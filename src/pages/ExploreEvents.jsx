import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'

import { db } from '../services/firebase'
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
    month: 'long',
    year: 'numeric',
  })
}

function getParticipantName(participant) {
  return participant.name || 'Utente Planify'
}

function ExploreEvents() {
  const { user } = useAuth()

  const userId = user?.uid || ''
  const userName = user?.displayName || user?.email || 'Utente Planify'

  const [publicEvents, setPublicEvents] = useState([])
  const [personalEvents, setPersonalEvents] = useState([])

  const [searchTerm, setSearchTerm] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')

  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')

  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!userId) return undefined

    const publicEventsRef = collection(db, 'publicEvents')
    const publicEventsQuery = query(publicEventsRef, orderBy('date', 'asc'))

    const unsubscribePublicEvents = onSnapshot(
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
        setError('Errore durante il caricamento degli eventi pubblici.')
      }
    )

    return () => {
      unsubscribePublicEvents()
    }
  }, [userId])

  useEffect(() => {
    if (!userId) return undefined

    const personalEventsRef = collection(db, 'users', userId, 'events')
    const personalEventsQuery = query(personalEventsRef, orderBy('date', 'asc'))

    const unsubscribePersonalEvents = onSnapshot(
      personalEventsQuery,
      (snapshot) => {
        const personalEventsData = snapshot.docs.map((document) => ({
          id: document.id,
          ...document.data(),
        }))

        setPersonalEvents(personalEventsData)
      },
      (snapshotError) => {
        console.error(snapshotError)
        setError('Errore durante il caricamento dei tuoi eventi.')
      }
    )

    return () => {
      unsubscribePersonalEvents()
    }
  }, [userId])

  const today = getTodayDateKey()

  const savedPublicEventIds = useMemo(() => {
    return new Set(
      personalEvents
        .map((eventItem) => eventItem.sourcePublicEventId)
        .filter(Boolean)
    )
  }, [personalEvents])

  const futurePublicEvents = useMemo(() => {
    return publicEvents
      .filter((eventItem) => eventItem.date >= today)
      .sort((firstEvent, secondEvent) => {
        const firstDate = `${firstEvent.date}T${firstEvent.time || '00:00'}`
        const secondDate = `${secondEvent.date}T${secondEvent.time || '00:00'}`

        return firstDate.localeCompare(secondDate)
      })
  }, [publicEvents, today])

  const filteredPublicEvents = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    return futurePublicEvents.filter((eventItem) => {
      const isOwner = eventItem.ownerId === userId

      const isJoined =
        savedPublicEventIds.has(eventItem.id) ||
        eventItem.participantIds?.includes(userId)

      const matchesSearch =
        !normalizedSearch ||
        eventItem.title?.toLowerCase().includes(normalizedSearch) ||
        eventItem.location?.toLowerCase().includes(normalizedSearch) ||
        eventItem.description?.toLowerCase().includes(normalizedSearch) ||
        eventItem.ownerName?.toLowerCase().includes(normalizedSearch)

      const matchesFilter =
        activeFilter === 'all' ||
        (activeFilter === 'joined' && isJoined) ||
        (activeFilter === 'created' && isOwner)

      return matchesSearch && matchesFilter
    })
  }, [futurePublicEvents, searchTerm, activeFilter, savedPublicEventIds, userId])

  async function handleCreatePublicEvent(event) {
    event.preventDefault()

    setError('')
    setMessage('')

    if (!userId) {
      setError('Devi essere autenticato per pubblicare un evento.')
      return
    }

    if (!title.trim() || !date) {
      setError('Inserisci almeno titolo e data.')
      return
    }

    try {
      const batch = writeBatch(db)

      const publicEventRef = doc(collection(db, 'publicEvents'))
      const personalEventRef = doc(collection(db, 'users', userId, 'events'))

      const participant = {
        uid: userId,
        name: userName,
        joinedAt: new Date().toISOString(),
      }

      const baseEventData = {
        title: title.trim(),
        date,
        time,
        location: location.trim(),
        description: description.trim(),
        visibility: 'public',
        sourcePublicEventId: publicEventRef.id,
        sourceOwnerId: userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }

      batch.set(publicEventRef, {
        ...baseEventData,
        ownerId: userId,
        ownerName: userName,
        participantIds: [userId],
        participants: [participant],
        participantCount: 1,
      })

      batch.set(personalEventRef, {
        ...baseEventData,
      })

      await batch.commit()

      setTitle('')
      setDate('')
      setTime('')
      setLocation('')
      setDescription('')

      setMessage('Evento pubblico creato e aggiunto al tuo calendario.')
    } catch (err) {
      console.error(err)
      setError('Errore durante la pubblicazione dell’evento.')
    }
  }

  async function handleSavePublicEvent(publicEvent) {
    setError('')
    setMessage('')

    if (!userId) {
      setError('Devi essere autenticato per aggiungere un evento.')
      return
    }

    const isAlreadySaved =
      savedPublicEventIds.has(publicEvent.id) ||
      publicEvent.participantIds?.includes(userId)

    if (isAlreadySaved) {
      setMessage('Questo evento è già presente nel tuo calendario.')
      return
    }

    try {
      const batch = writeBatch(db)

      const personalEventRef = doc(collection(db, 'users', userId, 'events'))
      const publicEventRef = doc(db, 'publicEvents', publicEvent.id)

      const participant = {
        uid: userId,
        name: userName,
        joinedAt: new Date().toISOString(),
      }

      batch.set(personalEventRef, {
        title: publicEvent.title,
        date: publicEvent.date,
        time: publicEvent.time || '',
        location: publicEvent.location || '',
        description: publicEvent.description || '',
        visibility: 'public',
        sourcePublicEventId: publicEvent.id,
        sourceOwnerId: publicEvent.ownerId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      batch.update(publicEventRef, {
        participantIds: arrayUnion(userId),
        participants: arrayUnion(participant),
        participantCount: increment(1),
        updatedAt: serverTimestamp(),
      })

      await batch.commit()

      setMessage('Evento aggiunto al tuo calendario.')
    } catch (err) {
      console.error(err)
      setError('Errore durante l’aggiunta dell’evento al calendario.')
    }
  }

  async function handleLeavePublicEvent(publicEvent) {
    setError('')
    setMessage('')

    if (!userId) {
      setError('Devi essere autenticato per annullare la partecipazione.')
      return
    }

    if (publicEvent.ownerId === userId) {
      setError('Il creatore non può annullare la partecipazione al proprio evento.')
      return
    }

    const personalEventToRemove = personalEvents.find(
      (eventItem) => eventItem.sourcePublicEventId === publicEvent.id
    )

    const participantToRemove = publicEvent.participants?.find(
      (participant) => participant.uid === userId
    )

    const participantCount =
      publicEvent.participantCount ||
      publicEvent.participantIds?.length ||
      publicEvent.participants?.length ||
      0

    try {
      const batch = writeBatch(db)

      const publicEventRef = doc(db, 'publicEvents', publicEvent.id)

      if (personalEventToRemove) {
        const personalEventRef = doc(
          db,
          'users',
          userId,
          'events',
          personalEventToRemove.id
        )

        batch.delete(personalEventRef)
      }

      const updateData = {
        participantIds: arrayRemove(userId),
        participantCount: Math.max(participantCount - 1, 0),
        updatedAt: serverTimestamp(),
      }

      if (participantToRemove) {
        updateData.participants = arrayRemove(participantToRemove)
      }

      batch.update(publicEventRef, updateData)

      await batch.commit()

      setMessage('Partecipazione annullata e evento rimosso dal tuo calendario.')
    } catch (err) {
      console.error(err)
      setError('Errore durante l’annullamento della partecipazione.')
    }
  }

  async function handleDeletePublicEvent(publicEventId) {
    setError('')
    setMessage('')

    if (!userId) {
      setError('Devi essere autenticato per eliminare un evento.')
      return
    }

    const personalEventToRemove = personalEvents.find(
      (eventItem) => eventItem.sourcePublicEventId === publicEventId
    )

    try {
      const batch = writeBatch(db)

      const publicEventRef = doc(db, 'publicEvents', publicEventId)

      batch.delete(publicEventRef)

      if (personalEventToRemove) {
        const personalEventRef = doc(
          db,
          'users',
          userId,
          'events',
          personalEventToRemove.id
        )

        batch.delete(personalEventRef)
      }

      await batch.commit()

      setMessage('Evento pubblico rimosso anche dal tuo calendario.')
    } catch (err) {
      console.error(err)
      setError('Errore durante l’eliminazione dell’evento pubblico.')
    }
  }

  if (!user) {
    return (
      <main className="dashboard-page">
        <section className="explore-page">
          <div className="explore-hero">
            <div>
              <span className="explore-badge">Eventi pubblici</span>
              <h1>Caricamento eventi...</h1>
              <p>Attendi qualche istante.</p>
            </div>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main className="dashboard-page">
      <section className="explore-page">
        <div className="explore-hero explore-hero-search-first">
          <div>
            <span className="explore-badge">Eventi pubblici</span>

            <h1>Trova eventi da aggiungere al tuo calendario.</h1>

            <p>
              Esplora eventi pubblicati dagli altri utenti di Planify. Cerca per
              nome, luogo o descrizione e aggiungi gli eventi interessanti alla
              tua agenda personale.
            </p>
          </div>

          <div className="explore-hero-actions">
            <Link to="/dashboard" className="btn btn-secondary">
              Dashboard
            </Link>

            <Link to="/calendar" className="btn btn-primary">
              Apri calendario
            </Link>
          </div>
        </div>

        {(message || error) && (
          <div className={error ? 'explore-alert error' : 'explore-alert'}>
            {error || message}
          </div>
        )}

        <div className="explore-search-panel">
          <div>
            <h2>Cerca eventi pubblici</h2>
            <p>
              Come una sezione di scoperta: prima trovi l’evento, poi lo aggiungi
              al tuo calendario.
            </p>
          </div>

          <div className="explore-search-box">
            <input
              type="text"
              placeholder="Cerca per titolo, luogo, descrizione..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>

          <div className="explore-filters">
            <button
              className={
                activeFilter === 'all'
                  ? 'explore-filter active'
                  : 'explore-filter'
              }
              onClick={() => setActiveFilter('all')}
            >
              Tutti
            </button>

            <button
              className={
                activeFilter === 'joined'
                  ? 'explore-filter active'
                  : 'explore-filter'
              }
              onClick={() => setActiveFilter('joined')}
            >
              Già aggiunti
            </button>

            <button
              className={
                activeFilter === 'created'
                  ? 'explore-filter active'
                  : 'explore-filter'
              }
              onClick={() => setActiveFilter('created')}
            >
              Creati da me
            </button>
          </div>
        </div>

        <div className="explore-layout-v2">
          <article className="explore-panel explore-results-panel">
            <div className="explore-panel-header">
              <div>
                <h2>Eventi disponibili</h2>
                <p>Eventi pubblici futuri creati dagli utenti.</p>
              </div>

              <span className="explore-count">{filteredPublicEvents.length}</span>
            </div>

            {filteredPublicEvents.length === 0 ? (
              <div className="explore-empty">
                <strong>Nessun evento trovato</strong>
                <p>
                  Prova a cambiare ricerca o filtri. Gli eventi pubblici futuri
                  appariranno qui.
                </p>
              </div>
            ) : (
              <div className="explore-events-list">
                {filteredPublicEvents.map((publicEvent) => {
                  const isOwner = publicEvent.ownerId === userId

                  const isAlreadyJoined =
                    isOwner ||
                    savedPublicEventIds.has(publicEvent.id) ||
                    publicEvent.participantIds?.includes(userId)

                  const participantCount =
                    publicEvent.participantCount ||
                    publicEvent.participantIds?.length ||
                    publicEvent.participants?.length ||
                    0

                  return (
                    <div className="explore-event-card" key={publicEvent.id}>
                      <div className="explore-event-top">
                        <div>
                          <span className="explore-event-label">
                            Evento pubblico
                          </span>

                          <h3>{publicEvent.title}</h3>
                        </div>

                        {isOwner && (
                          <span className="explore-owner-badge">
                            Creato da te
                          </span>
                        )}
                      </div>

                      <div className="explore-event-info">
                        <span>📅 {formatDateLabel(publicEvent.date)}</span>

                        {publicEvent.time && <span>🕘 {publicEvent.time}</span>}

                        {publicEvent.location && (
                          <span>📍 {publicEvent.location}</span>
                        )}

                        <span>👥 {participantCount} partecipanti</span>
                      </div>

                      {publicEvent.description && (
                        <p className="explore-event-description">
                          {publicEvent.description}
                        </p>
                      )}

                      <p className="explore-event-author">
                        Pubblicato da{' '}
                        <strong>
                          {publicEvent.ownerName || 'Utente Planify'}
                        </strong>
                      </p>

                      {isOwner && (
                        <div className="explore-participants-box">
                          <strong>Partecipanti iscritti</strong>

                          {publicEvent.participants?.length > 0 ? (
                            <div className="explore-participants-list">
                              {publicEvent.participants.map(
                                (participant, index) => (
                                  <span key={`${participant.uid}-${index}`}>
                                    {getParticipantName(participant)}
                                  </span>
                                )
                              )}
                            </div>
                          ) : (
                            <p>Nessun partecipante registrato.</p>
                          )}
                        </div>
                      )}

                      <div className="explore-event-actions">
                        {!isAlreadyJoined && (
                          <button
                            className="btn btn-primary"
                            onClick={() => handleSavePublicEvent(publicEvent)}
                          >
                            Aggiungi al mio calendario
                          </button>
                        )}

                        {isAlreadyJoined && !isOwner && (
                          <button
                            className="btn btn-secondary"
                            onClick={() => handleLeavePublicEvent(publicEvent)}
                          >
                            Annulla partecipazione
                          </button>
                        )}

                        {isOwner && (
                          <>
                            <button className="btn btn-primary" disabled>
                              Evento creato da te
                            </button>

                            <button
                              className="btn btn-secondary"
                              onClick={() =>
                                handleDeletePublicEvent(publicEvent.id)
                              }
                            >
                              Rimuovi evento pubblico
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </article>

          <aside className="explore-panel explore-create-panel">
            <div className="explore-panel-header">
              <div>
                <h2>Pubblica un evento</h2>
                <p>
                  Crea un evento visibile agli altri utenti autenticati di
                  Planify.
                </p>
              </div>
            </div>

            <form className="explore-form" onSubmit={handleCreatePublicEvent}>
              <label>
                Titolo evento
                <input
                  type="text"
                  placeholder="Es. Masterclass Bachata"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </label>

              <div className="explore-form-row">
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
                  placeholder="Es. Ponsacco"
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                />
              </label>

              <label>
                Descrizione
                <textarea
                  placeholder="Aggiungi qualche dettaglio sull’evento..."
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                ></textarea>
              </label>

              <button className="btn btn-primary" type="submit">
                Pubblica evento
              </button>
            </form>
          </aside>
        </div>
      </section>
    </main>
  )
}

export default ExploreEvents