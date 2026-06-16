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
import { getWeatherForCity } from '../services/weather'

function Events() {
  const { user } = useAuth()

  const [events, setEvents] = useState([])
  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')

  const [editEventId, setEditEventId] = useState(null)

  const [weatherByEvent, setWeatherByEvent] = useState({})
  const [weatherLoading, setWeatherLoading] = useState('')
  const [weatherError, setWeatherError] = useState('')

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

  function resetForm() {
    setTitle('')
    setDate('')
    setTime('')
    setLocation('')
    setDescription('')
    setEditEventId(null)
    setError('')
  }

  async function handleSaveEvent(event) {
    event.preventDefault()

    if (!title || !date) {
      setError('Inserisci almeno titolo e data.')
      return
    }

    setError('')

    if (editEventId) {
      const eventRef = doc(db, 'users', user.uid, 'events', editEventId)

      await updateDoc(eventRef, {
        title,
        date,
        time,
        location,
        description,
      })

      setWeatherByEvent((previousWeather) => {
        const updatedWeather = { ...previousWeather }
        delete updatedWeather[editEventId]
        return updatedWeather
      })

      resetForm()
      return
    }

    const eventsRef = collection(db, 'users', user.uid, 'events')

    await addDoc(eventsRef, {
      title,
      date,
      time,
      location,
      description,
      createdAt: serverTimestamp(),
    })

    resetForm()
  }

  function handleStartEdit(eventItem) {
    setEditEventId(eventItem.id)
    setTitle(eventItem.title || '')
    setDate(eventItem.date || '')
    setTime(eventItem.time || '')
    setLocation(eventItem.location || '')
    setDescription(eventItem.description || '')
    setError('')
    setWeatherError('')
  }

  async function handleDeleteEvent(eventId) {
    const eventRef = doc(db, 'users', user.uid, 'events', eventId)
    await deleteDoc(eventRef)

    setWeatherByEvent((previousWeather) => {
      const updatedWeather = { ...previousWeather }
      delete updatedWeather[eventId]
      return updatedWeather
    })

    if (editEventId === eventId) {
      resetForm()
    }
  }

  async function handleShowWeather(eventItem) {
    if (!eventItem.location) {
      setWeatherError('Inserisci un luogo per vedere il meteo.')
      return
    }

    if (!eventItem.date || !eventItem.time) {
      setWeatherError('Inserisci data e ora per vedere il meteo previsto.')
      return
    }

    setWeatherError('')
    setWeatherLoading(eventItem.id)

    setWeatherByEvent((previousWeather) => {
      const updatedWeather = { ...previousWeather }
      delete updatedWeather[eventItem.id]
      return updatedWeather
    })

    try {
      const weather = await getWeatherForCity(
        eventItem.location,
        eventItem.date,
        eventItem.time
      )

      setWeatherByEvent((previousWeather) => ({
        ...previousWeather,
        [eventItem.id]: weather,
      }))
    } catch (error) {
      console.error(error)
      setWeatherError('Meteo non disponibile per questo luogo, data o ora.')
    } finally {
      setWeatherLoading('')
    }
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
          <form className="event-form" onSubmit={handleSaveEvent}>
            <h2>{editEventId ? 'Modifica evento' : 'Nuovo evento'}</h2>

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
                placeholder="Es. Pisa, Firenze, Forcoli..."
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
              {editEventId ? 'Aggiorna evento' : 'Salva evento'}
            </button>

            {editEventId && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={resetForm}
              >
                Annulla modifica
              </button>
            )}
          </form>

          <div className="events-list">
            <h2>Eventi salvati</h2>

            {weatherError && <p className="error-message">{weatherError}</p>}

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

                    {weatherByEvent[event.id] && (
                      <div className="weather-box">
                        <strong>
                          Meteo a {weatherByEvent[event.id].city} ({event.time})
                        </strong>

                        <p>
                          {weatherByEvent[event.id].temperature}°C -{' '}
                          {weatherByEvent[event.id].description}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="event-actions">
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleStartEdit(event)}
                    >
                      Modifica
                    </button>

                    <button
                      className="btn btn-secondary"
                      onClick={() => handleShowWeather(event)}
                    >
                      {weatherLoading === event.id
                        ? 'Caricamento...'
                        : 'Vedi meteo'}
                    </button>

                    <button
                      className="btn btn-danger"
                      onClick={() => handleDeleteEvent(event.id)}
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

export default Events