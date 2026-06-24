import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import {
  arrayRemove,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
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

function getEventVisibilityLabel(eventItem, userId, isPublicSourceMissing) {
  if (isPublicSourceMissing) {
    return 'Non più pubblico'
  }

  if (eventItem.sourcePublicEventId && eventItem.sourceOwnerId === userId) {
    return 'Pubblico'
  }

  if (eventItem.sourcePublicEventId && eventItem.sourceOwnerId !== userId) {
    return 'Da Esplora'
  }

  return 'Privato'
}

function getEventVisibilityClass(eventItem, userId, isPublicSourceMissing) {
  if (isPublicSourceMissing) {
    return 'unavailable'
  }

  if (eventItem.sourcePublicEventId && eventItem.sourceOwnerId === userId) {
    return 'public'
  }

  if (eventItem.sourcePublicEventId && eventItem.sourceOwnerId !== userId) {
    return 'explore'
  }

  return 'private'
}

function Events() {
  const { user } = useAuth()

  const userId = user?.uid || ''
  const userName = user?.displayName || user?.email || 'Utente Planify'

  const [events, setEvents] = useState([])
  const [publicEvents, setPublicEvents] = useState([])

  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState('private')

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
    if (!userId) return undefined

    const eventsRef = collection(db, 'users', userId, 'events')
    const eventsQuery = query(eventsRef, orderBy('date', 'asc'))

    const unsubscribe = onSnapshot(
      eventsQuery,
      (snapshot) => {
        const eventsData = snapshot.docs.map((document) => ({
          id: document.id,
          ...document.data(),
        }))

        setEvents(eventsData)
      },
      (snapshotError) => {
        console.error(snapshotError)
        setError('Errore durante il caricamento degli eventi.')
      }
    )

    return () => unsubscribe()
  }, [userId])

  useEffect(() => {
    if (!userId) return undefined

    const publicEventsRef = collection(db, 'publicEvents')
    const publicEventsQuery = query(publicEventsRef, orderBy('date', 'asc'))

    const unsubscribe = onSnapshot(
      publicEventsQuery,
      (snapshot) => {
        const publicEventsData = snapshot.docs.map((document) => ({
          id: document.id,
          ...document.data(),
        }))

        setPublicEvents(publicEventsData)
      },
      (snapshotError) => {
        console.error(snapshotError)
      }
    )

    return () => unsubscribe()
  }, [userId])

  const today = getTodayDateKey()

  const publicEventIds = useMemo(() => {
    return new Set(publicEvents.map((eventItem) => eventItem.id))
  }, [publicEvents])

  function isPublicSourceMissing(eventItem) {
    if (!eventItem.sourcePublicEventId) return false

    return !publicEventIds.has(eventItem.sourcePublicEventId)
  }

  const futureEvents = events.filter((eventItem) => eventItem.date >= today)
  const pastEvents = events.filter((eventItem) => eventItem.date < today)

  const unavailablePublicEvents = events.filter((eventItem) =>
    isPublicSourceMissing(eventItem)
  )

  const visibleEvents = useMemo(() => {
    return events
      .filter((eventItem) => {
        if (filter === 'future') return eventItem.date >= today
        if (filter === 'past') return eventItem.date < today
        return true
      })
      .sort((firstEvent, secondEvent) => {
        const firstDate = `${firstEvent.date || '9999-12-31'}T${
          firstEvent.time || '00:00'
        }`

        const secondDate = `${secondEvent.date || '9999-12-31'}T${
          secondEvent.time || '00:00'
        }`

        return firstDate.localeCompare(secondDate)
      })
  }, [events, filter, today])

  const editingEvent = events.find((eventItem) => eventItem.id === editEventId)

  const isEditingCopiedPublicEvent = Boolean(
    editingEvent?.sourcePublicEventId && editingEvent?.sourceOwnerId !== userId
  )

  const isEditingUnavailablePublicEvent = Boolean(
    editingEvent && isPublicSourceMissing(editingEvent)
  )

  function resetForm() {
    setTitle('')
    setDate('')
    setTime('')
    setLocation('')
    setDescription('')
    setVisibility('private')
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

    if (!userId) {
      setError('Devi essere autenticato per salvare un evento.')
      return
    }

    setError('')
    setMessage('')
    setWeatherError('')
    setReminderError('')

    const eventData = {
      title: title.trim(),
      date,
      time,
      location: location.trim(),
      description: description.trim(),
    }

    const participant = {
      uid: userId,
      name: userName,
      joinedAt: new Date().toISOString(),
    }

    try {
      const batch = writeBatch(db)

      if (editEventId) {
        const eventRef = doc(db, 'users', userId, 'events', editEventId)

        const eventToEdit = events.find(
          (eventItem) => eventItem.id === editEventId
        )

        const isOwnedPublicEvent =
          eventToEdit?.sourcePublicEventId &&
          eventToEdit?.sourceOwnerId === userId &&
          !isPublicSourceMissing(eventToEdit)

        const isCopiedPublicEvent =
          eventToEdit?.sourcePublicEventId &&
          eventToEdit?.sourceOwnerId !== userId

        const isUnavailablePublicEvent =
          eventToEdit && isPublicSourceMissing(eventToEdit)

        if (isCopiedPublicEvent || isUnavailablePublicEvent) {
          batch.update(eventRef, {
            ...eventData,
            updatedAt: serverTimestamp(),
          })

          await batch.commit()

          clearEventWeather(editEventId)
          clearEventReminder(editEventId)

          setMessage(
            isUnavailablePublicEvent
              ? 'Copia personale aggiornata. L’evento pubblico originale non è più disponibile.'
              : 'Copia personale aggiornata correttamente.'
          )

          resetForm()
          return
        }

        if (visibility === 'public') {
          if (isOwnedPublicEvent) {
            const publicEventRef = doc(
              db,
              'publicEvents',
              eventToEdit.sourcePublicEventId
            )

            batch.update(eventRef, {
              ...eventData,
              visibility: 'public',
              sourcePublicEventId: eventToEdit.sourcePublicEventId,
              sourceOwnerId: userId,
              updatedAt: serverTimestamp(),
            })

            batch.update(publicEventRef, {
              ...eventData,
              visibility: 'public',
              sourcePublicEventId: eventToEdit.sourcePublicEventId,
              sourceOwnerId: userId,
              ownerId: userId,
              ownerName: userName,
              updatedAt: serverTimestamp(),
            })
          } else {
            const publicEventRef = doc(collection(db, 'publicEvents'))

            batch.update(eventRef, {
              ...eventData,
              visibility: 'public',
              sourcePublicEventId: publicEventRef.id,
              sourceOwnerId: userId,
              updatedAt: serverTimestamp(),
            })

            batch.set(publicEventRef, {
              ...eventData,
              visibility: 'public',
              sourcePublicEventId: publicEventRef.id,
              sourceOwnerId: userId,
              ownerId: userId,
              ownerName: userName,
              participantIds: [userId],
              participants: [participant],
              participantCount: 1,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            })
          }
        } else {
          if (isOwnedPublicEvent) {
            const publicEventRef = doc(
              db,
              'publicEvents',
              eventToEdit.sourcePublicEventId
            )

            const publicEventSnapshot = await getDoc(publicEventRef)

            if (publicEventSnapshot.exists()) {
              const publicEventData = publicEventSnapshot.data()

              const participantCount =
                publicEventData.participantCount ||
                publicEventData.participantIds?.length ||
                publicEventData.participants?.length ||
                0

              if (participantCount > 1) {
                setError(
                  'Non puoi rendere privato un evento pubblico con partecipanti iscritti. Puoi lasciarlo pubblico oppure creare un nuovo evento privato.'
                )
                return
              }

              batch.delete(publicEventRef)
            }

            batch.update(eventRef, {
              ...eventData,
              visibility: 'private',
              sourcePublicEventId: '',
              sourceOwnerId: '',
              updatedAt: serverTimestamp(),
            })
          } else {
            batch.update(eventRef, {
              ...eventData,
              visibility: 'private',
              sourcePublicEventId: '',
              sourceOwnerId: '',
              updatedAt: serverTimestamp(),
            })
          }
        }

        await batch.commit()

        clearEventWeather(editEventId)
        clearEventReminder(editEventId)

        setMessage('Evento aggiornato correttamente.')
        resetForm()
        return
      }

      const personalEventRef = doc(collection(db, 'users', userId, 'events'))

      if (visibility === 'public') {
        const publicEventRef = doc(collection(db, 'publicEvents'))

        batch.set(publicEventRef, {
          ...eventData,
          visibility: 'public',
          sourcePublicEventId: publicEventRef.id,
          sourceOwnerId: userId,
          ownerId: userId,
          ownerName: userName,
          participantIds: [userId],
          participants: [participant],
          participantCount: 1,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })

        batch.set(personalEventRef, {
          ...eventData,
          visibility: 'public',
          sourcePublicEventId: publicEventRef.id,
          sourceOwnerId: userId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      } else {
        batch.set(personalEventRef, {
          ...eventData,
          visibility: 'private',
          sourcePublicEventId: '',
          sourceOwnerId: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      }

      await batch.commit()

      setMessage(
        visibility === 'public'
          ? 'Evento pubblico creato e pubblicato in Esplora eventi.'
          : 'Evento privato creato correttamente.'
      )

      resetForm()
    } catch (saveError) {
      console.error(saveError)
      setError('Errore durante il salvataggio dell’evento.')
    }
  }

  function handleStartEdit(eventItem) {
    setEditEventId(eventItem.id)
    setTitle(eventItem.title || '')
    setDate(eventItem.date || '')
    setTime(eventItem.time || '')
    setLocation(eventItem.location || '')
    setDescription(eventItem.description || '')

    if (
      eventItem.sourcePublicEventId &&
      eventItem.sourceOwnerId === userId &&
      !isPublicSourceMissing(eventItem)
    ) {
      setVisibility('public')
    } else {
      setVisibility(eventItem.visibility || 'private')
    }

    setError('')
    setMessage('')
    setWeatherError('')
    setReminderError('')
  }

  async function handleKeepPersonalCopy(eventId) {
    const eventToKeep = events.find((eventItem) => eventItem.id === eventId)

    setError('')
    setMessage('')

    if (!userId) {
      setError('Devi essere autenticato per mantenere una copia personale.')
      return
    }

    if (!eventToKeep) {
      setError('Evento non trovato.')
      return
    }

    try {
      const batch = writeBatch(db)

      const personalEventRef = doc(db, 'users', userId, 'events', eventId)

      batch.update(personalEventRef, {
        visibility: 'private',
        sourcePublicEventId: '',
        sourceOwnerId: '',
        updatedAt: serverTimestamp(),
      })

      await batch.commit()

      if (editEventId === eventId) {
        resetForm()
      }

      setMessage('Evento mantenuto come copia personale privata.')
    } catch (copyError) {
      console.error(copyError)
      setError('Errore durante il salvataggio della copia personale.')
    }
  }

  async function handleDeleteEvent(eventId) {
    const eventToDelete = events.find((eventItem) => eventItem.id === eventId)

    setError('')
    setMessage('')

    if (!userId) {
      setError('Devi essere autenticato per eliminare un evento.')
      return
    }

    try {
      const batch = writeBatch(db)
      const personalEventRef = doc(db, 'users', userId, 'events', eventId)

      if (eventToDelete?.sourcePublicEventId) {
        const publicEventRef = doc(
          db,
          'publicEvents',
          eventToDelete.sourcePublicEventId
        )

        const publicEventSnapshot = await getDoc(publicEventRef)

        if (eventToDelete.sourceOwnerId === userId) {
          if (publicEventSnapshot.exists()) {
            batch.delete(publicEventRef)
          }
        } else if (publicEventSnapshot.exists()) {
          const publicEventData = publicEventSnapshot.data()

          const participantToRemove = publicEventData.participants?.find(
            (participantItem) => participantItem.uid === userId
          )

          const participantCount =
            publicEventData.participantCount ||
            publicEventData.participantIds?.length ||
            publicEventData.participants?.length ||
            0

          const updateData = {
            participantIds: arrayRemove(userId),
            participantCount: Math.max(participantCount - 1, 0),
            updatedAt: serverTimestamp(),
          }

          if (participantToRemove) {
            updateData.participants = arrayRemove(participantToRemove)
          }

          batch.update(publicEventRef, updateData)
        }
      }

      batch.delete(personalEventRef)

      await batch.commit()

      clearEventWeather(eventId)
      clearEventReminder(eventId)

      if (editEventId === eventId) {
        resetForm()
      }

      setMessage(
        eventToDelete?.sourcePublicEventId &&
          eventToDelete?.sourceOwnerId !== userId
          ? 'Evento rimosso dal tuo calendario e partecipazione annullata.'
          : 'Evento eliminato.'
      )
    } catch (deleteError) {
      console.error(deleteError)
      setError('Errore durante l’eliminazione dell’evento.')
    }
  }

  async function handleShowWeather(eventItem) {
    if (isPublicSourceMissing(eventItem)) {
      setWeatherError(
        'Questo evento pubblico non è più disponibile. Puoi mantenerlo come copia personale oppure rimuoverlo dal calendario.'
      )
      return
    }

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
    } catch (weatherRequestError) {
      console.error(weatherRequestError)
      setWeatherError('Meteo non disponibile per questo luogo, data o ora.')
    } finally {
      setWeatherLoading('')
    }
  }

  async function handleScheduleReminder(eventItem) {
    setReminderError('')
    setMessage('')

    if (isPublicSourceMissing(eventItem)) {
      setReminderError(
        'Questo evento pubblico non è più disponibile. Puoi mantenerlo come copia personale oppure rimuoverlo dal calendario.'
      )
      return
    }

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
    } catch (reminderRequestError) {
      console.error(reminderRequestError)
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
              Crea impegni privati o pubblici, collega il meteo, attiva
              promemoria e ritrova tutto nel calendario.
            </p>
          </div>

          <div className="events-header-actions">
            <Link to="/explore" className="btn btn-primary">
              Esplora eventi
            </Link>

            <Link to="/calendar" className="btn btn-secondary">
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

          <article className="events-summary-card">
            <span>Da controllare</span>
            <strong>{unavailablePublicEvents.length}</strong>
          </article>
        </div>

        {unavailablePublicEvents.length > 0 && (
          <div className="events-public-warning">
            <strong>Ci sono eventi pubblici non più disponibili</strong>
            <p>
              Alcuni eventi aggiunti da Esplora sono stati rimossi dal creatore.
              Puoi mantenerli come eventi privati nel tuo calendario oppure
              eliminarli.
            </p>
          </div>
        )}

        <div className="events-grid improved-events-grid">
          <form
            className="event-form improved-event-form"
            onSubmit={handleSaveEvent}
          >
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

            {isEditingUnavailablePublicEvent ? (
              <div className="event-visibility-info unavailable">
                <strong>Evento pubblico non più disponibile</strong>
                <p>
                  L’evento originale è stato rimosso da Esplora. Puoi modificare
                  questa copia personale, mantenerla come evento privato oppure
                  eliminarla dal tuo calendario.
                </p>
              </div>
            ) : isEditingCopiedPublicEvent ? (
              <div className="event-visibility-info">
                <strong>Evento aggiunto da Esplora eventi</strong>
                <p>
                  Stai modificando solo la tua copia personale. L’evento pubblico
                  originale non viene modificato.
                </p>
              </div>
            ) : (
              <div className="event-visibility-box">
                <span>Visibilità evento</span>

                <div className="event-visibility-options">
                  <label
                    className={
                      visibility === 'private'
                        ? 'event-visibility-option active'
                        : 'event-visibility-option'
                    }
                  >
                    <input
                      type="radio"
                      name="visibility"
                      value="private"
                      checked={visibility === 'private'}
                      onChange={() => setVisibility('private')}
                    />

                    <div>
                      <strong>Privato</strong>
                      <p>Lo vedi solo tu nel tuo calendario.</p>
                    </div>
                  </label>

                  <label
                    className={
                      visibility === 'public'
                        ? 'event-visibility-option active'
                        : 'event-visibility-option'
                    }
                  >
                    <input
                      type="radio"
                      name="visibility"
                      value="public"
                      checked={visibility === 'public'}
                      onChange={() => setVisibility('public')}
                    />

                    <div>
                      <strong>Pubblico</strong>
                      <p>Compare anche in Esplora eventi.</p>
                    </div>
                  </label>
                </div>
              </div>
            )}

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
                  type="button"
                  className={
                    filter === 'all' ? 'event-filter active' : 'event-filter'
                  }
                  onClick={() => setFilter('all')}
                >
                  Tutti
                </button>

                <button
                  type="button"
                  className={
                    filter === 'future' ? 'event-filter active' : 'event-filter'
                  }
                  onClick={() => setFilter('future')}
                >
                  Futuri
                </button>

                <button
                  type="button"
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
                  Puoi creare un evento da questa pagina oppure aggiungerne uno
                  pubblico da Esplora eventi.
                </p>

                <div className="events-empty-actions">
                  <Link to="/calendar" className="btn btn-secondary">
                    Apri calendario
                  </Link>

                  <Link to="/explore" className="btn btn-primary">
                    Esplora eventi
                  </Link>
                </div>
              </div>
            ) : (
              visibleEvents.map((eventItem) => {
                const isPast = eventItem.date < today
                const publicSourceMissing = isPublicSourceMissing(eventItem)

                return (
                  <article
                    className={
                      publicSourceMissing
                        ? 'event-card improved-event-card unavailable-public-event-card'
                        : isPast
                          ? 'event-card improved-event-card past-event-card'
                          : 'event-card improved-event-card'
                    }
                    key={eventItem.id}
                  >
                    <div className="event-card-main">
                      <div className="event-card-top">
                        <div>
                          <div className="event-title-row">
                            <h3>{eventItem.title}</h3>

                            <span
                              className={`event-visibility-pill ${getEventVisibilityClass(
                                eventItem,
                                userId,
                                publicSourceMissing
                              )}`}
                            >
                              {getEventVisibilityLabel(
                                eventItem,
                                userId,
                                publicSourceMissing
                              )}
                            </span>
                          </div>

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

                      {publicSourceMissing && (
                        <div className="event-unavailable-box">
                          <strong>Evento pubblico non più disponibile</strong>
                          <p>
                            L’evento originale è stato rimosso da Esplora. Puoi
                            mantenerlo come evento privato nel tuo calendario
                            oppure eliminarlo.
                          </p>
                        </div>
                      )}

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
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => handleStartEdit(eventItem)}
                      >
                        Modifica
                      </button>

                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => handleShowWeather(eventItem)}
                        disabled={publicSourceMissing}
                      >
                        {weatherLoading === eventItem.id
                          ? 'Caricamento...'
                          : 'Meteo'}
                      </button>

                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => handleScheduleReminder(eventItem)}
                        disabled={isPast || publicSourceMissing}
                      >
                        Promemoria
                      </button>

                      {publicSourceMissing && (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => handleKeepPersonalCopy(eventItem.id)}
                        >
                          Mantieni copia personale
                        </button>
                      )}

                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={() => handleDeleteEvent(eventItem.id)}
                      >
                        {publicSourceMissing
                          ? 'Rimuovi dal calendario'
                          : 'Elimina'}
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