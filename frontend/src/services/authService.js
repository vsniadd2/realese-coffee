import { API_URL, getAuthHeaders } from '../config/api'

export const authService = {
  async login(username, password) {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Ошибка входа')
    }

    return response.json()
  },

  async refreshToken(refreshToken) {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ refreshToken })
    })

    if (!response.ok) {
      throw new Error('Ошибка обновления токена')
    }

    return response.json()
  }
}
