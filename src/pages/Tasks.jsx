import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'

import { db } from '../services/firebase'
import { useAuth } from '../context/AuthContext'

function getPriorityLabel(priority) {
  if (priority === 'alta') return 'Alta'
  if (priority === 'bassa') return 'Bassa'
  return 'Media'
}

function getPriorityWeight(priority) {
  if (priority === 'alta') return 1
  if (priority === 'media') return 2
  return 3
}

function Tasks() {
  const { user } = useAuth()

  const [tasks, setTasks] = useState([])
  const [text, setText] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState('media')
  const [filter, setFilter] = useState('open')
  const [editTaskId, setEditTaskId] = useState(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!user) return

    const tasksRef = collection(db, 'users', user.uid, 'tasks')

    const unsubscribe = onSnapshot(tasksRef, (snapshot) => {
      const tasksData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))

      setTasks(tasksData)
    })

    return () => unsubscribe()
  }, [user])

  const visibleTasks = useMemo(() => {
    return tasks
      .filter((task) => {
        if (filter === 'open') return !task.completed
        if (filter === 'completed') return task.completed
        return true
      })
      .sort((firstTask, secondTask) => {
        const firstDate = firstTask.dueDate || '9999-12-31'
        const secondDate = secondTask.dueDate || '9999-12-31'

        if (firstDate !== secondDate) {
          return firstDate.localeCompare(secondDate)
        }

        return getPriorityWeight(firstTask.priority) - getPriorityWeight(secondTask.priority)
      })
  }, [tasks, filter])

  const completedTasks = tasks.filter((task) => task.completed)
  const openTasks = tasks.filter((task) => !task.completed)
  const highPriorityTasks = openTasks.filter((task) => task.priority === 'alta')

  function resetForm() {
    setText('')
    setDueDate('')
    setPriority('media')
    setEditTaskId(null)
    setError('')
  }

  async function handleSaveTask(event) {
    event.preventDefault()

    if (!text.trim()) {
      setError('Inserisci il nome dell’attività.')
      return
    }

    setError('')
    setMessage('')

    if (editTaskId) {
      const taskRef = doc(db, 'users', user.uid, 'tasks', editTaskId)

      await updateDoc(taskRef, {
        text: text.trim(),
        dueDate,
        priority,
      })

      setMessage('Attività aggiornata correttamente.')
      resetForm()
      return
    }

    const tasksRef = collection(db, 'users', user.uid, 'tasks')

    await addDoc(tasksRef, {
      text: text.trim(),
      dueDate,
      priority,
      completed: false,
      createdAt: serverTimestamp(),
    })

    setMessage('Attività creata correttamente.')
    resetForm()
  }

  function handleStartEdit(task) {
    setEditTaskId(task.id)
    setText(task.text || '')
    setDueDate(task.dueDate || '')
    setPriority(task.priority || 'media')
    setError('')
    setMessage('')
  }

  async function handleToggleCompleted(task) {
    const taskRef = doc(db, 'users', user.uid, 'tasks', task.id)

    await updateDoc(taskRef, {
      completed: !task.completed,
    })

    setMessage(
      task.completed
        ? 'Attività riaperta.'
        : 'Attività completata.'
    )
  }

  async function handleDeleteTask(taskId) {
    const taskRef = doc(db, 'users', user.uid, 'tasks', taskId)

    await deleteDoc(taskRef)

    if (editTaskId === taskId) {
      resetForm()
    }

    setMessage('Attività eliminata.')
  }

  return (
    <main className="dashboard-page">
      <section className="tasks-layout improved-tasks-layout">
        <div className="tasks-header">
          <div>
            <h1>Attività</h1>
            <p>
              Organizza le cose da fare, assegna priorità e controlla le
              scadenze.
            </p>
          </div>

          <div className="tasks-header-actions">
            <Link to="/calendar" className="btn btn-primary">
              Calendario
            </Link>

            <Link to="/dashboard" className="btn btn-secondary">
              Dashboard
            </Link>
          </div>
        </div>

        <div className="tasks-summary-grid">
          <article className="tasks-summary-card">
            <span>Totali</span>
            <strong>{tasks.length}</strong>
          </article>

          <article className="tasks-summary-card">
            <span>Da completare</span>
            <strong>{openTasks.length}</strong>
          </article>

          <article className="tasks-summary-card">
            <span>Completate</span>
            <strong>{completedTasks.length}</strong>
          </article>

          <article className="tasks-summary-card high-summary">
            <span>Priorità alta</span>
            <strong>{highPriorityTasks.length}</strong>
          </article>
        </div>

        <div className="tasks-grid improved-tasks-grid">
          <form className="task-form improved-task-form" onSubmit={handleSaveTask}>
            <h2>{editTaskId ? 'Modifica attività' : 'Nuova attività'}</h2>

            <label>
              Attività
              <input
                type="text"
                placeholder="Es. Finire progetto"
                value={text}
                onChange={(event) => setText(event.target.value)}
              />
            </label>

            <label>
              Scadenza
              <input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </label>

            <label>
              Priorità
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value)}
              >
                <option value="bassa">Bassa</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
              </select>
            </label>

            {error && <p className="error-message">{error}</p>}
            {message && <p className="tasks-success-message">{message}</p>}

            <button type="submit" className="btn btn-primary">
              {editTaskId ? 'Aggiorna attività' : 'Salva attività'}
            </button>

            {editTaskId && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={resetForm}
              >
                Annulla modifica
              </button>
            )}
          </form>

          <div className="tasks-list improved-tasks-list">
            <div className="tasks-list-top">
              <h2>Le tue attività</h2>

              <div className="tasks-filter-group">
                <button
                  className={filter === 'all' ? 'task-filter active' : 'task-filter'}
                  onClick={() => setFilter('all')}
                >
                  Tutte
                </button>

                <button
                  className={filter === 'open' ? 'task-filter active' : 'task-filter'}
                  onClick={() => setFilter('open')}
                >
                  Da fare
                </button>

                <button
                  className={
                    filter === 'completed' ? 'task-filter active' : 'task-filter'
                  }
                  onClick={() => setFilter('completed')}
                >
                  Completate
                </button>
              </div>
            </div>

            {visibleTasks.length === 0 ? (
              <p className="empty-message">
                Non ci sono attività in questa sezione.
              </p>
            ) : (
              visibleTasks.map((task) => (
                <article
                  className={
                    task.completed
                      ? 'task-item improved-task-item completed-task'
                      : 'task-item improved-task-item'
                  }
                  key={task.id}
                >
                  <div className="task-main-content">
                    <div className="task-title-row">
                      <h3>{task.text}</h3>

                      <span className={`priority-badge ${task.priority || 'media'}`}>
                        {getPriorityLabel(task.priority)}
                      </span>
                    </div>

                    <div className="task-meta-row">
                      <span>
                        {task.dueDate
                          ? `Scadenza: ${task.dueDate}`
                          : 'Nessuna scadenza'}
                      </span>

                      <span>
                        Stato:{' '}
                        {task.completed ? 'Completata' : 'Da completare'}
                      </span>
                    </div>
                  </div>

                  <div className="task-actions">
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleToggleCompleted(task)}
                    >
                      {task.completed ? 'Riapri' : 'Completa'}
                    </button>

                    <button
                      className="btn btn-secondary"
                      onClick={() => handleStartEdit(task)}
                    >
                      Modifica
                    </button>

                    <button
                      className="btn btn-danger"
                      onClick={() => handleDeleteTask(task.id)}
                    >
                      Elimina
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>
      </section>
    </main>
  )
}

export default Tasks