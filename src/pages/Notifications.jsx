import { useState } from 'react'
import { Link } from 'react-router'

import {
  areNotificationsSupported,
  getNotificationPermission,
  requestNotificationPermission,
  showNotification,
} from '../services/notifications'

function getPermissionInfo(permission) {
  if (permission === 'granted') {
    return {
      label: 'Attive',
      text: 'Le notifiche sono abilitate. Puoi ricevere promemoria dagli eventi.',
      className: 'notification-active',
    }
  }

  if (permission === 'denied') {
    return {
      label: 'Bloccate',
      text: 'Le notifiche sono bloccate dal browser. Devi riattivarle dalle impostazioni del sito o del sistema.',
      className: 'notification-blocked',
    }
  }

  if (permission === 'unsupported') {
    return {
      label: 'Non supportate',
      text: 'Questo browser non supporta le notifiche.',
      className: 'notification-blocked',
    }
  }

  return {
    label: 'Non attivate',
    text: 'Puoi attivare le notifiche per ricevere promemoria sugli eventi.',
    className: 'notification-pending',
  }
}

function Notifications() {
  const [permission, setPermission] = useState(getNotificationPermission())
  const [message, setMessage] = useState('')

  const permissionInfo = getPermissionInfo(permission)

  async function handleRequestPermission() {
    setMessage('')

    if (!areNotificationsSupported()) {
      setPermission('unsupported')
      setMessage('Le notifiche non sono supportate da questo browser.')
      return
    }

    try {
      const newPermission = await requestNotificationPermission()
      setPermission(newPermission)

      if (newPermission === 'granted') {
        setMessage('Notifiche attivate correttamente.')
        return
      }

      if (newPermission === 'denied') {
        setMessage(
          'Notifiche bloccate. Puoi riattivarle dalle impostazioni del browser.'
        )
        return
      }

      setMessage('Notifiche non ancora attivate.')
    } catch (error) {
      console.error(error)
      setMessage('Errore durante la richiesta del permesso notifiche.')
    }
  }

  function handleTestNotification() {
    setMessage('')

    try {
      showNotification('Planify', {
        body: 'Le notifiche funzionano. Riceverai promemoria per eventi e scadenze.',
      })

      setMessage('Notifica di prova inviata.')
    } catch (error) {
      console.error(error)
      setMessage(
        'Impossibile inviare la notifica. Controlla di averle attivate.'
      )
    }
  }

  return (
    <main className="dashboard-page">
      <section className="notifications-page">
        <div className="notifications-hero-card">
          <div>
            <span className="dashboard-badge">Notifiche</span>

            <h1>Centro notifiche</h1>

            <p>
              Gestisci i permessi del browser e verifica che i promemoria di
              Planify siano pronti per ricordarti eventi e scadenze.
            </p>
          </div>

          <Link to="/dashboard" className="btn btn-secondary">
            Dashboard
          </Link>
        </div>

        <div className="notifications-grid">
          <article className="notification-status-card">
            <div className="notification-status-header">
              <span className={`notification-status-dot ${permissionInfo.className}`}>
              </span>

              <div>
                <h2>Stato notifiche</h2>
                <strong>{permissionInfo.label}</strong>
              </div>
            </div>

            <p>{permissionInfo.text}</p>

            {message && <p className="notification-message">{message}</p>}

            <div className="notifications-actions">
              <button
                className="btn btn-primary"
                onClick={handleRequestPermission}
              >
                Attiva notifiche
              </button>

              <button
                className="btn btn-secondary"
                onClick={handleTestNotification}
                disabled={permission !== 'granted'}
              >
                Prova notifica
              </button>
            </div>
          </article>

          <article className="notification-info-card">
            <h2>Promemoria eventi</h2>

            <p>
              Dalla pagina Eventi puoi attivare un promemoria per un evento con
              data e ora. Quando arriva il momento, Planify invia una notifica
              di sistema.
            </p>

            <div className="notification-note">
              <strong>Nota importante</strong>
              <p>
                In questa versione i promemoria funzionano mentre Planify è
                aperta nel browser.
              </p>
            </div>

            <div className="notification-links">
              <Link to="/events" className="btn btn-primary">
                Vai agli eventi
              </Link>

              <Link to="/calendar" className="btn btn-secondary">
                Apri calendario
              </Link>
            </div>
          </article>
        </div>

        <div className="notification-steps-card">
          <h2>Come usare le notifiche</h2>

          <div className="notification-steps-grid">
            <article>
              <span>1</span>
              <strong>Attiva il permesso</strong>
              <p>
                Consenti le notifiche dal browser e dal sistema operativo.
              </p>
            </article>

            <article>
              <span>2</span>
              <strong>Crea un evento</strong>
              <p>
                Inserisci data e ora nella pagina Eventi o dal Calendario.
              </p>
            </article>

            <article>
              <span>3</span>
              <strong>Attiva il promemoria</strong>
              <p>
                Usa il pulsante Promemoria per ricevere l’avviso al momento
                giusto.
              </p>
            </article>
          </div>
        </div>
      </section>
    </main>
  )
}

export default Notifications