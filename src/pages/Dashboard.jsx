import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { signOut } from 'firebase/auth'
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore'

import { auth, db } from '../services/firebase'
import { useAuth } from '../context/AuthContext'
import logo from '../assets/logo.png'

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

function formatTimestampLabel(timestamp) {
  if (!timestamp?.toDate) return 'Non ancora salvata'

  return timestamp.toDate().toLocaleDateString('it-IT', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function getUserFirstName(user) {
  const fullName = user?.displayName || user?.email?.split('@')[0] || 'utente'
  return fullName.split(' ')[0]
}

function getPriorityLabel(priority) {
  if (priority === 'alta') return 'Alta'
  if (priority === 'bassa') return 'Bassa'
  return 'Media'
}

function getNoteTitle(note) {
  if (note.title?.trim()) return note.title.trim()
  return 'Nota senza titolo'
}

function getNotePreview(note) {
  if (note.plainText?.trim()) return note.plainText.trim()
  return 'Nessun contenuto'
}

function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [events, setEvents] = useState([])
  const [tasks, setTasks] = useState([])
  const [notes, setNotes] = useState([])

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

    const notesRef = collection(db, 'users', user.uid, 'notes')
    const notesQuery = query(notesRef, orderBy('updatedAt', 'desc'))

    const unsubscribeNotes = onSnapshot(notesQuery, (snapshot) => {
      const notesData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))

      setNotes(notesData)
    })

    return () => {
      unsubscribeEvents()
      unsubscribeTasks()
      unsubscribeNotes()
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

  const recentNotes = useMemo(() => {
    return notes.slice(0, 4)
  }, [notes])

  const todayTasks = openTasks.filter((task) => task.dueDate === today)
  const overdueTasks = openTasks.filter(
    (task) => task.dueDate && task.dueDate < today
  )

  const nextEvent = upcomingEvents[0]
  const nextTask = urgentTasks[0]
  const lastNote = recentNotes[0]

  async function handleLogout() {
    await signOut(auth)
    navigate('/')
  }

  return (
    <main className="dashboard-page dashboard-pro-page">
      <section className="dashboard-pro">
        <nav className="dashboard-pro-navbar">
          <Link to="/" className="dashboard-pro-brand">
            <img src={logo} alt="Planify" />
            <div>
              <strong>Planify</strong>
              <span>Area personale</span>
            </div>
          </Link>

          <div className="dashboard-pro-navbar-links">
            <Link to="/calendar">Agenda</Link>
            <Link to="/notes">Note</Link>
            <Link to="/explore">Esplora</Link>
            <Link to="/tasks">Attività</Link>
          </div>

          <button className="btn btn-secondary" onClick={handleLogout}>
            Esci
          </button>
        </nav>

        <header className="dashboard-pro-header">
          <div>
            <span className="dashboard-pro-kicker">Bentornato</span>
            <h1>Ciao {getUserFirstName(user)} 👋</h1>
            <p>
              Gestisci agenda, eventi, note e attività da un unico spazio
              personale.
            </p>
          </div>
        </header>

        <section className="dashboard-pro-hero-grid">
          <article className="dashboard-pro-hero-card">
            <div className="dashboard-pro-hero-content">
              <span>Oggi su Planify</span>
              <h2>Organizza tutto senza perdere il filo.</h2>
              <p>
                Controlla gli impegni importanti, scrivi appunti veloci e tieni
                sotto controllo le attività della giornata.
              </p>

              <div className="dashboard-pro-hero-actions">
                <Link to="/calendar" className="btn btn-primary">
                  Apri agenda
                </Link>

                <Link to="/notes" className="btn btn-secondary">
                  Scrivi una nota
                </Link>
              </div>
            </div>

            <div className="dashboard-pro-hero-metrics">
              <div>
                <span>Task oggi</span>
                <strong>{todayTasks.length}</strong>
              </div>

              <div>
                <span>Note salvate</span>
                <strong>{notes.length}</strong>
              </div>

              <div className={overdueTasks.length > 0 ? 'danger' : ''}>
                <span>Scadute</span>
                <strong>{overdueTasks.length}</strong>
              </div>
            </div>
          </article>

          <aside className="dashboard-pro-side-card">
            <div className="dashboard-pro-side-header">
              <span>In primo piano</span>
              <strong>{formatDateLabel(today)}</strong>
            </div>

            <div className="dashboard-pro-side-list">
              <div className="dashboard-pro-side-item">
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

              <div className="dashboard-pro-side-item">
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

              <div className="dashboard-pro-side-item">
                <span>Ultima nota</span>

                {lastNote ? (
                  <>
                    <strong>{getNoteTitle(lastNote)}</strong>
                    <p>{getNotePreview(lastNote).slice(0, 70)}</p>
                  </>
                ) : (
                  <>
                    <strong>Nessuna nota salvata</strong>
                    <p>Scrivi appunti veloci dalla pagina Note.</p>
                  </>
                )}
              </div>
            </div>
          </aside>
        </section>

        <section className="dashboard-pro-actions dashboard-pro-actions-premium">
          <Link to="/calendar" className="dashboard-pro-action-card">
            <div className="dashboard-pro-action-icon agenda">📅</div>
            <div>
              <strong>Agenda</strong>
              <p>Calendario con eventi, attività e festività.</p>
            </div>
          </Link>

          <Link to="/notes" className="dashboard-pro-action-card featured">
            <div className="dashboard-pro-action-icon notes">📝</div>
            <div>
              <strong>Note istantanee</strong>
              <p>Editor avanzato per appunti e promemoria.</p>
            </div>
          </Link>

          <Link to="/explore" className="dashboard-pro-action-card">
            <div className="dashboard-pro-action-icon explore">🌍</div>
            <div>
              <strong>Esplora eventi</strong>
              <p>Scopri eventi pubblici da aggiungere.</p>
            </div>
          </Link>

          <Link to="/events" className="dashboard-pro-action-card">
            <div className="dashboard-pro-action-icon events">＋</div>
            <div>
              <strong>Eventi</strong>
              <p>Crea impegni privati o pubblici.</p>
            </div>
          </Link>

          <Link to="/tasks" className="dashboard-pro-action-card">
            <div className="dashboard-pro-action-icon tasks">✓</div>
            <div>
              <strong>Attività</strong>
              <p>Task, priorità e scadenze.</p>
            </div>
          </Link>

          <Link to="/notifications" className="dashboard-pro-action-card">
            <div className="dashboard-pro-action-icon notifications">🔔</div>
            <div>
              <strong>Notifiche</strong>
              <p>Promemoria locali per gli eventi.</p>
            </div>
          </Link>
        </section>

        <section className="dashboard-pro-stats">
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
            <span>Note</span>
            <strong>{notes.length}</strong>
            <p>Appunti salvati</p>
          </article>

          <article>
            <span>Aperte</span>
            <strong>{openTasks.length}</strong>
            <p>Task da completare</p>
          </article>

          <article className="danger">
            <span>Urgenti</span>
            <strong>{todayTasks.length + overdueTasks.length}</strong>
            <p>Oggi o scadute</p>
          </article>
        </section>

        <section className="dashboard-pro-panels">
          <article className="dashboard-pro-panel">
            <div className="dashboard-pro-panel-header">
              <div>
                <h2>Eventi in arrivo</h2>
                <p>I prossimi impegni pianificati.</p>
              </div>

              <Link to="/events">Vedi tutti</Link>
            </div>

            {upcomingEvents.length === 0 ? (
              <div className="dashboard-pro-empty">
                <strong>Nessun evento imminente</strong>
                <p>
                  Crea un evento personale o aggiungine uno pubblico da Esplora.
                </p>

                <div className="dashboard-pro-empty-actions">
                  <Link to="/events" className="btn btn-secondary">
                    Crea evento
                  </Link>

                  <Link to="/explore" className="btn btn-primary">
                    Esplora
                  </Link>
                </div>
              </div>
            ) : (
              <div className="dashboard-pro-list">
                {upcomingEvents.slice(0, 4).map((event) => (
                  <div className="dashboard-pro-list-item" key={event.id}>
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

          <article className="dashboard-pro-panel">
            <div className="dashboard-pro-panel-header">
              <div>
                <h2>Attività urgenti</h2>
                <p>Le task aperte più vicine alla scadenza.</p>
              </div>

              <Link to="/tasks">Vedi tutte</Link>
            </div>

            {urgentTasks.length === 0 ? (
              <div className="dashboard-pro-empty">
                <strong>Nessuna attività urgente</strong>
                <p>Quando avrai task con scadenza, appariranno qui.</p>

                <Link to="/tasks" className="btn btn-secondary">
                  Vai alle attività
                </Link>
              </div>
            ) : (
              <div className="dashboard-pro-list">
                {urgentTasks.map((task) => (
                  <div className="dashboard-pro-list-item" key={task.id}>
                    <div>
                      <strong>{task.text}</strong>
                      <p>Scadenza: {formatDateLabel(task.dueDate)}</p>
                    </div>

                    <span
                      className={`dashboard-pro-priority ${
                        task.priority || 'media'
                      }`}
                    >
                      {getPriorityLabel(task.priority)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="dashboard-pro-panel notes-panel">
            <div className="dashboard-pro-panel-header">
              <div>
                <h2>Note recenti</h2>
                <p>Gli ultimi appunti salvati nel tuo spazio personale.</p>
              </div>

              <Link to="/notes">Apri note</Link>
            </div>

            {recentNotes.length === 0 ? (
              <div className="dashboard-pro-empty">
                <strong>Nessuna nota recente</strong>
                <p>
                  Usa le note istantanee per idee, promemoria e appunti veloci.
                </p>

                <Link to="/notes" className="btn btn-primary">
                  Crea una nota
                </Link>
              </div>
            ) : (
              <div className="dashboard-pro-list">
                {recentNotes.map((note) => (
                  <div className="dashboard-pro-list-item" key={note.id}>
                    <div>
                      <strong>{getNoteTitle(note)}</strong>
                      <p>{getNotePreview(note).slice(0, 95)}</p>
                    </div>

                    <span>{formatTimestampLabel(note.updatedAt)}</span>
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