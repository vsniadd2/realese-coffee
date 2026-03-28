import { API_URL, getAuthHeaders } from '../config/api'

export const clientService = {
  async getAll({ page = 1, limit = 20, search = '' } = {}) {
    const params = new URLSearchParams()
    params.append('page', page.toString())
    params.append('limit', limit.toString())
    if (search) {
      params.append('search', search)
    }

    const response = await fetch(`${API_URL}/clients?${params.toString()}`, {
      headers: getAuthHeaders()
    })

    if (response.status === 403) {
      throw new Error('UNAUTHORIZED')
    }

    if (!response.ok) {
      throw new Error('Ошибка загрузки клиентов')
    }

    return response.json()
  },

  async getStats() {
    const response = await fetch(`${API_URL}/clients/stats`, {
      headers: getAuthHeaders()
    })
    if (response.status === 403) throw new Error('UNAUTHORIZED')
    if (!response.ok) throw new Error('Ошибка загрузки статистики')
    return response.json()
  },

  async search(query) {
    const q = typeof query === 'string' ? query.trim() : ''
    if (!q) return []

    const response = await fetch(`${API_URL}/clients/search?q=${encodeURIComponent(q)}`, {
      headers: getAuthHeaders()
    })

    if (response.status === 403) {
      throw new Error('UNAUTHORIZED')
    }

    if (!response.ok) {
      throw new Error('Ошибка поиска клиентов')
    }

    return response.json()
  },

  async getById(clientId) {
    const encodedClientId = encodeURIComponent(clientId)
    const response = await fetch(`${API_URL}/clients/${encodedClientId}`, {
      headers: getAuthHeaders()
    })

    if (response.status === 403) {
      throw new Error('UNAUTHORIZED')
    }

    if (response.status === 404) {
      return null
    }

    if (!response.ok) {
      throw new Error('Ошибка получения клиента')
    }

    return response.json()
  },

  async addPurchase(clientDbId, price, items = [], paymentMethod = 'cash', employeeDiscount = 0, mixedParts = null) {
    const body = { price, items, paymentMethod, employeeDiscount }
    if (paymentMethod === 'mixed' && mixedParts) {
      body.cashPart = mixedParts.cashPart
      body.cardPart = mixedParts.cardPart
    }
    const response = await fetch(`${API_URL}/clients/${clientDbId}/purchase`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(body)
    })

    if (response.status === 403) {
      throw new Error('UNAUTHORIZED')
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.error || 'Ошибка добавления покупки')
    }

    return response.json()
  },

  async createAnonymousPurchase(price, items = [], paymentMethod = 'cash', employeeDiscount = 0, mixedParts = null) {
    const body = { price, items, paymentMethod, employeeDiscount }
    if (paymentMethod === 'mixed' && mixedParts) {
      body.cashPart = mixedParts.cashPart
      body.cardPart = mixedParts.cardPart
    }
    const response = await fetch(`${API_URL}/purchases/anonymous`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(body)
    })

    if (response.status === 403) {
      throw new Error('UNAUTHORIZED')
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.error || 'Ошибка создания заказа')
    }

    return response.json()
  },

  async create(clientData) {
    const body = {
      firstName: clientData.firstName,
      lastName: clientData.lastName,
      middleName: clientData.middleName,
      clientId: clientData.clientId,
      price: clientData.price,
      items: clientData.items || [],
      paymentMethod: clientData.paymentMethod || 'cash',
      employeeDiscount: clientData.employeeDiscount || 0
    }
    if (body.paymentMethod === 'mixed' && clientData.cashPart != null && clientData.cardPart != null) {
      body.cashPart = clientData.cashPart
      body.cardPart = clientData.cardPart
    }
    const response = await fetch(`${API_URL}/clients`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(body)
    })

    if (response.status === 403) {
      throw new Error('UNAUTHORIZED')
    }

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Ошибка добавления клиента')
    }

    return response.json()
  },

  async getByIdDb(id) {
    const response = await fetch(`${API_URL}/admin/clients/${id}`, {
      headers: getAuthHeaders()
    })
    if (response.status === 403) throw new Error('UNAUTHORIZED')
    if (response.status === 404) return null
    if (!response.ok) throw new Error('Ошибка получения клиента')
    return response.json()
  },

  async update(id, data) {
    const response = await fetch(`${API_URL}/admin/clients/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        firstName: data.firstName,
        lastName: data.lastName,
        middleName: data.middleName,
        clientId: data.clientId,
        status: data.status || 'standart'
      })
    })
    if (response.status === 403) throw new Error('UNAUTHORIZED')
    if (!response.ok) {
      const res = await response.json().catch(() => ({}))
      throw new Error(res.error || 'Ошибка обновления клиента')
    }
    return response.json()
  },

  async delete(id) {
    const response = await fetch(`${API_URL}/admin/clients/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    })
    if (response.status === 403) throw new Error('UNAUTHORIZED')
    if (!response.ok) {
      const res = await response.json().catch(() => ({}))
      throw new Error(res.error || 'Ошибка удаления клиента')
    }
    return response.json()
  }
}
