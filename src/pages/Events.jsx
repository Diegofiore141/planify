import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  increment,
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

function normalizeEmail(email) {
  return email.trim().toLowerCase()
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function getInviteEmailsFromText(text) {
  return Array.from(
    new Set(
      text
        .split(/[\s,;]+/)
        .map((email) => normalizeEmail(email))
        .filter(Boolean)
    )
  )
}

function getInviteEmailsFromEvent(eventItem, ownerEmail = '') {
  const ownerEmailNormalized = normalizeEmail(ownerEmail)

  if (Array.isArray(eventItem.invitedEmails)) {
    return eventItem.invitedEmails
      .map((email) => normalizeEmail(email))
      .filter(Boolean)
      .filter((email) => email !== ownerEmailNormalized)
  }

  if (Array.isArray(eventItem.invitedPeople)) {
    return eventItem.invitedPeople
      .map((person) => normalizeEmail(person.email || ''))
      .filter(Boolean)
      .filter((email) => email !== ownerEmailNormalized)
  }

  return []
}

function createInvitedPeople(invitedEmails, ownerEmail, previousPeople = []) {
  const ownerEmailNormalized = normalizeEmail(ownerEmail)
  const invitedAt = new Date().toISOString()

  const previousPeopleByEmail = new Map(
    previousPeople
      .filter((person) => person.email)
      .map((person) => [normalizeEmail(person.email), person])
  )

  return invitedEmails
    .map((email) => normalizeEmail(email))
    .filter(Boolean)
    .filter((email) => email !== ownerEmailNormalized)
    .map((email) => {
      const previousPerson = previousPeopleByEmail.get(email)

      if (previousPerson) {
        const shouldReinvite =
          previousPerson.status === 'removed' ||
          previousPerson.status === 'declined'

        return {
          ...previousPerson,
          email,
          role: previousPerson.role || 'participant',
          status: shouldReinvite ? 'invited' : previousPerson.status,
          invitedAt,
          removedAt: shouldReinvite ? '' : previousPerson.removedAt || '',
          declinedAt: shouldReinvite ? '' : previousPerson.declinedAt || '',
        }
      }

      return {
        email,
        uid: '',
        name: '',
        role: 'participant',
        status: 'invited',
        invitedAt,
        joinedAt: '',
        removedAt: '',
        declinedAt: '',
      }
    })
}

function getInvitePeopleGroups(eventItem) {
  const invitedPeople = Array.isArray(eventItem.invitedPeople)
    ? eventItem.invitedPeople
    : []

  const accepted = invitedPeople.filter(
    (person) => person.status === 'accepted'
  )

  const pending = invitedPeople.filter((person) => person.status === 'invited')

  const declined = invitedPeople.filter(
    (person) => person.status === 'declined'
  )

  const removed = invitedPeople.filter((person) => person.status === 'removed')

  return {
    accepted,
    pending,
    declined,
    removed,
    total: invitedPeople.length,
  }
}

function getInvitePersonDisplayName(person) {
  if (person.name) return person.name
  if (person.email) return person.email
  return 'Invitato'
}

function getInvitePersonByEmail(eventItem, email) {
  const normalizedEmail = normalizeEmail(email)

  return (
    eventItem.invitedPeople?.find(
      (person) => normalizeEmail(person.email || '') === normalizedEmail
    ) || null
  )
}

function getEventVisibilityLabel(
  eventItem,
  userId,
  isPublicSourceMissing,
  isInviteSourceMissing = false,
  inviteSourceEvent = null,
  publicSourceEvent = null
) {
  if (isPublicSourceMissing) return 'Non più pubblico'
  if (isInviteSourceMissing) return 'Invito non più disponibile'

  if (eventItem.sourceInviteEventId && inviteSourceEvent?.ownerId === userId) {
    return 'Su invito'
  }

  if (eventItem.sourceInviteEventId && inviteSourceEvent?.ownerId !== userId) {
    return 'Invitato'
  }

  if (eventItem.sourcePublicEventId) {
    const publicOwnerId = publicSourceEvent?.ownerId || eventItem.sourceOwnerId

    if (publicOwnerId === userId) return 'Pubblico'
    return 'Da Esplora'
  }

  return 'Privato'
}

function getEventVisibilityClass(
  eventItem,
  userId,
  isPublicSourceMissing,
  isInviteSourceMissing = false,
  inviteSourceEvent = null,
  publicSourceEvent = null
) {
  if (isPublicSourceMissing || isInviteSourceMissing) return 'unavailable'

  if (eventItem.sourceInviteEventId && inviteSourceEvent?.ownerId === userId) {
    return 'invite'
  }

  if (eventItem.sourceInviteEventId && inviteSourceEvent?.ownerId !== userId) {
    return 'invited'
  }

  if (eventItem.sourcePublicEventId) {
    const publicOwnerId = publicSourceEvent?.ownerId || eventItem.sourceOwnerId

    if (publicOwnerId === userId) return 'public'
    return 'explore'
  }

  return 'private'
}

function buildInviteEmailBody(eventItem, ownerName) {
  const lines = [
    'Ciao!',
    '',
    'Ti ho invitato a partecipare a un evento su Planify.',
    '',
    `Evento: ${eventItem.title || 'Evento senza titolo'}`,
    `Data: ${formatDateLabel(eventItem.date)}`,
    `Ora: ${eventItem.time || 'Non specificata'}`,
    `Luogo: ${eventItem.location || 'Non specificato'}`,
  ]

  if (eventItem.description) {
    lines.push(`Descrizione: ${eventItem.description}`)
  }

  lines.push(
    '',
    'Per accettare o rifiutare l’invito:',
    '1. Accedi a Planify',
    '2. Entra con questa stessa email',
    '3. Vai nella pagina Eventi',
    '4. Troverai l’invito nella sezione “Inviti ricevuti”',
    '',
    'A presto,',
    ownerName || 'Planify'
  )

  return lines.join('\n')
}

function Events() {
  const { user } = useAuth()
  const inviteInputRef = useRef(null)

  const userId = user?.uid || ''
  const userEmail = user?.email || ''
  const userName = user?.displayName || user?.email || 'Utente Planify'

  const [events, setEvents] = useState([])
  const [publicEvents, setPublicEvents] = useState([])
  const [inviteEvents, setInviteEvents] = useState([])

  const [title, setTitle] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [location, setLocation] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState('private')

  const [inviteEmails, setInviteEmails] = useState([])
  const [inviteEmailInput, setInviteEmailInput] = useState('')

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

  useEffect(() => {
    if (!userId || !userEmail) return undefined

    const inviteEventsRef = collection(db, 'inviteEvents')
    const inviteEventsQuery = query(inviteEventsRef, orderBy('date', 'asc'))

    const unsubscribe = onSnapshot(
      inviteEventsQuery,
      (snapshot) => {
        const inviteEventsData = snapshot.docs.map((document) => ({
          id: document.id,
          ...document.data(),
        }))

        setInviteEvents(inviteEventsData)
      },
      (snapshotError) => {
        console.error(snapshotError)
        setError('Errore durante il caricamento degli inviti.')
      }
    )

    return () => unsubscribe()
  }, [userId, userEmail])

  const today = getTodayDateKey()

  const publicEventIds = useMemo(() => {
    return new Set(publicEvents.map((eventItem) => eventItem.id))
  }, [publicEvents])

  const savedInviteEventsBySourceId = useMemo(() => {
    const savedEventsMap = new Map()

    events.forEach((eventItem) => {
      if (eventItem.sourceInviteEventId) {
        savedEventsMap.set(eventItem.sourceInviteEventId, eventItem)
      }
    })

    return savedEventsMap
  }, [events])

  function getPublicSourceEvent(eventItem) {
    if (!eventItem?.sourcePublicEventId) return null

    return (
      publicEvents.find(
        (publicEvent) => publicEvent.id === eventItem.sourcePublicEventId
      ) || null
    )
  }

  function getInviteSourceEvent(eventItem) {
    if (!eventItem?.sourceInviteEventId) return null

    return (
      inviteEvents.find(
        (inviteEvent) => inviteEvent.id === eventItem.sourceInviteEventId
      ) || null
    )
  }

  function getOfficialSourceEvent(eventItem) {
    if (eventItem?.sourceInviteEventId) {
      return getInviteSourceEvent(eventItem)
    }

    if (eventItem?.sourcePublicEventId) {
      return getPublicSourceEvent(eventItem)
    }

    return null
  }

  function hasPersonalChanges(eventItem) {
    return Boolean(
      eventItem?.hasPersonalChanges &&
        (eventItem.sourceInviteEventId || eventItem.sourcePublicEventId)
    )
  }

  function getEventDisplayData(eventItem) {
    const officialSourceEvent = getOfficialSourceEvent(eventItem)

    if (officialSourceEvent && !hasPersonalChanges(eventItem)) {
      return officialSourceEvent
    }

    return eventItem
  }

  function isPublicSourceMissing(eventItem) {
    if (!eventItem.sourcePublicEventId) return false
    return !publicEventIds.has(eventItem.sourcePublicEventId)
  }

  function isInviteSourceMissing(eventItem) {
    if (!eventItem.sourceInviteEventId) return false

    const inviteSourceEvent = getInviteSourceEvent(eventItem)

    if (!inviteSourceEvent) return true
    if (inviteSourceEvent.ownerId === userId) return false

    const currentUserInvite = getInvitePersonByEmail(inviteSourceEvent, userEmail)

    return (
      currentUserInvite?.status === 'removed' ||
      currentUserInvite?.status === 'declined'
    )
  }

  const pendingInvites = useMemo(() => {
    const normalizedUserEmail = normalizeEmail(userEmail)

    return inviteEvents
      .filter((inviteEvent) => inviteEvent.ownerId !== userId)
      .filter((inviteEvent) => {
        const invitedPerson = inviteEvent.invitedPeople?.find(
          (person) => normalizeEmail(person.email || '') === normalizedUserEmail
        )

        return invitedPerson?.status === 'invited'
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
  }, [inviteEvents, userEmail, userId])

  const futureEvents = events.filter((eventItem) => {
    const displayEvent = getEventDisplayData(eventItem)
    return displayEvent.date >= today
  })

  const savedInviteEvents = events.filter(
    (eventItem) => eventItem.sourceInviteEventId
  )

  const unavailablePublicEvents = events.filter((eventItem) =>
    isPublicSourceMissing(eventItem)
  )

  const unavailableInviteEvents = events.filter((eventItem) =>
    isInviteSourceMissing(eventItem)
  )

  const visibleEvents = useMemo(() => {
    return events
      .filter((eventItem) => {
        const displayEvent = getEventDisplayData(eventItem)

        if (filter === 'future') return displayEvent.date >= today
        if (filter === 'past') return displayEvent.date < today
        return true
      })
      .sort((firstEvent, secondEvent) => {
        const firstDisplayEvent = getEventDisplayData(firstEvent)
        const secondDisplayEvent = getEventDisplayData(secondEvent)

        const firstDate = `${firstDisplayEvent.date || '9999-12-31'}T${
          firstDisplayEvent.time || '00:00'
        }`

        const secondDate = `${secondDisplayEvent.date || '9999-12-31'}T${
          secondDisplayEvent.time || '00:00'
        }`

        return firstDate.localeCompare(secondDate)
      })
  }, [events, filter, inviteEvents, publicEvents, today])

  const editingEvent = events.find((eventItem) => eventItem.id === editEventId)
  const editingInviteSourceEvent = getInviteSourceEvent(editingEvent)
  const editingPublicSourceEvent = getPublicSourceEvent(editingEvent)

  const isEditingCopiedPublicEvent = Boolean(
    editingEvent?.sourcePublicEventId &&
      editingPublicSourceEvent?.ownerId !== userId
  )

  const isEditingCopiedInviteEvent = Boolean(
    editingEvent?.sourceInviteEventId &&
      editingInviteSourceEvent?.ownerId !== userId
  )

  const isEditingUnavailablePublicEvent = Boolean(
    editingEvent && isPublicSourceMissing(editingEvent)
  )

  const isEditingUnavailableInviteEvent = Boolean(
    editingEvent && isInviteSourceMissing(editingEvent)
  )

  function addInviteEmailsFromText(text) {
    const newEmails = getInviteEmailsFromText(text)

    if (newEmails.length === 0) return

    const invalidEmails = newEmails.filter((email) => !isValidEmail(email))

    if (invalidEmails.length > 0) {
      setError(`Email non valida: ${invalidEmails[0]}`)
      return
    }

    const ownerEmailNormalized = normalizeEmail(userEmail)

    setInviteEmails((previousEmails) =>
      Array.from(
        new Set([
          ...previousEmails,
          ...newEmails.filter((email) => email !== ownerEmailNormalized),
        ])
      )
    )

    setInviteEmailInput('')
    setError('')
  }

  function handleInviteEmailKeyDown(event) {
    if (event.metaKey || event.ctrlKey || event.altKey) return

    const shouldCreateChip =
      event.key === 'Enter' ||
      event.key === 'Tab' ||
      event.key === ',' ||
      event.key === ' '

    if (!shouldCreateChip) return
    if (!inviteEmailInput.trim()) return

    event.preventDefault()
    addInviteEmailsFromText(inviteEmailInput)
  }

  function handleInviteEmailPaste(event) {
    const pastedText = event.clipboardData.getData('text')

    if (!pastedText) return

    event.preventDefault()
    addInviteEmailsFromText(pastedText)
  }

  function removeInviteEmail(emailToRemove) {
    setInviteEmails((previousEmails) =>
      previousEmails.filter((email) => email !== emailToRemove)
    )
  }

  function resetForm() {
    setTitle('')
    setDate('')
    setTime('')
    setLocation('')
    setDescription('')
    setVisibility('private')
    setInviteEmails([])
    setInviteEmailInput('')
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

  function handleSendInviteEmails(eventItem) {
    const invitedEmails = getInviteEmailsFromEvent(eventItem, userEmail)

    if (invitedEmails.length === 0) {
      setError('Non ci sono email invitate a cui inviare il messaggio.')
      return
    }

    const subject = `Invito Planify - ${eventItem.title || 'Nuovo evento'}`
    const body = buildInviteEmailBody(eventItem, userName)

    const mailtoUrl = `mailto:${invitedEmails.join(',')}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`

    window.location.assign(mailtoUrl)
  }

  async function removeOwnedPublicEventIfPossible(batch, eventToEdit) {
    if (!eventToEdit?.sourcePublicEventId) return true

    const publicEventRef = doc(
      db,
      'publicEvents',
      eventToEdit.sourcePublicEventId
    )

    const publicEventSnapshot = await getDoc(publicEventRef)

    if (!publicEventSnapshot.exists()) {
      return true
    }

    const publicEventData = publicEventSnapshot.data()

    const participantCount =
      publicEventData.participantCount ||
      publicEventData.participantIds?.length ||
      publicEventData.participants?.length ||
      0

    if (participantCount > 1) {
      setError(
        'Non puoi cambiare visibilità a un evento pubblico con partecipanti iscritti. Puoi lasciarlo pubblico oppure creare un nuovo evento.'
      )
      return false
    }

    batch.delete(publicEventRef)
    return true
  }

  async function removeOwnedInviteEventIfExists(batch, eventToEdit) {
    if (!eventToEdit?.sourceInviteEventId) return

    const inviteEventRef = doc(
      db,
      'inviteEvents',
      eventToEdit.sourceInviteEventId
    )

    const inviteEventSnapshot = await getDoc(inviteEventRef)

    if (inviteEventSnapshot.exists()) {
      batch.delete(inviteEventRef)
    }
  }

  async function handleAcceptInvite(inviteEvent) {
    setError('')
    setMessage('')

    if (!userId || !userEmail) {
      setError('Devi essere autenticato per accettare un invito.')
      return
    }

    if (inviteEvent.ownerId === userId) {
      setError('Sei il creatore di questo evento.')
      return
    }

    try {
      const batch = writeBatch(db)

      const inviteEventRef = doc(db, 'inviteEvents', inviteEvent.id)

      const existingPersonalEvent = savedInviteEventsBySourceId.get(
        inviteEvent.id
      )

      const personalEventRef = existingPersonalEvent
        ? doc(db, 'users', userId, 'events', existingPersonalEvent.id)
        : doc(collection(db, 'users', userId, 'events'))

      const joinedAt = new Date().toISOString()

      const participant = {
        uid: userId,
        email: userEmail,
        name: userName,
        role: 'participant',
        status: 'accepted',
        joinedAt,
      }

      const previousParticipant = inviteEvent.participants?.find(
        (participantItem) =>
          participantItem.uid === userId ||
          normalizeEmail(participantItem.email || '') ===
            normalizeEmail(userEmail)
      )

      const updatedInvitedPeople = inviteEvent.invitedPeople?.map((person) => {
        const isCurrentUser =
          normalizeEmail(person.email || '') === normalizeEmail(userEmail)

        if (!isCurrentUser) return person

        return {
          ...person,
          uid: userId,
          name: userName,
          role: 'participant',
          status: 'accepted',
          joinedAt,
          declinedAt: '',
          removedAt: '',
        }
      })

      batch.set(
        personalEventRef,
        {
          title: inviteEvent.title || '',
          date: inviteEvent.date || '',
          time: inviteEvent.time || '',
          location: inviteEvent.location || '',
          description: inviteEvent.description || '',
          visibility: 'invite',
          sourcePublicEventId: '',
          sourceInviteEventId: inviteEvent.id,
          sourceOwnerId: inviteEvent.ownerId || '',
          ownerName: inviteEvent.ownerName || '',
          ownerEmail: inviteEvent.ownerEmail || '',
          invitedEmails: [],
          invitedPeople: [],
          participantRole: 'participant',
          hasPersonalChanges: false,
          createdAt: existingPersonalEvent?.createdAt || serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      )

      const updateData = {
        invitedPeople: updatedInvitedPeople || [],
        participantIds: arrayUnion(userId),
        updatedAt: serverTimestamp(),
      }

      if (!previousParticipant) {
        updateData.participants = arrayUnion(participant)
        updateData.participantCount = increment(1)
      }

      batch.update(inviteEventRef, updateData)

      await batch.commit()

      setMessage('Invito accettato. Evento aggiunto al tuo calendario.')
    } catch (acceptError) {
      console.error(acceptError)
      setError('Errore durante l’accettazione dell’invito.')
    }
  }

  async function handleDeclineInvite(inviteEvent) {
    setError('')
    setMessage('')

    if (!userId || !userEmail) {
      setError('Devi essere autenticato per rifiutare un invito.')
      return
    }

    if (inviteEvent.ownerId === userId) {
      setError('Sei il creatore di questo evento.')
      return
    }

    try {
      const batch = writeBatch(db)

      const inviteEventRef = doc(db, 'inviteEvents', inviteEvent.id)

      const updatedInvitedPeople = inviteEvent.invitedPeople?.map((person) => {
        const isCurrentUser =
          normalizeEmail(person.email || '') === normalizeEmail(userEmail)

        if (!isCurrentUser) return person

        return {
          ...person,
          uid: person.uid || userId,
          name: person.name || userName,
          role: person.role || 'participant',
          status: 'declined',
          declinedAt: new Date().toISOString(),
        }
      })

      const participantToRemove = inviteEvent.participants?.find(
        (participantItem) =>
          participantItem.uid === userId ||
          normalizeEmail(participantItem.email || '') ===
            normalizeEmail(userEmail)
      )

      const updateData = {
        invitedPeople: updatedInvitedPeople || [],
        participantIds: arrayRemove(userId),
        updatedAt: serverTimestamp(),
      }

      if (participantToRemove) {
        updateData.participants = arrayRemove(participantToRemove)
        updateData.participantCount = increment(-1)
      }

      batch.update(inviteEventRef, updateData)

      await batch.commit()

      setMessage('Invito rifiutato.')
    } catch (declineError) {
      console.error(declineError)
      setError('Errore durante il rifiuto dell’invito.')
    }
  }

  async function handleRemoveInviteParticipant(inviteEvent, personToRemove) {
    setError('')
    setMessage('')

    if (!inviteEvent?.id || !personToRemove?.email) {
      setError('Partecipante non valido.')
      return
    }

    if (inviteEvent.ownerId !== userId) {
      setError('Solo il creatore può rimuovere un partecipante.')
      return
    }

    try {
      const batch = writeBatch(db)
      const inviteEventRef = doc(db, 'inviteEvents', inviteEvent.id)

      const removedAt = new Date().toISOString()

      const updatedInvitedPeople = inviteEvent.invitedPeople?.map((person) => {
        const isTarget =
          normalizeEmail(person.email || '') ===
          normalizeEmail(personToRemove.email || '')

        if (!isTarget) return person

        return {
          ...person,
          status: 'removed',
          removedAt,
          declinedAt: '',
        }
      })

      const participantToRemove = inviteEvent.participants?.find(
        (participant) =>
          participant.uid === personToRemove.uid ||
          normalizeEmail(participant.email || '') ===
            normalizeEmail(personToRemove.email || '')
      )

      const updateData = {
        invitedPeople: updatedInvitedPeople || [],
        updatedAt: serverTimestamp(),
      }

      if (personToRemove.uid) {
        updateData.participantIds = arrayRemove(personToRemove.uid)
      }

      if (participantToRemove) {
        updateData.participants = arrayRemove(participantToRemove)
        updateData.participantCount = increment(-1)
      }

      batch.update(inviteEventRef, updateData)

      await batch.commit()

      setMessage('Partecipante rimosso dall’evento.')
    } catch (removeError) {
      console.error(removeError)
      setError('Errore durante la rimozione del partecipante.')
    }
  }

  async function handleReinvitePerson(inviteEvent, personToReinvite) {
    setError('')
    setMessage('')

    if (!inviteEvent?.id || !personToReinvite?.email) {
      setError('Invitato non valido.')
      return
    }

    if (inviteEvent.ownerId !== userId) {
      setError('Solo il creatore può reinvitare una persona.')
      return
    }

    try {
      const batch = writeBatch(db)
      const inviteEventRef = doc(db, 'inviteEvents', inviteEvent.id)

      const invitedAt = new Date().toISOString()

      const updatedInvitedPeople = inviteEvent.invitedPeople?.map((person) => {
        const isTarget =
          normalizeEmail(person.email || '') ===
          normalizeEmail(personToReinvite.email || '')

        if (!isTarget) return person

        return {
          ...person,
          status: 'invited',
          invitedAt,
          declinedAt: '',
          removedAt: '',
        }
      })

      batch.update(inviteEventRef, {
        invitedPeople: updatedInvitedPeople || [],
        updatedAt: serverTimestamp(),
      })

      await batch.commit()

      setMessage(
        'Invito inviato nuovamente. La persona potrà accettare o rifiutare.'
      )
    } catch (reinviteError) {
      console.error(reinviteError)
      setError('Errore durante il reinvito.')
    }
  }

  async function handleRestoreOfficialData(eventItem) {
    setError('')
    setMessage('')

    const officialSourceEvent = getOfficialSourceEvent(eventItem)

    if (!officialSourceEvent) {
      setError('Evento originale non disponibile.')
      return
    }

    try {
      const batch = writeBatch(db)
      const personalEventRef = doc(db, 'users', userId, 'events', eventItem.id)

      batch.update(personalEventRef, {
        title: officialSourceEvent.title || '',
        date: officialSourceEvent.date || '',
        time: officialSourceEvent.time || '',
        location: officialSourceEvent.location || '',
        description: officialSourceEvent.description || '',
        hasPersonalChanges: false,
        updatedAt: serverTimestamp(),
      })

      await batch.commit()

      clearEventWeather(eventItem.id)
      clearEventReminder(eventItem.id)

      if (editEventId === eventItem.id) {
        resetForm()
      }

      setMessage('Dati del creatore ripristinati.')
    } catch (restoreError) {
      console.error(restoreError)
      setError('Errore durante il ripristino dei dati del creatore.')
    }
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

    const eventToEditBeforeValidation = editEventId
      ? events.find((eventItem) => eventItem.id === editEventId)
      : null

    const inviteSourceBeforeValidation = getInviteSourceEvent(
      eventToEditBeforeValidation
    )

    const publicSourceBeforeValidation = getPublicSourceEvent(
      eventToEditBeforeValidation
    )

    const isEditingCopiedPublicBeforeValidation = Boolean(
      eventToEditBeforeValidation?.sourcePublicEventId &&
        publicSourceBeforeValidation?.ownerId !== userId
    )

    const isEditingCopiedInviteBeforeValidation = Boolean(
      eventToEditBeforeValidation?.sourceInviteEventId &&
        inviteSourceBeforeValidation?.ownerId !== userId
    )

    const isEditingPersonalCopyBeforeValidation =
      isEditingCopiedPublicBeforeValidation ||
      isEditingCopiedInviteBeforeValidation

    if (
      visibility === 'invite' &&
      !isEditingPersonalCopyBeforeValidation &&
      inviteEmailInput.trim()
    ) {
      addInviteEmailsFromText(inviteEmailInput)
      return
    }

    if (
      visibility === 'invite' &&
      !isEditingPersonalCopyBeforeValidation &&
      inviteEmails.length === 0
    ) {
      setError('Inserisci almeno una email invitata diversa dalla tua.')
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
      email: userEmail,
      name: userName,
      role: 'owner',
      status: 'accepted',
      joinedAt: new Date().toISOString(),
    }

    try {
      const batch = writeBatch(db)

      if (editEventId) {
        const eventRef = doc(db, 'users', userId, 'events', editEventId)

        const eventToEdit = events.find(
          (eventItem) => eventItem.id === editEventId
        )

        const inviteSourceEvent = getInviteSourceEvent(eventToEdit)
        const publicSourceEvent = getPublicSourceEvent(eventToEdit)

        const isOwnedPublicEvent =
          eventToEdit?.sourcePublicEventId &&
          publicSourceEvent?.ownerId === userId &&
          !isPublicSourceMissing(eventToEdit)

        const isOwnedInviteEvent =
          eventToEdit?.sourceInviteEventId &&
          inviteSourceEvent?.ownerId === userId

        const isCopiedPublicEvent =
          eventToEdit?.sourcePublicEventId &&
          publicSourceEvent?.ownerId !== userId

        const isCopiedInviteEvent =
          eventToEdit?.sourceInviteEventId &&
          inviteSourceEvent?.ownerId !== userId

        const isUnavailablePublicEvent =
          eventToEdit && isPublicSourceMissing(eventToEdit)

        const isUnavailableInviteEvent =
          eventToEdit && isInviteSourceMissing(eventToEdit)

        if (
          isCopiedPublicEvent ||
          isCopiedInviteEvent ||
          isUnavailablePublicEvent ||
          isUnavailableInviteEvent
        ) {
          batch.update(eventRef, {
            ...eventData,
            hasPersonalChanges:
              isCopiedPublicEvent || isCopiedInviteEvent ? true : false,
            updatedAt: serverTimestamp(),
          })

          await batch.commit()

          clearEventWeather(editEventId)
          clearEventReminder(editEventId)

          setMessage(
            isUnavailablePublicEvent
              ? 'Copia personale aggiornata. L’evento pubblico originale non è più disponibile.'
              : isUnavailableInviteEvent
                ? 'Copia personale aggiornata. L’evento su invito originale non è più disponibile.'
                : 'Copia personale aggiornata. Ora stai usando modifiche personali.'
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
              sourceInviteEventId: '',
              sourceOwnerId: userId,
              invitedEmails: [],
              invitedPeople: [],
              participantRole: 'owner',
              hasPersonalChanges: false,
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
            if (isOwnedInviteEvent) {
              await removeOwnedInviteEventIfExists(batch, eventToEdit)
            }

            const publicEventRef = doc(collection(db, 'publicEvents'))

            batch.update(eventRef, {
              ...eventData,
              visibility: 'public',
              sourcePublicEventId: publicEventRef.id,
              sourceInviteEventId: '',
              sourceOwnerId: userId,
              invitedEmails: [],
              invitedPeople: [],
              participantRole: 'owner',
              hasPersonalChanges: false,
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
        } else if (visibility === 'invite') {
          const invitedEmails = inviteEmails
          const invitedPeople = createInvitedPeople(
            invitedEmails,
            userEmail,
            inviteSourceEvent?.invitedPeople || eventToEdit?.invitedPeople || []
          )

          if (invitedPeople.length === 0) {
            setError('Inserisci almeno una email invitata diversa dalla tua.')
            return
          }

          if (isOwnedPublicEvent) {
            const canRemovePublicEvent = await removeOwnedPublicEventIfPossible(
              batch,
              eventToEdit
            )

            if (!canRemovePublicEvent) return
          }

          if (isOwnedInviteEvent) {
            const inviteEventRef = doc(
              db,
              'inviteEvents',
              eventToEdit.sourceInviteEventId
            )

            batch.update(eventRef, {
              ...eventData,
              visibility: 'invite',
              sourcePublicEventId: '',
              sourceInviteEventId: eventToEdit.sourceInviteEventId,
              sourceOwnerId: userId,
              invitedEmails,
              invitedPeople,
              participantRole: 'owner',
              hasPersonalChanges: false,
              updatedAt: serverTimestamp(),
            })

            batch.update(inviteEventRef, {
              ...eventData,
              visibility: 'invite',
              sourceInviteEventId: eventToEdit.sourceInviteEventId,
              sourceOwnerId: userId,
              ownerId: userId,
              ownerName: userName,
              ownerEmail: userEmail,
              invitedEmails,
              invitedPeople,
              updatedAt: serverTimestamp(),
            })
          } else {
            const inviteEventRef = doc(collection(db, 'inviteEvents'))

            batch.update(eventRef, {
              ...eventData,
              visibility: 'invite',
              sourcePublicEventId: '',
              sourceInviteEventId: inviteEventRef.id,
              sourceOwnerId: userId,
              invitedEmails,
              invitedPeople,
              participantRole: 'owner',
              hasPersonalChanges: false,
              updatedAt: serverTimestamp(),
            })

            batch.set(inviteEventRef, {
              ...eventData,
              visibility: 'invite',
              sourceInviteEventId: inviteEventRef.id,
              sourceOwnerId: userId,
              ownerId: userId,
              ownerName: userName,
              ownerEmail: userEmail,
              invitedEmails,
              invitedPeople,
              participantIds: [userId],
              participants: [participant],
              participantCount: 1,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            })
          }
        } else {
          if (isOwnedPublicEvent) {
            const canRemovePublicEvent = await removeOwnedPublicEventIfPossible(
              batch,
              eventToEdit
            )

            if (!canRemovePublicEvent) return
          }

          if (isOwnedInviteEvent) {
            await removeOwnedInviteEventIfExists(batch, eventToEdit)
          }

          batch.update(eventRef, {
            ...eventData,
            visibility: 'private',
            sourcePublicEventId: '',
            sourceInviteEventId: '',
            sourceOwnerId: '',
            invitedEmails: [],
            invitedPeople: [],
            participantRole: 'owner',
            hasPersonalChanges: false,
            updatedAt: serverTimestamp(),
          })
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
          sourceInviteEventId: '',
          sourceOwnerId: userId,
          invitedEmails: [],
          invitedPeople: [],
          participantRole: 'owner',
          hasPersonalChanges: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      } else if (visibility === 'invite') {
        const invitedEmails = inviteEmails
        const invitedPeople = createInvitedPeople(invitedEmails, userEmail)

        if (invitedPeople.length === 0) {
          setError('Inserisci almeno una email invitata diversa dalla tua.')
          return
        }

        const inviteEventRef = doc(collection(db, 'inviteEvents'))

        batch.set(inviteEventRef, {
          ...eventData,
          visibility: 'invite',
          sourceInviteEventId: inviteEventRef.id,
          sourceOwnerId: userId,
          ownerId: userId,
          ownerName: userName,
          ownerEmail: userEmail,
          invitedEmails,
          invitedPeople,
          participantIds: [userId],
          participants: [participant],
          participantCount: 1,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })

        batch.set(personalEventRef, {
          ...eventData,
          visibility: 'invite',
          sourcePublicEventId: '',
          sourceInviteEventId: inviteEventRef.id,
          sourceOwnerId: userId,
          invitedEmails,
          invitedPeople,
          participantRole: 'owner',
          hasPersonalChanges: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      } else {
        batch.set(personalEventRef, {
          ...eventData,
          visibility: 'private',
          sourcePublicEventId: '',
          sourceInviteEventId: '',
          sourceOwnerId: '',
          invitedEmails: [],
          invitedPeople: [],
          participantRole: 'owner',
          hasPersonalChanges: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      }

      await batch.commit()

      setMessage(
        visibility === 'public'
          ? 'Evento pubblico creato e pubblicato in Esplora eventi.'
          : visibility === 'invite'
            ? 'Evento su invito creato correttamente.'
            : 'Evento privato creato correttamente.'
      )

      resetForm()
    } catch (saveError) {
      console.error(saveError)
      setError('Errore durante il salvataggio dell’evento.')
    }
  }

  function handleStartEdit(eventItem) {
    const inviteSourceEvent = getInviteSourceEvent(eventItem)
    const publicSourceEvent = getPublicSourceEvent(eventItem)
    const officialSourceEvent = getOfficialSourceEvent(eventItem)
    const eventForInviteData = inviteSourceEvent || eventItem
    const displayEvent = getEventDisplayData(eventItem)

    setEditEventId(eventItem.id)
    setTitle(displayEvent.title || '')
    setDate(displayEvent.date || '')
    setTime(displayEvent.time || '')
    setLocation(displayEvent.location || '')
    setDescription(displayEvent.description || '')
    setInviteEmails(getInviteEmailsFromEvent(eventForInviteData, userEmail))
    setInviteEmailInput('')

    if (
      eventItem.sourcePublicEventId &&
      publicSourceEvent?.ownerId === userId &&
      !isPublicSourceMissing(eventItem)
    ) {
      setVisibility('public')
    } else if (
      eventItem.sourceInviteEventId &&
      inviteSourceEvent?.ownerId === userId
    ) {
      setVisibility('invite')
    } else if (officialSourceEvent) {
      setVisibility(eventItem.visibility || 'private')
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
      const displayEvent = getEventDisplayData(eventToKeep)

      const batch = writeBatch(db)

      const personalEventRef = doc(db, 'users', userId, 'events', eventId)

      batch.update(personalEventRef, {
        title: displayEvent.title || '',
        date: displayEvent.date || '',
        time: displayEvent.time || '',
        location: displayEvent.location || '',
        description: displayEvent.description || '',
        visibility: 'private',
        sourcePublicEventId: '',
        sourceInviteEventId: '',
        sourceOwnerId: '',
        invitedEmails: [],
        invitedPeople: [],
        participantRole: 'owner',
        hasPersonalChanges: false,
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

        if (publicEventSnapshot.exists()) {
          const publicEventData = publicEventSnapshot.data()

          if (publicEventData.ownerId === userId) {
            batch.delete(publicEventRef)
          } else {
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
      }

      if (eventToDelete?.sourceInviteEventId) {
        const inviteEventRef = doc(
          db,
          'inviteEvents',
          eventToDelete.sourceInviteEventId
        )

        const inviteEventSnapshot = await getDoc(inviteEventRef)

        if (inviteEventSnapshot.exists()) {
          const inviteEventData = inviteEventSnapshot.data()

          if (inviteEventData.ownerId === userId) {
            batch.delete(inviteEventRef)
          } else {
            const updatedInvitedPeople = inviteEventData.invitedPeople?.map(
              (person) => {
                const isCurrentUser =
                  person.uid === userId ||
                  normalizeEmail(person.email || '') ===
                    normalizeEmail(userEmail)

                if (!isCurrentUser) return person

                return {
                  ...person,
                  uid: person.uid || userId,
                  name: person.name || userName,
                  status: 'declined',
                  declinedAt: new Date().toISOString(),
                }
              }
            )

            const participantToRemove = inviteEventData.participants?.find(
              (participantItem) => participantItem.uid === userId
            )

            const updateData = {
              invitedPeople: updatedInvitedPeople || [],
              participantIds: arrayRemove(userId),
              updatedAt: serverTimestamp(),
            }

            if (participantToRemove) {
              updateData.participants = arrayRemove(participantToRemove)
              updateData.participantCount = increment(-1)
            }

            batch.update(inviteEventRef, updateData)
          }
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
          getPublicSourceEvent(eventToDelete)?.ownerId !== userId
          ? 'Evento rimosso dal tuo calendario e partecipazione annullata.'
          : eventToDelete?.sourceInviteEventId
            ? 'Evento rimosso dal tuo calendario.'
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

    if (isInviteSourceMissing(eventItem)) {
      setWeatherError(
        'Questo evento su invito non è più disponibile. Puoi mantenerlo come copia personale oppure rimuoverlo dal calendario.'
      )
      return
    }

    const displayEvent = getEventDisplayData(eventItem)

    if (!displayEvent.location) {
      setWeatherError('Inserisci un luogo per vedere il meteo.')
      return
    }

    if (!displayEvent.date || !displayEvent.time) {
      setWeatherError('Inserisci data e ora per vedere il meteo previsto.')
      return
    }

    setWeatherError('')
    setWeatherLoading(eventItem.id)

    clearEventWeather(eventItem.id)

    try {
      const weather = await getWeatherForCity(
        displayEvent.location,
        displayEvent.date,
        displayEvent.time
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

    if (isInviteSourceMissing(eventItem)) {
      setReminderError(
        'Questo evento su invito non è più disponibile. Puoi mantenerlo come copia personale oppure rimuoverlo dal calendario.'
      )
      return
    }

    const displayEvent = getEventDisplayData(eventItem)

    if (!displayEvent.date || !displayEvent.time) {
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

      const timeoutId = scheduleEventNotification({
        ...displayEvent,
        id: eventItem.id,
      })

      setScheduledReminders((previousReminders) => ({
        ...previousReminders,
        [eventItem.id]: timeoutId,
      }))

      setReminderByEvent((previousMessages) => ({
        ...previousMessages,
        [eventItem.id]: `Promemoria attivo per le ${displayEvent.time}`,
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
              Crea impegni privati, pubblici o su invito, collega il meteo,
              attiva promemoria e ritrova tutto nel calendario.
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
            <span>Su invito</span>
            <strong>{savedInviteEvents.length}</strong>
          </article>

          <article className="events-summary-card">
            <span>Inviti ricevuti</span>
            <strong>{pendingInvites.length}</strong>
          </article>

          <article className="events-summary-card">
            <span>Da controllare</span>
            <strong>
              {unavailablePublicEvents.length + unavailableInviteEvents.length}
            </strong>
          </article>
        </div>

        {pendingInvites.length > 0 && (
          <section className="received-invites-section">
            <div className="received-invites-header">
              <div>
                <span className="dashboard-badge">Inviti ricevuti</span>
                <h2>Eventi da confermare</h2>
                <p>
                  Accetta un invito per aggiungerlo al tuo calendario oppure
                  rifiutalo se non vuoi partecipare.
                </p>
              </div>
            </div>

            <div className="received-invites-list">
              {pendingInvites.map((inviteEvent) => (
                <article className="received-invite-card" key={inviteEvent.id}>
                  <div>
                    <div className="event-title-row">
                      <h3>{inviteEvent.title}</h3>
                      <span className="event-visibility-pill invite">
                        Invito ricevuto
                      </span>
                    </div>

                    <div className="event-meta-pills">
                      <span className="event-date-pill">
                        {formatDateLabel(inviteEvent.date)}
                      </span>

                      <span className="event-time-pill">
                        {inviteEvent.time || 'Ora non specificata'}
                      </span>
                    </div>

                    {inviteEvent.location && (
                      <p className="event-location">📍 {inviteEvent.location}</p>
                    )}

                    {inviteEvent.description && (
                      <p className="event-description">
                        {inviteEvent.description}
                      </p>
                    )}

                    <p className="received-invite-owner">
                      Invitato da:{' '}
                      <strong>
                        {inviteEvent.ownerName ||
                          inviteEvent.ownerEmail ||
                          'Creatore evento'}
                      </strong>
                    </p>
                  </div>

                  <div className="received-invite-actions">
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => handleAcceptInvite(inviteEvent)}
                    >
                      Accetta
                    </button>

                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => handleDeclineInvite(inviteEvent)}
                    >
                      Rifiuta
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

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

        {unavailableInviteEvents.length > 0 && (
          <div className="events-public-warning">
            <strong>Ci sono eventi su invito non più disponibili</strong>
            <p>
              Alcuni eventi su invito sono stati eliminati dal creatore oppure
              la tua partecipazione è stata rimossa o rifiutata. Puoi mantenerli
              come eventi privati nel tuo calendario oppure rimuoverli.
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
            ) : isEditingUnavailableInviteEvent ? (
              <div className="event-visibility-info unavailable">
                <strong>Evento su invito non più disponibile</strong>
                <p>
                  L’evento originale è stato eliminato dal creatore oppure la tua
                  partecipazione è stata rimossa o rifiutata. Puoi modificare
                  questa copia personale, mantenerla come evento privato oppure
                  eliminarla dal tuo calendario.
                </p>
              </div>
            ) : isEditingCopiedPublicEvent || isEditingCopiedInviteEvent ? (
              <div className="event-visibility-info">
                <strong>
                  {isEditingCopiedInviteEvent
                    ? 'Evento ricevuto su invito'
                    : 'Evento aggiunto da Esplora eventi'}
                </strong>
                <p>
                  Stai modificando la tua copia personale. L’evento originale
                  del creatore non viene modificato.
                </p>
              </div>
            ) : (
              <>
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

                    <label
                      className={
                        visibility === 'invite'
                          ? 'event-visibility-option active'
                          : 'event-visibility-option'
                      }
                    >
                      <input
                        type="radio"
                        name="visibility"
                        value="invite"
                        checked={visibility === 'invite'}
                        onChange={() => setVisibility('invite')}
                      />

                      <div>
                        <strong>Su invito</strong>
                        <p>Lo vedono solo le email invitate.</p>
                      </div>
                    </label>
                  </div>
                </div>

                {visibility === 'invite' && (
                  <div className="invite-email-field">
                    <span>Email invitate</span>

                    <div
                      className="invite-email-chip-box"
                      onClick={() => inviteInputRef.current?.focus()}
                    >
                      {inviteEmails.map((email) => (
                        <span className="invite-email-chip" key={email}>
                          {email}

                          <button
                            type="button"
                            onClick={() => removeInviteEmail(email)}
                            aria-label={`Rimuovi ${email}`}
                          >
                            ×
                          </button>
                        </span>
                      ))}

                      <input
                        ref={inviteInputRef}
                        type="text"
                        placeholder={
                          inviteEmails.length === 0
                            ? 'Scrivi un’email e premi Invio...'
                            : 'Aggiungi email...'
                        }
                        value={inviteEmailInput}
                        onChange={(event) =>
                          setInviteEmailInput(event.target.value)
                        }
                        onKeyDown={handleInviteEmailKeyDown}
                        onPaste={handleInviteEmailPaste}
                        onBlur={() => {
                          if (inviteEmailInput.trim()) {
                            addInviteEmailsFromText(inviteEmailInput)
                          }
                        }}
                      />
                    </div>

                    <p>
                      Premi Invio, Tab, spazio o virgola per aggiungere l’email.
                      Puoi anche incollare più email insieme.
                    </p>
                  </div>
                )}
              </>
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
                const publicSourceMissing = isPublicSourceMissing(eventItem)
                const inviteSourceMissing = isInviteSourceMissing(eventItem)
                const isInviteEvent = Boolean(eventItem.sourceInviteEventId)

                const inviteSourceEvent = getInviteSourceEvent(eventItem)
                const publicSourceEvent = getPublicSourceEvent(eventItem)
                const officialSourceEvent = getOfficialSourceEvent(eventItem)

                const inviteDisplayEvent = inviteSourceEvent || eventItem
                const displayEvent = getEventDisplayData(eventItem)

                const isPast = displayEvent.date < today

                const isCurrentUserInviteOwner =
                  isInviteEvent &&
                  Boolean(inviteSourceEvent) &&
                  inviteSourceEvent.ownerId === userId

                const hasPersonalVersion =
                  hasPersonalChanges(eventItem) &&
                  Boolean(officialSourceEvent) &&
                  officialSourceEvent.ownerId !== userId

                const eventInviteEmails = getInviteEmailsFromEvent(
                  inviteDisplayEvent,
                  userEmail
                )

                const invitePeopleGroups =
                  getInvitePeopleGroups(inviteDisplayEvent)

                return (
                  <article
                    className={
                      publicSourceMissing || inviteSourceMissing
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
                            <h3>{displayEvent.title}</h3>

                            <span
                              className={`event-visibility-pill ${getEventVisibilityClass(
                                eventItem,
                                userId,
                                publicSourceMissing,
                                inviteSourceMissing,
                                inviteSourceEvent,
                                publicSourceEvent
                              )}`}
                            >
                              {getEventVisibilityLabel(
                                eventItem,
                                userId,
                                publicSourceMissing,
                                inviteSourceMissing,
                                inviteSourceEvent,
                                publicSourceEvent
                              )}
                            </span>
                          </div>

                          <div className="event-meta-pills">
                            <span className="event-date-pill">
                              {formatDateLabel(displayEvent.date)}
                            </span>

                            <span className="event-time-pill">
                              {displayEvent.time || 'Ora non specificata'}
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

                      {inviteSourceMissing && (
                        <div className="event-unavailable-box">
                          <strong>Evento su invito non più disponibile</strong>
                          <p>
                            L’evento originale è stato eliminato dal creatore
                            oppure la tua partecipazione è stata rimossa o
                            rifiutata. Puoi mantenerlo come evento privato nel
                            tuo calendario oppure rimuoverlo.
                          </p>
                        </div>
                      )}

                      {hasPersonalVersion && (
                        <div className="event-unavailable-box">
                          <strong>Modifiche personali attive</strong>
                          <p>
                            Stai visualizzando la tua versione personale
                            dell’evento. Le modifiche del creatore restano
                            disponibili e puoi ripristinarle quando vuoi.
                          </p>
                        </div>
                      )}

                      {isCurrentUserInviteOwner && (
                        <div className="invite-management-box">
                          <div className="invite-management-header">
                            <div>
                              <strong>Gestione inviti</strong>
                              <p>
                                Controlla chi ha accettato, chi deve ancora
                                rispondere e chi ha rifiutato l’invito.
                              </p>
                            </div>

                            {eventInviteEmails.length > 0 && (
                              <button
                                type="button"
                                className="btn btn-secondary invite-mail-button"
                                onClick={() =>
                                  handleSendInviteEmails(inviteDisplayEvent)
                                }
                              >
                                Invia email agli invitati
                              </button>
                            )}
                          </div>

                          <div className="invite-stats-grid">
                            <div className="invite-stat-card">
                              <span>Invitati</span>
                              <strong>{invitePeopleGroups.total}</strong>
                            </div>

                            <div className="invite-stat-card accepted">
                              <span>Partecipanti</span>
                              <strong>
                                {invitePeopleGroups.accepted.length}
                              </strong>
                            </div>

                            <div className="invite-stat-card pending">
                              <span>In attesa</span>
                              <strong>{invitePeopleGroups.pending.length}</strong>
                            </div>

                            <div className="invite-stat-card declined">
                              <span>Rifiutati</span>
                              <strong>
                                {invitePeopleGroups.declined.length}
                              </strong>
                            </div>
                          </div>

                          <div className="invite-groups">
                            <div className="invite-group accepted">
                              <div className="invite-group-title">
                                <span>✅</span>
                                <strong>Partecipanti confermati</strong>
                              </div>

                              {invitePeopleGroups.accepted.length > 0 ? (
                                <div className="invite-person-list">
                                  {invitePeopleGroups.accepted.map((person) => (
                                    <div
                                      className="invite-person-row"
                                      key={person.email}
                                    >
                                      <div>
                                        <strong>
                                          {getInvitePersonDisplayName(person)}
                                        </strong>
                                        <span>{person.email}</span>
                                      </div>

                                      <div className="invite-person-actions">
                                        <span className="invite-status-pill accepted">
                                          Accettato
                                        </span>

                                        <button
                                          type="button"
                                          className="btn btn-danger invite-small-action"
                                          onClick={() =>
                                            handleRemoveInviteParticipant(
                                              inviteDisplayEvent,
                                              person
                                            )
                                          }
                                        >
                                          Rimuovi
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="invite-empty-text">
                                  Nessun partecipante ha ancora accettato.
                                </p>
                              )}
                            </div>

                            <div className="invite-group pending">
                              <div className="invite-group-title">
                                <span>⏳</span>
                                <strong>In attesa di risposta</strong>
                              </div>

                              {invitePeopleGroups.pending.length > 0 ? (
                                <div className="invite-person-list">
                                  {invitePeopleGroups.pending.map((person) => (
                                    <div
                                      className="invite-person-row"
                                      key={person.email}
                                    >
                                      <div>
                                        <strong>
                                          {getInvitePersonDisplayName(person)}
                                        </strong>
                                        <span>{person.email}</span>
                                      </div>

                                      <span className="invite-status-pill pending">
                                        In attesa
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="invite-empty-text">
                                  Nessun invito in attesa.
                                </p>
                              )}
                            </div>

                            <div className="invite-group declined">
                              <div className="invite-group-title">
                                <span>❌</span>
                                <strong>Hanno rifiutato</strong>
                              </div>

                              {invitePeopleGroups.declined.length > 0 ? (
                                <div className="invite-person-list">
                                  {invitePeopleGroups.declined.map((person) => (
                                    <div
                                      className="invite-person-row"
                                      key={person.email}
                                    >
                                      <div>
                                        <strong>
                                          {getInvitePersonDisplayName(person)}
                                        </strong>
                                        <span>{person.email}</span>
                                      </div>

                                      <div className="invite-person-actions">
                                        <span className="invite-status-pill declined">
                                          Rifiutato
                                        </span>

                                        <button
                                          type="button"
                                          className="btn btn-secondary invite-small-action"
                                          onClick={() =>
                                            handleReinvitePerson(
                                              inviteDisplayEvent,
                                              person
                                            )
                                          }
                                        >
                                          Reinvita
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="invite-empty-text">
                                  Nessun invitato ha rifiutato.
                                </p>
                              )}
                            </div>

                            {invitePeopleGroups.removed.length > 0 && (
                              <div className="invite-group removed">
                                <div className="invite-group-title">
                                  <span>🚫</span>
                                  <strong>Rimossi</strong>
                                </div>

                                <div className="invite-person-list">
                                  {invitePeopleGroups.removed.map((person) => (
                                    <div
                                      className="invite-person-row"
                                      key={person.email}
                                    >
                                      <div>
                                        <strong>
                                          {getInvitePersonDisplayName(person)}
                                        </strong>
                                        <span>{person.email}</span>
                                      </div>

                                      <div className="invite-person-actions">
                                        <span className="invite-status-pill removed">
                                          Rimosso
                                        </span>

                                        <button
                                          type="button"
                                          className="btn btn-secondary invite-small-action"
                                          onClick={() =>
                                            handleReinvitePerson(
                                              inviteDisplayEvent,
                                              person
                                            )
                                          }
                                        >
                                          Reinvita
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {displayEvent.location && (
                        <p className="event-location">
                          📍 {displayEvent.location}
                        </p>
                      )}

                      {displayEvent.description && (
                        <p className="event-description">
                          {displayEvent.description}
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

                          <span>{displayEvent.time}</span>
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
                        disabled={publicSourceMissing || inviteSourceMissing}
                      >
                        {weatherLoading === eventItem.id
                          ? 'Caricamento...'
                          : 'Meteo'}
                      </button>

                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => handleScheduleReminder(eventItem)}
                        disabled={
                          isPast || publicSourceMissing || inviteSourceMissing
                        }
                      >
                        Promemoria
                      </button>

                      {hasPersonalVersion && (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => handleRestoreOfficialData(eventItem)}
                        >
                          Ripristina dati del creatore
                        </button>
                      )}

                      {(publicSourceMissing || inviteSourceMissing) && (
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
                        {publicSourceMissing || inviteSourceMissing
                          ? 'Rimuovi dal calendario'
                          : eventItem.sourceInviteEventId ||
                              eventItem.sourcePublicEventId
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
