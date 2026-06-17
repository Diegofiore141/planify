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

  const upcomingEvents = useMemo(() => {
    const today = getTodayDateKey()

    return events
      .filter((event) => event.date >= today)
      .sort((firstEvent, secondEvent) => {
        const firstDate = `${firstEvent.date}T${firstEvent.time || '00:00'}`
        const secondDate = `${secondEvent.date}T${secondEvent.time || '00:00'}`

        return firstDate.localeCompare(secondDate)
      })
      .slice(0, 3)
  }, [events])

  const upcomingTasks = useMemo(() => {
    const today = getTodayDateKey()

    return tasks
      .filter((task) => task.dueDate >= today && !task.completed)
      .sort((firstTask, secondTask) => {
        return firstTask.dueDate.localeCompare(secondTask.dueDate)
      })
      .slice(0, 3)
  }, [tasks])

  async function handleLogout() {
    await signOut(auth)
    navigate('/')
  }

  return (
    <main className="dashboard-page">
      <section className="dashboard-overview">
        <div className="dashboard-welcome-card">
          <div>
            <span className="dashboard-badge">Area personale</span>

            <h1>Dashboard</h1>

            <p>
              Benvenuto {user?.displayName || user?.email || 'utente'}.
              Da qui puoi gestire eventi, attività, calendario e notifiche.
            </p>
          </div>

          <button className="btn btn-primary" onClick={handleLogout}>
            Esci
          </button>
        </div>

        <div className="dashboard-stats-grid">
          <article className="dashboard-stat-card">
            <span>Eventi salvati</span>
            <strong>{events.length}</strong>
          </article>

          <article className="dashboard-stat-card">
            <span>Attività totali</span>
            <strong>{tasks.length}</strong>
          </article>

          <article className="dashboard-stat-card">
            <span>Attività da completare</span>
            <strong>{tasks.filter((task) => !task.completed).length}</strong>
          </article>
        </div>

        <div className="dashboard-content-grid">
          <article className="dashboard-panel">
            <div className="dashboard-panel-header">
              <h2>Prossimi eventi</h2>

              <Link to="/events">Vedi eventi</Link>
            </div>

            {upcomingEvents.length === 0 ? (
              <p className="dashboard-empty-text">
                Non hai eventi imminenti.
              </p>
            ) : (
              <div className="dashboard-mini-list">
                {upcomingEvents.map((event) => (
                  <div className="dashboard-mini-item" key={event.id}>
                    <div>
                      <strong>{event.title}</strong>
                      <p>
                        {event.date}
                        {event.time && ` alle ${event.time}`}
                      </p>
                    </div>

                    {event.location && <span>{event.location}</span>}
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className="dashboard-panel">
            <div className="dashboard-panel-header">
              <h2>Attività in scadenza</h2>

              <Link to="/tasks">Vedi attività</Link>
            </div>

            {upcomingTasks.length === 0 ? (
              <p className="dashboard-empty-text">
                Non hai attività imminenti da completare.
              </p>
            ) : (
              <div className="dashboard-mini-list">
                {upcomingTasks.map((task) => (
                  <div className="dashboard-mini-item" key={task.id}>
                    <div>
                      <strong>{task.text}</strong>
                      <p>Scadenza: {task.dueDate}</p>
                    </div>

                    <span className={`dashboard-priority ${task.priority}`}>
                      {task.priority}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </article>
        </div>

        <div className="dashboard-actions-card">
          <h2>Azioni rapide</h2>

          <div className="dashboard-actions">
            <Link to="/events" className="btn btn-primary">
              Gestisci eventi
            </Link>

            <Link to="/tasks" className="btn btn-primary">
              Gestisci attività
            </Link>

            <Link to="/calendar" className="btn btn-primary">
              Calendario
            </Link>

            <Link to="/notifications" className="btn btn-primary">
              Notifiche
            </Link>

            <Link to="/" className="btn btn-secondary">
              Torna alla home
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}

export default Dashboard