/** Повторяет запрос после обновления access token при 403 (UNAUTHORIZED). */
export async function withAuthRetry(fn, refreshAccessToken) {
  try {
    return await fn()
  } catch (err) {
    if (err?.message !== 'UNAUTHORIZED') {
      throw err
    }
    const refreshed = await refreshAccessToken()
    if (!refreshed) {
      throw new Error('Сессия истекла. Войдите снова.')
    }
    return await fn()
  }
}
