import { API_URL, getAuthHeaders } from '../config/api'

export const purchaseHistoryService = {
  async getPurchases({ page = 1, limit = 20, dateFrom = null, dateTo = null, searchName = null, pointId = null } = {}) {
    const params = new URLSearchParams()
    params.append('page', page.toString())
    params.append('limit', limit.toString())
    if (dateFrom) params.append('dateFrom', dateFrom)
    if (dateTo) params.append('dateTo', dateTo)
    if (searchName) params.append('searchName', searchName)
    if (pointId != null && pointId !== '') params.append('pointId', pointId)

    const response = await fetch(`${API_URL}/purchases?${params.toString()}`, {
      headers: getAuthHeaders()
    })

    if (response.status === 403) {
      throw new Error('UNAUTHORIZED')
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.error || 'Ошибка загрузки истории покупок')
    }

    return response.json()
  },

  async getPurchaseDetails(purchaseId) {
    const response = await fetch(`${API_URL}/purchases/${purchaseId}`, {
      headers: getAuthHeaders()
    })

    if (response.status === 403) {
      throw new Error('UNAUTHORIZED')
    }

    if (response.status === 404) {
      return null
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.error || 'Ошибка загрузки деталей покупки')
    }

    return response.json()
  },

  async setOperationType(purchaseId, operationType) {
    const response = await fetch(`${API_URL}/purchases/${purchaseId}`, {
      method: 'PATCH',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ operation_type: operationType })
    })

    if (response.status === 403) {
      throw new Error('UNAUTHORIZED')
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.error || 'Ошибка обновления операции')
    }

    return response.json()
  },

  async createReplacement(returnTransactionId, price, items) {
    const response = await fetch(`${API_URL}/purchases/replacement`, {
      method: 'POST',
      headers: {
        ...getAuthHeaders(),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        return_transaction_id: returnTransactionId,
        price: Number(price),
        items: items || []
      })
    })

    if (response.status === 403) {
      throw new Error('UNAUTHORIZED')
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.error || 'Ошибка оформления замены')
    }

    return response.json()
  },

  async deleteTransaction(transactionId) {
    const response = await fetch(`${API_URL}/admin/transactions/${transactionId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    })

    if (response.status === 403) {
      throw new Error('UNAUTHORIZED')
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.error || 'Ошибка удаления заказа')
    }

    return response.json()
  },

  async getPaymentStats(dateFrom = null, dateTo = null, pointId = null) {
    const params = new URLSearchParams()
    if (dateFrom) params.append('dateFrom', dateFrom)
    if (dateTo) params.append('dateTo', dateTo)
    if (pointId != null && pointId !== '') params.append('pointId', pointId)

    const response = await fetch(`${API_URL}/purchases/payment-stats?${params.toString()}`, {
      headers: getAuthHeaders()
    })

    if (response.status === 403) {
      throw new Error('UNAUTHORIZED')
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.error || 'Ошибка загрузки статистики')
    }

    return response.json()
  }
}
