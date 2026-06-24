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
  if (eventItem.sourcePublicEventId && eventItem.sourceOwnerId !== userId) {
    return 'explore'
  }

  if (eventItem.visibility === 'public' || eventItem.sourcePublicEventId) {
    return 'public'
  }

  return 'private'
}

function getCalendarEventColors(kind) {
  if (kind === 'public') {
    return {
      backgroundColor: '#dcfce7',
      borderColor: '#16a34a',
      textColor: '#166534',
    }
  }

  if (kind === 'explore') {
    return {
      backgroundColor: '#ede9fe',
      borderColor: '#7c3aed',
      textColor: '#5b21b6',
    }
  }

  return {
    backgroundColor: '#dbeafe',
    borderColor: '#2563eb',
    textColor: '#1e3a8a',
  }
}

function getEventVisibilityLabel(eventItem, userId) {
  if (eventItem.sourcePublicEventId && eventItem.sourceOwnerId !== userId) {
    return 'Da Esplora'
  }

  if (eventItem.visibility === 'public' || eventItem.sourcePublicEventId) {
    return 'Pubblico'
  }

  return 'Privato'
}

function getEventVisibilityClass(eventItem, userId) {
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
  const userName = user?.displayName || 'Utente Planify'

  const [events, setEvents] = useState([])
  const [tasks, setTasks] = useState([])

  const [selectedItem, setSelectedItem] = useState(null)
  const [isEditing, setIsEditing] = useState(false)

  const [isCreating, setIsCreating] = useState(false)
  const [createType, setCreateType] = useState('event')

  const [popupError, setPopupError] = useState('')
  const [calendarMessage, setCalendarMessage] = useState('')
  const [calendarError, setCalendarError] = useState('')

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

  useEffect(() => {
    if (!userId) return

    const eventsRef = collection(db, 'users', userId, 'events')
    const eventsQuery = query(eventsRef, orderBy('date', 'asc'))

    const unsubscribeEvents = onSnapshot(eventsQuery, (snapshot) => {
      const eventsData = snapshot.docs.map((document) => ({
        id: document.id,
        ...document.data(),
      }))

      setEvents(eventsData)
    })

    const tasksRef = collection(db, 'users', userId, 'tasks')

    const unsubscribeTasks = onSnapshot(tasksRef, (snapshot) => {
      const tasksData = snapshot.docs.map((document) => ({
        id: document.id,
        ...document.data(),
      }))

      setTasks(tasksData)
    })

    return () => {
      unsubscribeEvents()
      unsubscribeTasks()
    }
  }, [userId])

  const calendarItems = useMemo(() => {
    const eventItems = events
      .filter((eventItem) => eventItem.date)
      .map((eventItem) => {
        const hasTime = Boolean(eventItem.time)
        const eventKind = getCalendarEventKind(eventItem, userId)
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
            sourceOwnerId: eventItem.sourceOwnerId || '',
            calendarEventKind: eventKind,
          },
        }
      })

    const taskItems = tasks
      .filter((taskItem) => taskItem.dueDate)
      .map((taskItem) => {
        const priority = taskItem.priority || 'media'

        return {
          id: `task-${taskItem.id}`,
          title: `Attività: ${taskItem.text}`,
          start: taskItem.dueDate,
          allDay: true,
          classNames: taskItem.completed
            ? [
                'planify-calendar-task',
                getPriorityClass(priority),
                'completed-calendar-task',
              ]
            : ['planify-calendar-task', getPriorityClass(priority)],
          extendedProps: {
            type: 'task',
            originalId: taskItem.id,
            text: taskItem.text || '',
            dueDate: taskItem.dueDate || '',
            priority,
            completed: Boolean(taskItem.completed),
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

    const holidayItems = holidayYears
      .flatMap((year) => getItalianHolidaysForYear(year))
      .map((holiday) => ({
        id: holiday.id,
        title: holiday.title,
        start: holiday.date,
        allDay: true,
        editable: false,
        startEditable: false,
        durationEditable: false,
        classNames: ['planify-calendar-holiday'],
        backgroundColor: '#ffe4e6',
        borderColor: '#e11d48',
        textColor: '#9f1239',
        extendedProps: {
          type: 'holiday',
          originalId: holiday.id,
          title: holiday.title,
          date: holiday.date,
          description: holiday.description,
          calendarEventKind: 'holiday',
        },
      }))

    return [...holidayItems, ...eventItems, ...taskItems]
  }, [events, tasks, userId])

  function handleEventDidMount(info) {
    const item = info.event.extendedProps

    if (item.type !== 'event' && item.type !== 'holiday') return

    let colors = null

    if (item.type === 'holiday') {
      colors = {
        backgroundColor: '#ffe4e6',
        borderColor: '#e11d48',
        textColor: '#9f1239',
      }
    } else {
      colors = getCalendarEventColors(item.calendarEventKind)
    }

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

  function getCurrentVisibility(item) {
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

  async function handleCalendarItemDrop(info) {
    const item = info.event.extendedProps
    const newStartDate = info.event.start

    if (item.type === 'holiday') {
      info.revert()
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
        }

        if (!info.event.allDay && item.time) {
          updatedEvent.time = formatTime(newStartDate)
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

        await batch.commit()

        setCalendarMessage('Evento spostato correttamente.')
        return
      }

      if (item.type === 'task') {
        const taskRef = doc(db, 'users', userId, 'tasks', item.originalId)

        await updateDoc(taskRef, {
          dueDate: newDate,
        })

        setCalendarMessage('Attività spostata correttamente.')
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

  async function handleCreateEvent(event) {
    event.preventDefault()

    if (!eventForm.title || !eventForm.date) {
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
          ownerId: userId,
          ownerName: userName,
          participantIds: [userId],
          participants: [participant],
          participantCount: 1,
          createdAt: serverTimestamp(),
        })

        batch.set(personalEventRef, {
          ...eventData,
          visibility: 'public',
          sourcePublicEventId: publicEventRef.id,
          sourceOwnerId: userId,
          createdAt: serverTimestamp(),
        })
      } else {
        batch.set(personalEventRef, {
          ...eventData,
          visibility: 'private',
          createdAt: serverTimestamp(),
        })
      }

      await batch.commit()

      setCalendarMessage(
        eventForm.visibility === 'public'
          ? 'Evento pubblico creato e pubblicato in Esplora eventi.'
          : 'Evento privato creato correttamente.'
      )

      closePopup()
    } catch (error) {
      console.error(error)
      setPopupError('Errore durante la creazione dell’evento.')
    }
  }

  async function handleCreateTask(event) {
    event.preventDefault()

    if (!taskForm.text || !taskForm.dueDate) {
      setPopupError('Inserisci almeno nome attività e scadenza.')
      return
    }

    const tasksRef = collection(db, 'users', userId, 'tasks')

    await addDoc(tasksRef, {
      text: taskForm.text,
      dueDate: taskForm.dueDate,
      priority: taskForm.priority,
      completed: taskForm.completed,
      createdAt: serverTimestamp(),
    })

    setCalendarMessage('Attività creata correttamente.')
    closePopup()
  }

  async function handleUpdateEvent(event) {
    event.preventDefault()

    if (!eventForm.title || !eventForm.date) {
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

    const isOwnedPublicEvent =
      selectedItem.sourcePublicEventId && selectedItem.sourceOwnerId === userId

    const isCopiedPublicEvent =
      selectedItem.sourcePublicEventId && selectedItem.sourceOwnerId !== userId

    try {
      const batch = writeBatch(db)

      const eventRef = doc(
        db,
        'users',
        userId,
        'events',
        selectedItem.originalId
      )

      if (isCopiedPublicEvent) {
        batch.update(eventRef, {
          ...eventData,
        })

        await batch.commit()

        setCalendarMessage('Copia personale aggiornata correttamente.')
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
          })

          batch.update(publicEventRef, {
            ...eventData,
          })
        } else {
          const publicEventRef = doc(collection(db, 'publicEvents'))

          batch.update(eventRef, {
            ...eventData,
            visibility: 'public',
            sourcePublicEventId: publicEventRef.id,
            sourceOwnerId: userId,
          })

          batch.set(publicEventRef, {
            ...eventData,
            ownerId: userId,
            ownerName: userName,
            participantIds: [userId],
            participants: [participant],
            participantCount: 1,
            createdAt: serverTimestamp(),
          })
        }
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

          batch.update(eventRef, {
            ...eventData,
            visibility: 'private',
            sourcePublicEventId: '',
            sourceOwnerId: '',
          })

          batch.delete(publicEventRef)
        } else {
          batch.update(eventRef, {
            ...eventData,
            visibility: 'private',
            sourcePublicEventId: '',
            sourceOwnerId: '',
          })
        }
      }

      await batch.commit()

      setCalendarMessage('Evento aggiornato correttamente.')
      closePopup()
    } catch (error) {
      console.error(error)
      setPopupError('Errore durante l’aggiornamento dell’evento.')
    }
  }

  async function handleUpdateTask(event) {
    event.preventDefault()

    if (!taskForm.text || !taskForm.dueDate) {
      setPopupError('Inserisci almeno nome attività e scadenza.')
      return
    }

    const taskRef = doc(db, 'users', userId, 'tasks', selectedItem.originalId)

    await updateDoc(taskRef, {
      text: taskForm.text,
      dueDate: taskForm.dueDate,
      priority: taskForm.priority,
      completed: taskForm.completed,
    })

    closePopup()
  }

  async function handleDeleteSelectedItem() {
    if (!selectedItem) return

    if (selectedItem.type === 'holiday') {
      setPopupError('Le festività automatiche non possono essere eliminate.')
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
              }

              if (participantToRemove) {
                updateData.participants = arrayRemove(participantToRemove)
              }

              batch.update(publicEventRef, updateData)
            }
          }
        }

        batch.delete(eventRef)

        await batch.commit()

        setCalendarMessage(
          removedOnlyPersonalCopy
            ? 'Evento rimosso dal tuo calendario e partecipazione annullata.'
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

        setCalendarMessage('Attività eliminata.')
        closePopup()
      }
    } catch (error) {
      console.error(error)
      setPopupError('Errore durante l’eliminazione.')
    }
  }

  const isEditingCopiedPublicEvent =
    selectedItem?.type === 'event' &&
    selectedItem?.sourcePublicEventId &&
    selectedItem?.sourceOwnerId !== userId

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

        <div className="fullcalendar-card">
          <FullCalendar
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

        <div className="calendar-legend improved-calendar-legend">
          <div className="legend-group">
            <span className="legend-title">Tipologia</span>

            <span className="legend-pill event-legend-pill">
              <strong className="legend-dot private-event-dot"></strong>
              Privato
            </span>

            <span className="legend-pill event-legend-pill">
              <strong className="legend-dot public-event-dot"></strong>
              Pubblico
            </span>

            <span className="legend-pill event-legend-pill">
              <strong className="legend-dot explore-event-dot"></strong>
              Da Esplora
            </span>

            <span className="legend-pill holiday-legend-pill">
              <strong className="legend-dot holiday-dot"></strong>
              Festività
            </span>
          </div>

          <div className="legend-divider"></div>

          <div className="legend-group">
            <span className="legend-title">Priorità attività</span>

            <span className="legend-pill low-legend-pill">
              <strong className="legend-dot priority-low-dot"></strong>
              Bassa
            </span>

            <span className="legend-pill medium-legend-pill">
              <strong className="legend-dot priority-medium-dot"></strong>
              Media
            </span>

            <span className="legend-pill high-legend-pill">
              <strong className="legend-dot priority-high-dot"></strong>
              Alta
            </span>
          </div>
        </div>
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

                  <button className="popup-close-button" onClick={closePopup}>
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
                            : 'calendar-popup-badge'
                      }
                    >
                      {selectedItem.type === 'event'
                        ? 'Evento'
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

                  <button className="popup-close-button" onClick={closePopup}>
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
                        Questa festività è inserita automaticamente e non può
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
                      <p>
                        <strong>Visibilità:</strong>{' '}
                        <span
                          className={`event-visibility-pill ${getEventVisibilityClass(
                            selectedItem,
                            userId
                          )}`}
                        >
                          {getEventVisibilityLabel(selectedItem, userId)}
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

                    {isEditingCopiedPublicEvent ? (
                      <div className="event-visibility-info">
                        <strong>Evento aggiunto da Esplora eventi</strong>
                        <p>
                          Stai modificando solo la tua copia personale.
                          L’evento pubblico originale non viene modificato.
                        </p>
                      </div>
                    ) : (
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
                        </div>
                      </div>
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