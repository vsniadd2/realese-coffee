// Используем МСК (Московское время), которое совпадает с минским (UTC+3)
const TIME_ZONE = 'Europe/Moscow'
const LOCALE = 'ru-RU'

const toDate = (value) => {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export const formatMinskDate = (value) => {
  const d = toDate(value)
  if (!d) return '—'
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(d)
}

export const formatMinskDateTime = (value) => {
  const d = toDate(value)
  if (!d) return '—'
  // Форматируем дату и время в формате: ДД.ММ.ГГГГ, ЧЧ:ММ
  const dateTime = new Intl.DateTimeFormat(LOCALE, {
    timeZone: TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(d)
  return dateTime
}

