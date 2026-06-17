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