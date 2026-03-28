import React, { useState, useEffect } from 'react'
import { useClients } from '../hooks/useClients'
import { clientService } from '../services/clientService'
import { useNotification } from './NotificationProvider'
import { useDataRefresh } from '../contexts/DataRefreshContext'
import ProductSelector from './ProductSelector'
import PaymentMethodModal from './PaymentMethodModal'
import './ClientModal.css'

const ClientModal = ({ onClose }) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    middleName: '',
    clientId: '',
    price: ''
  })
  const [loading, setLoading] = useState(false)
  const [discountInfo, setDiscountInfo] = useState(null)
  const [checkedClient, setCheckedClient] = useState(null)
  const [selectedProducts, setSelectedProducts] = useState({})
  const [productsTotal, setProductsTotal] = useState(0)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [pendingOrderData, setPendingOrderData] = useState(null)

  const { addClient, addPurchase } = useClients()
  const { showNotification } = useNotification()
  const { refreshAll } = useDataRefresh()

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleProductsChange = (cart, total) => {
    setSelectedProducts(cart)
    setProductsTotal(total)
    // Автоматически обновляем цену в форме, если есть товары
    if (total > 0) {
      setFormData(prev => ({
        ...prev,
        price: total.toFixed(2)
      }))
    }
  }

  const createOrderWithPayment = async (paymentMethod, options) => {
    setLoading(true)
    setShowPaymentModal(false)

    try {
      const orderData = pendingOrderData
      if (!orderData) {
        setLoading(false)
        return
      }

      const mixedParts = paymentMethod === 'mixed' && options ? { cashPart: options.cashPart, cardPart: options.cardPart } : null

      if (orderData.type === 'existing') {
        const purchaseResult = await addPurchase(orderData.clientId, orderData.price, orderData.items, paymentMethod, 0, mixedParts)
        if (purchaseResult.success) {
          showNotification('Покупка успешно добавлена!', 'success')
          setTimeout(() => refreshAll(), 100)
          setTimeout(() => {
            onClose()
            setFormData({ firstName: '', lastName: '', middleName: '', clientId: '', price: '' })
            setSelectedProducts({})
            setProductsTotal(0)
            setCheckedClient(null)
            setDiscountInfo(null)
          }, 1000)
        } else {
          showNotification(purchaseResult.error || 'Ошибка при добавлении покупки', 'error')
        }
      } else if (orderData.type === 'new') {
        const clientData = {
          firstName: orderData.firstName,
          lastName: orderData.lastName,
          middleName: orderData.middleName,
          clientId: orderData.clientId,
          price: orderData.price,
          items: orderData.items,
          paymentMethod
        }
        if (mixedParts) {
          clientData.cashPart = mixedParts.cashPart
          clientData.cardPart = mixedParts.cardPart
        }
        const result = await addClient(clientData)

        if (result.success) {
          showNotification('Клиент успешно добавлен!', 'success')
          refreshAll()
          onClose()
          setFormData({ firstName: '', lastName: '', middleName: '', clientId: '', price: '' })
          setSelectedProducts({})
          setProductsTotal(0)
        } else {
          showNotification(result.error, 'error')
        }
      }

      setPendingOrderData(null)
    } catch (error) {
      showNotification(error.message || 'Ошибка при обработке запроса', 'error')
    }

    setLoading(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setDiscountInfo(null)
    setCheckedClient(null)

    try {
      // Проверка существующего клиента по clientId, если указан
      let existingClient = null
      if (formData.clientId && formData.clientId.trim()) {
        try {
          existingClient = await clientService.getById(formData.clientId.trim())
          
          if (existingClient) {
            // Клиент найден - рассчитываем скидку и показываем информацию
            const price = productsTotal > 0 ? productsTotal : (parseFloat(formData.price) || 0)
            const currentTotal = parseFloat(existingClient.total_spent) || 0
            
            setCheckedClient(existingClient)
            
            const status = existingClient.status || 'standart'
            const hasDiscount = price > 0 && status === 'gold'
            if (hasDiscount) {
              setDiscountInfo({
                hasDiscount: true,
                originalPrice: price,
                finalPrice: price * 0.9,
                discount: 10
              })
            }
            
            // Если клиент найден и указана цена, добавляем покупку
            if (price > 0) {
              const items = Object.values(selectedProducts).map(item => ({
                productId: item.product.id,
                productName: item.product.name,
                productPrice: item.product.price,
                quantity: item.quantity
              }))
              const finalAmount = hasDiscount ? price * 0.9 : price
              setPendingOrderData({ type: 'existing', clientId: existingClient.id, price, items, finalAmount })
              setShowPaymentModal(true)
              return
            } else {
              showNotification('Клиент найден. Укажите цену для добавления покупки.', 'info')
              return
            }
          }
        } catch (err) {
          // Клиент не найден - продолжаем создание нового
          if (err.message === 'UNAUTHORIZED') {
            showNotification('Ошибка авторизации', 'error')
            return
          }
          // 404 или другой ошибка - клиент не найден, создаем нового
        }
      }

      // Создание нового клиента
      const finalPrice = productsTotal > 0 ? productsTotal : (parseFloat(formData.price) || 0)
      
      // Подготавливаем товары для отправки
      const items = Object.values(selectedProducts).map(item => ({
        productId: item.product.id,
        productName: item.product.name,
        productPrice: item.product.price,
        quantity: item.quantity
      }))
      
      setPendingOrderData({
        type: 'new',
        firstName: formData.firstName,
        lastName: formData.lastName,
        middleName: formData.middleName,
        clientId: formData.clientId,
        price: finalPrice,
        items,
        finalAmount: finalPrice
      })
      setShowPaymentModal(true)
    } catch (error) {
      showNotification(error.message || 'Ошибка при обработке запроса', 'error')
    }
  }

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div className="modal" onClick={handleOverlayClick}>
      <div className="modal-overlay"></div>
      <div className="modal-content modal-content-large">
        <div className="modal-header">
          <h2>Новый клиент</h2>
          <button className="close-modal" onClick={onClose}>&times;</button>
        </div>
        <p style={{ marginBottom: 20, color: 'var(--muted)', fontSize: '0.9rem' }}>
          Все поля <strong>необязательны</strong>. Вы можете выбрать товары или указать цену вручную.
        </p>
        
        <div className="modal-two-columns">
          {/* Левая колонка - Выбор товаров */}
          <div className="modal-left-column">
            <h3 style={{ marginBottom: 14, fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>
              Выбор товаров
            </h3>
            <ProductSelector 
              onProductsChange={handleProductsChange}
              initialTotal={productsTotal}
            />
          </div>

          {/* Правая колонка - Форма */}
          <div className="modal-right-column">
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="input-group">
                  <label>Имя (необязательно)</label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    disabled={loading}
                  />
                </div>
                <div className="input-group">
                  <label>Фамилия (необязательно)</label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    disabled={loading}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="input-group">
                  <label>Отчество</label>
                  <input
                    type="text"
                    name="middleName"
                    value={formData.middleName}
                    onChange={handleChange}
                    disabled={loading}
                  />
                </div>
                <div className="input-group">
                  <label>ID (телефон или строка) (необязательно)</label>
                  <input
                    type="text"
                    name="clientId"
                    value={formData.clientId}
                    onChange={handleChange}
                    disabled={loading}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="input-group">
                  <label>Цена (необязательно)</label>
                  <input
                    type="number"
                    name="price"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={handleChange}
                    disabled={loading}
                  />
                </div>
              </div>

              {checkedClient && (
                <div className="client-found-info">
                  <div style={{ fontWeight: '600', marginBottom: 6, fontSize: '0.95rem' }}>
                    ✓ Клиент найден: {checkedClient.first_name} {checkedClient.last_name}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                    Статус: {checkedClient.status === 'gold' ? 'GOLD' : 'STANDART'} | 
                    Потрачено: {parseFloat(checkedClient.total_spent || 0).toFixed(2)} BYN
                  </div>
                </div>
              )}

              {(discountInfo && discountInfo.hasDiscount) || (checkedClient && productsTotal > 0) ? (
                <div className="discount-preview" style={{ marginTop: 12 }}>
                  {discountInfo && discountInfo.hasDiscount && (
                    <>
                      <div className="discount-badge">
                        <span>Скидка {discountInfo.discount}%</span>
                      </div>
                      <div className="price-preview">
                        <div className="price-original">
                          {discountInfo.originalPrice.toFixed(2)} BYN
                        </div>
                        <div className="price-final">
                          {discountInfo.finalPrice.toFixed(2)} BYN
                        </div>
                      </div>
                    </>
                  )}
                  {checkedClient && productsTotal > 0 && !discountInfo && (
                    <div className="price-preview">
                      <div className="price-final">
                        {productsTotal.toFixed(2)} BYN
                      </div>
                    </div>
                  )}
                </div>
              ) : null}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-cancel"
                  onClick={onClose}
                  disabled={loading}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="btn-submit"
                  disabled={loading}
                >
                  {loading ? 'Сохранение...' : 'Занести в базу'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {showPaymentModal && pendingOrderData && (
        <PaymentMethodModal
          totalAmount={pendingOrderData.finalAmount ?? pendingOrderData.price}
          onSelect={createOrderWithPayment}
          onClose={() => {
            setShowPaymentModal(false)
            setPendingOrderData(null)
          }}
        />
      )}
    </div>
  )
}

export default ClientModal
