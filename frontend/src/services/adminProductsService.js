import { API_URL, getAuthHeaders } from '../config/api'

const request = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: getAuthHeaders()
  })
  if (response.status === 403) throw new Error('UNAUTHORIZED')
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || 'Ошибка запроса')
  }
  return response.json()
}

export const adminProductsService = {
  getCategories() {
    return request(`${API_URL}/admin/products/categories`)
  },
  createCategory(data) {
    return request(`${API_URL}/admin/products/categories`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },
  updateCategory(id, data) {
    return request(`${API_URL}/admin/products/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  },
  deleteCategory(id) {
    return request(`${API_URL}/admin/products/categories/${id}`, { method: 'DELETE' })
  },
  getSubcategories(categoryId) {
    return request(`${API_URL}/admin/products/categories/${categoryId}/subcategories`)
  },
  createSubcategory(data) {
    return request(`${API_URL}/admin/products/subcategories`, {
      method: 'POST',
      body: JSON.stringify(data)
    })
  },
  updateSubcategory(id, data) {
    return request(`${API_URL}/admin/products/subcategories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    })
  },
  deleteSubcategory(id) {
    return request(`${API_URL}/admin/products/subcategories/${id}`, { method: 'DELETE' })
  },
  getProducts(subcategoryId) {
    return request(`${API_URL}/admin/products/subcategories/${subcategoryId}/products`)
  },
  createProduct(data) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 90000)
    return request(`${API_URL}/admin/products`, {
      method: 'POST',
      body: JSON.stringify(data),
      signal: controller.signal
    })
      .finally(() => clearTimeout(timeoutId))
      .catch((err) => {
        if (err?.name === 'AbortError') throw new Error('Запрос занял слишком много времени. Уменьшите размер изображения и попробуйте снова.')
        throw err
      })
  },
  updateProduct(id, data) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 90000)
    return request(`${API_URL}/admin/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
      signal: controller.signal
    })
      .finally(() => clearTimeout(timeoutId))
      .catch((err) => {
        if (err?.name === 'AbortError') throw new Error('Запрос занял слишком много времени. Уменьшите размер изображения и попробуйте снова.')
        throw err
      })
  },
  deleteProduct(id) {
    return request(`${API_URL}/admin/products/${id}`, { method: 'DELETE' })
  }
}
