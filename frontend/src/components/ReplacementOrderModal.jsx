import React, { useEffect, useMemo, useState } from 'react'
import { useNotification } from './NotificationProvider'
import { useDataRefresh } from '../contexts/DataRefreshContext'
import ProductSelector from './ProductSelector'
import { purchaseHistoryService } from '../services/purchaseHistoryService'
import { normalizeMiddleNameForDisplay } from '../utils/clientDisplay'
import './PurchaseModal.css'
import './ReplacementOrderModal.css'

const ReplacementOrderModal = ({ order, onClose, onSuccess }) => {
  const [price, setPrice] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedProducts, setSelectedProducts] = useState({})
  const [productsTotal, setProductsTotal] = useState(0)
  const { showNotification } = useNotification()
  const { refreshAll } = useDataRefresh()

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [onClose])

  const fullName = useMemo(() => {
    return [order?.first_name, order?.last_name, normalizeMiddleNameForDisplay(order?.middle_name)].filter(Boolean).join(' ')
  }, [order])

  const discountInfo = useMemo(() => {
    const p = productsTotal > 0 ? productsTotal : Number.parseFloat(price)
    if (!Number.isFinite(p) || p <= 0) return null
    const status = order?.client_status || 'standart'
    const hasDiscount = status === 'gold'
    if (hasDiscount) {
      const finalPrice = p * 0.9
      const savedAmount = p - finalPrice
      return {
        originalPrice: p,
        finalPrice: finalPrice,
        discount: 10,
        savedAmount: savedAmount
      }
    }
    return null
  }, [price, productsTotal, order?.client_status])

  const handleProductsChange = (cart, total) => {
    setSelectedProducts(cart)
    setProductsTotal(total)
    if (total > 0) setPrice(total.toFixed(2))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const p = productsTotal > 0 ? productsTotal : Number.parseFloat(price)
    if (!Number.isFinite(p) || p <= 0) {
      showNotification('Введите корректную сумму или выберите товары', 'error')
      return
    }

    setLoading(true)
    const items = Object.values(selectedProducts).map(item => ({
      productId: item.product.id,
      productName: item.product.name,
      productPrice: item.product.price,
      quantity: item.quantity
    }))

    try {
      const result = await purchaseHistoryService.createReplacement(order.id, p, items)
      if (result.success) {
        showNotification('Замена оформлена. Заказ обновлён.', 'success')
        setTimeout(() => refreshAll(), 100)
        onSuccess?.(result)
        onClose()
      }
    } catch (err) {
      showNotification(err.message || 'Ошибка оформления замены', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose()
  }

  if (!order) return null

  const isAnonymous = order.client_id == null

  return (
    <div className="modal" onClick={handleOverlayClick}>
      <div className="modal-overlay" />
      <div className="modal-content modal-content-large replacement-modal">
        <div className="modal-header">
          <div>
            <h2>Оформление замены</h2>
            <div className="purchase-subtitle">
              {isAnonymous ? (
                <>Анонимный заказ</>
              ) : (
                <>
                  Клиент: <span className="mono">{fullName || '—'}</span> • ID:{' '}
                  <span className="mono">{order.client_external_id || '—'}</span>
                </>
              )}
            </div>
          </div>
          <button type="button" className="close-modal" onClick={onClose}>&times;</button>
        </div>

        <div className="replacement-summary">
          <div className="replacement-summary-left">
            <div className="replacement-summary-label">Заменяемый заказ</div>
            <div className="replacement-summary-text">
              №{order.id} • Итого:{' '}
              <span className="replacement-summary-total mono">{parseFloat(order.final_amount || 0).toFixed(2)} BYN</span>
            </div>
          </div>
          {!isAnonymous && (
            <div className="replacement-summary-status">
              <span className={`status-chip ${order.client_status || 'standart'}`}>
                {(order.client_status || 'standart').toUpperCase()}
              </span>
            </div>
          )}
        </div>

        <div className="modal-two-columns">
          <div className="modal-left-column">
            <h3>Новые товары</h3>
            <ProductSelector
              onProductsChange={handleProductsChange}
              initialTotal={productsTotal}
            />
          </div>

          <div className="modal-right-column">
            <form onSubmit={handleSubmit}>
              <div className="form-row one-col">
                <div className="input-group">
                  <label>Сумма нового заказа</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    disabled={loading}
                    autoFocus
                  />
                </div>
              </div>

              {discountInfo && (
                <div className="discount-preview">
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
                    <div className="price-saved">
                      Экономия: {discountInfo.savedAmount.toFixed(2)} BYN
                    </div>
                  </div>
                </div>
              )}

              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={onClose} disabled={loading}>
                  Отмена
                </button>
                <button type="submit" className="btn-submit" disabled={loading}>
                  {loading ? 'Сохранение...' : 'Оформить замену'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ReplacementOrderModal
