// Piccoli helper per permessi browser, invio e promemoria eventi.
export function areNotificationsSupported() {
  return 'Notification' in window
}

export function getNotificationPermission() {
  if (!areNotificationsSupported()) {
    return 'unsupported'
  }

  return Notification.permission
}

export async function requestNotificationPermission() {
  if (!areNotificationsSupported()) {
    throw new Error('Le notifiche non sono supportate da questo browser.')
  }

  const permission = await Notification.requestPermission()

  return permission
}

export function showNotification(title, options = {}) {
  if (!areNotificationsSupported()) {
    throw new Error('Le notifiche non sono supportate da questo browser.')
  }

  if (Notification.permission !== 'granted') {
    throw new Error('Permesso notifiche non concesso.')
  }

  new Notification(title, {
    icon: '/logo.png',
    badge: '/logo.png',
    ...options,
  })
}

// Normalizza la data evento nel formato usato dai timeout.
export function getEventDateTime(eventItem) {
  if (!eventItem.date || !eventItem.time) {
    throw new Error('Evento senza data o ora.')
  }

  return new Date(`${eventItem.date}T${eventItem.time}`)
}

export function getMillisecondsUntilEvent(eventItem) {
  const eventDateTime = getEventDateTime(eventItem)
  const now = new Date()

  return eventDateTime.getTime() - now.getTime()
}

// Programma una notifica locale finche' la pagina resta aperta.
export function scheduleEventNotification(eventItem) {
  const millisecondsUntilEvent = getMillisecondsUntilEvent(eventItem)

  if (millisecondsUntilEvent <= 0) {
    throw new Error('Questo evento è già passato.')
  }

  const timeoutId = window.setTimeout(() => {
    showNotification('Promemoria Planify', {
      body: `Hai un evento ora: ${eventItem.title}`,
    })
  }, millisecondsUntilEvent)

  return timeoutId
}
