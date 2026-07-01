// Codici meteo Open-Meteo tradotti in etichette leggibili.
const weatherDescriptions = {
  0: 'Cielo sereno',
  1: 'Prevalentemente sereno',
  2: 'Parzialmente nuvoloso',
  3: 'Coperto',
  45: 'Nebbia',
  48: 'Nebbia con brina',
  51: 'Pioviggine leggera',
  53: 'Pioviggine moderata',
  55: 'Pioviggine intensa',
  61: 'Pioggia leggera',
  63: 'Pioggia moderata',
  65: 'Pioggia intensa',
  71: 'Neve leggera',
  73: 'Neve moderata',
  75: 'Neve intensa',
  80: 'Rovesci leggeri',
  81: 'Rovesci moderati',
  82: 'Rovesci intensi',
  95: 'Temporale',
}

// Cerca la citta', poi recupera la previsione oraria per data e ora evento.
export async function getWeatherForCity(city, date, time) {
  if (!city) {
    throw new Error('Inserisci una città valida.')
  }

  if (!date || !time) {
    throw new Error('Inserisci data e ora per vedere il meteo previsto.')
  }

  const geocodingUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    city
  )}&count=1&language=it&format=json`

  const geocodingResponse = await fetch(geocodingUrl)

  if (!geocodingResponse.ok) {
    throw new Error('Errore nella richiesta geocoding.')
  }

  const geocodingData = await geocodingResponse.json()

  if (!geocodingData.results || geocodingData.results.length === 0) {
    throw new Error('Città non trovata.')
  }

  const place = geocodingData.results[0]

  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&hourly=temperature_2m,weather_code&start_date=${date}&end_date=${date}&timezone=auto`

  const weatherResponse = await fetch(weatherUrl)

  if (!weatherResponse.ok) {
    throw new Error('Errore nella richiesta meteo.')
  }

  const weatherData = await weatherResponse.json()

  if (!weatherData.hourly) {
    throw new Error('Dati meteo orari non disponibili.')
  }

  const hour = time.slice(0, 2)
  const eventDateTime = `${date}T${hour}:00`

  const weatherIndex = weatherData.hourly.time.findIndex(
    (forecastTime) => forecastTime === eventDateTime
  )

  if (weatherIndex === -1) {
    throw new Error('Meteo non disponibile per questa data e ora.')
  }

  const weatherCode = weatherData.hourly.weather_code[weatherIndex]

  return {
    city: place.name,
    country: place.country,
    temperature: weatherData.hourly.temperature_2m[weatherIndex],
    weatherCode,
    description:
      weatherDescriptions[weatherCode] || 'Condizione meteo non disponibile',
    forecastTime: eventDateTime,
  }
}
