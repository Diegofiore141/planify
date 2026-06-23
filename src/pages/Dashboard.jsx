import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { signOut } from 'firebase/auth'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'

import { auth, db } from '../services/firebase'
import { useAuth } from '../context/AuthContext'

function getTodayDateKey() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function formatDateLabel(dateKey) {
  if (!dateKey) return 'Nessuna data'

  const date = new Date(`${dateKey}T00:00:00`)

  return date.toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function getUserFirstName(user) {
  const fullName = user?.displayName || user?.email?.split('@')[0] || 'utente'
  const firstName = fullName.split(' ')[0]

  return firstName
}

function getPriorityLabel(priority) {
  if (priority === 'alta') return 'Alta'
  if (priority === 'bassa') return 'Bassa'
  return 'Media'
}

function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [events, setEvents] = useState([])
  const [tasks, setTasks] = useState([])

  useEffect(() => {
    if (!user) return

    const eventsRef = collection(db, 'users', user.uid, 'events')
    const eventsQuery = query(eventsRef, orderBy('date', 'asc'))

    const unsubscribeEvents = onSnapshot(eventsQuery, (snapshot) => {
      const eventsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))

      setEvents(eventsData)
    })

    const tasksRef = collection(db, 'users', user.uid, 'tasks')

    const unsubscribeTasks = onSnapshot(tasksRef, (snapshot) => {
      const tasksData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))

      setTasks(tasksData)
    })

    return () => {
      unsubscribeEvents()
      unsubscribeTasks()
    }
  }, [user])

  const today = getTodayDateKey()

  const upcomingEvents = useMemo(() => {
    return events
      .filter((event) => event.date >= today)
      .sort((firstEvent, secondEvent) => {
        const firstDate = `${firstEvent.date}T${firstEvent.time || '00:00'}`
        const secondDate = `${secondEvent.date}T${secondEvent.time || '00:00'}`

        return firstDate.localeCompare(secondDate)
      })
  }, [events, today])

  const openTasks = useMemo(() => {
    return tasks.filter((task) => !task.completed)
  }, [tasks])

  const urgentTasks = useMemo(() => {
    return openTasks
      .filter((task) => task.dueDate)
      .sort((firstTask, secondTask) => {
        const firstDate = firstTask.dueDate || '9999-12-31'
        const secondDate = secondTask.dueDate || '9999-12-31'

        return firstDate.localeCompare(secondDate)
      })
      .slice(0, 4)
  }, [openTasks])

  const todayTasks = openTasks.filter((task) => task.dueDate === today)
  const overdueTasks = openTasks.filter(
    (task) => task.dueDate && task.dueDate < today
  )

  const nextEvent = upcomingEvents[0]
  const nextTask = urgentTasks[0]

  async function handleLogout() {
    await signOut(auth)
    navigate('/')
  }

  return (
    <main className="dashboard-page dashboard-clean-page">
      <section className="dashboard-clean">
        <div className="dashboard-clean-topbar">
          <div>
            <span className="dashboard-clean-kicker">Area personale</span>
            <h1>Ciao {getUserFirstName(user)} 👋</h1>
            <p>
              Gestisci eventi, attività, notifiche e calendario da un unico
              pannello.
            </p>
          </div>

          <button className="btn btn-secondary" onClick={handleLogout}>
            Esci dall’account
          </button>
        </div>

        <div className="dashboard-clean-main-grid">
          <section className="dashboard-clean-focus-card">
            <div className="dashboard-clean-focus-content">
              <span>Oggi su Planify</span>
              <h2>Organizza la giornata in pochi click.</h2>
              <p>
                Apri il calendario, esplora eventi pubblici oppure aggiungi un
                nuovo impegno personale.
              </p>

              <div className="dashboard-clean-focus-actions">
                <Link to="/calendar" className="btn btn-primary">
                  Apri agenda
                </Link>

                <Link to="/explore" className="btn btn-secondary">
                  Esplora eventi
                </Link>
              </div>
            </div>

            <div className="dashboard-clean-summary">
              <div>
                <span>Task oggi</span>
                <strong>{todayTasks.length}</strong>
              </div>

              <div>
                <span>Scadute</span>
                <strong>{overdueTasks.length}</strong>
              </div>
            </div>
          </section>

          <aside className="dashboard-clean-next-card">
            <span className="dashboard-clean-card-title">Prossimi impegni</span>

            <div className="dashboard-clean-next-item">
              <span>Prossimo evento</span>

              {nextEvent ? (
                <>
                  <strong>{nextEvent.title}</strong>
                  <p>
                    {formatDateLabel(nextEvent.date)}
                    {nextEvent.time && ` alle ${nextEvent.time}`}
                  </p>
                </>
              ) : (
                <>
                  <strong>Nessun evento imminente</strong>
                  <p>Quando creerai un evento, apparirà qui.</p>
                </>
              )}
            </div>

            <div className="dashboard-clean-next-item">
              <span>Prossima attività</span>

              {nextTask ? (
                <>
                  <strong>{nextTask.text}</strong>
                  <p>Scadenza: {formatDateLabel(nextTask.dueDate)}</p>
                </>
              ) : (
                <>
                  <strong>Nessuna attività urgente</strong>
                  <p>Le task con scadenza appariranno qui.</p>
                </>
              )}
            </div>
          </aside>
        </div>

        <section className="dashboard-clean-actions">
          <Link to="/calendar" className="dashboard-clean-action-card">
            <div className="dashboard-clean-action-icon blue">📅</div>
            <div>
              <strong>Agenda</strong>
              <p>Calendario interattivo con drag & drop.</p>
            </div>
          </Link>

          <Link
            to="/explore"
            className="dashboard-clean-action-card dashboard-clean-action-highlight"
          >
            <div className="dashboard-clean-action-icon green">🌍</div>
            <div>
              <strong>Esplora eventi</strong>
              <p>Trova eventi pubblici e aggiungili al calendario.</p>
            </div>
          </Link>

          <Link to="/events" className="dashboard-clean-action-card">
            <div className="dashboard-clean-action-icon purple">＋</div>
            <div>
              <strong>Eventi</strong>
              <p>Crea e gestisci i tuoi impegni.</p>
            </div>
          </Link>

          <Link to="/tasks" className="dashboard-clean-action-card">
            <div className="dashboard-clean-action-icon cyan">✓</div>
            <div>
              <strong>Attività</strong>
              <p>Task, priorità e scadenze.</p>
            </div>
          </Link>

          <Link to="/notifications" className="dashboard-clean-action-card">
            <div className="dashboard-clean-action-icon yellow">🔔</div>
            <div>
              <strong>Notifiche</strong>
              <p>Promemoria locali per gli eventi.</p>
            </div>
          </Link>
        </section>

        <section className="dashboard-clean-stats">
          <article>
            <span>Eventi</span>
            <strong>{events.length}</strong>
            <p>Totale salvati</p>
          </article>

          <article>
            <span>Attività</span>
            <strong>{tasks.length}</strong>
            <p>Totale create</p>
          </article>

          <article>
            <span>Da completare</span>
            <strong>{openTasks.length}</strong>
            <p>Task aperte</p>
          </article>

          <article className="dashboard-clean-stat-alert">
            <span>Urgenti</span>
            <strong>{todayTasks.length + overdueTasks.length}</strong>
            <p>Oggi o scadute</p>
          </article>
        </section>

        <section className="dashboard-clean-lists">
          <article className="dashboard-clean-panel">
            <div className="dashboard-clean-panel-header">
              <div>
                <h2>Eventi in arrivo</h2>
                <p>I prossimi impegni che hai pianificato.</p>
              </div>

              <Link to="/events">Vedi tutti</Link>
            </div>

            {upcomingEvents.length === 0 ? (
              <div className="dashboard-clean-empty">
                <strong>Nessun evento imminente</strong>
                <p>
                  Puoi creare un evento personale o aggiungerne uno pubblico da
                  Esplora eventi.
                </p>

                <div className="dashboard-clean-empty-actions">
                  <Link to="/events" className="btn btn-secondary">
                    Crea evento
                  </Link>

                  <Link to="/explore" className="btn btn-primary">
                    Esplora eventi
                  </Link>
                </div>
              </div>
            ) : (
              <div className="dashboard-clean-list">
                {upcomingEvents.slice(0, 4).map((event) => (
                  <div className="dashboard-clean-list-item" key={event.id}>
                    <div>
                      <strong>{event.title}</strong>
                      <p>
                        {formatDateLabel(event.date)}
                        {event.time && ` alle ${event.time}`}
                      </p>
                    </div>

                    {event.location && <span>{event.location}</span>}
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="dashboard-clean-panel">
            <div className="dashboard-clean-panel-header">
              <div>
                <h2>Attività urgenti</h2>
                <p>Le task aperte più vicine alla scadenza.</p>
              </div>

              <Link to="/tasks">Vedi tutte</Link>
            </div>

            {urgentTasks.length === 0 ? (
              <div className="dashboard-clean-empty">
                <strong>Nessuna attività urgente</strong>
                <p>Quando avrai task con scadenza, appariranno qui.</p>

                <Link to="/tasks" className="btn btn-secondary">
                  Vai alle attività
                </Link>
              </div>
            ) : (
              <div className="dashboard-clean-list">
                {urgentTasks.map((task) => (
                  <div className="dashboard-clean-list-item" key={task.id}>
                    <div>
                      <strong>{task.text}</strong>
                      <p>Scadenza: {formatDateLabel(task.dueDate)}</p>
                    </div>

                    <span className={`dashboard-clean-priority ${task.priority || 'media'}`}>
                      {getPriorityLabel(task.priority)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </article>
        </section>
      </section>
    </main>
  )
}

export default Dashboard