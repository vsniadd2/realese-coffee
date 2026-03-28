import React, { useEffect, useState, useRef } from 'react'
import { normalizeMiddleNameForDisplay } from '../utils/clientDisplay'
import './OrderDetailsModal.css'

const OrderDetailsModal = ({ order, onClose, onMarkOperation, onStartReplacement, onDeleteOrder }) => {
  const [showReplacementMenu, setShowReplacementMenu] = useState(false)
  const [updating, setUpdating] = useState(false)
  const replacementWrapRef = useRef(null)

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        if (showReplacementMenu) setShowReplacementMenu(false)
        else onClose()
      }
    }
    document.addEventListener('keydown', handleEscape)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [onClose, showReplacementMenu])

  useEffect(() => {
    if (!showReplacementMenu) return
    const handleClickOutside = (e) => {
      if (replacementWrapRef.current && !replacementWrapRef.current.contains(e.target)) {
        setShowReplacementMenu(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [showReplacementMenu])

  if (!order) return null

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return '—'
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('ru-RU', {
      timeZone: 'Europe/Moscow',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(date)
  }

  const isAnonymous = order.client_id == null
  const clientName = isAnonymous
    ? 'Аноним'
    : [order.first_name, order.last_name, normalizeMiddleNameForDisplay(order.middle_name)].filter(Boolean).join(' ') || '—'

  const operationType = (order.operation_type || 'sale').toLowerCase()
  const isReturn = operationType === 'return'
  const isReplacement = operationType === 'replacement'
  const hasReturnFlow = isReturn || isReplacement

  const operationTypeLabel = {
    sale: 'Продажа',
    return: 'Возврат',
    replacement: 'Замена'
  }[operationType] || 'Продажа'

  const handleMarkOperation = async (type) => {
    if (!onMarkOperation || updating) return
    setShowReplacementMenu(false)
    setUpdating(true)
    try {
      await onMarkOperation(type)
    } catch (err) {
      console.error(err)
    } finally {
      setUpdating(false)
    }
  }

  // Вспомогательный блок: карточка заказа (дата, товары, итого)
  const OrderCard = ({ title, transaction, showDate = true }) => {
    if (!transaction) return null
    const items = transaction.items || []
    const total = parseFloat(transaction.final_amount || 0).toFixed(2)
    return (
      <div className="order-details-card">
        <div className="order-details-card-title">{title}</div>
        {showDate && transaction.created_at && (
          <div className="order-details-card-meta">
            Дата: {formatDate(transaction.created_at)}
          </div>
        )}
        <div className="order-details-card-table-wrap">
          {items.length > 0 ? (
            <table className="order-details-card-table">
              <thead>
                <tr>
                  <th>Товар</th>
                  <th>Цена</th>
                  <th>Кол-во</th>
                  <th>Сумма</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i}>
                    <td>{item.product_name}</td>
                    <td className="mono">{parseFloat(item.product_price || 0).toFixed(2)} BYN</td>
                    <td>{item.quantity}</td>
                    <td className="mono">
                      {(parseFloat(item.product_price || 0) * parseInt(item.quantity || 1, 10)).toFixed(2)} BYN
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="order-details-card-sum-only">
              Сумма заказа: <span className="mono">{total} BYN</span>
            </div>
          )}
        </div>
        <div className="order-details-card-total">
          Итого: <span className="mono">{total} BYN</span>
        </div>
        {transaction.payment_method && (
          <div className="order-details-card-payment">
            Оплата: {transaction.payment_method === 'mixed'
              ? `${parseFloat(transaction.cash_part || 0).toFixed(2)} наличными + ${parseFloat(transaction.card_part || 0).toFixed(2)} картой`
              : transaction.payment_method === 'card'
                ? 'Карта'
                : 'Наличные'}
          </div>
        )}
      </div>
    )
  }

  // Блок "Что на что поменяли": две колонки — возвращено / выдано
  const SwapComparison = ({ returnItems = [], replacementItems = [] }) => {
    const maxRows = Math.max(returnItems.length, replacementItems.length, 1)
    const rows = []
    for (let i = 0; i < maxRows; i++) {
      const ret = returnItems[i]
      const rep = replacementItems[i]
      rows.push({
        return: ret
          ? `${ret.product_name} × ${ret.quantity} — ${(parseFloat(ret.product_price || 0) * parseInt(ret.quantity || 1, 10)).toFixed(2)} BYN`
          : '—',
        replacement: rep
          ? `${rep.product_name} × ${rep.quantity} — ${(parseFloat(rep.product_price || 0) * parseInt(rep.quantity || 1, 10)).toFixed(2)} BYN`
          : '—'
      })
    }
    return (
      <div className="order-details-swap-comparison">
        <h4 className="order-details-swap-title">Что на что поменяли</h4>
        <table className="order-details-swap-table">
          <thead>
            <tr>
              <th>Возвращено (снято с заказа)</th>
              <th>Выдано вместо (новый заказ)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <td>{row.return}</td>
                <td>{row.replacement}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="order-details-modal-overlay" onClick={handleOverlayClick}>
      <div className="order-details-modal">
        <div className="order-details-modal-header">
          <h2>Детали заказа №{order.id}</h2>
          <div className="order-details-modal-header-actions">
            {(onStartReplacement || onMarkOperation) && (
              <div className="order-details-return-wrap" ref={replacementWrapRef}>
                <button
                  type="button"
                  className="order-details-return-btn"
                  onClick={() => setShowReplacementMenu((v) => !v)}
                  title="Замена"
                  disabled={updating}
                >
                  <img src="/img/return.svg" alt="" className="order-details-return-icon" />
                  <span>Замена</span>
                </button>
                {showReplacementMenu && (
                  <div className="order-details-return-menu">
                    {onStartReplacement && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowReplacementMenu(false)
                          onStartReplacement(order)
                        }}
                      >
                        Оформить замену
                      </button>
                    )}
                    {(isReturn || isReplacement) && onMarkOperation && (
                      <button type="button" onClick={() => handleMarkOperation('sale')}>
                        Снять пометку (обычная продажа)
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
            {onDeleteOrder && (
              <button
                type="button"
                className="order-details-delete-btn"
                onClick={() => onDeleteOrder(order)}
                title="Удалить заказ"
                disabled={updating}
              >
                <img src="/img/delete-2-svgrepo-com.svg" alt="" className="order-details-delete-icon" />
                <span>Удалить заказ</span>
              </button>
            )}
            <button className="order-details-modal-close" onClick={onClose}>&times;</button>
          </div>
        </div>
        <div className="order-details-modal-body">
          <div className="order-details-operation-row">
            <span className="order-details-label-inline">Тип операции:</span>
            <span className={`order-details-operation-badge order-details-operation-badge--${operationType}`}>
              {operationTypeLabel}
            </span>
          </div>

          <div className="order-details-section">
            <h3>Информация о клиенте</h3>
            <div className="order-details-grid">
              <div className="order-details-item">
                <span className="order-details-label">ФИО:</span>
                <span className="order-details-value">{clientName}</span>
              </div>
              {!isAnonymous && (
                <>
                  <div className="order-details-item">
                    <span className="order-details-label">ID клиента:</span>
                    <span className="order-details-value mono">{order.client_external_id || '—'}</span>
                  </div>
                  <div className="order-details-item">
                    <span className="order-details-label">Статус клиента:</span>
                    <span className={`status-chip ${order.client_status || 'standart'}`}>
                      {(order.client_status || 'standart').toUpperCase()}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="order-details-section">
            <h3>Информация о заказе</h3>
            <div className="order-details-grid">
              <div className="order-details-item">
                <span className="order-details-label">Номер заказа:</span>
                <span className="order-details-value mono">№{order.id}</span>
              </div>
              <div className="order-details-item">
                <span className="order-details-label">Дата и время:</span>
                <span className="order-details-value">{formatDate(order.created_at)}</span>
              </div>
              <div className="order-details-item">
                <span className="order-details-label">Сумма (до скидки):</span>
                <span className="order-details-value mono">{parseFloat(order.amount || 0).toFixed(2)} BYN</span>
              </div>
              {order.discount > 0 && (
                <div className="order-details-item">
                  <span className="order-details-label">Скидка:</span>
                  <span className="order-details-value">{order.discount}%</span>
                </div>
              )}
              {order.employee_discount > 0 && (
                <div className="order-details-item order-details-item--employee">
                  <span className="order-details-label">Скидка сотруднику:</span>
                  <span className="order-details-value order-details-employee-badge">
                    Применена скидка сотруднику: −{parseFloat(order.employee_discount).toFixed(2)} BYN
                  </span>
                </div>
              )}
              <div className="order-details-item order-details-item--total">
                <span className="order-details-label">Итого к оплате:</span>
                <span className="order-details-value mono order-details-total">
                  {parseFloat(order.final_amount || 0).toFixed(2)} BYN
                </span>
              </div>
              <div className="order-details-item">
                <span className="order-details-label">Оплата:</span>
                <span className="order-details-value">
                  {order.payment_method === 'mixed'
                    ? `Смешанная: ${parseFloat(order.cash_part || 0).toFixed(2)} BYN наличными + ${parseFloat(order.card_part || 0).toFixed(2)} BYN картой`
                    : order.payment_method === 'card'
                      ? 'Карта'
                      : order.payment_method === 'cash'
                        ? 'Наличные'
                        : '—'}
                </span>
              </div>
            </div>
          </div>

          <div className="order-details-section">
            <h3>Товары в заказе</h3>
            <div className="order-details-products">
              {order.items && order.items.length > 0 ? (
                <table className="order-items-table">
                  <thead>
                    <tr>
                      <th>Товар</th>
                      <th>Цена</th>
                      <th>Количество</th>
                      <th>Сумма</th>
                    </tr>
                  </thead>
                  <tbody>
                    {order.items.map((item, index) => (
                      <tr key={index}>
                        <td className="order-item-name" data-label="Товар">{item.product_name}</td>
                        <td className="order-item-price mono" data-label="Цена">{parseFloat(item.product_price || 0).toFixed(2)} BYN</td>
                        <td className="order-item-quantity" data-label="Количество">{item.quantity}</td>
                        <td className="order-item-total mono" data-label="Сумма">
                          {(parseFloat(item.product_price || 0) * parseInt(item.quantity || 1, 10)).toFixed(2)} BYN
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan="3" className="order-items-total-label">
                        <strong>Итого по товарам:</strong>
                      </td>
                      <td className="order-items-total-value mono">
                        <strong>
                          {order.items.reduce((sum, item) => {
                            return sum + (parseFloat(item.product_price || 0) * parseInt(item.quantity || 1, 10))
                          }, 0).toFixed(2)} BYN
                        </strong>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              ) : (
                <div className="order-details-no-products">
                  Детализация по товарам отсутствует. Заказ был создан только с указанием суммы.
                </div>
              )}
            </div>
          </div>

          {isReturn && order.replacement_transaction && (
            <div className="order-details-section order-details-return-section">
              <h3>Возврат и замена</h3>
              <p className="order-details-return-desc">
                Этот заказ помечен как <strong>возврат</strong>. Ниже указано, что было возвращено (этот заказ №{order.id}) и на какой новый заказ №{order.replacement_transaction.id} его заменили.
              </p>
              <div className="order-details-cards">
                <OrderCard
                  title={`Возвращённый заказ (этот) №${order.id}`}
                  transaction={order}
                />
                <div className="order-details-arrow" aria-hidden="true">
                  ↓ Заменён на
                </div>
                <OrderCard
                  title={`Новый заказ №${order.replacement_transaction.id}`}
                  transaction={order.replacement_transaction}
                />
              </div>
              {order.items?.length > 0 && order.replacement_transaction.items?.length > 0 && (
                <SwapComparison
                  returnItems={order.items}
                  replacementItems={order.replacement_transaction.items}
                />
              )}
            </div>
          )}

          {isReplacement && order.return_transaction && (
            <div className="order-details-section order-details-return-section">
              <h3>Замена заказа</h3>
              <p className="order-details-return-desc">
                Этот заказ оформлен как <strong>замена</strong>. Ниже указано, какой заказ №{order.return_transaction.id} был возвращён и что выдано клиенту вместо него (этот заказ №{order.id}).
              </p>
              <div className="order-details-cards">
                <OrderCard
                  title={`Возвращённый заказ №${order.return_transaction.id}`}
                  transaction={order.return_transaction}
                />
                <div className="order-details-arrow" aria-hidden="true">
                  ↓ Выдан заказ
                </div>
                <OrderCard
                  title={`Выданный заказ (этот) №${order.id}`}
                  transaction={order}
                />
              </div>
              {order.return_transaction.items?.length > 0 && order.items?.length > 0 && (
                <SwapComparison
                  returnItems={order.return_transaction.items}
                  replacementItems={order.items}
                />
              )}
            </div>
          )}
        </div>
        <div className="order-details-modal-footer">
          <button className="order-details-modal-btn-close" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  )
}

export default OrderDetailsModal
