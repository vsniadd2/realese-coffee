import { API_URL, getAuthHeaders } from '../config/api'

/**
 * Загружает дерево товаров (категории → подкатегории → товары) из БД.
 * Используется при создании заказа в ProductSelector.
 */
export async function getProductsTree() {
  try {
    const response = await fetch(`${API_URL}/products/tree`, {
      headers: getAuthHeaders()
    })

    if (response.status === 403) {
      throw new Error('UNAUTHORIZED')
    }

    if (!response.ok) {
      let errorMessage = 'Ошибка загрузки товаров'
      try {
        const data = await response.json()
        errorMessage = data.error || `Ошибка сервера: ${response.status} ${response.statusText}`
      } catch (e) {
        errorMessage = `Ошибка сервера: ${response.status} ${response.statusText}`
      }
      console.error('Ошибка загрузки товаров:', errorMessage, response.status)
      throw new Error(errorMessage)
    }

    const data = await response.json()
    const categories = data.categories || []

  // Преобразуем в формат, ожидаемый ProductSelector: объект категорий с подкатегориями и товарами
  const productCategories = {}
  categories.forEach(cat => {
    const subcategoriesMap = {}
    ;(cat.subcategories || []).forEach(sub => {
      subcategoriesMap[sub.id] = {
        id: sub.id,
        name: sub.name,
        products: (sub.products || []).map(p => ({
          id: p.id,
          name: p.name,
          price: Number(p.price),
          image_data: p.image_data || null
        }))
      }
    })
    productCategories[cat.id] = {
      id: cat.id,
      name: cat.name,
      icon: cat.icon || null,
      subcategories: subcategoriesMap
    }
  })

    return productCategories
  } catch (error) {
    // Если это уже наша ошибка, пробрасываем дальше
    if (error.message === 'UNAUTHORIZED' || error.message.startsWith('Ошибка')) {
      throw error
    }
    // Для сетевых ошибок и других
    console.error('Сетевая ошибка при загрузке товаров:', error)
    throw new Error('Не удалось подключиться к серверу. Проверьте, что бэкенд запущен.')
  }
}
