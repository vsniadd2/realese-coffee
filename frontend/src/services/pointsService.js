import { API_URL, getAuthHeaders } from '../config/api'

export const pointsService = {
  async getPoints() {
    const response = await fetch(`${API_URL}/points`, {
      headers: getAuthHeaders()
    })
    if (response.status === 403) throw new Error('UNAUTHORIZED')
    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.error || 'Ошибка загрузки точек')
    }
    return response.json()
  }
}
