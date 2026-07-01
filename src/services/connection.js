// Controllo rete condiviso da App e pagina Offline.
export async function checkOnlineConnection() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return false
  }

  try {
    const response = await fetch(`/online-check.txt?time=${Date.now()}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
      },
    })

    return response.ok
  } catch {
    return false
  }
}
