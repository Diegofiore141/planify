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
    <main className="dashboard-page">
      <section className="dashboard-v3">
        <div className="dashboard-v3-hero">
          <div className="dashboard-v3-welcome compact-welcome-card">
            <span className="dashboard-v3-badge">Area personale</span>

            <h1>Ciao {getUserFirstName(user)} 👋</h1>

            <p>
              Organizza la tua giornata da un unico posto: eventi, attività,
              notifiche e calendario sono sempre a portata di mano.
            </p>

            <div className="dashboard-v3-hero-actions">
              <Link to="/calendar" className="btn btn-primary">
                Organizza la giornata
              </Link>

              <button className="btn btn-secondary" onClick={handleLogout}>
                Esci dall’account
              </button>
            </div>
          </div>

          <div className="dashboard-v3-today-card">
            <span className="dashboard-v3-card-label">Riepilogo di oggi</span>

            <div className="dashboard-v3-today-grid">
              <div className="dashboard-v3-mini-info">
                <span>Task oggi</span>
                <strong>{todayTasks.length}</strong>
              </div>

              <div className="dashboard-v3-mini-info">
                <span>Scadute</span>
                <strong>{overdueTasks.length}</strong>
              </div>
            </div>

            <div className="dashboard-v3-focus-box">
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
                  <p>Quando creerai un evento, lo vedrai qui.</p>
                </>
              )}
            </div>

            <div className="dashboard-v3-focus-box">
              <span>Prossima attività</span>
              {nextTask ? (
                <>
                  <strong>{nextTask.text}</strong>
                  <p>Scadenza: {formatDateLabel(nextTask.dueDate)}</p>
                </>
              ) : (
                <>
                  <strong>Nessuna attività urgente</strong>
                  <p>Le tue task aperte appariranno qui.</p>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="dashboard-v3-actions-grid">
          <Link to="/calendar" className="dashboard-v3-action-card featured-action-card">
            <div className="dashboard-v3-action-icon">📅</div>
            <div>
              <strong>Agenda interattiva</strong>
              <p>Crea, sposta e modifica eventi e attività.</p>
            </div>
          </Link>

          <Link to="/events" className="dashboard-v3-action-card">
            <div className="dashboard-v3-action-icon">＋</div>
            <div>
              <strong>Nuovo evento</strong>
              <p>Aggiungi un impegno con data, ora e meteo.</p>
            </div>
          </Link>

          <Link to="/tasks" className="dashboard-v3-action-card">
            <div className="dashboard-v3-action-icon">✓</div>
            <div>
              <strong>Nuova attività</strong>
              <p>Gestisci task, priorità e scadenze.</p>
            </div>
          </Link>

          <Link to="/notifications" className="dashboard-v3-action-card">
            <div className="dashboard-v3-action-icon">🔔</div>
            <div>
              <strong>Promemoria</strong>
              <p>Controlla notifiche e avvisi degli eventi.</p>
            </div>
          </Link>
        </div>

        <div className="dashboard-v3-stats-grid">
          <article className="dashboard-v3-stat-card">
            <span>Eventi</span>
            <strong>{events.length}</strong>
            <p>Totale eventi salvati</p>
          </article>

          <article className="dashboard-v3-stat-card">
            <span>Attività</span>
            <strong>{tasks.length}</strong>
            <p>Totale attività create</p>
          </article>

          <article className="dashboard-v3-stat-card">
            <span>Da completare</span>
            <strong>{openTasks.length}</strong>
            <p>Task ancora aperte</p>
          </article>

          <article className="dashboard-v3-stat-card dashboard-v3-stat-alert">
            <span>Urgenti</span>
            <strong>{todayTasks.length + overdueTasks.length}</strong>
            <p>Tra oggi e attività scadute</p>
          </article>
        </div>

        <div className="dashboard-v3-content-grid">
          <article className="dashboard-v3-panel">
            <div className="dashboard-v3-panel-header">
              <div>
                <h2>Eventi in arrivo</h2>
                <p>I prossimi impegni che hai pianificato.</p>
              </div>

              <Link to="/events">Vedi tutti</Link>
            </div>

            {upcomingEvents.length === 0 ? (
              <div className="dashboard-v3-empty">
                <strong>Nessun evento imminente</strong>
                <p>Puoi creare un evento dalla sezione Eventi o dal calendario.</p>
                <Link to="/events" className="btn btn-secondary">
                  Vai agli eventi
                </Link>
              </div>
            ) : (
              <div className="dashboard-v3-list">
                {upcomingEvents.slice(0, 4).map((event) => (
                  <div className="dashboard-v3-list-item" key={event.id}>
                    <div>
                      <strong>{event.title}</strong>
                      <p>
                        {formatDateLabel(event.date)}
                        {event.time && ` alle ${event.time}`}
                      </p>
                    </div>

                    {event.location && (
                      <span className="dashboard-v3-pill">{event.location}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="dashboard-v3-panel">
            <div className="dashboard-v3-panel-header">
              <div>
                <h2>Attività urgenti</h2>
                <p>Le task aperte più vicine alla scadenza.</p>
              </div>

              <Link to="/tasks">Vedi tutte</Link>
            </div>

            {urgentTasks.length === 0 ? (
              <div className="dashboard-v3-empty">
                <strong>Nessuna attività urgente</strong>
                <p>Quando avrai task con scadenza, appariranno qui.</p>
                <Link to="/tasks" className="btn btn-secondary">
                  Vai alle attività
                </Link>
              </div>
            ) : (
              <div className="dashboard-v3-list">
                {urgentTasks.map((task) => (
                  <div className="dashboard-v3-list-item" key={task.id}>
                    <div>
                      <strong>{task.text}</strong>
                      <p>Scadenza: {formatDateLabel(task.dueDate)}</p>
                    </div>

                    <span className={`dashboard-v3-priority ${task.priority || 'media'}`}>
                      {getPriorityLabel(task.priority)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </article>
        </div>
      </section>
    </main>
  )
}

export default Dashboard