import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import {
  addDoc,
  arrayRemove,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore'

import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import itLocale from '@fullcalendar/core/locales/it'

import { db } from '../services/firebase'
import { useAuth } from '../context/AuthContext'

// Helper di formattazione, colori e classificazione usati da FullCalendar.
function normalizeEmail(email) {
  return email.trim().toLowerCase()
}

function getPriorityLabel(priority) {
  if (priority === 'alta') return 'Alta'
  if (priority === 'bassa') return 'Bassa'
  return 'Media'
}

function getPriorityClass(priority) {
  if (priority === 'alta') return 'task-priority-alta'
  if (priority === 'bassa') return 'task-priority-bassa'
  return 'task-priority-media'
}

function getTaskPriorityColors(priority) {
  if (priority === 'alta') {
    return {
      backgroundColor: '#fee2e2',
      borderColor: '#dc2626',
      textColor: '#991b1b',
    }
  }

  if (priority === 'bassa') {
    return {
      backgroundColor: '#dcfce7',
      borderColor: '#16a34a',
      textColor: '#166534',
    }
  }

  return {
    backgroundColor: '#fef3c7',
    borderColor: '#d97706',
    textColor: '#92400e',
  }
}

function getHolidayColors() {
  return {
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderColor: '#16a34a',
    textColor: '#166534',
  }
}

function getUnavailableEventColors() {
  return {
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b',
    textColor: '#92400e',
  }
}

function formatDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function formatTime(date) {
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')

  return `${hours}:${minutes}`
}

function getCalendarEventKind(eventItem, userId) {
  if (eventItem.sourceInviteEventId && eventItem.sourceOwnerId === userId) {
    return 'invite'
  }

  if (eventItem.sourceInviteEventId && eventItem.sourceOwnerId !== userId) {
    return 'invited'
  }

  if (eventItem.sourcePublicEventId && eventItem.sourceOwnerId !== userId) {
    return 'explore'
  }

  if (eventItem.visibility === 'public' || eventItem.sourcePublicEventId) {
    return 'public'
  }

  return 'private'
}

function getCalendarEventColors(kind) {
  if (kind === 'unavailable') {
    return getUnavailableEventColors()
  }

  if (kind === 'public') {
    return {
      backgroundColor: '#f3e8ff',
      borderColor: '#9333ea',
      textColor: '#6b21a8',
    }
  }

  if (kind === 'explore') {
    return {
      backgroundColor: '#fce7f3',
      borderColor: '#db2777',
      textColor: '#9d174d',
    }
  }

  if (kind === 'invite' || kind === 'invited') {
    return {
      backgroundColor: '#fed7aa',
      borderColor: '#ea580c',
      textColor: '#7c2d12',
    }
  }

  return {
    backgroundColor: '#dbeafe',
    borderColor: '#2563eb',
    textColor: '#1e3a8a',
  }
}

function getEventVisibilityLabel(
  eventItem,
  userId,
  isPublicSourceMissing = false
) {
  if (isPublicSourceMissing) {
    return 'Non più pubblico'
  }

  if (eventItem.sourceInviteEventId && eventItem.sourceOwnerId === userId) {
    return 'Su invito'
  }

  if (eventItem.sourceInviteEventId && eventItem.sourceOwnerId !== userId) {
    return 'Invitato'
  }

  if (eventItem.sourcePublicEventId && eventItem.sourceOwnerId !== userId) {
    return 'Da Esplora'
  }

  if (eventItem.visibility === 'public' || eventItem.sourcePublicEventId) {
    return 'Pubblico'
  }

  return 'Privato'
}

function getEventVisibilityClass(
  eventItem,
  userId,
  isPublicSourceMissing = false
) {
  if (isPublicSourceMissing) {
    return 'unavailable'
  }

  if (eventItem.sourceInviteEventId && eventItem.sourceOwnerId === userId) {
    return 'invite'
  }

  if (eventItem.sourceInviteEventId && eventItem.sourceOwnerId !== userId) {
    return 'invited'
  }

  if (eventItem.sourcePublicEventId && eventItem.sourceOwnerId !== userId) {
    return 'explore'
  }

  if (eventItem.visibility === 'public' || eventItem.sourcePublicEventId) {
    return 'public'
  }

  return 'private'
}

function addDays(date, days) {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

// Calcola le festivita italiane fisse e mobili mostrate nel calendario.
function getEasterDate(year) {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1

  return new Date(year, month - 1, day)
}

function getItalianHolidaysForYear(year) {
  const easterDate = getEasterDate(year)
  const easterMondayDate = addDays(easterDate, 1)

  return [
    {
      id: `holiday-${year}-01-01`,
      title: 'Capodanno',
      date: `${year}-01-01`,
      description: 'Primo giorno dell’anno.',
    },
    {
      id: `holiday-${year}-01-06`,
      title: 'Epifania',
      date: `${year}-01-06`,
      description: 'Festività nazionale.',
    },
    {
      id: `holiday-${year}-easter`,
      title: 'Pasqua',
      date: formatDate(easterDate),
      description: 'Festività mobile.',
    },
    {
      id: `holiday-${year}-easter-monday`,
      title: 'Pasquetta',
      date: formatDate(easterMondayDate),
      description: 'Lunedì dell’Angelo.',
    },
    {
      id: `holiday-${year}-04-25`,
      title: 'Festa della Liberazione',
      date: `${year}-04-25`,
      description: 'Festività nazionale italiana.',
    },
    {
      id: `holiday-${year}-05-01`,
      title: 'Festa del Lavoro',
      date: `${year}-05-01`,
      description: 'Festività nazionale.',
    },
    {
      id: `holiday-${year}-06-02`,
      title: 'Festa della Repubblica',
      date: `${year}-06-02`,
      description: 'Festività nazionale italiana.',
    },
    {
      id: `holiday-${year}-08-15`,
      title: 'Ferragosto',
      date: `${year}-08-15`,
      description: 'Assunzione di Maria.',
    },
    {
      id: `holiday-${year}-11-01`,
      title: 'Ognissanti',
      date: `${year}-11-01`,
      description: 'Festività nazionale.',
    },
    {
      id: `holiday-${year}-12-08`,
      title: 'Immacolata',
      date: `${year}-12-08`,
      description: 'Immacolata Concezione.',
    },
    {
      id: `holiday-${year}-12-25`,
      title: 'Natale',
      date: `${year}-12-25`,
      description: 'Festività natalizia.',
    },
    {
      id: `holiday-${year}-12-26`,
      title: 'Santo Stefano',
      date: `${year}-12-26`,
      description: 'Festività natalizia.',
    },
  ]
}

function Calendar() {
  const { user } = useAuth()

  const userId = user?.uid || ''
  const userEmail = user?.email || ''
  const userName = user?.displayName || user?.email || 'Utente Planify'

  const [events, setEvents] = useState([])
  const [tasks, setTasks] = useState([])
  const [publicEvents, setPublicEvents] = useState([])

  const [selectedItem, setSelectedItem] = useState(null)
  const [isEditing, setIsEditing] = useState(false)

  const [isCreating, setIsCreating] = useState(false)
  const [createType, setCreateType] = useState('event')

  const [popupError, setPopupError] = useState('')
  const [calendarMessage, setCalendarMessage] = useState('')
  const [calendarError, setCalendarError] = useState('')
  const [calendarRenderVersion, setCalendarRenderVersion] = useState(0)

  const [calendarFilters, setCalendarFilters] = useState({
    privateEvents: true,
    publicEvents: true,
    exploreEvents: true,
    inviteEvents: true,
    lowTasks: true,
    mediumTasks: true,
    highTasks: true,
    holidays: true,
  })

  const [eventForm, setEventForm] = useState({
    title: '',
    date: '',
    time: '',
    location: '',
    description: '',
    visibility: 'private',
  })

  const [taskForm, setTaskForm] = useState({
    text: '',
    dueDate: '',
    priority: 'media',
    completed: false,
  })

  // Ascolta eventi e attivita personali dell'utente.
  useEffect(() => {
    if (!userId) return undefined

    const eventsRef = collection(db, 'users', userId, 'events')
    const eventsQuery = query(eventsRef, orderBy('date', 'asc'))

    const unsubscribeEvents = onSnapshot(
      eventsQuery,
      (snapshot) => {
        const eventsData = snapshot.docs.map((document) => ({
          id: document.id,
          ...document.data(),
        }))

        setEvents(eventsData)
      },
      (error) => {
        console.error(error)
        setCalendarError('Errore durante il caricamento degli eventi.')
      }
    )

    const tasksRef = collection(db, 'users', userId, 'tasks')

    const unsubscribeTasks = onSnapshot(
      tasksRef,
      (snapshot) => {
        const tasksData = snapshot.docs.map((document) => ({
          id: document.id,
          ...document.data(),
        }))

        setTasks(tasksData)
      },
      (error) => {
        console.error(error)
        setCalendarError('Errore durante il caricamento delle attività.')
      }
    )

    return () => {
      unsubscribeEvents()
      unsubscribeTasks()
    }
  }, [userId])

  // Ascolta gli eventi pubblici per riconoscere copie e sorgenti mancanti.
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
      (error) => {
        console.error(error)
      }
    )

    return () => {
      unsubscribePublicEvents()
    }
  }, [userId])

  const publicEventIds = useMemo(() => {
    return new Set(publicEvents.map((eventItem) => eventItem.id))
  }, [publicEvents])

  function isPublicSourceMissing(eventItem) {
    if (!eventItem.sourcePublicEventId) return false

    return !publicEventIds.has(eventItem.sourcePublicEventId)
  }

  const unavailablePublicEvents = events.filter((eventItem) =>
    isPublicSourceMissing(eventItem)
  )

  // Stato e toggle della legenda filtrabile del calendario.
  function refreshCalendarColors() {
    setCalendarRenderVersion((previousVersion) => previousVersion + 1)
  }

  function setAllCalendarFilters() {
    setCalendarFilters({
      privateEvents: true,
      publicEvents: true,
      exploreEvents: true,
      inviteEvents: true,
      lowTasks: true,
      mediumTasks: true,
      highTasks: true,
      holidays: true,
    })

    refreshCalendarColors()
  }

  function setNoCalendarFilters() {
    setCalendarFilters({
      privateEvents: false,
      publicEvents: false,
      exploreEvents: false,
      inviteEvents: false,
      lowTasks: false,
      mediumTasks: false,
      highTasks: false,
      holidays: false,
    })

    refreshCalendarColors()
  }

  function toggleCalendarFilter(filterName) {
    setCalendarFilters((previousFilters) => ({
      ...previousFilters,
      [filterName]: !previousFilters[filterName],
    }))

    refreshCalendarColors()
  }

  function areEventFiltersActive() {
    return (
      calendarFilters.privateEvents ||
      calendarFilters.publicEvents ||
      calendarFilters.exploreEvents ||
      calendarFilters.inviteEvents
    )
  }

  function areTaskFiltersActive() {
    return (
      calendarFilters.lowTasks ||
      calendarFilters.mediumTasks ||
      calendarFilters.highTasks
    )
  }

  function areHolidayFiltersActive() {
    return calendarFilters.holidays
  }

  function toggleEventGroup() {
    const shouldActivate = !areEventFiltersActive()

    setCalendarFilters((previousFilters) => ({
      ...previousFilters,
      privateEvents: shouldActivate,
      publicEvents: shouldActivate,
      exploreEvents: shouldActivate,
      inviteEvents: shouldActivate,
    }))

    refreshCalendarColors()
  }

  function toggleTaskGroup() {
    const shouldActivate = !areTaskFiltersActive()

    setCalendarFilters((previousFilters) => ({
      ...previousFilters,
      lowTasks: shouldActivate,
      mediumTasks: shouldActivate,
      highTasks: shouldActivate,
    }))

    refreshCalendarColors()
  }

  function toggleHolidayGroup() {
    const shouldActivate = !areHolidayFiltersActive()

    setCalendarFilters((previousFilters) => ({
      ...previousFilters,
      holidays: shouldActivate,
    }))

    refreshCalendarColors()
  }

  function getLegendPillClass(baseClass, isActive) {
    return isActive
      ? `${baseClass} legend-filter-pill active`
      : `${baseClass} legend-filter-pill inactive`
  }

  // Converte eventi, attivita e festivita nel formato richiesto da FullCalendar.
  const calendarItems = useMemo(() => {
    function isPublicSourceMissingForCalendar(eventItem) {
      if (!eventItem.sourcePublicEventId) return false
      return !publicEventIds.has(eventItem.sourcePublicEventId)
    }

    function shouldShowEventInCalendar(eventKind) {
      if (eventKind === 'private') return calendarFilters.privateEvents
      if (eventKind === 'public') return calendarFilters.publicEvents
      if (eventKind === 'explore') return calendarFilters.exploreEvents
      if (eventKind === 'invite' || eventKind === 'invited') {
        return calendarFilters.inviteEvents
      }
      if (eventKind === 'unavailable') {
        return (
          calendarFilters.privateEvents ||
          calendarFilters.publicEvents ||
          calendarFilters.exploreEvents ||
          calendarFilters.inviteEvents
        )
      }

      return true
    }

    function shouldShowTaskInCalendar(priority) {
      if (priority === 'bassa') return calendarFilters.lowTasks
      if (priority === 'alta') return calendarFilters.highTasks
      return calendarFilters.mediumTasks
    }

    const eventItems = events
      .filter((eventItem) => eventItem.date)
      .filter((eventItem) => {
        const publicSourceMissing = isPublicSourceMissingForCalendar(eventItem)
        const eventKind = publicSourceMissing
          ? 'unavailable'
          : getCalendarEventKind(eventItem, userId)

        return shouldShowEventInCalendar(eventKind)
      })
      .map((eventItem) => {
        const hasTime = Boolean(eventItem.time)
        const publicSourceMissing = isPublicSourceMissingForCalendar(eventItem)

        const eventKind = publicSourceMissing
          ? 'unavailable'
          : getCalendarEventKind(eventItem, userId)

        const eventColors = getCalendarEventColors(eventKind)

        return {
          id: `event-${eventItem.id}`,
          title: eventItem.title,
          start: hasTime
            ? `${eventItem.date}T${eventItem.time}`
            : eventItem.date,
          allDay: !hasTime,

          classNames: [
            'planify-calendar-event',
            `planify-calendar-${eventKind}-event`,
          ],

          backgroundColor: eventColors.backgroundColor,
          borderColor: eventColors.borderColor,
          textColor: eventColors.textColor,

          extendedProps: {
            type: 'event',
            originalId: eventItem.id,
            title: eventItem.title || '',
            date: eventItem.date || '',
            time: eventItem.time || '',
            location: eventItem.location || '',
            description: eventItem.description || '',
            visibility: eventItem.visibility || 'private',
            sourcePublicEventId: eventItem.sourcePublicEventId || '',
            sourceInviteEventId: eventItem.sourceInviteEventId || '',
            sourceOwnerId: eventItem.sourceOwnerId || '',
            hasPersonalChanges: Boolean(eventItem.hasPersonalChanges),
            calendarEventKind: eventKind,
            publicSourceMissing,
          },
        }
      })

    const taskItems = tasks
      .filter((taskItem) => taskItem.dueDate)
      .filter((taskItem) => {
        const priority = taskItem.priority || 'media'
        return shouldShowTaskInCalendar(priority)
      })
      .map((taskItem) => {
        const priority = taskItem.priority || 'media'
        const taskColors = getTaskPriorityColors(priority)

        return {
          id: `task-${taskItem.id}`,
          title: `Attività: ${taskItem.text}`,
          start: taskItem.dueDate,
          allDay: true,

          classNames: taskItem.completed
            ? [
                'planify-calendar-task',
                `planify-calendar-task-${priority}`,
                getPriorityClass(priority),
                'completed-calendar-task',
              ]
            : [
                'planify-calendar-task',
                `planify-calendar-task-${priority}`,
                getPriorityClass(priority),
              ],

          backgroundColor: taskColors.backgroundColor,
          borderColor: taskColors.borderColor,
          textColor: taskColors.textColor,

          extendedProps: {
            type: 'task',
            originalId: taskItem.id,
            text: taskItem.text || '',
            dueDate: taskItem.dueDate || '',
            priority,
            completed: Boolean(taskItem.completed),
            calendarTaskPriority: priority,
          },
        }
      })

    const currentYear = new Date().getFullYear()
    const holidayYears = [
      currentYear - 1,
      currentYear,
      currentYear + 1,
      currentYear + 2,
    ]

    const holidayItems = calendarFilters.holidays
      ? holidayYears
          .flatMap((year) => getItalianHolidaysForYear(year))
          .map((holiday) => {
            const holidayColors = getHolidayColors()

            return {
              id: holiday.id,
              title: holiday.title,
              start: holiday.date,
              allDay: true,
              editable: false,
              startEditable: false,
              durationEditable: false,
              classNames: ['planify-calendar-holiday'],
              backgroundColor: holidayColors.backgroundColor,
              borderColor: holidayColors.borderColor,
              textColor: holidayColors.textColor,
              extendedProps: {
                type: 'holiday',
                originalId: holiday.id,
                title: holiday.title,
                date: holiday.date,
                description: holiday.description,
                calendarEventKind: 'holiday',
              },
            }
          })
      : []

    return [...holidayItems, ...eventItems, ...taskItems]
  }, [
    events,
    tasks,
    userId,
    calendarFilters,
    publicEventIds,
  ])

  // Forza i colori sugli elementi creati da FullCalendar dopo il render.
  function handleEventDidMount(info) {
    const item = info.event.extendedProps

    let colors = null

    if (item.type === 'holiday') {
      colors = getHolidayColors()
    }

    if (item.type === 'event') {
      colors = getCalendarEventColors(item.calendarEventKind)
    }

    if (item.type === 'task') {
      colors = getTaskPriorityColors(item.calendarTaskPriority)
    }

    if (!colors) return

    info.el.style.setProperty(
      'background-color',
      colors.backgroundColor,
      'important'
    )
    info.el.style.setProperty('border-color', colors.borderColor, 'important')
    info.el.style.setProperty('color', colors.textColor, 'important')
    info.el.style.setProperty('font-weight', '900', 'important')

    const mainElement = info.el.querySelector('.fc-event-main')
    const titleElement = info.el.querySelector('.fc-event-title')
    const timeElement = info.el.querySelector('.fc-event-time')

    if (mainElement) {
      mainElement.style.setProperty('color', colors.textColor, 'important')
    }

    if (titleElement) {
      titleElement.style.setProperty('color', colors.textColor, 'important')
    }

    if (timeElement) {
      timeElement.style.setProperty('color', colors.textColor, 'important')
    }
  }

  function updateLocalEvent(eventId, updatedData) {
    setEvents((previousEvents) =>
      previousEvents.map((eventItem) =>
        eventItem.id === eventId ? { ...eventItem, ...updatedData } : eventItem
      )
    )

    refreshCalendarColors()
  }

  function removeLocalEvent(eventId) {
    setEvents((previousEvents) =>
      previousEvents.filter((eventItem) => eventItem.id !== eventId)
    )

    refreshCalendarColors()
  }

  // Apre popup di dettaglio/modifica partendo da un elemento del calendario.
  function getCurrentVisibility(item) {
    if (item.publicSourceMissing) {
      return 'private'
    }

    if (item.sourceInviteEventId && item.sourceOwnerId === userId) {
      return 'invite'
    }

    if (item.sourcePublicEventId && item.sourceOwnerId === userId) {
      return 'public'
    }

    return item.visibility || 'private'
  }

  function handleCalendarItemClick(info) {
    const item = info.event.extendedProps

    setSelectedItem(item)
    setIsCreating(false)
    setIsEditing(false)
    setPopupError('')
    setCalendarMessage('')
    setCalendarError('')

    if (item.type === 'holiday') {
      return
    }

    if (item.type === 'event') {
      setEventForm({
        title: item.title || '',
        date: item.date || '',
        time: item.time || '',
        location: item.location || '',
        description: item.description || '',
        visibility: getCurrentVisibility(item),
      })
    }

    if (item.type === 'task') {
      setTaskForm({
        text: item.text || '',
        dueDate: item.dueDate || '',
        priority: item.priority || 'media',
        completed: Boolean(item.completed),
      })
    }
  }

  function handleDateClick(info) {
    setSelectedItem(null)
    setIsEditing(false)
    setIsCreating(true)
    setCreateType('event')
    setPopupError('')
    setCalendarMessage('')
    setCalendarError('')

    setEventForm({
      title: '',
      date: info.dateStr,
      time: '',
      location: '',
      description: '',
      visibility: 'private',
    })

    setTaskForm({
      text: '',
      dueDate: info.dateStr,
      priority: 'media',
      completed: false,
    })
  }

  // Salva drag & drop su Firestore e aggiorna anche sorgenti pubbliche/invito.
  async function handleCalendarItemDrop(info) {
    const item = info.event.extendedProps
    const newStartDate = info.event.start

    if (item.type === 'holiday') {
      info.revert()
      return
    }

    if (item.publicSourceMissing) {
      info.revert()
      setCalendarError(
        'Questo evento pubblico non è più disponibile. Gestiscilo dalla pagina Eventi.'
      )
      return
    }

    if (!newStartDate) {
      info.revert()
      setCalendarError('Spostamento non valido.')
      return
    }

    const newDate = formatDate(newStartDate)

    try {
      setCalendarMessage('')
      setCalendarError('')

      if (item.type === 'event') {
        const batch = writeBatch(db)

        const eventRef = doc(db, 'users', userId, 'events', item.originalId)

        const updatedEvent = {
          date: newDate,
          updatedAt: serverTimestamp(),
        }

        const localUpdatedEvent = {
          date: newDate,
        }

        const shouldMarkPersonalChanges =
          (item.sourcePublicEventId || item.sourceInviteEventId) &&
          item.sourceOwnerId !== userId

        if (!info.event.allDay && item.time) {
          const newTime = formatTime(newStartDate)
          updatedEvent.time = newTime
          localUpdatedEvent.time = newTime
        }

        if (shouldMarkPersonalChanges) {
          updatedEvent.hasPersonalChanges = true
          localUpdatedEvent.hasPersonalChanges = true
        }

        batch.update(eventRef, updatedEvent)

        if (item.sourcePublicEventId && item.sourceOwnerId === userId) {
          const publicEventRef = doc(
            db,
            'publicEvents',
            item.sourcePublicEventId
          )

          batch.update(publicEventRef, updatedEvent)
        }

        if (item.sourceInviteEventId && item.sourceOwnerId === userId) {
          const inviteEventRef = doc(
            db,
            'inviteEvents',
            item.sourceInviteEventId
          )

          batch.update(inviteEventRef, updatedEvent)
        }

        await batch.commit()

        updateLocalEvent(item.originalId, localUpdatedEvent)

        return
      }

      if (item.type === 'task') {
        const taskRef = doc(db, 'users', userId, 'tasks', item.originalId)

        await updateDoc(taskRef, {
          dueDate: newDate,
          updatedAt: serverTimestamp(),
        })

        setTasks((previousTasks) =>
          previousTasks.map((taskItem) =>
            taskItem.id === item.originalId
              ? { ...taskItem, dueDate: newDate }
              : taskItem
          )
        )

        refreshCalendarColors()
      }
    } catch (error) {
      console.error(error)
      info.revert()
      setCalendarError('Non è stato possibile salvare lo spostamento.')
    }
  }

  function closePopup() {
    setSelectedItem(null)
    setIsEditing(false)
    setIsCreating(false)
    setPopupError('')
  }

  // Creazione rapida dal popup calendario.
  async function handleCreateEvent(event) {
    event.preventDefault()

    if (!eventForm.title.trim() || !eventForm.date) {
      setPopupError('Inserisci almeno titolo e data.')
      return
    }

    setPopupError('')
    setCalendarMessage('')
    setCalendarError('')

    const eventData = {
      title: eventForm.title.trim(),
      date: eventForm.date,
      time: eventForm.time,
      location: eventForm.location.trim(),
      description: eventForm.description.trim(),
    }

    const participant = {
      uid: userId,
      name: userName,
      joinedAt: new Date().toISOString(),
    }

    try {
      const batch = writeBatch(db)
      const personalEventRef = doc(collection(db, 'users', userId, 'events'))

      if (eventForm.visibility === 'public') {
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
          hasPersonalChanges: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        })
      }

      await batch.commit()

      setCalendarMessage(
        eventForm.visibility === 'public'
          ? 'Evento pubblico creato e pubblicato in Esplora eventi.'
          : 'Evento privato creato correttamente.'
      )

      closePopup()
      refreshCalendarColors()
    } catch (error) {
      console.error(error)
      setPopupError('Errore durante la creazione dell’evento.')
    }
  }

  async function handleCreateTask(event) {
    event.preventDefault()

    if (!taskForm.text.trim() || !taskForm.dueDate) {
      setPopupError('Inserisci almeno nome attività e scadenza.')
      return
    }

    try {
      const tasksRef = collection(db, 'users', userId, 'tasks')

      await addDoc(tasksRef, {
        text: taskForm.text.trim(),
        dueDate: taskForm.dueDate,
        priority: taskForm.priority,
        completed: taskForm.completed,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      })

      setCalendarMessage('Attività creata correttamente.')
      closePopup()
      refreshCalendarColors()
    } catch (error) {
      console.error(error)
      setPopupError('Errore durante la creazione dell’attività.')
    }
  }

  // Modifica elementi esistenti rispettando copie, eventi pubblici e inviti.
  async function handleUpdateEvent(event) {
    event.preventDefault()

    if (!eventForm.title.trim() || !eventForm.date) {
      setPopupError('Inserisci almeno titolo e data.')
      return
    }

    setPopupError('')
    setCalendarMessage('')
    setCalendarError('')

    const eventData = {
      title: eventForm.title.trim(),
      date: eventForm.date,
      time: eventForm.time,
      location: eventForm.location.trim(),
      description: eventForm.description.trim(),
    }

    const participant = {
      uid: userId,
      name: userName,
      joinedAt: new Date().toISOString(),
    }

    const isUnavailablePublicEvent =
      selectedItem.sourcePublicEventId && selectedItem.publicSourceMissing

    const isOwnedPublicEvent =
      selectedItem.sourcePublicEventId &&
      selectedItem.sourceOwnerId === userId &&
      !selectedItem.publicSourceMissing

    const isCopiedPublicEvent =
      selectedItem.sourcePublicEventId && selectedItem.sourceOwnerId !== userId

    const isOwnedInviteEvent =
      selectedItem.sourceInviteEventId && selectedItem.sourceOwnerId === userId

    const isCopiedInviteEvent =
      selectedItem.sourceInviteEventId && selectedItem.sourceOwnerId !== userId

    try {
      const batch = writeBatch(db)

      const eventRef = doc(
        db,
        'users',
        userId,
        'events',
        selectedItem.originalId
      )

      if (
        isCopiedPublicEvent ||
        isCopiedInviteEvent ||
        isUnavailablePublicEvent
      ) {
        const shouldMarkPersonalChanges =
          isCopiedPublicEvent || isCopiedInviteEvent

        batch.update(eventRef, {
          ...eventData,
          hasPersonalChanges: shouldMarkPersonalChanges,
          updatedAt: serverTimestamp(),
        })

        await batch.commit()

        updateLocalEvent(selectedItem.originalId, {
          ...eventData,
          hasPersonalChanges: shouldMarkPersonalChanges,
        })

        setCalendarMessage(
          isUnavailablePublicEvent
            ? 'Copia personale aggiornata. L’evento pubblico originale non è più disponibile.'
            : 'Copia personale aggiornata. Ora stai usando modifiche personali.'
        )

        closePopup()
        return
      }

      if (eventForm.visibility === 'public') {
        if (isOwnedPublicEvent) {
          const publicEventRef = doc(
            db,
            'publicEvents',
            selectedItem.sourcePublicEventId
          )

          batch.update(eventRef, {
            ...eventData,
            visibility: 'public',
            sourcePublicEventId: selectedItem.sourcePublicEventId,
            sourceInviteEventId: '',
            sourceOwnerId: userId,
            hasPersonalChanges: false,
            updatedAt: serverTimestamp(),
          })

          batch.update(publicEventRef, {
            ...eventData,
            visibility: 'public',
            sourcePublicEventId: selectedItem.sourcePublicEventId,
            sourceOwnerId: userId,
            ownerId: userId,
            ownerName: userName,
            updatedAt: serverTimestamp(),
          })

          await batch.commit()

          updateLocalEvent(selectedItem.originalId, {
            ...eventData,
            visibility: 'public',
            sourcePublicEventId: selectedItem.sourcePublicEventId,
            sourceInviteEventId: '',
            sourceOwnerId: userId,
            hasPersonalChanges: false,
          })
        } else {
          if (isOwnedInviteEvent) {
            const inviteEventRef = doc(
              db,
              'inviteEvents',
              selectedItem.sourceInviteEventId
            )

            batch.delete(inviteEventRef)
          }

          const publicEventRef = doc(collection(db, 'publicEvents'))

          batch.update(eventRef, {
            ...eventData,
            visibility: 'public',
            sourcePublicEventId: publicEventRef.id,
            sourceInviteEventId: '',
            sourceOwnerId: userId,
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

          await batch.commit()

          updateLocalEvent(selectedItem.originalId, {
            ...eventData,
            visibility: 'public',
            sourcePublicEventId: publicEventRef.id,
            sourceInviteEventId: '',
            sourceOwnerId: userId,
            hasPersonalChanges: false,
          })
        }
      } else if (eventForm.visibility === 'invite' && isOwnedInviteEvent) {
        const inviteEventRef = doc(
          db,
          'inviteEvents',
          selectedItem.sourceInviteEventId
        )

        batch.update(eventRef, {
          ...eventData,
          visibility: 'invite',
          sourcePublicEventId: '',
          sourceInviteEventId: selectedItem.sourceInviteEventId,
          sourceOwnerId: userId,
          hasPersonalChanges: false,
          updatedAt: serverTimestamp(),
        })

        batch.update(inviteEventRef, {
          ...eventData,
          visibility: 'invite',
          sourceInviteEventId: selectedItem.sourceInviteEventId,
          sourceOwnerId: userId,
          ownerId: userId,
          ownerName: userName,
          updatedAt: serverTimestamp(),
        })

        await batch.commit()

        updateLocalEvent(selectedItem.originalId, {
          ...eventData,
          visibility: 'invite',
          sourcePublicEventId: '',
          sourceInviteEventId: selectedItem.sourceInviteEventId,
          sourceOwnerId: userId,
          hasPersonalChanges: false,
        })
      } else {
        if (isOwnedPublicEvent) {
          const publicEventRef = doc(
            db,
            'publicEvents',
            selectedItem.sourcePublicEventId
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
              setPopupError(
                'Non puoi rendere privato un evento pubblico con partecipanti iscritti. Puoi lasciarlo pubblico oppure creare un nuovo evento privato.'
              )
              return
            }
          }

          batch.delete(publicEventRef)
        }

        if (isOwnedInviteEvent) {
          const inviteEventRef = doc(
            db,
            'inviteEvents',
            selectedItem.sourceInviteEventId
          )

          batch.delete(inviteEventRef)
        }

        batch.update(eventRef, {
          ...eventData,
          visibility: 'private',
          sourcePublicEventId: '',
          sourceInviteEventId: '',
          sourceOwnerId: '',
          hasPersonalChanges: false,
          updatedAt: serverTimestamp(),
        })

        await batch.commit()

        updateLocalEvent(selectedItem.originalId, {
          ...eventData,
          visibility: 'private',
          sourcePublicEventId: '',
          sourceInviteEventId: '',
          sourceOwnerId: '',
          hasPersonalChanges: false,
        })
      }

      setCalendarMessage('Evento aggiornato correttamente.')
      closePopup()
    } catch (error) {
      console.error(error)
      setPopupError('Errore durante l’aggiornamento dell’evento.')
    }
  }

  async function handleUpdateTask(event) {
    event.preventDefault()

    if (!taskForm.text.trim() || !taskForm.dueDate) {
      setPopupError('Inserisci almeno nome attività e scadenza.')
      return
    }

    try {
      const taskRef = doc(db, 'users', userId, 'tasks', selectedItem.originalId)

      await updateDoc(taskRef, {
        text: taskForm.text.trim(),
        dueDate: taskForm.dueDate,
        priority: taskForm.priority,
        completed: taskForm.completed,
        updatedAt: serverTimestamp(),
      })

      setTasks((previousTasks) =>
        previousTasks.map((taskItem) =>
          taskItem.id === selectedItem.originalId
            ? {
                ...taskItem,
                text: taskForm.text.trim(),
                dueDate: taskForm.dueDate,
                priority: taskForm.priority,
                completed: taskForm.completed,
              }
            : taskItem
        )
      )

      setCalendarMessage('Attività aggiornata correttamente.')
      closePopup()
      refreshCalendarColors()
    } catch (error) {
      console.error(error)
      setPopupError('Errore durante l’aggiornamento dell’attività.')
    }
  }

  // Elimina l'elemento selezionato e aggiorna eventuali sorgenti condivise.
  async function handleDeleteSelectedItem() {
    if (!selectedItem) return

    if (selectedItem.type === 'holiday') {
      setPopupError('Le festività non possono essere eliminate.')
      return
    }

    setPopupError('')
    setCalendarMessage('')
    setCalendarError('')

    try {
      if (selectedItem.type === 'event') {
        const batch = writeBatch(db)

        const eventRef = doc(
          db,
          'users',
          userId,
          'events',
          selectedItem.originalId
        )

        let removedOnlyPersonalCopy = false

        if (selectedItem.sourcePublicEventId) {
          const publicEventRef = doc(
            db,
            'publicEvents',
            selectedItem.sourcePublicEventId
          )

          const publicEventSnapshot = await getDoc(publicEventRef)

          if (publicEventSnapshot.exists()) {
            const publicEventData = publicEventSnapshot.data()
            const isPublicOwner = publicEventData.ownerId === userId

            if (isPublicOwner) {
              batch.delete(publicEventRef)
            } else {
              removedOnlyPersonalCopy = true

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

        if (selectedItem.sourceInviteEventId) {
          const inviteEventRef = doc(
            db,
            'inviteEvents',
            selectedItem.sourceInviteEventId
          )

          const inviteEventSnapshot = await getDoc(inviteEventRef)

          if (inviteEventSnapshot.exists()) {
            const inviteEventData = inviteEventSnapshot.data()
            const isInviteOwner = inviteEventData.ownerId === userId

            if (isInviteOwner) {
              batch.delete(inviteEventRef)
            } else {
              removedOnlyPersonalCopy = true

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

              const participantCount =
                inviteEventData.participantCount ||
                inviteEventData.participantIds?.length ||
                inviteEventData.participants?.length ||
                0

              const updateData = {
                invitedPeople: updatedInvitedPeople || [],
                participantIds: arrayRemove(userId),
                participantCount: Math.max(participantCount - 1, 0),
                updatedAt: serverTimestamp(),
              }

              if (participantToRemove) {
                updateData.participants = arrayRemove(participantToRemove)
              }

              batch.update(inviteEventRef, updateData)
            }
          }
        }

        batch.delete(eventRef)

        await batch.commit()

        removeLocalEvent(selectedItem.originalId)

        setCalendarMessage(
          removedOnlyPersonalCopy
            ? 'Evento rimosso dal tuo calendario.'
            : 'Evento eliminato.'
        )

        closePopup()
        return
      }

      if (selectedItem.type === 'task') {
        const taskRef = doc(
          db,
          'users',
          userId,
          'tasks',
          selectedItem.originalId
        )

        await deleteDoc(taskRef)

        setTasks((previousTasks) =>
          previousTasks.filter(
            (taskItem) => taskItem.id !== selectedItem.originalId
          )
        )

        setCalendarMessage('Attività eliminata.')
        closePopup()
        refreshCalendarColors()
      }
    } catch (error) {
      console.error(error)
      setPopupError('Errore durante l’eliminazione.')
    }
  }

  const isEditingCopiedPublicEvent =
    selectedItem?.type === 'event' &&
    selectedItem?.sourcePublicEventId &&
    selectedItem?.sourceOwnerId !== userId &&
    !selectedItem?.publicSourceMissing

  const isEditingCopiedInviteEvent =
    selectedItem?.type === 'event' &&
    selectedItem?.sourceInviteEventId &&
    selectedItem?.sourceOwnerId !== userId

  const isEditingOwnedInviteEvent =
    selectedItem?.type === 'event' &&
    selectedItem?.sourceInviteEventId &&
    selectedItem?.sourceOwnerId === userId

  const isEditingUnavailablePublicEvent =
    selectedItem?.type === 'event' &&
    selectedItem?.sourcePublicEventId &&
    selectedItem?.publicSourceMissing

  return (
    <main className="dashboard-page">
      <section className="calendar-layout">
        <div className="calendar-header">
          <div>
            <h1>Calendario</h1>
            <p>
              Visualizza eventi, attività e festività italiane in un calendario
              interattivo.
            </p>
          </div>

          <Link to="/dashboard" className="btn btn-secondary">
            Dashboard
          </Link>
        </div>

        {calendarMessage && (
          <p className="calendar-feedback success-feedback">
            {calendarMessage}
          </p>
        )}

        {calendarError && (
          <p className="calendar-feedback error-feedback">{calendarError}</p>
        )}

        {unavailablePublicEvents.length > 0 && (
          <div className="calendar-public-warning">
            <div>
              <strong>Ci sono eventi pubblici non più disponibili</strong>
              <p>
                Alcuni eventi aggiunti da Esplora sono stati rimossi dal
                creatore. Apri la pagina Eventi per mantenerli come copie
                personali oppure rimuoverli dal calendario.
              </p>
            </div>

            <Link to="/events" className="btn btn-secondary">
              Gestisci in Eventi
            </Link>
          </div>
        )}

        <div className="fullcalendar-card">
          <FullCalendar
            key={calendarRenderVersion}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            locale={itLocale}
            firstDay={1}
            height="auto"
            events={calendarItems}
            eventClick={handleCalendarItemClick}
            dateClick={handleDateClick}
            eventDrop={handleCalendarItemDrop}
            eventDidMount={handleEventDidMount}
            editable={true}
            eventStartEditable={true}
            eventDurationEditable={false}
            fixedMirrorParent={
              typeof document !== 'undefined' ? document.body : undefined
            }
            dragRevertDuration={180}
            nowIndicator={true}
            dayMaxEvents={3}
            allDayText="Giornata"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay',
            }}
            buttonText={{
              today: 'Oggi',
              month: 'Mese',
              week: 'Settimana',
              day: 'Giorno',
            }}
          />
        </div>

        <div className="calendar-legend improved-calendar-legend clearer-calendar-legend selectable-calendar-legend">
          <div className="calendar-legend-header">
            <div>
              <span className="legend-title">Legenda calendario</span>
              <p>
                Clicca sulle singole voci per mostrarle o nasconderle. Clicca
                sul riquadro della categoria per attivare o disattivare tutto il
                gruppo.
              </p>
            </div>

            <div className="calendar-legend-actions">
              <button
                type="button"
                className="calendar-legend-action-button"
                onClick={setAllCalendarFilters}
              >
                Mostra tutto
              </button>

              <button
                type="button"
                className="calendar-legend-action-button danger"
                onClick={setNoCalendarFilters}
              >
                Nascondi tutto
              </button>
            </div>
          </div>

          <div className="calendar-legend-content">
            <button
              type="button"
              className={
                areEventFiltersActive()
                  ? 'legend-group legend-events-group legend-toggle-group active'
                  : 'legend-group legend-events-group legend-toggle-group inactive'
              }
              onClick={toggleEventGroup}
            >
              <span className="legend-title">Eventi</span>

              <span
                role="button"
                tabIndex={0}
                className={getLegendPillClass(
                  'legend-pill event-legend-pill',
                  calendarFilters.privateEvents
                )}
                onClick={(event) => {
                  event.stopPropagation()
                  toggleCalendarFilter('privateEvents')
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.stopPropagation()
                    toggleCalendarFilter('privateEvents')
                  }
                }}
              >
                <strong className="legend-dot private-event-dot"></strong>
                Privato
              </span>

              <span
                role="button"
                tabIndex={0}
                className={getLegendPillClass(
                  'legend-pill event-legend-pill',
                  calendarFilters.publicEvents
                )}
                onClick={(event) => {
                  event.stopPropagation()
                  toggleCalendarFilter('publicEvents')
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.stopPropagation()
                    toggleCalendarFilter('publicEvents')
                  }
                }}
              >
                <strong className="legend-dot public-event-dot"></strong>
                Pubblico
              </span>

              <span
                role="button"
                tabIndex={0}
                className={getLegendPillClass(
                  'legend-pill event-legend-pill',
                  calendarFilters.exploreEvents
                )}
                onClick={(event) => {
                  event.stopPropagation()
                  toggleCalendarFilter('exploreEvents')
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.stopPropagation()
                    toggleCalendarFilter('exploreEvents')
                  }
                }}
              >
                <strong className="legend-dot explore-event-dot"></strong>
                Da Esplora
              </span>

              <span
                role="button"
                tabIndex={0}
                className={getLegendPillClass(
                  'legend-pill event-legend-pill',
                  calendarFilters.inviteEvents
                )}
                onClick={(event) => {
                  event.stopPropagation()
                  toggleCalendarFilter('inviteEvents')
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.stopPropagation()
                    toggleCalendarFilter('inviteEvents')
                  }
                }}
              >
                <strong className="legend-dot invite-event-dot"></strong>
                Su invito
              </span>
            </button>

            <button
              type="button"
              className={
                areTaskFiltersActive()
                  ? 'legend-group legend-tasks-group legend-toggle-group active'
                  : 'legend-group legend-tasks-group legend-toggle-group inactive'
              }
              onClick={toggleTaskGroup}
            >
              <span className="legend-title">Attività</span>

              <span
                role="button"
                tabIndex={0}
                className={getLegendPillClass(
                  'legend-pill task-legend-pill task-low-legend-pill',
                  calendarFilters.lowTasks
                )}
                onClick={(event) => {
                  event.stopPropagation()
                  toggleCalendarFilter('lowTasks')
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.stopPropagation()
                    toggleCalendarFilter('lowTasks')
                  }
                }}
              >
                <strong className="legend-dot priority-low-dot"></strong>
                Bassa
              </span>

              <span
                role="button"
                tabIndex={0}
                className={getLegendPillClass(
                  'legend-pill task-legend-pill task-medium-legend-pill',
                  calendarFilters.mediumTasks
                )}
                onClick={(event) => {
                  event.stopPropagation()
                  toggleCalendarFilter('mediumTasks')
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.stopPropagation()
                    toggleCalendarFilter('mediumTasks')
                  }
                }}
              >
                <strong className="legend-dot priority-medium-dot"></strong>
                Media
              </span>

              <span
                role="button"
                tabIndex={0}
                className={getLegendPillClass(
                  'legend-pill task-legend-pill task-high-legend-pill',
                  calendarFilters.highTasks
                )}
                onClick={(event) => {
                  event.stopPropagation()
                  toggleCalendarFilter('highTasks')
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.stopPropagation()
                    toggleCalendarFilter('highTasks')
                  }
                }}
              >
                <strong className="legend-dot priority-high-dot"></strong>
                Alta
              </span>
            </button>

            <button
              type="button"
              className={
                areHolidayFiltersActive()
                  ? 'legend-group legend-holidays-group legend-toggle-group active'
                  : 'legend-group legend-holidays-group legend-toggle-group inactive'
              }
              onClick={toggleHolidayGroup}
            >
              <span className="legend-title">Festività</span>

              <span
                role="button"
                tabIndex={0}
                className={getLegendPillClass(
                  'legend-pill holiday-legend-pill',
                  calendarFilters.holidays
                )}
                onClick={(event) => {
                  event.stopPropagation()
                  toggleCalendarFilter('holidays')
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.stopPropagation()
                    toggleCalendarFilter('holidays')
                  }
                }}
              >
                <strong className="legend-dot holiday-dot"></strong>
                Festività italiana
              </span>
            </button>
          </div>
        </div>

        <p className="calendar-legend-note">
          Nota: gli eventi indicano la visibilità, mentre le attività indicano la
          priorità della scadenza.
        </p>
      </section>

      {(selectedItem || isCreating) && (
        <div className="calendar-popup-overlay" onClick={closePopup}>
          <div
            className="calendar-popup"
            onClick={(event) => event.stopPropagation()}
          >
            {isCreating ? (
              <>
                <div className="calendar-popup-header">
                  <div>
                    <span className="calendar-popup-badge">
                      Nuovo elemento
                    </span>

                    <h2>
                      {createType === 'event'
                        ? 'Crea nuovo evento'
                        : 'Crea nuova attività'}
                    </h2>
                  </div>

                  <button
                    type="button"
                    className="popup-close-button"
                    onClick={closePopup}
                  >
                    ×
                  </button>
                </div>

                <div className="create-type-switch">
                  <button
                    type="button"
                    className={
                      createType === 'event'
                        ? 'create-type-button active'
                        : 'create-type-button'
                    }
                    onClick={() => setCreateType('event')}
                  >
                    Evento
                  </button>

                  <button
                    type="button"
                    className={
                      createType === 'task'
                        ? 'create-type-button active'
                        : 'create-type-button'
                    }
                    onClick={() => setCreateType('task')}
                  >
                    Attività
                  </button>
                </div>

                {createType === 'event' ? (
                  <form
                    className="calendar-popup-form"
                    onSubmit={handleCreateEvent}
                  >
                    <label>
                      Titolo
                      <input
                        type="text"
                        value={eventForm.title}
                        onChange={(event) =>
                          setEventForm({
                            ...eventForm,
                            title: event.target.value,
                          })
                        }
                      />
                    </label>

                    <label>
                      Data
                      <input
                        type="date"
                        value={eventForm.date}
                        onChange={(event) =>
                          setEventForm({
                            ...eventForm,
                            date: event.target.value,
                          })
                        }
                      />
                    </label>

                    <label>
                      Ora
                      <input
                        type="time"
                        value={eventForm.time}
                        onChange={(event) =>
                          setEventForm({
                            ...eventForm,
                            time: event.target.value,
                          })
                        }
                      />
                    </label>

                    <label>
                      Luogo
                      <input
                        type="text"
                        value={eventForm.location}
                        onChange={(event) =>
                          setEventForm({
                            ...eventForm,
                            location: event.target.value,
                          })
                        }
                      />
                    </label>

                    <label>
                      Descrizione
                      <textarea
                        value={eventForm.description}
                        onChange={(event) =>
                          setEventForm({
                            ...eventForm,
                            description: event.target.value,
                          })
                        }
                      />
                    </label>

                    <div className="event-visibility-box">
                      <span>Visibilità evento</span>

                      <div className="event-visibility-options">
                        <label
                          className={
                            eventForm.visibility === 'private'
                              ? 'event-visibility-option active'
                              : 'event-visibility-option'
                          }
                        >
                          <input
                            type="radio"
                            name="calendar-create-visibility"
                            value="private"
                            checked={eventForm.visibility === 'private'}
                            onChange={() =>
                              setEventForm({
                                ...eventForm,
                                visibility: 'private',
                              })
                            }
                          />

                          <div>
                            <strong>Privato</strong>
                            <p>Lo vedi solo tu nel tuo calendario.</p>
                          </div>
                        </label>

                        <label
                          className={
                            eventForm.visibility === 'public'
                              ? 'event-visibility-option active'
                              : 'event-visibility-option'
                          }
                        >
                          <input
                            type="radio"
                            name="calendar-create-visibility"
                            value="public"
                            checked={eventForm.visibility === 'public'}
                            onChange={() =>
                              setEventForm({
                                ...eventForm,
                                visibility: 'public',
                              })
                            }
                          />

                          <div>
                            <strong>Pubblico</strong>
                            <p>Compare anche in Esplora eventi.</p>
                          </div>
                        </label>
                      </div>
                    </div>

                    <div className="calendar-invite-helper-box">
                      <div>
                        <strong>Vuoi creare un evento su invito?</strong>
                        <p>
                          Gli eventi su invito richiedono una lista di email
                          invitate. Per gestirli meglio, creali dalla pagina
                          Eventi.
                        </p>
                      </div>

                      <Link to="/events" className="btn btn-secondary">
                        Crea da Eventi
                      </Link>
                    </div>

                    {popupError && (
                      <p className="error-message">{popupError}</p>
                    )}

                    <div className="calendar-popup-actions">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={closePopup}
                      >
                        Annulla
                      </button>

                      <button type="submit" className="btn btn-primary">
                        Crea evento
                      </button>
                    </div>
                  </form>
                ) : (
                  <form
                    className="calendar-popup-form"
                    onSubmit={handleCreateTask}
                  >
                    <label>
                      Attività
                      <input
                        type="text"
                        value={taskForm.text}
                        onChange={(event) =>
                          setTaskForm({
                            ...taskForm,
                            text: event.target.value,
                          })
                        }
                      />
                    </label>

                    <label>
                      Scadenza
                      <input
                        type="date"
                        value={taskForm.dueDate}
                        onChange={(event) =>
                          setTaskForm({
                            ...taskForm,
                            dueDate: event.target.value,
                          })
                        }
                      />
                    </label>

                    <label>
                      Priorità
                      <select
                        value={taskForm.priority}
                        onChange={(event) =>
                          setTaskForm({
                            ...taskForm,
                            priority: event.target.value,
                          })
                        }
                      >
                        <option value="bassa">Bassa</option>
                        <option value="media">Media</option>
                        <option value="alta">Alta</option>
                      </select>
                    </label>

                    {popupError && (
                      <p className="error-message">{popupError}</p>
                    )}

                    <div className="calendar-popup-actions">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={closePopup}
                      >
                        Annulla
                      </button>

                      <button type="submit" className="btn btn-primary">
                        Crea attività
                      </button>
                    </div>
                  </form>
                )}
              </>
            ) : (
              <>
                <div className="calendar-popup-header">
                  <div>
                    <span
                      className={
                        selectedItem.type === 'task'
                          ? `calendar-popup-badge ${getPriorityClass(
                              taskForm.priority
                            )}`
                          : selectedItem.type === 'holiday'
                            ? 'calendar-popup-badge holiday-popup-badge'
                            : selectedItem.publicSourceMissing
                              ? 'calendar-popup-badge unavailable'
                              : selectedItem.hasPersonalChanges
                                ? 'calendar-popup-badge unavailable'
                                : selectedItem.sourceInviteEventId
                                  ? 'calendar-popup-badge invite'
                                  : 'calendar-popup-badge'
                      }
                    >
                      {selectedItem.type === 'event'
                        ? selectedItem.publicSourceMissing
                          ? 'Evento non più pubblico'
                          : selectedItem.hasPersonalChanges
                            ? 'Modifiche personali'
                            : selectedItem.sourceInviteEventId
                              ? 'Evento su invito'
                              : 'Evento'
                        : selectedItem.type === 'holiday'
                          ? 'Festività'
                          : `Attività · Priorità ${getPriorityLabel(
                              taskForm.priority
                            )}`}
                    </span>

                    <h2>
                      {selectedItem.type === 'event'
                        ? eventForm.title
                        : selectedItem.type === 'holiday'
                          ? selectedItem.title
                          : taskForm.text}
                    </h2>
                  </div>

                  <button
                    type="button"
                    className="popup-close-button"
                    onClick={closePopup}
                  >
                    ×
                  </button>
                </div>

                {!isEditing && selectedItem.type === 'holiday' && (
                  <>
                    <div className="calendar-popup-content">
                      <p>
                        <strong>Tipo:</strong>{' '}
                        <span className="event-visibility-pill holiday">
                          Festività italiana
                        </span>
                      </p>

                      <p>
                        <strong>Data:</strong> {selectedItem.date}
                      </p>

                      <p>
                        <strong>Descrizione:</strong>{' '}
                        {selectedItem.description || 'Giorno festivo'}
                      </p>

                      <p className="holiday-popup-note">
                        Questa festività è inserita dal calendario e non può
                        essere modificata o eliminata.
                      </p>
                    </div>

                    <div className="calendar-popup-actions">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={closePopup}
                      >
                        Chiudi
                      </button>
                    </div>
                  </>
                )}

                {!isEditing && selectedItem.type === 'event' && (
                  <>
                    <div className="calendar-popup-content">
                      {selectedItem.hasPersonalChanges && (
                        <div className="event-unavailable-box">
                          <strong>Modifiche personali attive</strong>
                          <p>
                            Questo evento è stato modificato rispetto alla
                            versione del creatore. Per ripristinare i dati
                            ufficiali, apri la pagina Eventi.
                          </p>

                          <Link to="/events" className="btn btn-secondary">
                            Vai a Eventi
                          </Link>
                        </div>
                      )}

                      {selectedItem.publicSourceMissing && (
                        <div className="event-unavailable-box">
                          <strong>Evento pubblico non più disponibile</strong>
                          <p>
                            L’evento originale è stato rimosso da Esplora. Apri
                            la pagina Eventi per mantenerlo come copia personale
                            oppure rimuoverlo dal calendario.
                          </p>
                        </div>
                      )}

                      <p>
                        <strong>Visibilità:</strong>{' '}
                        <span
                          className={`event-visibility-pill ${getEventVisibilityClass(
                            selectedItem,
                            userId,
                            selectedItem.publicSourceMissing
                          )}`}
                        >
                          {getEventVisibilityLabel(
                            selectedItem,
                            userId,
                            selectedItem.publicSourceMissing
                          )}
                        </span>
                      </p>

                      <p>
                        <strong>Data:</strong> {eventForm.date}
                      </p>

                      <p>
                        <strong>Ora:</strong>{' '}
                        {eventForm.time || 'Non specificata'}
                      </p>

                      <p>
                        <strong>Luogo:</strong>{' '}
                        {eventForm.location || 'Non specificato'}
                      </p>

                      <p>
                        <strong>Descrizione:</strong>{' '}
                        {eventForm.description || 'Nessuna descrizione'}
                      </p>
                    </div>

                    <div className="calendar-popup-actions">
                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={handleDeleteSelectedItem}
                      >
                        {selectedItem.publicSourceMissing ||
                        (selectedItem.sourceInviteEventId &&
                          selectedItem.sourceOwnerId !== userId)
                          ? 'Rimuovi dal calendario'
                          : 'Elimina'}
                      </button>

                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={closePopup}
                      >
                        Chiudi
                      </button>

                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => setIsEditing(true)}
                      >
                        Modifica
                      </button>
                    </div>
                  </>
                )}

                {!isEditing && selectedItem.type === 'task' && (
                  <>
                    <div className="calendar-popup-content">
                      <p>
                        <strong>Scadenza:</strong> {taskForm.dueDate}
                      </p>

                      <p>
                        <strong>Priorità:</strong>{' '}
                        <span
                          className={`priority-text ${getPriorityClass(
                            taskForm.priority
                          )}`}
                        >
                          {getPriorityLabel(taskForm.priority)}
                        </span>
                      </p>

                      <p>
                        <strong>Stato:</strong>{' '}
                        {taskForm.completed ? 'Completata' : 'Da completare'}
                      </p>
                    </div>

                    <div className="calendar-popup-actions">
                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={handleDeleteSelectedItem}
                      >
                        Elimina
                      </button>

                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={closePopup}
                      >
                        Chiudi
                      </button>

                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => setIsEditing(true)}
                      >
                        Modifica
                      </button>
                    </div>
                  </>
                )}

                {isEditing && selectedItem.type === 'event' && (
                  <form
                    className="calendar-popup-form"
                    onSubmit={handleUpdateEvent}
                  >
                    <label>
                      Titolo
                      <input
                        type="text"
                        value={eventForm.title}
                        onChange={(event) =>
                          setEventForm({
                            ...eventForm,
                            title: event.target.value,
                          })
                        }
                      />
                    </label>

                    <label>
                      Data
                      <input
                        type="date"
                        value={eventForm.date}
                        onChange={(event) =>
                          setEventForm({
                            ...eventForm,
                            date: event.target.value,
                          })
                        }
                      />
                    </label>

                    <label>
                      Ora
                      <input
                        type="time"
                        value={eventForm.time}
                        onChange={(event) =>
                          setEventForm({
                            ...eventForm,
                            time: event.target.value,
                          })
                        }
                      />
                    </label>

                    <label>
                      Luogo
                      <input
                        type="text"
                        value={eventForm.location}
                        onChange={(event) =>
                          setEventForm({
                            ...eventForm,
                            location: event.target.value,
                          })
                        }
                      />
                    </label>

                    <label>
                      Descrizione
                      <textarea
                        value={eventForm.description}
                        onChange={(event) =>
                          setEventForm({
                            ...eventForm,
                            description: event.target.value,
                          })
                        }
                      />
                    </label>

                    {isEditingUnavailablePublicEvent ? (
                      <div className="event-visibility-info unavailable">
                        <strong>Evento pubblico non più disponibile</strong>
                        <p>
                          L’evento originale è stato rimosso da Esplora. Puoi
                          modificare questa copia personale oppure gestirla dalla
                          pagina Eventi.
                        </p>
                      </div>
                    ) : isEditingCopiedPublicEvent ||
                      isEditingCopiedInviteEvent ? (
                      <div className="event-visibility-info">
                        <strong>
                          {isEditingCopiedInviteEvent
                            ? 'Evento ricevuto su invito'
                            : 'Evento aggiunto da Esplora eventi'}
                        </strong>
                        <p>
                          Stai modificando solo la tua copia personale. L’evento
                          originale non viene modificato.
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className="event-visibility-box">
                          <span>Visibilità evento</span>

                          <div className="event-visibility-options">
                            <label
                              className={
                                eventForm.visibility === 'private'
                                  ? 'event-visibility-option active'
                                  : 'event-visibility-option'
                              }
                            >
                              <input
                                type="radio"
                                name="calendar-edit-visibility"
                                value="private"
                                checked={eventForm.visibility === 'private'}
                                onChange={() =>
                                  setEventForm({
                                    ...eventForm,
                                    visibility: 'private',
                                  })
                                }
                              />

                              <div>
                                <strong>Privato</strong>
                                <p>Lo vedi solo tu nel tuo calendario.</p>
                              </div>
                            </label>

                            <label
                              className={
                                eventForm.visibility === 'public'
                                  ? 'event-visibility-option active'
                                  : 'event-visibility-option'
                              }
                            >
                              <input
                                type="radio"
                                name="calendar-edit-visibility"
                                value="public"
                                checked={eventForm.visibility === 'public'}
                                onChange={() =>
                                  setEventForm({
                                    ...eventForm,
                                    visibility: 'public',
                                  })
                                }
                              />

                              <div>
                                <strong>Pubblico</strong>
                                <p>Compare anche in Esplora eventi.</p>
                              </div>
                            </label>

                            {isEditingOwnedInviteEvent && (
                              <label
                                className={
                                  eventForm.visibility === 'invite'
                                    ? 'event-visibility-option active'
                                    : 'event-visibility-option'
                                }
                              >
                                <input
                                  type="radio"
                                  name="calendar-edit-visibility"
                                  value="invite"
                                  checked={eventForm.visibility === 'invite'}
                                  onChange={() =>
                                    setEventForm({
                                      ...eventForm,
                                      visibility: 'invite',
                                    })
                                  }
                                />

                                <div>
                                  <strong>Su invito</strong>
                                  <p>
                                    Resta un evento su invito. Gestisci le email
                                    dalla pagina Eventi.
                                  </p>
                                </div>
                              </label>
                            )}
                          </div>
                        </div>

                        <div className="calendar-invite-helper-box">
                          <div>
                            <strong>
                              {isEditingOwnedInviteEvent
                                ? 'Evento su invito'
                                : 'Vuoi renderlo su invito?'}
                            </strong>
                            <p>
                              {isEditingOwnedInviteEvent
                                ? 'Puoi modificare i dettagli da qui. Per email e partecipanti usa la pagina Eventi.'
                                : 'Gli eventi su invito richiedono email e partecipanti. Continua dalla pagina Eventi.'}
                            </p>
                          </div>

                          <Link to="/events" className="btn btn-secondary">
                            Vai a Eventi
                          </Link>
                        </div>
                      </>
                    )}

                    {popupError && (
                      <p className="error-message">{popupError}</p>
                    )}

                    <div className="calendar-popup-actions">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                          setIsEditing(false)
                          setPopupError('')
                        }}
                      >
                        Indietro
                      </button>

                      <button type="submit" className="btn btn-primary">
                        Salva modifiche
                      </button>
                    </div>
                  </form>
                )}

                {isEditing && selectedItem.type === 'task' && (
                  <form
                    className="calendar-popup-form"
                    onSubmit={handleUpdateTask}
                  >
                    <label>
                      Attività
                      <input
                        type="text"
                        value={taskForm.text}
                        onChange={(event) =>
                          setTaskForm({
                            ...taskForm,
                            text: event.target.value,
                          })
                        }
                      />
                    </label>

                    <label>
                      Scadenza
                      <input
                        type="date"
                        value={taskForm.dueDate}
                        onChange={(event) =>
                          setTaskForm({
                            ...taskForm,
                            dueDate: event.target.value,
                          })
                        }
                      />
                    </label>

                    <label>
                      Priorità
                      <select
                        value={taskForm.priority}
                        onChange={(event) =>
                          setTaskForm({
                            ...taskForm,
                            priority: event.target.value,
                          })
                        }
                      >
                        <option value="bassa">Bassa</option>
                        <option value="media">Media</option>
                        <option value="alta">Alta</option>
                      </select>
                    </label>

                    <label>
                      Stato
                      <select
                        value={taskForm.completed ? 'completed' : 'open'}
                        onChange={(event) =>
                          setTaskForm({
                            ...taskForm,
                            completed: event.target.value === 'completed',
                          })
                        }
                      >
                        <option value="open">Da completare</option>
                        <option value="completed">Completata</option>
                      </select>
                    </label>

                    {popupError && (
                      <p className="error-message">{popupError}</p>
                    )}

                    <div className="calendar-popup-actions">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                          setIsEditing(false)
                          setPopupError('')
                        }}
                      >
                        Indietro
                      </button>

                      <button type="submit" className="btn btn-primary">
                        Salva modifiche
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </main>
  )
}

export default Calendar
