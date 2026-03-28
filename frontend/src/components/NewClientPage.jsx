import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useClients } from '../hooks/useClients'
import { clientService } from '../services/clientService'
import { useNotification } from './NotificationProvider'
import { useDataRefresh } from '../contexts/DataRefreshContext'
import { useAuth } from '../contexts/AuthContext'
import ProductSelector from './ProductSelector'
import PaymentMethodModal from './PaymentMethodModal'
import { normalizeMiddleNameForDisplay, normalizeClientIdForDisplay } from '../utils/clientDisplay'
import './NewClientPage.css'

const NewClientPage = () => {
  const { refreshAccessToken } = useAuth()
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
  const [searchQuery, setSearchQuery] = useState(() => {
    try {
      return localStorage.getItem('newClientPage_searchQuery') || ''
    } catch {
      return ''
    }
  })
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState(null)
  const [productSelectorKey, setProductSelectorKey] = useState(0)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [pendingOrderData, setPendingOrderData] = useState(null)
  const [employeeDiscount, setEmployeeDiscount] = useState(false)
  const debounceRef = useRef(null)
  const discountDebounceRef = useRef(null)
  const searchInputRef = useRef(null)
  const wasFocusedRef = useRef(false)
  const cursorPositionRef = useRef(null)
  const isUserTypingRef = useRef(false)

  const { addClient, addPurchase } = useClients()
  const { showNotification } = useNotification()
  const { refreshAll } = useDataRefresh()

  const trimmedSearchQuery = useMemo(() => searchQuery.trim(), [searchQuery])

  // Анонимный режим: все поля клиента (имя, фамилия, отчество, ID) пустые
  const isAnonymousForm = useMemo(() => {
    const f = formData
    return !(f.firstName || '').trim() && !(f.lastName || '').trim() &&
           !(f.middleName || '').trim() && !(f.clientId || '').trim()
  }, [formData])

  // Сохраняем поисковый запрос в localStorage
  useEffect(() => {
    try {
      if (searchQuery) {
        localStorage.setItem('newClientPage_searchQuery', searchQuery)
      } else {
        localStorage.removeItem('newClientPage_searchQuery')
      }
    } catch (e) {
      // Игнорируем ошибки localStorage
    }
  }, [searchQuery])

  // Функция для пересчета скидки
  const recalculateDiscount = useCallback((client, price) => {
    if (!client) {
      setDiscountInfo(null)
      return
    }

    // Используем переданную цену
    const currentPrice = price !== undefined && price !== null ? price : 0
    if (currentPrice <= 0) {
      setDiscountInfo(null)
      return
    }

    const status = client.status || 'standart'
    const hasDiscount = status === 'gold'

    if (hasDiscount) {
      setDiscountInfo({
        hasDiscount: true,
        originalPrice: currentPrice,
        finalPrice: currentPrice * 0.9,
        discount: 10
      })
    } else {
      setDiscountInfo(null)
    }
  }, [])

  // Поиск клиентов
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setSearchError(null)

    if (!trimmedSearchQuery) {
      setSearchResults([])
      setSearching(false)
      return
    }

    // Сохраняем фокус и позицию курсора только если пользователь активно печатает
    if (searchInputRef.current && document.activeElement === searchInputRef.current) {
      wasFocusedRef.current = true
      cursorPositionRef.current = searchInputRef.current.selectionStart
      isUserTypingRef.current = true
    }

    debounceRef.current = setTimeout(async () => {
      try {
        setSearching(true)
        try {
          const data = await clientService.search(trimmedSearchQuery)
          setSearchResults(Array.isArray(data) ? data : [])
        } catch (e) {
          if (e?.message === 'UNAUTHORIZED') {
            const refreshed = await refreshAccessToken()
            if (refreshed) {
              const data = await clientService.search(trimmedSearchQuery)
              setSearchResults(Array.isArray(data) ? data : [])
              return
            }
          }
          throw e
        }
      } catch (e) {
        setSearchResults([])
        setSearchError(e?.message || 'Ошибка поиска')
      } finally {
        setSearching(false)
        isUserTypingRef.current = false
        // Восстанавливаем фокус после завершения поиска
        if (wasFocusedRef.current && searchInputRef.current && searchQuery.length > 0) {
          setTimeout(() => {
            if (searchInputRef.current && searchInputRef.current.value === searchQuery) {
              searchInputRef.current.focus()
              const savedPosition = cursorPositionRef.current !== null 
                ? cursorPositionRef.current 
                : searchInputRef.current.value.length
              const position = Math.min(savedPosition, searchInputRef.current.value.length)
              searchInputRef.current.setSelectionRange(position, position)
            }
            wasFocusedRef.current = false
          }, 50)
        }
      }
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [trimmedSearchQuery, refreshAccessToken, searchQuery])

  // Автозаполнение формы при выборе клиента
  const handleSelectClient = async (client) => {
    const newPrice = productsTotal > 0 ? productsTotal.toFixed(2) : formData.price
    setFormData({
      firstName: client.first_name || '',
      lastName: client.last_name || '',
      middleName: normalizeMiddleNameForDisplay(client.middle_name) || '',
      clientId: client.client_id || '',
      price: newPrice
    })
    setCheckedClient(client)
    setSearchQuery('')
    setSearchResults([])
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    
    // Если изменилась цена и есть выбранный клиент, пересчитываем скидку с небольшой задержкой
    if (name === 'price' && checkedClient) {
      const priceValue = parseFloat(value) || 0
      // Используем requestAnimationFrame для плавного обновления без дерганий
      requestAnimationFrame(() => {
        recalculateDiscount(checkedClient, priceValue)
      })
    }
  }

  // Скидка сотрудника: -1 BYN к заказу при включённой галочке
  const employeeDiscountAmount = employeeDiscount ? 1 : 0

  const handleProductsChange = useCallback((cart, total) => {
    setSelectedProducts(cart)
    setProductsTotal(total)
    
    // Автоматически обновляем цену в форме, если есть товары
    if (total > 0) {
      setFormData(prev => ({
        ...prev,
        price: total.toFixed(2)
      }))
    }
    
    // Пересчитываем скидку при изменении товаров с небольшой задержкой для плавности
    if (checkedClient) {
      if (total > 0) {
        requestAnimationFrame(() => {
          recalculateDiscount(checkedClient, total)
        })
      } else {
        // Если товары удалены, пересчитываем по цене из формы
        setFormData(prev => {
          const priceFromForm = parseFloat(prev.price) || 0
          if (priceFromForm > 0) {
            requestAnimationFrame(() => {
              recalculateDiscount(checkedClient, priceFromForm)
            })
          } else {
            setDiscountInfo(null)
          }
          return prev
        })
      }
    }
  }, [checkedClient, recalculateDiscount])

  // Отслеживаем изменения цены и пересчитываем скидку с debounce для предотвращения дерганий
  useEffect(() => {
    if (checkedClient) {
      // Очищаем предыдущий таймер
      if (discountDebounceRef.current) {
        clearTimeout(discountDebounceRef.current)
      }
      
      // Используем requestAnimationFrame для плавного обновления
      discountDebounceRef.current = setTimeout(() => {
        requestAnimationFrame(() => {
          const currentPrice = productsTotal > 0 ? productsTotal : (parseFloat(formData.price) || 0)
          if (currentPrice > 0) {
            recalculateDiscount(checkedClient, currentPrice)
          } else {
            setDiscountInfo(null)
          }
        })
      }, 150) // Небольшая задержка для предотвращения дерганий при быстром вводе
      
      return () => {
        if (discountDebounceRef.current) {
          clearTimeout(discountDebounceRef.current)
        }
      }
    } else {
      setDiscountInfo(null)
    }
  }, [formData.price, productsTotal, checkedClient, recalculateDiscount])

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

      if (orderData.type === 'anonymous') {
        try {
          await clientService.createAnonymousPurchase(orderData.price, orderData.items, paymentMethod, orderData.employeeDiscount || 0, mixedParts)
          showNotification('Заказ создан!', 'success')
          refreshAll()
          setFormData({ firstName: '', lastName: '', middleName: '', clientId: '', price: '' })
          setSelectedProducts({})
          setProductsTotal(0)
          setEmployeeDiscount(false)
          setSearchQuery('')
          setSearchResults([])
          setProductSelectorKey(k => k + 1)
        } catch (err) {
          if (err.message === 'UNAUTHORIZED') {
            const refreshed = await refreshAccessToken()
            if (refreshed) {
              try {
                await clientService.createAnonymousPurchase(orderData.price, orderData.items, paymentMethod, orderData.employeeDiscount || 0, mixedParts)
                showNotification('Заказ создан!', 'success')
                refreshAll()
                setFormData({ firstName: '', lastName: '', middleName: '', clientId: '', price: '' })
                setSelectedProducts({})
                setProductsTotal(0)
                setEmployeeDiscount(false)
                setSearchQuery('')
                setSearchResults([])
                setProductSelectorKey(k => k + 1)
              } catch (retryErr) {
                showNotification(retryErr.message || 'Ошибка создания заказа', 'error')
              }
            } else {
              showNotification('Сессия истекла. Войдите снова.', 'error')
            }
          } else {
            showNotification(err.message || 'Ошибка создания заказа', 'error')
          }
        }
      } else if (orderData.type === 'existing') {
        try {
          const purchaseResult = await addPurchase(orderData.clientId, orderData.price, orderData.items, paymentMethod, orderData.employeeDiscount || 0, mixedParts)
          if (purchaseResult.success) {
            showNotification('Покупка успешно добавлена!', 'success')
            setTimeout(() => refreshAll(), 100)
            setTimeout(() => {
              setFormData({ firstName: '', lastName: '', middleName: '', clientId: '', price: '' })
              setSelectedProducts({})
              setProductsTotal(0)
              setEmployeeDiscount(false)
              setCheckedClient(null)
              setDiscountInfo(null)
              setSearchQuery('')
              setSearchResults([])
              setProductSelectorKey(k => k + 1)
            }, 1000)
          } else {
            showNotification(purchaseResult.error || 'Ошибка при добавлении покупки', 'error')
          }
        } catch (purchaseError) {
          showNotification(purchaseError.message || 'Ошибка при добавлении покупки', 'error')
        }
      } else if (orderData.type === 'new') {
        const clientData = {
          firstName: orderData.firstName,
          lastName: orderData.lastName,
          middleName: orderData.middleName,
          clientId: orderData.clientId,
          price: orderData.price,
          items: orderData.items,
          paymentMethod,
          employeeDiscount: orderData.employeeDiscount || 0
        }
        if (mixedParts) {
          clientData.cashPart = mixedParts.cashPart
          clientData.cardPart = mixedParts.cardPart
        }
        const result = await addClient(clientData)

        if (result.success) {
          showNotification('Клиент успешно добавлен!', 'success')
          refreshAll()
          setFormData({ firstName: '', lastName: '', middleName: '', clientId: '', price: '' })
          setSelectedProducts({})
          setProductsTotal(0)
          setCheckedClient(null)
          setDiscountInfo(null)
          setSearchQuery('')
          setSearchResults([])
          setProductSelectorKey(k => k + 1)
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
      // Аноним: все поля клиента пустые (имя, фамилия, отчество, ID)
      const firstName = (formData.firstName || '').trim()
      const lastName = (formData.lastName || '').trim()
      const middleName = (formData.middleName || '').trim()
      const clientId = (formData.clientId || '').trim()
      const isAnonymous = !firstName && !lastName && !middleName && !clientId

      // Для неанонимного заказа проверяем обязательные поля: Имя, Фамилия, ID
      if (!isAnonymous) {
        if (!firstName) {
          showNotification('Укажите имя', 'error')
          return
        }
        if (!lastName) {
          showNotification('Укажите фамилию', 'error')
          return
        }
        if (!clientId) {
          showNotification('Укажите ID (телефон или строку)', 'error')
          return
        }
      }

      // Анонимный заказ — только цена и товары, без клиента (все поля клиента пустые)
      if (isAnonymous) {
        const price = productsTotal > 0 ? productsTotal : (parseFloat(formData.price) || 0)
        if (price <= 0) {
          showNotification('Укажите цену или выберите товары из каталога', 'error')
          return
        }
        const items = Object.values(selectedProducts).map(item => ({
          productId: item.product.id,
          productName: item.product.name,
          productPrice: item.product.price,
          quantity: item.quantity
        }))
        const finalAmount = Math.max(0, price - employeeDiscountAmount)
        setPendingOrderData({ type: 'anonymous', price, items, employeeDiscount: employeeDiscountAmount, finalAmount })
        setShowPaymentModal(true)
        return
      }

      // Проверка существующего клиента по clientId, если указан
      let existingClient = null
      if (clientId) {
        try {
          existingClient = await clientService.getById(clientId)
          
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
              const finalAmount = Math.max(0, (hasDiscount ? price * 0.9 : price) - employeeDiscountAmount)
              setPendingOrderData({ 
                type: 'existing', 
                clientId: existingClient.id, 
                price, 
                items,
                employeeDiscount: employeeDiscountAmount,
                finalAmount
              })
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
      
      const finalAmount = Math.max(0, finalPrice - employeeDiscountAmount)
      setPendingOrderData({
        type: 'new',
        firstName: formData.firstName,
        lastName: formData.lastName,
        middleName: formData.middleName,
        clientId: formData.clientId,
        price: finalPrice,
        items,
        employeeDiscount: employeeDiscountAmount,
        finalAmount
      })
      setShowPaymentModal(true)
    } catch (error) {
      showNotification(error.message || 'Ошибка при обработке запроса', 'error')
    }
  }

  return (
    <div className="new-client-page">
      <div className="new-client-content">
        <div className="new-client-header">
          <h2>Новый заказ</h2>
        </div>
        <p style={{ marginBottom: 20, color: 'var(--muted)', fontSize: '0.9rem' }}>
          Все поля <strong>необязательны</strong>. Вы можете выбрать товары или указать цену вручную.
        </p>
        
        <div className="new-client-two-columns">
          {/* Левая колонка - Выбор товаров */}
          <div className="new-client-left-column">
            <div className="new-client-column-header">
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text)' }}>
                Выбор товаров
              </h3>
            </div>
            <ProductSelector 
              key={productSelectorKey}
              onProductsChange={handleProductsChange}
              initialTotal={productsTotal}
            />
          </div>

          {/* Правая колонка - Форма */}
          <div className="new-client-right-column">
            {/* Шапка колонки: подпись поиска (без чекбокса — он у поля «Цена») */}
            <div className="new-client-column-header new-client-column-header-right">
              {!isAnonymousForm && (
                <span className="client-search-label-inline">Поиск клиента (для программы лояльности)</span>
              )}
              {isAnonymousForm && (
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--muted)', width: '100%' }}>
                  Достаточно указать цену или выбрать товары из каталога — заказ будет анонимным.
                </p>
              )}
            </div>

            <div className="new-client-right-content">
            <div className="client-search-section">
              <div className="client-search-wrapper">
                <input
                  ref={searchInputRef}
                  type="text"
                  className="client-search-input-main"
                  placeholder="Введите имя, фамилию или ID..."
                  value={searchQuery}
                  onChange={(e) => {
                    cursorPositionRef.current = e.target.selectionStart
                    isUserTypingRef.current = true
                    setSearchQuery(e.target.value)
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
                  disabled={loading}
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="client-search-clear-main"
                    onClick={() => {
                      setSearchQuery('')
                      setSearchResults([])
                      setSearchError(null)
                      try {
                        localStorage.removeItem('newClientPage_searchQuery')
                      } catch (e) {
                        // Игнорируем ошибки localStorage
                      }
                      if (searchInputRef.current) {
                        searchInputRef.current.focus()
                      }
                    }}
                    aria-label="Очистить поиск"
                  >
                    ×
                  </button>
                )}
              </div>
              {searchError && <div className="client-search-hint-main error">{searchError}</div>}
              {!searchError && searching && <div className="client-search-hint-main">Поиск…</div>}
              {!searchError && !searching && trimmedSearchQuery && searchResults.length === 0 && (
                <div className="client-search-hint-main">Ничего не найдено</div>
              )}
              {searchResults.length > 0 && (
                <div className="client-search-results-main">
                  {searchResults.map((c) => {
                    const fullName = [c.first_name, c.last_name, normalizeMiddleNameForDisplay(c.middle_name)].filter(Boolean).join(' ')
                    return (
                      <button
                        type="button"
                        key={c.id}
                        className="client-search-item-main"
                        onClick={() => handleSelectClient(c)}
                      >
                        <div className="client-search-name-main">{fullName || '—'}</div>
                        <div className="client-search-meta-main">
                          <span className="mono">{normalizeClientIdForDisplay(c.client_id)}</span>
                          <span className={`pill ${c.status}`}>{c.status?.toUpperCase()}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="new-client-form">
              <div className="form-fields-client">
              <div className="form-row">
                <div className="input-group">
                  <label>Имя</label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    disabled={loading}
                  />
                </div>
                <div className="input-group">
                  <label>Фамилия</label>
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
                  <label>Отчество (необязательно)</label>
                  <input
                    type="text"
                    name="middleName"
                    value={formData.middleName}
                    onChange={handleChange}
                    disabled={loading}
                  />
                </div>
                <div className="input-group">
                  <label>ID (телефон или строка)</label>
                  <input
                    type="text"
                    name="clientId"
                    value={formData.clientId}
                    onChange={handleChange}
                    disabled={loading}
                  />
                </div>
              </div>
              </div>
              <div className="form-row form-row-price-anonymous">
                <div className="input-group">
                  <label>{isAnonymousForm ? 'Цена (или выберите товары)' : 'Цена'}</label>
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

              {!isAnonymousForm && checkedClient && (
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

              {/* Показываем информацию о цене и скидке */}
              {!isAnonymousForm && checkedClient && (productsTotal > 0 || parseFloat(formData.price) > 0) && (
                <div className="discount-preview" style={{ marginTop: 12 }}>
                  {discountInfo && discountInfo.hasDiscount ? (
                    <>
                      <div className="discount-badge">
                        <span>Скидка {discountInfo.discount}%</span>
                      </div>
                      <div className="price-preview">
                        <div className="price-original">
                          {discountInfo.originalPrice.toFixed(2)} BYN
                        </div>
                        <div className="price-final">
                          {(discountInfo.finalPrice - employeeDiscountAmount).toFixed(2)} BYN
                          {employeeDiscountAmount > 0 && (
                            <span className="employee-discount-badge"> (−1 BYN)</span>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                      <div className="price-preview">
                        <div className="price-final">
                          {((productsTotal > 0 ? productsTotal : parseFloat(formData.price) || 0) - employeeDiscountAmount).toFixed(2)} BYN
                          {employeeDiscountAmount > 0 && (
                            <span className="employee-discount-badge"> (−1 BYN)</span>
                          )}
                        </div>
                      </div>
                  )}
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

              <div className="new-client-actions">
                <button
                  type="submit"
                  className="btn-submit"
                  disabled={loading}
                >
                  {loading ? 'Сохранение...' : 'Создать заказ'}
                </button>
              </div>
            </form>
            </div>
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

export default NewClientPage
