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
} from 'firebase/firestore'
import { db } from '../services/firebase'
import { useAuth } from '../context/AuthContext'

function Events() {
  const { user } = useAuth()

  const [events, setEvents] = useState([])
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!user) return

    const eventsRef = collection(db, 'users', user.uid, 'events')
    const eventsQuery = query(eventsRef, orderBy('date', 'asc'))

    const unsubscribe = onSnapshot(eventsQuery, (snapshot) => {
      const eventsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))

      setEvents(eventsData)
    })

    return () => unsubscribe()
  }, [user])

  async function handleAddEvent(event) {
    event.preventDefault()

    if (!title || !date) {
      setError('Inserisci almeno titolo e data.')
      return
    }

    setError('')

    const eventsRef = collection(db, 'users', user.uid, 'events')

    await addDoc(eventsRef, {
      title,
      date,
      time,
      location,
      description,
      createdAt: serverTimestamp(),
    })

    setTitle('')
    setDate('')
    setTime('')
    setLocation('')
    setDescription('')
  }

  async function handleDeleteEvent(eventId) {
    const eventRef = doc(db, 'users', user.uid, 'events', eventId)
    await deleteDoc(eventRef)
  }

  return (
    <main className="dashboard-page">
      <section className="events-layout">
        <div className="events-header">
          <div>
            <h1>I miei eventi</h1>
            <p>Crea e gestisci eventi, scadenze e promemoria personali.</p>
          </div>

          <Link to="/dashboard" className="btn btn-secondary">
            Dashboard
          </Link>
        </div>

        <div className="events-grid">
          <form className="event-form" onSubmit={handleAddEvent}>
            <h2>Nuovo evento</h2>

            <label>
              Titolo
              <input
                type="text"
                placeholder="Es. Consegna progetto"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>

            <label>
              Data
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </label>

            <label>
              Ora
              <input
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
              />
            </label>

            <label>
              Luogo
              <input
                type="text"
                placeholder="Es. Online, Università, Casa..."
                value={location}
                onChange={(event) => setLocation(event.target.value)}
              />
            </label>

            <label>
              Descrizione
              <textarea
                placeholder="Aggiungi dettagli..."
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>

            {error && <p className="error-message">{error}</p>}

            <button type="submit" className="btn btn-primary">
              Salva evento
            </button>
          </form>

          <div className="events-list">
            <h2>Eventi salvati</h2>

            {events.length === 0 ? (
              <p className="empty-message">Non hai ancora eventi salvati.</p>
            ) : (
              events.map((event) => (
                <article className="event-card" key={event.id}>
                  <div>
                    <h3>{event.title}</h3>

                    <p>
                      {event.date}
                      {event.time && ` alle ${event.time}`}
                    </p>

                    {event.location && <p>📍 {event.location}</p>}
                    {event.description && <p>{event.description}</p>}
                  </div>

                  <button
                    className="btn btn-danger"
                    onClick={() => handleDeleteEvent(event.id)}
                  >
                    Elimina
                  </button>
                </article>
              ))
            )}
          </div>
        </div>
      </section>
    </main>
  )
}

export default Events