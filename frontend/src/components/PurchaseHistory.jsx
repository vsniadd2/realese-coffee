import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useDataRefresh } from '../contexts/DataRefreshContext'
import { purchaseHistoryService } from '../services/purchaseHistoryService'
import { deletionTicketsService } from '../services/deletionTicketsService'
import { pointsService } from '../services/pointsService'
import OrderDetailsModal from './OrderDetailsModal'
import ReplacementOrderModal from './ReplacementOrderModal'
import ConfirmDialog from './ConfirmDialog'
import { useNotification } from './NotificationProvider'
import { normalizeMiddleNameForDisplay } from '../utils/clientDisplay'
import './PurchaseHistory.css'

const PurchaseHistory = () => {
  const { refreshAccessToken, user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const { refreshKey, registerRefreshCallback } = useDataRefresh()
  const { showNotification } = useNotification()
  const [purchases, setPurchases] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [dateFrom, setDateFrom] = useState(() => {
    try {
      return localStorage.getItem('purchaseHistory_dateFrom') || ''
    } catch {
      return ''
    }
  })
  const [dateTo, setDateTo] = useState(() => {
    try {
      return localStorage.getItem('purchaseHistory_dateTo') || ''
    } catch {
      return ''
    }
  })
  const [searchName, setSearchName] = useState(() => {
    try {
      return localStorage.getItem('purchaseHistory_searchName') || ''
    } catch {
      return ''
    }
  })
  const [debouncedSearchName, setDebouncedSearchName] = useState(() => {
    try {
      return localStorage.getItem('purchaseHistory_searchName') || ''
    } catch {
      return ''
    }
  })
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedPurchase, setSelectedPurchase] = useState(null)
  const [replacementOrder, setReplacementOrder] = useState(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [confirmDeleteOrder, setConfirmDeleteOrder] = useState(null)
  const [activeTickets, setActiveTickets] = useState([])
  const [loadingTickets, setLoadingTickets] = useState(false)
  const [paymentStats, setPaymentStats] = useState(null)
  const [loadingStats, setLoadingStats] = useState(false)
  const [points, setPoints] = useState([])
  const [selectedPointId, setSelectedPointId] = useState('')
  const debounceTimerRef = useRef(null)
  const isInitialLoad = useRef(true)
  const tableScrollRef = useRef(null)
  const savedScrollPositionRef = useRef(0)
  const searchInputRef = useRef(null)
  const wasFocusedRef = useRef(false)
  const cursorPositionRef = useRef(null)
  const isUserTypingRef = useRef(false)

  // Сохраняем фильтры в localStorage
  useEffect(() => {
    try {
      if (dateFrom) {
        localStorage.setItem('purchaseHistory_dateFrom', dateFrom)
      } else {
        localStorage.removeItem('purchaseHistory_dateFrom')
      }
    } catch (e) {
      // Игнорируем ошибки localStorage
    }
  }, [dateFrom])

  useEffect(() => {
    try {
      if (dateTo) {
        localStorage.setItem('purchaseHistory_dateTo', dateTo)
      } else {
        localStorage.removeItem('purchaseHistory_dateTo')
      }
    } catch (e) {
      // Игнорируем ошибки localStorage
    }
  }, [dateTo])

  useEffect(() => {
    try {
      if (searchName) {
        localStorage.setItem('purchaseHistory_searchName', searchName)
      } else {
        localStorage.removeItem('purchaseHistory_searchName')
      }
    } catch (e) {
      // Игнорируем ошибки localStorage
    }
  }, [searchName])

  // Debounce для текстового поля поиска
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    // Сохраняем фокус и позицию курсора только если пользователь активно печатает
    if (searchInputRef.current && document.activeElement === searchInputRef.current) {
      wasFocusedRef.current = true
      cursorPositionRef.current = searchInputRef.current.selectionStart
      isUserTypingRef.current = true
    }

    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearchName(searchName)
      if (!isInitialLoad.current) {
        setPage(1)
      }
      isUserTypingRef.current = false
    }, 500)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [searchName])

  const loadPurchases = useCallback(async (silent = false) => {
    try {
      // Показываем loading только при первой загрузке и не в silent режиме
      if (!silent) {
        if (isInitialLoad.current) {
          setLoading(true)
        } else {
          setIsRefreshing(true)
        }
      }
      setError(null)
      try {
        const pointIdParam = isAdmin && selectedPointId !== '' ? selectedPointId : null
        const data = await purchaseHistoryService.getPurchases({
          page,
          limit: 20,
          dateFrom: dateFrom || null,
          dateTo: dateTo || null,
          searchName: debouncedSearchName || null,
          pointId: pointIdParam
        })
        
        // Обновляем состояние с использованием requestAnimationFrame для плавности
        requestAnimationFrame(() => {
          setPurchases(data.purchases || [])
          setTotalPages(data.pagination?.totalPages || 1)
        })
        
        isInitialLoad.current = false
      } catch (e) {
        if (e?.message === 'UNAUTHORIZED') {
          const refreshed = await refreshAccessToken()
          if (refreshed) {
            const pointIdParam = isAdmin && selectedPointId !== '' ? selectedPointId : null
            const data = await purchaseHistoryService.getPurchases({
              page,
              limit: 20,
              dateFrom: dateFrom || null,
              dateTo: dateTo || null,
              searchName: debouncedSearchName || null,
              pointId: pointIdParam
            })
            requestAnimationFrame(() => {
              setPurchases(data.purchases || [])
              setTotalPages(data.pagination?.totalPages || 1)
            })
            isInitialLoad.current = false
            return
          }
        }
        throw e
      }
    } catch (err) {
      setError(err?.message || 'Ошибка загрузки истории покупок')
      setPurchases([])
      isInitialLoad.current = false
    } finally {
      if (!silent) {
        setLoading(false)
        setIsRefreshing(false)
      }
      // Восстанавливаем позицию скролла и фокус после обновления
      requestAnimationFrame(() => {
        const tableWrap = document.querySelector('.purchases-table-wrap')
        if (tableWrap && savedScrollPositionRef.current > 0) {
          tableWrap.scrollTop = savedScrollPositionRef.current
        }
        // Восстанавливаем фокус на input только если пользователь активно печатал
        if (isUserTypingRef.current && wasFocusedRef.current && searchInputRef.current && searchName.length > 0) {
          const savedPosition = cursorPositionRef.current !== null 
            ? cursorPositionRef.current 
            : searchInputRef.current.value.length
          if (searchInputRef.current.value === searchName) {
            searchInputRef.current.focus()
            const position = Math.min(savedPosition, searchInputRef.current.value.length)
            searchInputRef.current.setSelectionRange(position, position)
          }
        }
        wasFocusedRef.current = false
        isUserTypingRef.current = false
      })
    }
    }, [page, dateFrom, dateTo, debouncedSearchName, refreshAccessToken, searchName, isAdmin, selectedPointId])

  useEffect(() => {
    loadPurchases()
  }, [loadPurchases])

  // Сохраняем позицию скролла перед обновлением
  useEffect(() => {
    const tableWrap = document.querySelector('.purchases-table-wrap')
    if (tableWrap) {
      tableScrollRef.current = tableWrap
      savedScrollPositionRef.current = tableWrap.scrollTop
    }
  }, [purchases])

  // Регистрируем callback для обновления при изменениях данных
  useEffect(() => {
    const unregister = registerRefreshCallback((silent) => {
      // Не обновляем если пользователь активно печатает
      if (isUserTypingRef.current) return
      
      // Сохраняем позицию скролла перед обновлением
      const tableWrap = document.querySelector('.purchases-table-wrap')
      if (tableWrap) {
        savedScrollPositionRef.current = tableWrap.scrollTop
      }
      // Обновляем данные (silent режим передается из контекста)
      if (!isInitialLoad.current) {
        loadPurchases(silent !== false)
      }
    })
    return unregister
  }, [registerRefreshCallback, loadPurchases])

  // Обновляем данные при изменении refreshKey
  useEffect(() => {
    if (refreshKey > 0 && !isInitialLoad.current) {
      // Сохраняем позицию скролла перед обновлением
      const tableWrap = document.querySelector('.purchases-table-wrap')
      if (tableWrap) {
        savedScrollPositionRef.current = tableWrap.scrollTop
      }
      // Обновляем данные без показа полного loading (используем isRefreshing)
      loadPurchases()
    }
  }, [refreshKey, loadPurchases])

  // Загрузка активных тикетов
  const loadActiveTickets = useCallback(async () => {
    try {
      setLoadingTickets(true)
      try {
        const data = await deletionTicketsService.getActiveTickets()
        setActiveTickets(data.tickets || [])
      } catch (e) {
        if (e?.message === 'UNAUTHORIZED') {
          const refreshed = await refreshAccessToken()
          if (refreshed) {
            const data = await deletionTicketsService.getActiveTickets()
            setActiveTickets(data.tickets || [])
            return
          }
        }
        throw e
      }
    } catch (err) {
      console.error('Ошибка загрузки тикетов:', err)
      setActiveTickets([])
    } finally {
      setLoadingTickets(false)
    }
  }, [refreshAccessToken])

  useEffect(() => {
    loadActiveTickets()
    // Обновляем тикеты каждые 30 секунд
    const interval = setInterval(loadActiveTickets, 30000)
    return () => clearInterval(interval)
  }, [loadActiveTickets])

  // Загрузка статистики по способам оплаты
  const loadPaymentStats = useCallback(async () => {
    try {
      setLoadingStats(true)
      try {
        const pointIdParam = isAdmin && selectedPointId !== '' ? selectedPointId : null
        const stats = await purchaseHistoryService.getPaymentStats(
          dateFrom || null,
          dateTo || null,
          pointIdParam
        )
        setPaymentStats(stats)
      } catch (e) {
        if (e?.message === 'UNAUTHORIZED') {
          const refreshed = await refreshAccessToken()
          if (refreshed) {
            const pointIdParam = isAdmin && selectedPointId !== '' ? selectedPointId : null
            const stats = await purchaseHistoryService.getPaymentStats(
              dateFrom || null,
              dateTo || null,
              pointIdParam
            )
            setPaymentStats(stats)
            return
          }
        }
        throw e
      }
    } catch (err) {
      console.error('Ошибка загрузки статистики по способам оплаты:', err)
      setPaymentStats(null)
    } finally {
      setLoadingStats(false)
    }
  }, [dateFrom, dateTo, refreshAccessToken, isAdmin, selectedPointId])

  useEffect(() => {
    loadPaymentStats()
  }, [loadPaymentStats])

  const loadPoints = useCallback(async () => {
    if (!isAdmin) return
    try {
      const list = await pointsService.getPoints()
      setPoints(Array.isArray(list) ? list : [])
    } catch (e) {
      if (e?.message === 'UNAUTHORIZED') {
        await refreshAccessToken()
        const list = await pointsService.getPoints()
        setPoints(Array.isArray(list) ? list : [])
      }
    }
  }, [isAdmin, refreshAccessToken])

  useEffect(() => {
    if (isAdmin) loadPoints()
  }, [isAdmin, loadPoints])

  const handleClearFilters = () => {
    setDateFrom('')
    setDateTo('')
    setSearchName('')
    setDebouncedSearchName('')
    setPage(1)
    try {
      localStorage.removeItem('purchaseHistory_dateFrom')
      localStorage.removeItem('purchaseHistory_dateTo')
      localStorage.removeItem('purchaseHistory_searchName')
    } catch (e) {
      // Игнорируем ошибки localStorage
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return '—'
    const date = new Date(dateString)
    // Используем МСК/Минское время (UTC+3)
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

  const formatCurrency = (amount) => {
    return `${parseFloat(amount).toFixed(2)} BYN`
  }

  const getClientName = (purchase) => {
    if (purchase.client_id == null) return 'Аноним'
    const parts = [
      purchase.first_name,
      purchase.last_name,
      normalizeMiddleNameForDisplay(purchase.middle_name)
    ].filter(Boolean)
    return parts.length > 0 ? parts.join(' ') : '—'
  }

  const handlePurchaseClick = async (purchase) => {
    setLoadingDetails(true)
    try {
      const details = await purchaseHistoryService.getPurchaseDetails(purchase.id)
      if (details) {
        setSelectedPurchase(details)
      }
    } catch (err) {
      if (err?.message === 'UNAUTHORIZED') {
        const refreshed = await refreshAccessToken()
        if (refreshed) {
          try {
            const details = await purchaseHistoryService.getPurchaseDetails(purchase.id)
            if (details) {
              setSelectedPurchase(details)
            }
          } catch (retryErr) {
            console.error('Ошибка загрузки деталей покупки:', retryErr)
          }
        }
      } else {
        console.error('Ошибка загрузки деталей покупки:', err)
      }
    } finally {
      setLoadingDetails(false)
    }
  }

  const handleClearHistory = async () => {
    try {
      setLoadingTickets(true)
      try {
        await deletionTicketsService.createTicket()
        showNotification('Тикет на удаление истории создан. Удаление произойдет через 24 часа.', 'success')
        await loadActiveTickets()
      } catch (e) {
        if (e?.message === 'UNAUTHORIZED') {
          const refreshed = await refreshAccessToken()
          if (refreshed) {
            await deletionTicketsService.createTicket()
            showNotification('Тикет на удаление истории создан. Удаление произойдет через 24 часа.', 'success')
            await loadActiveTickets()
            return
          }
        }
        throw e
      }
    } catch (err) {
      showNotification(err.message || 'Ошибка создания тикета на удаление', 'error')
    } finally {
      setLoadingTickets(false)
      setShowConfirmDialog(false)
    }
  }

  const handleCancelTicket = async (ticketId) => {
    try {
      setLoadingTickets(true)
      try {
        await deletionTicketsService.cancelTicket(ticketId)
        showNotification('Тикет на удаление отменен', 'success')
        await loadActiveTickets()
      } catch (e) {
        if (e?.message === 'UNAUTHORIZED') {
          const refreshed = await refreshAccessToken()
          if (refreshed) {
            await deletionTicketsService.cancelTicket(ticketId)
            showNotification('Тикет на удаление отменен', 'success')
            await loadActiveTickets()
            return
          }
        }
        throw e
      }
    } catch (err) {
      showNotification(err.message || 'Ошибка отмены тикета', 'error')
    } finally {
      setLoadingTickets(false)
    }
  }

  const formatTimeUntilDeletion = (scheduledAt) => {
    const now = new Date()
    const scheduled = new Date(scheduledAt)
    const diff = scheduled - now

    if (diff <= 0) {
      return 'Удаление скоро произойдет'
    }

    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

    if (hours > 0) {
      return `Через ${hours} ч ${minutes} мин`
    }
    return `Через ${minutes} мин`
  }

  return (
    <div className="purchase-history">
      <div className="purchase-history-header">
        <div className="purchase-history-title-row">
          <h2>История покупок</h2>
          {isAdmin && (
            <button
              onClick={() => setShowConfirmDialog(true)}
              className="clear-history-btn"
              disabled={loadingTickets || activeTickets.length > 0}
              title={activeTickets.length > 0 ? 'Уже есть активный тикет на удаление' : 'Очистить историю'}
            >
              Очистить историю
            </button>
          )}
        </div>
        {isAdmin && activeTickets.length > 0 && (
          <div className="active-tickets-container">
            {activeTickets.map((ticket) => (
              <div key={ticket.id} className="active-ticket">
                <div className="active-ticket-info">
                  <span className="active-ticket-label">Запланировано удаление истории:</span>
                  <span className="active-ticket-time">{formatTimeUntilDeletion(ticket.scheduled_deletion_at)}</span>
                </div>
                <button
                  onClick={() => handleCancelTicket(ticket.id)}
                  className="cancel-ticket-btn"
                  disabled={loadingTickets}
                >
                  Отменить
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="purchase-history-filters">
          {isAdmin && points.length > 0 && (
            <div className="filter-group">
              <label htmlFor="pointSelect">Точка:</label>
              <select
                id="pointSelect"
                className="text-input"
                value={selectedPointId}
                onChange={(e) => { setSelectedPointId(e.target.value); setPage(1) }}
              >
                <option value="">Все точки</option>
                {points.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="filter-group">
            <label htmlFor="searchName">Клиент / позиция:</label>
            <input
              ref={searchInputRef}
              id="searchName"
              type="text"
              value={searchName}
              onChange={(e) => {
                cursorPositionRef.current = e.target.selectionStart
                isUserTypingRef.current = true
                setSearchName(e.target.value)
              }}
              onFocus={(e) => {
                wasFocusedRef.current = true
                if (cursorPositionRef.current !== null) {
                  setTimeout(() => {
                    e.target.setSelectionRange(cursorPositionRef.current, cursorPositionRef.current)
                  }, 0)
                }
              }}
              onBlur={() => {
                wasFocusedRef.current = false
              }}
              placeholder="Имя, фамилия, Ано для анонимов или название позиции"
              className="text-input"
            />
          </div>
          <div className="filter-group">
            <label htmlFor="dateFrom">От:</label>
            <input
              id="dateFrom"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="date-input"
            />
          </div>
          <div className="filter-group">
            <label htmlFor="dateTo">До:</label>
            <input
              id="dateTo"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="date-input"
            />
          </div>
          {(dateFrom || dateTo || searchName) && (
            <button onClick={handleClearFilters} className="clear-btn">
              Сбросить
            </button>
          )}
        </div>
        {paymentStats && (
          <div className="payment-stats-container">
            <div className="payment-stat-card payment-stat-cash">
              <div className="payment-stat-label">Наличные</div>
              <div className="payment-stat-value">
                {paymentStats.cash.total.toFixed(2)} BYN
              </div>
              <div className="payment-stat-count">{paymentStats.cash.count} продаж</div>
            </div>
            <div className="payment-stat-card payment-stat-card-item">
              <div className="payment-stat-label">Карта</div>
              <div className="payment-stat-value">
                {paymentStats.card.total.toFixed(2)} BYN
              </div>
              <div className="payment-stat-count">{paymentStats.card.count} продаж</div>
            </div>
            <div className="payment-stat-card payment-stat-total">
              <div className="payment-stat-label">Всего</div>
              <div className="payment-stat-value">
                {paymentStats.total.total.toFixed(2)} BYN
              </div>
              <div className="payment-stat-count">{paymentStats.total.count} продаж</div>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="purchase-history-error">
          <div className="error-message">{error}</div>
        </div>
      )}

      {loading && purchases.length === 0 ? (
        <div className="purchase-history-loading">
          <div className="loading-spinner">Загрузка...</div>
        </div>
      ) : (
        <>
          {isRefreshing && purchases.length > 0 && (
            <div className="refreshing-indicator">
              <div className="loading-spinner">Обновление...</div>
            </div>
          )}
          {purchases.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📦</div>
              <h3>Нет покупок</h3>
              <p>История покупок пуста</p>
            </div>
          ) : (
            <>
              <div className="purchases-table-wrap">
                <table className="purchases-table">
                  <colgroup>
                    <col className="col-date" />
                    <col className="col-client" />
                    <col className="col-id" />
                    <col className="col-amount" />
                    <col className="col-discount" />
                    <col className="col-total" />
                    <col className="col-payment" />
                    <col className="col-status" />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Дата</th>
                      <th>Клиент</th>
                      <th>ID клиента</th>
                      <th>Сумма</th>
                      <th>Скидка</th>
                      <th>Итого</th>
                      <th>Оплата</th>
                      <th>Статус</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchases.map((purchase) => (
                      <tr 
                        key={purchase.id} 
                        className="purchase-row"
                        onClick={() => handlePurchaseClick(purchase)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td className="mono" data-label="Дата">{formatDate(purchase.created_at)}</td>
                        <td className="name" data-label="Клиент">{getClientName(purchase)}</td>
                        <td className="mono" data-label="ID клиента">{purchase.client_external_id || '—'}</td>
                        <td className="num mono" data-label="Сумма">{formatCurrency(purchase.amount)}</td>
                        <td className="num mono" data-label="Скидка">
                          {purchase.discount > 0 ? `${purchase.discount}%` : '—'}
                        </td>
                        <td className="num mono" data-label="Итого">{formatCurrency(purchase.final_amount)}</td>
                        <td data-label="Оплата">
                          {purchase.payment_method === 'mixed' ? (
                            <span className="payment-method-badge payment-method-mixed-badge">
                              <img src="/img/money-svgrepo-com.svg" alt="Нал" className="payment-badge-icon" />
                              <img src="/img/card-svgrepo-com.svg" alt="Карта" className="payment-badge-icon" />
                              <span>Смешанная</span>
                            </span>
                          ) : purchase.payment_method === 'card' ? (
                            <span className="payment-method-badge payment-method-card-badge">
                              <img src="/img/card-svgrepo-com.svg" alt="Карта" className="payment-badge-icon" />
                              <span>Карта</span>
                            </span>
                          ) : purchase.payment_method === 'credit' ? (
                            <span className="payment-method-badge payment-method-credit-badge">
                              <span>Зачисление</span>
                            </span>
                          ) : (
                            <span className="payment-method-badge payment-method-cash-badge">
                              <img src="/img/money-svgrepo-com.svg" alt="Наличные" className="payment-badge-icon" />
                              <span>Нал</span>
                            </span>
                          )}
                        </td>
                        <td data-label="Статус">
                          {(purchase.operation_type || 'sale').toLowerCase() === 'return' || (purchase.operation_type || 'sale').toLowerCase() === 'replacement' ? (
                            <span className="status-chip operation-replacement">Замена</span>
                          ) : (
                            <span className={`status-chip ${purchase.client_status || 'standart'}`}>
                              {(purchase.client_status || 'standart').toUpperCase()}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="pagination">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="pagination-btn"
                  >
                    Назад
                  </button>
                  <span className="pagination-info">
                    Страница {page} из {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="pagination-btn"
                  >
                    Вперед
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {selectedPurchase && (
        <OrderDetailsModal
          order={selectedPurchase}
          onClose={() => setSelectedPurchase(null)}
          onMarkOperation={async (operationType) => {
            const updated = await purchaseHistoryService.setOperationType(selectedPurchase.id, operationType)
            setSelectedPurchase(updated)
            await loadPurchases()
          }}
          onStartReplacement={(order) => {
            setSelectedPurchase(null)
            setReplacementOrder(order)
          }}
          onDeleteOrder={(order) => {
            setConfirmDeleteOrder(order)
          }}
        />
      )}

      {replacementOrder && (
        <ReplacementOrderModal
          order={replacementOrder}
          onClose={() => setReplacementOrder(null)}
          onSuccess={() => {
            loadPurchases()
          }}
        />
      )}

      <ConfirmDialog
        isOpen={showConfirmDialog}
        title="Подтверждение"
        message="Вы уверены?"
        confirmText="Да"
        cancelText="Нет"
        confirmType="danger"
        onConfirm={handleClearHistory}
        onCancel={() => setShowConfirmDialog(false)}
      />

      <ConfirmDialog
        isOpen={!!confirmDeleteOrder}
        title="Удаление заказа"
        message={`Вы уверены, что хотите удалить заказ №${confirmDeleteOrder?.id}? Это действие нельзя отменить.`}
        confirmText="Удалить"
        cancelText="Отмена"
        confirmType="danger"
        onConfirm={async () => {
          try {
            await purchaseHistoryService.deleteTransaction(confirmDeleteOrder.id)
            setConfirmDeleteOrder(null)
            setSelectedPurchase(null)
            showNotification('Заказ успешно удален', 'success')
            await loadPurchases()
          } catch (err) {
            console.error('Ошибка удаления заказа:', err)
            showNotification(err.message || 'Ошибка удаления заказа', 'error')
          }
        }}
        onCancel={() => setConfirmDeleteOrder(null)}
      />
    </div>
  )
}

export default PurchaseHistory
