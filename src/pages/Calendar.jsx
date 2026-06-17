import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import {
  collection,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore'

import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import itLocale from '@fullcalendar/core/locales/it'

import { db } from '../services/firebase'
import { useAuth } from '../context/AuthContext'

function Calendar() {
  const { user } = useAuth()

  const [events, setEvents] = useState([])
  const [tasks, setTasks] = useState([])

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
            title: eventItem.title,
            date: eventItem.date,
            time: eventItem.time,
            location: eventItem.location,
            description: eventItem.description,
          },
        }
      })

    const taskItems = tasks
      .filter((taskItem) => taskItem.dueDate)
      .map((taskItem) => {
        return {
          id: `task-${taskItem.id}`,
          title: `Attività: ${taskItem.text}`,
          start: taskItem.dueDate,
          allDay: true,
          className: taskItem.completed
            ? 'planify-calendar-task completed-calendar-task'
            : 'planify-calendar-task',
          extendedProps: {
            type: 'task',
            originalId: taskItem.id,
            text: taskItem.text,
            dueDate: taskItem.dueDate,
            priority: taskItem.priority,
            completed: taskItem.completed,
          },
        }
      })

    return [...eventItems, ...taskItems]
  }, [events, tasks])

  function handleCalendarItemClick(info) {
    const item = info.event.extendedProps

    if (item.type === 'event') {
      alert(
        `Evento: ${item.title}\n` +
          `Data: ${item.date}\n` +
          `Ora: ${item.time || 'Non specificata'}\n` +
          `Luogo: ${item.location || 'Non specificato'}\n` +
          `Descrizione: ${item.description || 'Nessuna descrizione'}`
      )

      return
    }

    if (item.type === 'task') {
      alert(
        `Attività: ${item.text}\n` +
          `Scadenza: ${item.dueDate}\n` +
          `Priorità: ${item.priority}\n` +
          `Stato: ${item.completed ? 'Completata' : 'Da completare'}`
      )
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

        <div className="fullcalendar-card">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            locale={itLocale}
            firstDay={1}
            height="auto"
            events={calendarItems}
            eventClick={handleCalendarItemClick}
            nowIndicator={true}
            dayMaxEvents={3}
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

        <div className="calendar-legend">
          <span>
            <strong className="legend-dot event-dot"></strong>
            Eventi
          </span>

          <span>
            <strong className="legend-dot task-dot"></strong>
            Attività
          </span>
        </div>
      </section>
    </main>
  )
}

export default Calendar