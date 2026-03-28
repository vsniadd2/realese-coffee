import React, { useEffect, useMemo, useState } from 'react'
import { useClients } from '../hooks/useClients'
import { useNotification } from './NotificationProvider'
import { useDataRefresh } from '../contexts/DataRefreshContext'
import { useAuth } from '../contexts/AuthContext'
import ProductSelector from './ProductSelector'
import PaymentMethodModal from './PaymentMethodModal'
import { clientService } from '../services/clientService'
import { normalizeMiddleNameForDisplay, normalizeClientIdForDisplay } from '../utils/clientDisplay'
import { buildPurchaseDiscountInfo } from '../utils/clientDiscount'
import './PurchaseModal.css'

const PurchaseModal = ({ client, onClose }) => {
  const [tab, setTab] = useState('purchase')
  const [localClient, setLocalClient] = useState(client)
  const [price, setPrice] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedProducts, setSelectedProducts] = useState({})
  const [productsTotal, setProductsTotal] = useState(0)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [pendingPurchaseData, setPendingPurchaseData] = useState(null)
  const [creditAmount, setCreditAmount] = useState('')
  const [creditLoading, setCreditLoading] = useState(false)
  const [employeeDiscount, setEmployeeDiscount] = useState(false)

  const { addPurchase } = useClients()
  const { showNotification } = useNotification()
  const { refreshAll } = useDataRefresh()
  const { refreshAccessToken } = useAuth()

  useEffect(() => {
    setLocalClient(client)
  }, [client])

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  const fullName = useMemo(() => {
    return [localClient?.first_name, localClient?.last_name, normalizeMiddleNameForDisplay(localClient?.middle_name)].filter(Boolean).join(' ')
  }, [localClient])

  const discountInfo = useMemo(() => {
    const p = productsTotal > 0 ? productsTotal : Number.parseFloat(price)
    if (!Number.isFinite(p) || p <= 0 || !localClient) return null
    return buildPurchaseDiscountInfo(localClient, p)
  }, [price, productsTotal, localClient])

  const employeeDiscountAmount = employeeDiscount ? 1 : 0

  const baseOrderAmount = useMemo(() => {
    const p = productsTotal > 0 ? productsTotal : Number.parseFloat(price)
    return Number.isFinite(p) && p > 0 ? p : null
  }, [price, productsTotal])

  const baseFinalBeforeEmployee = useMemo(() => {
    if (baseOrderAmount == null) return null
    return discountInfo ? discountInfo.finalPrice : baseOrderAmount
  }, [baseOrderAmount, discountInfo])

  const displayFinalForPay =
    baseFinalBeforeEmployee != null ? Math.max(0, baseFinalBeforeEmployee - employeeDiscountAmount) : null

  const handleProductsChange = (cart, total) => {
    setSelectedProducts(cart)
    setProductsTotal(total)
    if (total > 0) {
      setPrice(total.toFixed(2))
    }
  }

  const createPurchaseWithPayment = async (paymentMethod, options) => {
    setLoading(true)
    setShowPaymentModal(false)

    try {
      const purchaseData = pendingPurchaseData
      if (!purchaseData) {
        setLoading(false)
        return
      }

      const mixedParts = paymentMethod === 'mixed' && options ? { cashPart: options.cashPart, cardPart: options.cardPart } : null
      const emp = purchaseData.employeeDiscount || 0
      const result = await addPurchase(localClient.id, purchaseData.price, purchaseData.items, paymentMethod, emp, mixedParts)
      if (result.success) {
        showNotification('Покупка успешно добавлена!', 'success')
        setTimeout(() => refreshAll(), 100)
        onClose()
        setPrice('')
        setSelectedProducts({})
        setProductsTotal(0)
        setEmployeeDiscount(false)
        setPendingPurchaseData(null)
      } else {
        showNotification(result.error, 'error')
      }
    } catch (error) {
      showNotification(error.message || 'Ошибка при обработке запроса', 'error')
    }

    setLoading(false)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const p = productsTotal > 0 ? productsTotal : Number.parseFloat(price)
    if (!Number.isFinite(p) || p <= 0) {
      showNotification('Введите корректную цену или выберите товары', 'error')
      return
    }

    const baseFinal = discountInfo ? discountInfo.finalPrice : p
    const finalAmount = Math.max(0, baseFinal - employeeDiscountAmount)

    const items = Object.values(selectedProducts).map(item => ({
      productId: item.product.id,
      productName: item.product.name,
      productPrice: item.product.price,
      quantity: item.quantity
    }))
    setPendingPurchaseData({ price: p, items, finalAmount, employeeDiscount: employeeDiscountAmount })
    setShowPaymentModal(true)
  }

  const handleCreditSubmit = async (e) => {
    e.preventDefault()
    const amt = Number.parseFloat(String(creditAmount).replace(',', '.'))
    if (!Number.isFinite(amt) || amt <= 0) {
      showNotification('Введите сумму больше 0', 'error')
      return
    }

    setCreditLoading(true)
    try {
      const data = await clientService.creditAccount(localClient.id, amt)
      if (data.client) {
        setLocalClient(prev => ({ ...prev, ...data.client }))
      }
      setCreditAmount('')
      showNotification(`Зачислено ${amt.toFixed(2)} BYN к накопительной сумме покупок клиента`, 'success')
      refreshAll()
    } catch (err) {
      if (err?.message === 'UNAUTHORIZED') {
        const refreshed = await refreshAccessToken()
        if (refreshed) {
          try {
            const data = await clientService.creditAccount(localClient.id, amt)
            if (data.client) {
              setLocalClient(prev => ({ ...prev, ...data.client }))
            }
            setCreditAmount('')
            showNotification(`Зачислено ${amt.toFixed(2)} BYN к накопительной сумме покупок клиента`, 'success')
            refreshAll()
          } catch (retryErr) {
            showNotification(retryErr.message || 'Ошибка зачисления', 'error')
          }
        } else {
          showNotification('Сессия истекла. Войдите снова.', 'error')
        }
      } else {
        showNotification(err.message || 'Ошибка зачисления', 'error')
      }
    } finally {
      setCreditLoading(false)
    }
  }

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) onClose()
  }

  if (!client) return null

  return (
    <div className="modal" onClick={handleOverlayClick}>
      <div className="modal-overlay"></div>
      <div className="modal-content modal-content-large">
        <div className="modal-header">
          <div>
            <h2>{tab === 'purchase' ? 'Новая покупка' : 'Зачисление на счёт'}</h2>
            <div className="purchase-subtitle purchase-subtitle-line">
              <span>
                Клиент: <span className="mono">{fullName || '—'}</span>
              </span>
              <span className="purchase-subtitle-dot" aria-hidden="true">
                •
              </span>
              <span>
                ID: <span className="mono">{normalizeClientIdForDisplay(localClient.client_id)}</span>
              </span>
            </div>
          </div>
          <button type="button" className="close-modal" onClick={onClose}>
            &times;
          </button>
        </div>

        <div className="purchase-modal-tabs" role="tablist" aria-label="Режим">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'purchase'}
            className={`purchase-modal-tab ${tab === 'purchase' ? 'active' : ''}`}
            onClick={() => setTab('purchase')}
          >
            Покупка
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'credit'}
            className={`purchase-modal-tab ${tab === 'credit' ? 'active' : ''}`}
            onClick={() => setTab('credit')}
          >
            Зачисление на счёт
          </button>
        </div>

        {tab === 'purchase' && (
          <div className="modal-two-columns">
            <div className="modal-left-column">
              <h3 className="purchase-column-title">Выбор товаров</h3>
              <ProductSelector onProductsChange={handleProductsChange} initialTotal={productsTotal} />
            </div>

            <div className="modal-right-column">
              <form onSubmit={handleSubmit}>
                <div className="form-row one-col">
                  <div className="input-group">
                    <label>Цена</label>
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
                      <div className="price-original">{discountInfo.originalPrice.toFixed(2)} BYN</div>
                      <div className="price-final">
                        {displayFinalForPay != null ? displayFinalForPay.toFixed(2) : discountInfo.finalPrice.toFixed(2)} BYN
                        {employeeDiscountAmount > 0 && (
                          <span className="employee-discount-badge"> (−1 BYN)</span>
                        )}
                      </div>
                      <div className="price-saved">Экономия: {discountInfo.savedAmount.toFixed(2)} BYN</div>
                    </div>
                  </div>
                )}

                {!discountInfo && baseOrderAmount != null && (
                  <div className="discount-preview">
                    <div className="price-preview">
                      <div className="price-final">
                        {displayFinalForPay != null ? displayFinalForPay.toFixed(2) : baseOrderAmount.toFixed(2)} BYN
                        {employeeDiscountAmount > 0 && (
                          <span className="employee-discount-badge"> (−1 BYN)</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <label className="employee-checkbox-wrap">
                  <input
                    type="checkbox"
                    checked={employeeDiscount}
                    onChange={(e) => setEmployeeDiscount(e.target.checked)}
                    disabled={loading}
                  />
                  <span>Сотрудник</span>
                  {employeeDiscount && <span className="employee-checkbox-hint">(−1 BYN к заказу)</span>}
                </label>

                <div className="modal-actions">
                  <button type="button" className="btn-cancel" onClick={onClose} disabled={loading}>
                    Отмена
                  </button>
                  <button type="submit" className="btn-submit" disabled={loading}>
                    {loading ? 'Сохранение...' : 'Добавить покупку'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {tab === 'credit' && (
          <div className="purchase-credit-panel">
            <p className="purchase-credit-desc">
              Укажите сумму в BYN. Она будет добавлена к накопительной сумме покупок клиента; при сумме от 500 BYN возможен статус GOLD.
            </p>
            <form onSubmit={handleCreditSubmit}>
              <div className="form-row one-col">
                <div className="input-group">
                  <label>Сумма зачисления (BYN)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={creditAmount}
                    onChange={(e) => setCreditAmount(e.target.value)}
                    disabled={creditLoading}
                    autoFocus
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={onClose} disabled={creditLoading}>
                  Отмена
                </button>
                <button type="submit" className="btn-submit" disabled={creditLoading}>
                  {creditLoading ? 'Зачисление...' : 'Подтвердить зачисление'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {showPaymentModal && pendingPurchaseData && (
        <PaymentMethodModal
          totalAmount={pendingPurchaseData.finalAmount ?? pendingPurchaseData.price}
          onSelect={createPurchaseWithPayment}
          onClose={() => {
            setShowPaymentModal(false)
            setPendingPurchaseData(null)
          }}
        />
      )}
    </div>
  )
}

export default PurchaseModal
