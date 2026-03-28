import React, { useState, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNotification } from './NotificationProvider'
import { API_URL, getAuthHeaders } from '../config/api'
import './OrderSearchPage.css'

const OrderSearchPage = () => {
  const { refreshAccessToken } = useAuth()
  const { showNotification } = useNotification()
  const [productName, setProductName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [createdByUser, setCreatedByUser] = useState('')
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)

  const searchOrders = useCallback(async () => {
    if (!productName.trim() || !startDate || !endDate) {
      showNotification('Заполните все обязательные поля', 'error')
      return
    }

    setLoading(true)
    try {
      const params = new URLSearchParams({
        productName: productName.trim(),
        startDate,
        endDate
      })
      if (createdByUser) {
        params.append('createdByUser', createdByUser)
      }

      const response = await fetch(`${API_URL}/orders/search?${params.toString()}`, {
        headers: getAuthHeaders()
      })

      if (response.status === 403) {
        throw new Error('UNAUTHORIZED')
      }

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Ошибка поиска')
      }

      const data = await response.json()
      setOrders(data)
    } catch (err) {
      if (err.message === 'UNAUTHORIZED') {
        const refreshed = await refreshAccessToken()
        if (refreshed) {
          return searchOrders()
        }
        showNotification('Сессия истекла. Войдите снова.', 'error')
      } else {
        showNotification(err.message || 'Ошибка поиска заказов', 'error')
      }
      setOrders([])
    } finally {
      setLoading(false)
    }
  }, [productName, startDate, endDate, createdByUser, refreshAccessToken, showNotification])

  const handleSubmit = (e) => {
    e.preventDefault()
    searchOrders()
  }

  return (
    <div className="order-search-page">
      <div className="order-search-content">
        <div className="order-search-header">
          <h2>Поиск заказов</h2>
        </div>

        <form onSubmit={handleSubmit} className="order-search-form">
          <div className="order-search-form-row">
            <div className="order-search-form-group">
              <label>Название товара *</label>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Например: 1кг Мексика"
                required
              />
            </div>
          </div>

          <div className="order-search-form-row">
            <div className="order-search-form-group">
              <label>Начало периода *</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div className="order-search-form-group">
              <label>Конец периода *</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="order-search-form-row">
            <div className="order-search-form-group">
              <label>Создал пользователь (необязательно)</label>
              <select
                value={createdByUser}
                onChange={(e) => setCreatedByUser(e.target.value)}
              >
                <option value="">Все пользователи</option>
                <option value="chervenskiy">chervenskiy</option>
                <option value="valeryanova">valeryanova</option>
              </select>
            </div>
          </div>

          <div className="order-search-actions">
            <button type="submit" className="order-search-btn" disabled={loading}>
              {loading ? 'Поиск...' : 'Найти заказы'}
            </button>
          </div>
        </form>

        {orders.length > 0 && (
          <div className="order-search-results">
            <h3>Найдено заказов: {orders.length}</h3>
            <div className="order-search-results-list">
              {orders.map((order) => (
                <div key={order.id} className="order-search-result-item">
                  <div className="order-search-result-header">
                    <div className="order-search-result-date">
                      {new Date(order.created_at).toLocaleString('ru-RU')}
                    </div>
                    <div className="order-search-result-user">
                      {order.created_by_user || 'Не указан'}
                    </div>
                  </div>
                  {order.client_id && (
                    <div className="order-search-result-client">
                      Клиент: {order.first_name} {order.last_name} {order.middle_name || ''}
                      {order.client_identifier && ` (${order.client_identifier})`}
                    </div>
                  )}
                  {!order.client_id && (
                    <div className="order-search-result-client">Анонимный заказ</div>
                  )}
                  <div className="order-search-result-items">
                    {order.items && order.items.length > 0 && (
                      <div>
                        <strong>Товары:</strong>
                        <ul>
                          {order.items.map((item, idx) => (
                            <li key={idx}>
                              {item.product_name} - {item.quantity} шт. × {parseFloat(item.product_price).toFixed(2)} BYN
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  <div className="order-search-result-total">
                    <div>Сумма: {parseFloat(order.amount).toFixed(2)} BYN</div>
                    {order.discount > 0 && (
                      <div>Скидка: {order.discount}%</div>
                    )}
                    {order.employee_discount > 0 && (
                      <div>Скидка сотрудника: -{parseFloat(order.employee_discount).toFixed(2)} BYN</div>
                    )}
                    <div className="order-search-result-final">
                      Итого: {parseFloat(order.final_amount).toFixed(2)} BYN
                    </div>
                    <div className="order-search-result-payment">
                      Оплата: {order.payment_method === 'mixed'
                        ? `Смешанная (${parseFloat(order.cash_part || 0).toFixed(2)} наличными + ${parseFloat(order.card_part || 0).toFixed(2)} картой)`
                        : order.payment_method === 'card'
                          ? 'Карта'
                          : 'Наличные'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {orders.length === 0 && !loading && productName && startDate && endDate && (
          <div className="order-search-no-results">
            Заказы не найдены
          </div>
        )}
      </div>
    </div>
  )
}

export default OrderSearchPage
