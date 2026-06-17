import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import {
  areNotificationsSupported,
  getNotificationPermission,
  requestNotificationPermission,
  showNotification,
} from '../services/notifications'

function Notifications() {
  const [permission, setPermission] = useState('default')
  const [message, setMessage] = useState('')

  useEffect(() => {
    setPermission(getNotificationPermission())
  }, [])

  async function handleEnableNotifications() {
    setMessage('')

    try {
      const result = await requestNotificationPermission()
      setPermission(result)

      if (result === 'granted') {
        setMessage('Notifiche attivate correttamente.')
      } else if (result === 'denied') {
        setMessage(
          'Notifiche bloccate. Puoi riattivarle dalle impostazioni del browser.'
        )
      } else {
        setMessage('Permesso notifiche non ancora concesso.')
      }
    } catch (error) {
      console.error(error)
      setMessage('Questo browser non supporta le notifiche.')
    }
  }

  function handleTestNotification() {
    setMessage('')

    try {
      showNotification('Planify', {
        body: 'Le notifiche sono attive. Ti ricorderemo eventi e scadenze.',
      })

      setMessage('Notifica di prova inviata.')
    } catch (error) {
      console.error(error)
      setMessage('Devi prima attivare le notifiche.')
    }
  }

  return (
    <main className="dashboard-page">
      <section className="notifications-card">
        <div className="notifications-header">
          <div>
            <h1>Notifiche</h1>
            <p>
              Attiva le notifiche per ricevere promemoria su eventi, scadenze e
              attività personali.
            </p>
          </div>

          <Link to="/dashboard" className="btn btn-secondary">
            Dashboard
          </Link>
        </div>

        <div className="notification-status">
          <h2>Stato notifiche</h2>

          {!areNotificationsSupported() ? (
            <p>Le notifiche non sono supportate da questo browser.</p>
          ) : (
            <p>
              Permesso attuale:{' '}
              <strong>
                {permission === 'granted'
                  ? 'Attive'
                  : permission === 'denied'
                    ? 'Bloccate'
                    : 'Non ancora attivate'}
              </strong>
            </p>
          )}
        </div>

        <div className="notifications-actions">
          <button
            className="btn btn-primary"
            onClick={handleEnableNotifications}
          >
            Attiva notifiche
          </button>

          <button
            className="btn btn-secondary"
            onClick={handleTestNotification}
          >
            Prova notifica
          </button>
        </div>

        {message && <p className="notification-message">{message}</p>}

        <div className="notifications-info">
          <h2>A cosa serviranno?</h2>

          <p>
            In Planify le notifiche verranno usate per ricordare eventi,
            scadenze e attività importanti.
          </p>
        </div>
      </section>
    </main>
  )
}

export default Notifications