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

function Calendar() {
  const { user } = useAuth()

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
  })

  const [taskForm, setTaskForm] = useState({
    text: '',
    dueDate: '',
    priority: 'media',
    completed: false,
  })

  useEffect(() => {
    if (!user) return

    const eventsRef = collection(db, 'users', user.uid, 'events')
    const eventsQuery = query(eventsRef, orderBy('date', 'asc'))

    const unsubscribeEvents = onSnapshot(eventsQuery, (snapshot) => {
      const eventsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))

      setEvents(eventsData)
    })

    const tasksRef = collection(db, 'users', user.uid, 'tasks')

    const unsubscribeTasks = onSnapshot(tasksRef, (snapshot) => {
      const tasksData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))

      setTasks(tasksData)
    })

    return () => {
      unsubscribeEvents()
      unsubscribeTasks()
    }
  }, [user])

  const calendarItems = useMemo(() => {
    const eventItems = events
      .filter((eventItem) => eventItem.date)
      .map((eventItem) => {
        const hasTime = Boolean(eventItem.time)

        return {
          id: `event-${eventItem.id}`,
          title: eventItem.title,
          start: hasTime
            ? `${eventItem.date}T${eventItem.time}`
            : eventItem.date,
          allDay: !hasTime,
          className: 'planify-calendar-event',
          extendedProps: {
            type: 'event',
            originalId: eventItem.id,
            title: eventItem.title || '',
            date: eventItem.date || '',
            time: eventItem.time || '',
            location: eventItem.location || '',
            description: eventItem.description || '',
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
          className: taskItem.completed
            ? `planify-calendar-task ${getPriorityClass(
                priority
              )} completed-calendar-task`
            : `planify-calendar-task ${getPriorityClass(priority)}`,
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

    return [...eventItems, ...taskItems]
  }, [events, tasks])

  function handleCalendarItemClick(info) {
    const item = info.event.extendedProps

    setSelectedItem(item)
    setIsCreating(false)
    setIsEditing(false)
    setPopupError('')
    setCalendarMessage('')
    setCalendarError('')

    if (item.type === 'event') {
      setEventForm({
        title: item.title || '',
        date: item.date || '',
        time: item.time || '',
        location: item.location || '',
        description: item.description || '',
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
        const eventRef = doc(db, 'users', user.uid, 'events', item.originalId)

        const updatedEvent = {
          date: newDate,
        }

        if (!info.event.allDay && item.time) {
          updatedEvent.time = formatTime(newStartDate)
        }

        await updateDoc(eventRef, updatedEvent)

        setCalendarMessage('Evento spostato correttamente.')
        return
      }

      if (item.type === 'task') {
        const taskRef = doc(db, 'users', user.uid, 'tasks', item.originalId)

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

    const eventsRef = collection(db, 'users', user.uid, 'events')

    await addDoc(eventsRef, {
      title: eventForm.title,
      date: eventForm.date,
      time: eventForm.time,
      location: eventForm.location,
      description: eventForm.description,
      createdAt: serverTimestamp(),
    })

    setCalendarMessage('Evento creato correttamente.')
    closePopup()
  }

  async function handleCreateTask(event) {
    event.preventDefault()

    if (!taskForm.text || !taskForm.dueDate) {
      setPopupError('Inserisci almeno nome attività e scadenza.')
      return
    }

    const tasksRef = collection(db, 'users', user.uid, 'tasks')

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

    const eventRef = doc(
      db,
      'users',
      user.uid,
      'events',
      selectedItem.originalId
    )

    await updateDoc(eventRef, {
      title: eventForm.title,
      date: eventForm.date,
      time: eventForm.time,
      location: eventForm.location,
      description: eventForm.description,
    })

    closePopup()
  }

  async function handleUpdateTask(event) {
    event.preventDefault()

    if (!taskForm.text || !taskForm.dueDate) {
      setPopupError('Inserisci almeno nome attività e scadenza.')
      return
    }

    const taskRef = doc(
      db,
      'users',
      user.uid,
      'tasks',
      selectedItem.originalId
    )

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

    if (selectedItem.type === 'event') {
      const eventRef = doc(
        db,
        'users',
        user.uid,
        'events',
        selectedItem.originalId
      )

      await deleteDoc(eventRef)
      closePopup()
      return
    }

    if (selectedItem.type === 'task') {
      const taskRef = doc(
        db,
        'users',
        user.uid,
        'tasks',
        selectedItem.originalId
      )

      await deleteDoc(taskRef)
      closePopup()
    }
  }

  return (
    <main className="dashboard-page">
      <section className="calendar-layout">
        <div className="calendar-header">
          <div>
            <h1>Calendario</h1>
            <p>
              Visualizza eventi e attività con scadenza in un calendario
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
              <strong className="legend-dot event-dot"></strong>
              Evento
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
                          : 'calendar-popup-badge'
                      }
                    >
                      {selectedItem.type === 'event'
                        ? 'Evento'
                        : `Attività · Priorità ${getPriorityLabel(
                            taskForm.priority
                          )}`}
                    </span>

                    <h2>
                      {selectedItem.type === 'event'
                        ? eventForm.title
                        : taskForm.text}
                    </h2>
                  </div>

                  <button className="popup-close-button" onClick={closePopup}>
                    ×
                  </button>
                </div>

                {!isEditing && selectedItem.type === 'event' && (
                  <>
                    <div className="calendar-popup-content">
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