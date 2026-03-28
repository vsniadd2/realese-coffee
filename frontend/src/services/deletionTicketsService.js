import { API_URL, getAuthHeaders } from '../config/api'

export const deletionTicketsService = {
  async createTicket() {
    const response = await fetch(`${API_URL}/purchases/clear-history`, {
      method: 'POST',
      headers: getAuthHeaders()
    })

    if (response.status === 403) {
      throw new Error('UNAUTHORIZED')
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.error || 'Ошибка создания тикета на удаление')
    }

    return response.json()
  },

  async cancelTicket(ticketId) {
    const response = await fetch(`${API_URL}/purchases/clear-history/${ticketId}/cancel`, {
      method: 'POST',
      headers: getAuthHeaders()
    })

    if (response.status === 403) {
      throw new Error('UNAUTHORIZED')
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.error || 'Ошибка отмены тикета')
    }

    return response.json()
  },

  async getActiveTickets() {
    const response = await fetch(`${API_URL}/purchases/clear-history/tickets`, {
      headers: getAuthHeaders()
    })

    if (response.status === 403) {
      throw new Error('UNAUTHORIZED')
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.error || 'Ошибка получения тикетов')
    }

    return response.json()
  }
}
