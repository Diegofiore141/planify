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
import {
  getNotificationPermission,
  requestNotificationPermission,
  scheduleEventNotification,
} from '../services/notifications'

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

  const [reminderByEvent, setReminderByEvent] = useState({})
  const [scheduledReminders, setScheduledReminders] = useState({})
  const [reminderError, setReminderError] = useState('')

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

  function clearEventWeather(eventId) {
    setWeatherByEvent((previousWeather) => {
      const updatedWeather = { ...previousWeather }
      delete updatedWeather[eventId]
      return updatedWeather
    })
  }

  function clearEventReminder(eventId) {
    if (scheduledReminders[eventId]) {
      clearTimeout(scheduledReminders[eventId])
    }

    setScheduledReminders((previousReminders) => {
      const updatedReminders = { ...previousReminders }
      delete updatedReminders[eventId]
      return updatedReminders
    })

    setReminderByEvent((previousMessages) => {
      const updatedMessages = { ...previousMessages }
      delete updatedMessages[eventId]
      return updatedMessages
    })
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

      clearEventWeather(editEventId)
      clearEventReminder(editEventId)

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
    setReminderError('')
  }

  async function handleDeleteEvent(eventId) {
    const eventRef = doc(db, 'users', user.uid, 'events', eventId)
    await deleteDoc(eventRef)

    clearEventWeather(eventId)
    clearEventReminder(eventId)

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

    clearEventWeather(eventItem.id)

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

  async function handleScheduleReminder(eventItem) {
    setReminderError('')

    if (!eventItem.date || !eventItem.time) {
      setReminderError('Inserisci data e ora per attivare il promemoria.')
      return
    }

    try {
      let permission = getNotificationPermission()

      if (permission !== 'granted') {
        permission = await requestNotificationPermission()
      }

      if (permission !== 'granted') {
        setReminderError(
          'Devi consentire le notifiche per attivare un promemoria.'
        )
        return
      }

      if (scheduledReminders[eventItem.id]) {
        clearTimeout(scheduledReminders[eventItem.id])
      }

      const timeoutId = scheduleEventNotification(eventItem)

      setScheduledReminders((previousReminders) => ({
        ...previousReminders,
        [eventItem.id]: timeoutId,
      }))

      setReminderByEvent((previousMessages) => ({
        ...previousMessages,
        [eventItem.id]: `Promemoria attivo per le ${eventItem.time}`,
      }))
    } catch (error) {
      console.error(error)
      setReminderError(
        'Promemoria non attivato. Controlla che data e ora siano future.'
      )
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
            {reminderError && <p className="error-message">{reminderError}</p>}

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

                    {reminderByEvent[event.id] && (
                      <div className="reminder-box">
                        <strong>🔔 Promemoria</strong>
                        <p>{reminderByEvent[event.id]}</p>
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
                      className="btn btn-secondary"
                      onClick={() => handleScheduleReminder(event)}
                    >
                      Attiva promemoria
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