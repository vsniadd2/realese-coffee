import { API_URL, getAuthHeaders } from '../config/api'

export const orderStatsService = {
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
      throw new Error(data.error || 'Ошибка загрузки статистики по способам оплаты')
    }

    return response.json()
  },

  async getProductsStats(dateFrom = null, dateTo = null, pointId = null) {
    const params = new URLSearchParams()
    if (dateFrom) params.append('dateFrom', dateFrom)
    if (dateTo) params.append('dateTo', dateTo)
    if (pointId != null && pointId !== '') params.append('pointId', pointId)

    const response = await fetch(`${API_URL}/orders/stats/products?${params.toString()}`, {
      headers: getAuthHeaders()
    })

    if (response.status === 403) {
      throw new Error('UNAUTHORIZED')
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.error || 'Ошибка загрузки статистики по товарам')
    }

    return response.json()
  },

  async getCategoriesStats(dateFrom = null, dateTo = null, categoryId = null, pointId = null) {
    const params = new URLSearchParams()
    if (dateFrom) params.append('dateFrom', dateFrom)
    if (dateTo) params.append('dateTo', dateTo)
    if (categoryId) params.append('categoryId', categoryId)
    if (pointId != null && pointId !== '') params.append('pointId', pointId)

    const response = await fetch(`${API_URL}/orders/stats/categories?${params.toString()}`, {
      headers: getAuthHeaders()
    })

    if (response.status === 403) {
      throw new Error('UNAUTHORIZED')
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.error || 'Ошибка загрузки статистики по категориям')
    }

    return response.json()
  },

  async getCategoryProductsStats(dateFrom = null, dateTo = null, categoryId = null, pointId = null) {
    const params = new URLSearchParams()
    if (categoryId) params.append('categoryId', categoryId)
    if (dateFrom) params.append('dateFrom', dateFrom)
    if (dateTo) params.append('dateTo', dateTo)
    if (pointId != null && pointId !== '') params.append('pointId', pointId)

    const response = await fetch(`${API_URL}/orders/stats/category-products?${params.toString()}`, {
      headers: getAuthHeaders()
    })

    if (response.status === 403) {
      throw new Error('UNAUTHORIZED')
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.error || 'Ошибка загрузки статистики по товарам категории')
    }

    return response.json()
  },

  async getProductStats(dateFrom = null, dateTo = null, productId = null, productName = null, pointId = null) {
    const params = new URLSearchParams()
    if (productId) params.append('productId', productId)
    if (productName) params.append('productName', productName)
    if (dateFrom) params.append('dateFrom', dateFrom)
    if (dateTo) params.append('dateTo', dateTo)
    if (pointId != null && pointId !== '') params.append('pointId', pointId)

    const response = await fetch(`${API_URL}/orders/stats/product?${params.toString()}`, {
      headers: getAuthHeaders()
    })

    if (response.status === 403) {
      throw new Error('UNAUTHORIZED')
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.error || 'Ошибка загрузки статистики по товару')
    }

    return response.json()
  },

  async getDayTopProducts(date, categoryId = null, limit = 5, pointId = null) {
    const params = new URLSearchParams()
    params.append('date', date)
    params.append('limit', limit.toString())
    if (categoryId) params.append('categoryId', categoryId)
    if (pointId != null && pointId !== '') params.append('pointId', pointId)

    const response = await fetch(`${API_URL}/orders/stats/day-top-products?${params.toString()}`, {
      headers: getAuthHeaders()
    })

    if (response.status === 403) {
      throw new Error('UNAUTHORIZED')
    }

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data.error || 'Ошибка загрузки топ товаров за день')
    }

    return response.json()
  }
}
