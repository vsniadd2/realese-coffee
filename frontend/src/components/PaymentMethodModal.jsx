import React, { useEffect, useState } from 'react'
import './PaymentMethodModal.css'

const PaymentMethodModal = ({ onSelect, onClose, totalAmount = 0 }) => {
  const [showMixedForm, setShowMixedForm] = useState(false)
  const [cashPart, setCashPart] = useState('')
  const [mixedError, setMixedError] = useState('')

  const total = parseFloat(totalAmount) || 0

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        if (showMixedForm) setShowMixedForm(false)
        else onClose()
      }
    }
    document.addEventListener('keydown', handleEscape)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [onClose, showMixedForm])

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      if (showMixedForm) setShowMixedForm(false)
      else onClose()
    }
  }

  const handleSelect = (method, options) => {
    onSelect(method, options)
  }

  const handleMixedClick = () => {
    setShowMixedForm(true)
    setCashPart('')
    setMixedError('')
  }

  const handleMixedConfirm = () => {
    const cash = parseFloat(cashPart)
    if (isNaN(cash) || cash < 0) {
      setMixedError('Введите корректную сумму наличными')
      return
    }
    if (cash > total) {
      setMixedError('Сумма наличными не может превышать итог')
      return
    }
    const card = Math.round((total - cash) * 100) / 100
    onSelect('mixed', { cashPart: cash, cardPart: card })
  }

  const cashNum = parseFloat(cashPart) || 0
  const cardPartDisplay = Math.round((total - cashNum) * 100) / 100

  return (
    <div className="modal" onClick={handleOverlayClick}>
      <div className="modal-overlay"></div>
      <div className="modal-content payment-method-modal">
        <div className="modal-header">
          <h2>Выберите способ оплаты</h2>
          <button className="close-modal" onClick={onClose}>
            &times;
          </button>
        </div>

        {!showMixedForm ? (
          <div className="payment-method-options">
            <button
              className="payment-method-btn payment-method-cash"
              onClick={() => handleSelect('cash')}
            >
              <div className="payment-method-icon">
                <img src="/img/money-svgrepo-com.svg" alt="Наличные" />
              </div>
              <div className="payment-method-label">Наличные</div>
            </button>
            <button
              className="payment-method-btn payment-method-card"
              onClick={() => handleSelect('card')}
            >
              <div className="payment-method-icon">
                <img src="/img/card-svgrepo-com.svg" alt="Карта" />
              </div>
              <div className="payment-method-label">Карта</div>
            </button>
            <button
              className="payment-method-btn payment-method-mixed"
              onClick={handleMixedClick}
            >
              <div className="payment-method-icon payment-method-icon-mixed">
                <img src="/img/money-svgrepo-com.svg" alt="Нал" className="mixed-icon-small" />
                <span className="mixed-plus">+</span>
                <img src="/img/card-svgrepo-com.svg" alt="Карта" className="mixed-icon-small" />
              </div>
              <div className="payment-method-label">Смешанная</div>
            </button>
          </div>
        ) : (
          <div className="payment-method-mixed-form">
            <p className="payment-method-mixed-hint">Введите сумму наличными. Остаток — картой.</p>
            <div className="payment-method-mixed-row">
              <label>Наличными (BYN)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max={total}
                value={cashPart}
                onChange={(e) => { setCashPart(e.target.value); setMixedError('') }}
                placeholder="0.00"
                autoFocus
              />
            </div>
            <div className="payment-method-mixed-rest">
              Остаток картой: <strong>{cardPartDisplay.toFixed(2)} BYN</strong>
            </div>
            {mixedError && <div className="payment-method-mixed-error">{mixedError}</div>}
            <div className="payment-method-mixed-actions">
              <button type="button" className="payment-method-btn-back" onClick={() => setShowMixedForm(false)}>
                Назад
              </button>
              <button type="button" className="payment-method-btn-confirm" onClick={handleMixedConfirm}>
                Подтвердить
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default PaymentMethodModal
