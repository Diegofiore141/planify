import { useEffect, useMemo, useState } from 'react'
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
    month: 'long',
    year: 'numeric',
  })
}

function Events() {
  const { user } = useAuth()

  const [events, setEvents] = useState([])

  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')

  const [filter, setFilter] = useState('future')
  const [editEventId, setEditEventId] = useState(null)

  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

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

  const today = getTodayDateKey()

  const futureEvents = events.filter((eventItem) => eventItem.date >= today)
  const pastEvents = events.filter((eventItem) => eventItem.date < today)

  const visibleEvents = useMemo(() => {
    return events
      .filter((eventItem) => {
        if (filter === 'future') return eventItem.date >= today
        if (filter === 'past') return eventItem.date < today
        return true
      })
      .sort((firstEvent, secondEvent) => {
        const firstDate = `${firstEvent.date}T${firstEvent.time || '00:00'}`
        const secondDate = `${secondEvent.date}T${secondEvent.time || '00:00'}`

        return firstDate.localeCompare(secondDate)
      })
  }, [events, filter, today])

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

    if (!title.trim() || !date) {
      setError('Inserisci almeno titolo e data.')
      return
    }

    setError('')
    setMessage('')
    setWeatherError('')
    setReminderError('')

    if (editEventId) {
      const eventRef = doc(db, 'users', user.uid, 'events', editEventId)

      await updateDoc(eventRef, {
        title: title.trim(),
        date,
        time,
        location: location.trim(),
        description: description.trim(),
      })

      clearEventWeather(editEventId)
      clearEventReminder(editEventId)

      setMessage('Evento aggiornato correttamente.')
      resetForm()
      return
    }

    const eventsRef = collection(db, 'users', user.uid, 'events')

    await addDoc(eventsRef, {
      title: title.trim(),
      date,
      time,
      location: location.trim(),
      description: description.trim(),
      createdAt: serverTimestamp(),
    })

    setMessage('Evento creato correttamente.')
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
    setMessage('')
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

    setMessage('Evento eliminato.')
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
    setMessage('')

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

      setMessage('Promemoria attivato correttamente.')
    } catch (error) {
      console.error(error)
      setReminderError(
        'Promemoria non attivato. Controlla che data e ora siano future.'
      )
    }
  }

  return (
    <main className="dashboard-page">
      <section className="events-layout improved-events-layout">
        <div className="events-header improved-events-header">
          <div>
            <span className="dashboard-badge">Eventi</span>

            <h1>I miei eventi</h1>

            <p>
              Crea impegni, collega il meteo, attiva promemoria e ritrova tutto
              nel calendario.
            </p>
          </div>

          <div className="events-header-actions">
            <Link to="/calendar" className="btn btn-primary">
              Calendario
            </Link>

            <Link to="/dashboard" className="btn btn-secondary">
              Dashboard
            </Link>
          </div>
        </div>

        <div className="events-summary-grid">
          <article className="events-summary-card">
            <span>Totali</span>
            <strong>{events.length}</strong>
          </article>

          <article className="events-summary-card">
            <span>Futuri</span>
            <strong>{futureEvents.length}</strong>
          </article>

          <article className="events-summary-card">
            <span>Passati</span>
            <strong>{pastEvents.length}</strong>
          </article>
        </div>

        <div className="events-grid improved-events-grid">
          <form className="event-form improved-event-form" onSubmit={handleSaveEvent}>
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

            <div className="event-form-row">
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
            </div>

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
            {message && <p className="events-success-message">{message}</p>}

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

          <div className="events-list improved-events-list">
            <div className="events-list-top">
              <h2>Eventi salvati</h2>

              <div className="events-filter-group">
                <button
                  className={
                    filter === 'all' ? 'event-filter active' : 'event-filter'
                  }
                  onClick={() => setFilter('all')}
                >
                  Tutti
                </button>

                <button
                  className={
                    filter === 'future' ? 'event-filter active' : 'event-filter'
                  }
                  onClick={() => setFilter('future')}
                >
                  Futuri
                </button>

                <button
                  className={
                    filter === 'past' ? 'event-filter active' : 'event-filter'
                  }
                  onClick={() => setFilter('past')}
                >
                  Passati
                </button>
              </div>
            </div>

            {weatherError && <p className="error-message">{weatherError}</p>}
            {reminderError && <p className="error-message">{reminderError}</p>}

            {visibleEvents.length === 0 ? (
              <div className="events-empty-box">
                <strong>Nessun evento in questa sezione</strong>
                <p>
                  Puoi creare un evento da questa pagina oppure direttamente dal
                  calendario.
                </p>

                <Link to="/calendar" className="btn btn-secondary">
                  Apri calendario
                </Link>
              </div>
            ) : (
              visibleEvents.map((eventItem) => {
                const isPast = eventItem.date < today

                return (
                  <article
                    className={
                      isPast
                        ? 'event-card improved-event-card past-event-card'
                        : 'event-card improved-event-card'
                    }
                    key={eventItem.id}
                  >
                    <div className="event-card-main">
                      <div className="event-card-top">
                        <div>
                          <h3>{eventItem.title}</h3>

                          <div className="event-meta-pills">
                            <span className="event-date-pill">
                              {formatDateLabel(eventItem.date)}
                            </span>

                            <span className="event-time-pill">
                              {eventItem.time || 'Ora non specificata'}
                            </span>

                            {isPast && (
                              <span className="event-past-pill">Passato</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {eventItem.location && (
                        <p className="event-location">📍 {eventItem.location}</p>
                      )}

                      {eventItem.description && (
                        <p className="event-description">
                          {eventItem.description}
                        </p>
                      )}

                      {weatherByEvent[eventItem.id] && (
                        <div className="weather-box improved-weather-box">
                          <div>
                            <strong>
                              Meteo a {weatherByEvent[eventItem.id].city}
                            </strong>

                            <p>
                              {weatherByEvent[eventItem.id].temperature}°C -{' '}
                              {weatherByEvent[eventItem.id].description}
                            </p>
                          </div>

                          <span>{eventItem.time}</span>
                        </div>
                      )}

                      {reminderByEvent[eventItem.id] && (
                        <div className="reminder-box improved-reminder-box">
                          <strong>🔔 Promemoria attivo</strong>
                          <p>{reminderByEvent[eventItem.id]}</p>
                        </div>
                      )}
                    </div>

                    <div className="event-actions improved-event-actions">
                      <button
                        className="btn btn-secondary"
                        onClick={() => handleStartEdit(eventItem)}
                      >
                        Modifica
                      </button>

                      <button
                        className="btn btn-secondary"
                        onClick={() => handleShowWeather(eventItem)}
                      >
                        {weatherLoading === eventItem.id
                          ? 'Caricamento...'
                          : 'Meteo'}
                      </button>

                      <button
                        className="btn btn-secondary"
                        onClick={() => handleScheduleReminder(eventItem)}
                        disabled={isPast}
                      >
                        Promemoria
                      </button>

                      <button
                        className="btn btn-danger"
                        onClick={() => handleDeleteEvent(eventItem.id)}
                      >
                        Elimina
                      </button>
                    </div>
                  </article>
                )
              })
            )}
          </div>
        </div>
      </section>
    </main>
  )
}

export default Events