import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import {
  collection,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore'
import { db } from '../services/firebase'
import { useAuth } from '../context/AuthContext'

const weekDays = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']

function formatDateKey(year, month, day) {
  const formattedMonth = String(month + 1).padStart(2, '0')
  const formattedDay = String(day).padStart(2, '0')

  return `${year}-${formattedMonth}-${formattedDay}`
}

function getCalendarDays(currentDate) {
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const firstDayOfMonth = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const startDay = (firstDayOfMonth.getDay() + 6) % 7

  const days = []

  for (let i = 0; i < startDay; i++) {
    days.push(null)
  }

  for (let day = 1; day <= daysInMonth; day++) {
    days.push({
      day,
      dateKey: formatDateKey(year, month, day),
    })
  }

  while (days.length % 7 !== 0) {
    days.push(null)
  }

  return days
}

function Calendar() {
  const { user } = useAuth()

  const [events, setEvents] = useState([])
  const [tasks, setTasks] = useState([])
  const [currentDate, setCurrentDate] = useState(new Date())

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

  const calendarDays = useMemo(() => {
    return getCalendarDays(currentDate)
  }, [currentDate])

  const monthTitle = currentDate.toLocaleDateString('it-IT', {
    month: 'long',
    year: 'numeric',
  })

  function goToPreviousMonth() {
    setCurrentDate((previousDate) => {
      return new Date(
        previousDate.getFullYear(),
        previousDate.getMonth() - 1,
        1
      )
    })
  }

  function goToNextMonth() {
    setCurrentDate((previousDate) => {
      return new Date(
        previousDate.getFullYear(),
        previousDate.getMonth() + 1,
        1
      )
    })
  }

  function goToToday() {
    setCurrentDate(new Date())
  }

  function getEventsForDay(dateKey) {
    return events.filter((event) => event.date === dateKey)
  }

  function getTasksForDay(dateKey) {
    return tasks.filter((task) => task.dueDate === dateKey)
  }

  return (
    <main className="dashboard-page">
      <section className="calendar-layout">
        <div className="calendar-header">
          <div>
            <h1>Calendario</h1>
            <p>
              Visualizza eventi e attività con scadenza in un’unica vista
              mensile.
            </p>
          </div>

          <Link to="/dashboard" className="btn btn-secondary">
            Dashboard
          </Link>
        </div>

        <div className="calendar-toolbar">
          <button className="btn btn-secondary" onClick={goToPreviousMonth}>
            Mese precedente
          </button>

          <div>
            <h2>{monthTitle}</h2>
            <button className="calendar-today-button" onClick={goToToday}>
              Torna a oggi
            </button>
          </div>

          <button className="btn btn-secondary" onClick={goToNextMonth}>
            Mese successivo
          </button>
        </div>

        <div className="calendar-grid">
          {weekDays.map((day) => (
            <div className="calendar-weekday" key={day}>
              {day}
            </div>
          ))}

          {calendarDays.map((calendarDay, index) => {
            if (!calendarDay) {
              return <div className="calendar-day empty-day" key={index}></div>
            }

            const dayEvents = getEventsForDay(calendarDay.dateKey)
            const dayTasks = getTasksForDay(calendarDay.dateKey)

            return (
              <div className="calendar-day" key={calendarDay.dateKey}>
                <div className="calendar-day-number">
                  {calendarDay.day}
                </div>

                <div className="calendar-items">
                  {dayEvents.map((event) => (
                    <div className="calendar-item event-item" key={event.id}>
                      <strong>{event.title}</strong>
                      {event.time && <span>{event.time}</span>}
                    </div>
                  ))}

                  {dayTasks.map((task) => (
                    <div
                      className={
                        task.completed
                          ? 'calendar-item task-item-calendar completed-calendar-task'
                          : 'calendar-item task-item-calendar'
                      }
                      key={task.id}
                    >
                      <strong>{task.text}</strong>
                      <span>{task.priority}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
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