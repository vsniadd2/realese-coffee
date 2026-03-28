/**
 * Значения отчества, которые при отображении показываем как пустое (прочерк).
 * Сравнение без учёта регистра (Клиенты Gold, Клиенты GOLD и т.д.).
 */
const MIDDLE_NAME_PLACEHOLDERS_LOWER = ['клиенты gold', 'новые клиенты']

/**
 * Для отображения: если отчество — служебная метка («Клиенты Gold», «Клиенты GOLD», «Новые клиенты» и т.д.),
 * возвращает null, иначе возвращает значение как есть.
 * @param {string|null|undefined} value
 * @returns {string|null}
 */
export function normalizeMiddleNameForDisplay(value) {
  if (value == null || typeof value !== 'string') return null
  const v = value.trim()
  if (MIDDLE_NAME_PLACEHOLDERS_LOWER.includes(v.toLowerCase())) return null
  return value
}

/**
 * Значения ID клиента, которые при отображении показываем как прочерк.
 * Сравнение без учёта регистра для строк.
 */
const CLIENT_ID_AS_DASH_LOWER = ['червенский', 'валерьяново', 'не задано']

/**
 * Для отображения: если ID не задан, служебное значение («Червенский», «Валерьяново», «Не задано»)
 * или авто-сгенерированный (AUTO-...), возвращаем прочерк «—», иначе значение как есть.
 * @param {string|null|undefined} value
 * @returns {string}
 */
export function normalizeClientIdForDisplay(value) {
  if (value == null || value === '') return '—'
  if (typeof value !== 'string') return '—'
  const v = value.trim()
  if (v === '') return '—'
  if (v.toLowerCase().startsWith('auto-')) return '—'
  if (CLIENT_ID_AS_DASH_LOWER.includes(v.toLowerCase())) return '—'
  return value
}
