import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import { db } from '../services/firebase'
import { useAuth } from '../context/AuthContext'

function Tasks() {
  const { user } = useAuth()

  const [tasks, setTasks] = useState([])
  const [text, setText] = useState('')
  const [priority, setPriority] = useState('media')
  const [dueDate, setDueDate] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return

    const tasksRef = collection(db, 'users', user.uid, 'tasks')
    const tasksQuery = query(tasksRef, orderBy('createdAt', 'desc'))

    const unsubscribe = onSnapshot(tasksQuery, (snapshot) => {
      const tasksData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))

      setTasks(tasksData)
    })

    return () => unsubscribe()
  }, [user])

  async function handleAddTask(event) {
    event.preventDefault()

    if (!text) {
      setError('Inserisci il testo dell’attività.')
      return
    }

    setError('')

    const tasksRef = collection(db, 'users', user.uid, 'tasks')

    await addDoc(tasksRef, {
      text,
      priority,
      dueDate,
      completed: false,
      createdAt: serverTimestamp(),
    })

    setText('')
    setPriority('media')
    setDueDate('')
  }

  async function handleToggleTask(task) {
    const taskRef = doc(db, 'users', user.uid, 'tasks', task.id)

    await updateDoc(taskRef, {
      completed: !task.completed,
    })
  }

  async function handleDeleteTask(taskId) {
    const taskRef = doc(db, 'users', user.uid, 'tasks', taskId)
    await deleteDoc(taskRef)
  }

  return (
    <main className="dashboard-page">
      <section className="tasks-layout">
        <div className="tasks-header">
          <div>
            <h1>Le mie attività</h1>
            <p>Crea e organizza attività personali, priorità e scadenze.</p>
          </div>

          <Link to="/dashboard" className="btn btn-secondary">
            Dashboard
          </Link>
        </div>

        <div className="tasks-grid">
          <form className="task-form" onSubmit={handleAddTask}>
            <h2>Nuova attività</h2>

            <label>
              Attività
              <input
                type="text"
                placeholder="Es. Studiare Firebase"
                value={text}
                onChange={(event) => setText(event.target.value)}
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

            <label>
              Scadenza
              <input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </label>

            {error && <p className="error-message">{error}</p>}

            <button type="submit" className="btn btn-primary">
              Salva attività
            </button>
          </form>

          <div className="tasks-list">
            <h2>Attività salvate</h2>

            {tasks.length === 0 ? (
              <p className="empty-message">Non hai ancora attività salvate.</p>
            ) : (
              tasks.map((task) => (
                <article
                  className={task.completed ? 'task-item completed-task' : 'task-item'}
                  key={task.id}
                >
                  <div>
                    <h3>{task.text}</h3>

                    <p>Priorità: {task.priority}</p>

                    {task.dueDate && <p>Scadenza: {task.dueDate}</p>}

                    <p>
                      Stato:{' '}
                      {task.completed ? 'Completata' : 'Da completare'}
                    </p>
                  </div>

                  <div className="task-actions">
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleToggleTask(task)}
                    >
                      {task.completed ? 'Riapri' : 'Completa'}
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