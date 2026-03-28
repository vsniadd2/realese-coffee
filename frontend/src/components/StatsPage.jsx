import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { orderStatsService } from '../services/orderStatsService'
import { getProductsTree } from '../services/productsService'
import { pointsService } from '../services/pointsService'
import { useNotification } from './NotificationProvider'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer
} from 'recharts'
import './StatsPage.css'
//g
const StatsPage = () => {
  const { refreshAccessToken, ensureValidToken, user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const { showNotification } = useNotification()
  const [loading, setLoading] = useState(true) // только для первой загрузки
  const [chartLoading, setChartLoading] = useState(false) // фоновое обновление без блокировки
  const cacheRef = useRef({}) // кэш по ключу: viewType_date_period_categoryId_pointId
  const [productsStats, setProductsStats] = useState([])
  const [categoriesStats, setCategoriesStats] = useState([])
  const [categoryProductsStats, setCategoryProductsStats] = useState([])
  const [productStats, setProductStats] = useState(null)
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [dayTopProducts, setDayTopProducts] = useState(null)
  const [points, setPoints] = useState([])
  const [selectedPointId, setSelectedPointId] = useState('') // для админа: '' = все точки
  // Локальная дата (YYYY-MM-DD), не UTC — чтобы max в календаре совпадал с «сегодня» пользователя
  const todayStr = () => new Date().toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' })
  // У каждого типа графика своя история: дата и период
  const [datesByViewType, setDatesByViewType] = useState(() => ({
    day: todayStr(),
    all: todayStr(),
    category: todayStr(),
    other: todayStr()
  }))
  const [periodsByViewType, setPeriodsByViewType] = useState(() => ({
    day: 'day',
    all: 'month',
    category: 'month',
    other: 'month'
  }))
  const [productViewType, setProductViewType] = useState('day') // day, all, category, other
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [paymentStats, setPaymentStats] = useState(null)

  const selectedDate = datesByViewType[productViewType]
  const period = periodsByViewType[productViewType]

  const setSelectedDate = (date) => {
    setDatesByViewType(prev => ({ ...prev, [productViewType]: date }))
  }

  const setPeriod = (p) => {
    setPeriodsByViewType(prev => ({ ...prev, [productViewType]: p }))
  }

  const toLocalDateStr = (d) => d.toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' })

  const getDateRange = (periodType, dateStr = null) => {
    const useDate = dateStr ?? selectedDate
    if (periodType === 'day' && useDate) {
      return { dateFrom: useDate, dateTo: useDate }
    }
    const today = new Date()
    let dateFrom = new Date()
    switch (periodType) {
      case 'month':
        dateFrom.setDate(1)
        break
      case 'quarter':
        const qMonth = Math.floor(today.getMonth() / 3) * 3
        dateFrom.setMonth(qMonth)
        dateFrom.setDate(1)
        break
      case 'year':
        dateFrom.setMonth(0)
        dateFrom.setDate(1)
        break
      default:
        dateFrom.setMonth(today.getMonth() - 1)
    }
    return {
      dateFrom: toLocalDateStr(dateFrom),
      dateTo: toLocalDateStr(today)
    }
  }

  const loadCategories = async () => {
    await ensureValidToken()
    try {
      const tree = await getProductsTree()
      const cats = Object.values(tree).map(cat => ({
        id: cat.id,
        name: cat.name
      }))
      setCategories(cats)
    } catch (e) {
      if (e?.message === 'UNAUTHORIZED') {
        const refreshed = await refreshAccessToken()
        if (refreshed) {
          const tree = await getProductsTree()
          const cats = Object.values(tree).map(cat => ({
            id: cat.id,
            name: cat.name
          }))
          setCategories(cats)
        }
      }
    }
  }

  // Для "Общий" всегда показываем со всех точек; для остальных — с учётом выбора точки
  const pointIdParam = isAdmin
    ? (productViewType === 'all' ? null : (selectedPointId === '' ? null : selectedPointId))
    : null

  const loadPoints = async () => {
    if (!isAdmin) return
    await ensureValidToken()
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
  }

  const loadProductsForCategory = async (categoryId) => {
    if (!categoryId) {
      setProducts([])
      return
    }
    await ensureValidToken()
    try {
      const { dateFrom, dateTo } = getDateRange(period)
      const data = await orderStatsService.getCategoryProductsStats(dateFrom, dateTo, categoryId, pointIdParam)
      setProducts(data.products || [])
    } catch (e) {
      if (e?.message === 'UNAUTHORIZED') {
        const refreshed = await refreshAccessToken()
        if (refreshed) {
          const { dateFrom, dateTo } = getDateRange(period)
          const data = await orderStatsService.getCategoryProductsStats(dateFrom, dateTo, categoryId, pointIdParam)
          setProducts(data.products || [])
        }
      }
    }
  }

  const cacheKeyDay = (date, catId, ptId) =>
    `day_${date}_${catId || ''}_${ptId || ''}`

  const loadDayTopProducts = async (date, categoryId = null) => {
    await ensureValidToken()
    const key = cacheKeyDay(date, categoryId, pointIdParam)
    const cached = cacheRef.current[key]
    if (cached) {
      setDayTopProducts(cached)
      setLoading(false)
      setChartLoading(false)
      return
    }
    try {
      setChartLoading(true)
      const data = await orderStatsService.getDayTopProducts(date, categoryId, 5, pointIdParam)
      cacheRef.current[key] = data
      setDayTopProducts(data)
    } catch (e) {
      if (e?.message === 'UNAUTHORIZED') {
        const refreshed = await refreshAccessToken()
        if (refreshed) {
          const data = await orderStatsService.getDayTopProducts(date, categoryId, 5, pointIdParam)
          cacheRef.current[key] = data
          setDayTopProducts(data)
          return
        }
      }
      showNotification(e.message || 'Ошибка загрузки топ товаров за день', 'error')
      setDayTopProducts(null)
    } finally {
      setLoading(false)
      setChartLoading(false)
    }
  }

  const cacheKeyStats = (viewType, dateFrom, dateTo, catId, ptId) =>
    `${viewType}_${dateFrom}_${dateTo}_${catId || ''}_${ptId || ''}`

  const applyCachedStats = (cached) => {
    if (!cached) return
    setProductsStats(cached.productsStats || [])
    setCategoriesStats(cached.categoriesStats || [])
    setCategoryProductsStats(cached.categoryProductsStats || [])
    setPaymentStats(cached.paymentStats ?? null)
  }

  const loadStats = async () => {
    await ensureValidToken()
    const { dateFrom, dateTo } = getDateRange(period)
    const key = cacheKeyStats(productViewType, dateFrom, dateTo, selectedCategoryId, pointIdParam)
    const cached = cacheRef.current[key]
    if (cached) {
      applyCachedStats(cached)
      setLoading(false)
      setChartLoading(false)
      return
    }
    try {
      setChartLoading(true)
      try {
        const promises = []
        if (productViewType === 'all') {
          promises.push(
            orderStatsService.getProductsStats(dateFrom, dateTo, pointIdParam),
            orderStatsService.getCategoriesStats(dateFrom, dateTo, null, pointIdParam)
          )
        } else if (productViewType === 'category' && selectedCategoryId) {
          promises.push(
            orderStatsService.getCategoryProductsStats(dateFrom, dateTo, selectedCategoryId, pointIdParam),
            orderStatsService.getCategoriesStats(dateFrom, dateTo, selectedCategoryId, pointIdParam)
          )
        } else if (productViewType === 'other') {
          promises.push(
            orderStatsService.getProductsStats(dateFrom, dateTo, pointIdParam),
            orderStatsService.getCategoriesStats(dateFrom, dateTo, null, pointIdParam),
            orderStatsService.getPaymentStats(dateFrom, dateTo, pointIdParam)
          )
        }

        if (promises.length === 0) {
          setProductsStats([])
          setCategoriesStats([])
          setCategoryProductsStats([])
          setProductStats(null)
          setPaymentStats(null)
        } else {
          const results = await Promise.all(promises)
          const cachedData = { productsStats: [], categoriesStats: [], categoryProductsStats: [], paymentStats: null }
          if (productViewType === 'all') {
            cachedData.productsStats = results[0].products || []
            cachedData.categoriesStats = results[1].categories || []
          } else if (productViewType === 'category' && selectedCategoryId) {
            cachedData.categoryProductsStats = results[0].products || []
            cachedData.categoriesStats = results[1].categories || []
          } else if (productViewType === 'other') {
            cachedData.productsStats = results[0].products || []
            cachedData.categoriesStats = results[1].categories || []
            cachedData.paymentStats = results[2] || null
          }
          cacheRef.current[key] = cachedData
          applyCachedStats(cachedData)
        }
      } catch (e) {
        if (e?.message === 'UNAUTHORIZED') {
          const refreshed = await refreshAccessToken()
          if (refreshed) {
            await loadStats()
            return
          }
        }
        throw e
      }
    } catch (err) {
      showNotification(err.message || 'Ошибка загрузки статистики', 'error')
    } finally {
      setLoading(false)
      setChartLoading(false)
    }
  }

  useEffect(() => {
    if (productViewType === 'day') {
      loadDayTopProducts(selectedDate, selectedCategoryId || null)
    } else {
      loadStats()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, productViewType, selectedCategoryId, selectedDate, selectedPointId])

  useEffect(() => {
    loadCategories()
    if (isAdmin) {
      loadPoints()
    } else if (productViewType === 'all') {
      setProductViewType('day')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin])

  useEffect(() => {
    if (productViewType === 'category' && selectedCategoryId) {
      loadProductsForCategory(selectedCategoryId)
    } else {
      setProducts([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategoryId, productViewType, period])

  useEffect(() => {
    if (productViewType === 'day' && selectedDate) {
      loadDayTopProducts(selectedDate, selectedCategoryId || null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, selectedCategoryId, productViewType])

  const COLORS = ['#ef4444', '#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

  // Подпись процентов на donut — в середине сегмента (внутри кольца), чтобы не обрезалось clipPath
  const renderPieLabel = (props) => {
    const { cx, cy, midAngle, innerRadius, outerRadius, percent, percentage } = props
    const RADIAN = Math.PI / 180
    const r = (innerRadius + outerRadius) / 2
    const x = cx + r * Math.cos(-midAngle * RADIAN)
    const y = cy + r * Math.sin(-midAngle * RADIAN)
    const pct = percentage != null ? Number(percentage) : (percent != null ? percent * 100 : 0)
    return (
      <text x={x} y={y} fill="#1a1a1a" stroke="#fff" strokeWidth={2} strokeLinejoin="round" textAnchor="middle" dominantBaseline="central" style={{ fontSize: 13, fontWeight: 600, paintOrder: 'stroke' }}>
        {`${pct.toFixed(1)}%`}
      </text>
    )
  }

  // Преобразование данных для donut-диаграмм (как на вкладке "по дням")
  const toDonutData = (items, limit = 10) => {
    if (!items || items.length === 0) return []
    const total = items.reduce((s, i) => s + (i.revenue || 0), 0)
    return items.slice(0, limit).map((item, i) => ({
      ...item,
      id: item.id || item.name,
      revenue: item.revenue || 0,
      percentage: total > 0 ? ((item.revenue || 0) / total * 100).toFixed(1) : '0',
      color: item.color || COLORS[i % COLORS.length]
    }))
  }

  const DonutChartSection = ({ title, dateLabel, data }) => {
    const donutData = toDonutData(data)
    const totalSum = donutData.reduce((s, i) => s + (i.revenue || 0), 0)
    if (donutData.length === 0) return null
    return (
      <div className="chart-section day-top-products-section">
        <div className="day-top-products-header">
          <h3>{title}</h3>
          <div className="day-info">
            {dateLabel && <span className="day-date">{dateLabel}</span>}
            <span className="day-total">Всего: {totalSum.toFixed(2)} BYN</span>
          </div>
        </div>
        <div className="day-top-products-content">
          <div className="donut-chart-container">
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={140}
                  paddingAngle={2}
                  dataKey="revenue"
                  label={renderPieLabel}
                  labelLine={false}
                >
                  {donutData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload
                      return (
                        <div className="chart-tooltip">
                          <p className="chart-tooltip-label">{d.name}</p>
                          <p className="chart-tooltip-value">{d.percentage}%</p>
                          <p className="chart-tooltip-value">{Number(d.revenue).toFixed(2)} BYN</p>
                          {d.quantity != null && (
                            <p className="chart-tooltip-count">Количество: {d.quantity} шт</p>
                          )}
                          {d.count != null && (
                            <p className="chart-tooltip-count">Продаж: {d.count}</p>
                          )}
                        </div>
                      )
                    }
                    return null
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="day-top-products-legend">
            {donutData.map((product, index) => (
              <div key={product.id || index} className="legend-item">
                <div className="legend-color" style={{ backgroundColor: product.color }} />
                <div className="legend-content">
                  <div className="legend-percentage">{product.percentage}%</div>
                  <div className="legend-name">{product.name}</div>
                  <div className="legend-revenue">{Number(product.revenue).toFixed(2)} BYN</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const getPeriodLabel = () => {
    switch (period) {
      case 'day':
        return selectedDate ? `за ${new Date(selectedDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}` : 'за день'
      case 'month':
        return 'за месяц'
      case 'quarter':
        return 'за квартал'
      case 'year':
        return 'за год'
      default:
        return ''
    }
  }

  return (
    <div className="stats-page">
      <div className="stats-header">
        <h2>Графики</h2>
        <div className="period-filters">
          {productViewType !== 'day' && (
            <>
              <button
                type="button"
                onClick={() => setPeriod('day')}
                className={`period-btn ${period === 'day' ? 'active' : ''}`}
              >
                День
              </button>
              <button
                type="button"
                onClick={() => setPeriod('month')}
                className={`period-btn ${period === 'month' ? 'active' : ''}`}
              >
                Месяц
              </button>
              <button
                type="button"
                onClick={() => setPeriod('quarter')}
                className={`period-btn ${period === 'quarter' ? 'active' : ''}`}
              >
                Квартал
              </button>
              <button
                type="button"
                onClick={() => setPeriod('year')}
                className={`period-btn ${period === 'year' ? 'active' : ''}`}
              >
                Год
              </button>
            </>
          )}
          {(period === 'day' || productViewType === 'day') && (
            <label className="stats-point-select-wrap">
              <span className="stats-point-label">Дата:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="stats-date-input"
                max={todayStr()}
              />
            </label>
          )}
          {isAdmin && points.length > 0 && productViewType !== 'all' && (
            <label className="stats-point-select-wrap">
              <span className="stats-point-label">Точка:</span>
              <select
                className="stats-point-select"
                value={selectedPointId}
                onChange={(e) => setSelectedPointId(e.target.value)}
              >
                <option value="">Все точки</option>
                {points.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>

      <div className={`stats-content ${chartLoading ? 'stats-content-loading' : ''}`}>
        {chartLoading && <div className="stats-chart-loading-overlay" aria-hidden="true" />}
        {(
          <div className="products-stats-container stats-content-inner">
            <div className="products-stats-filters">
              <div className="filter-group">
                <label>Тип графика:</label>
                <div className="view-type-buttons">
                  <button
                    type="button"
                    onClick={() => {
                      setProductViewType('day')
                    }}
                    className={`view-type-btn ${productViewType === 'day' ? 'active' : ''}`}
                  >
                    По дням
                  </button>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setProductViewType('all')
                        setSelectedCategoryId('')
                      }}
                      className={`view-type-btn ${productViewType === 'all' ? 'active' : ''}`}
                      title="Данные по обеим точкам (Червенский + Валерианова)"
                    >
                      Общий (обе точки)
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setProductViewType('category')
                    }}
                    className={`view-type-btn ${productViewType === 'category' ? 'active' : ''}`}
                  >
                    По категории
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProductViewType('other')
                      setSelectedCategoryId('')
                    }}
                    className={`view-type-btn ${productViewType === 'other' ? 'active' : ''}`}
                  >
                    Другие графики
                  </button>
                </div>
              </div>

              {/* Дата для любого типа графика (у каждого типа своя дата в datesByViewType) */}
              <div className="filter-group">
                <label htmlFor="stats-date-select">
                  {productViewType === 'day' ? 'Выберите день:' : 'Дата (для периода «День»):'}
                </label>
                <input
                  id="stats-date-select"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="stats-date-input"
                  max={todayStr()}
                />
              </div>

              {productViewType === 'day' && (
                <div className="filter-group">
                  <label htmlFor="category-select-day">Категория (опционально):</label>
                  <select
                    id="category-select-day"
                    value={selectedCategoryId}
                    onChange={(e) => setSelectedCategoryId(e.target.value)}
                    className="stats-select"
                  >
                    <option value="">Все категории</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {productViewType === 'category' && (
                <div className="filter-group">
                  <label htmlFor="category-select">Категория:</label>
                  <select
                    id="category-select"
                    value={selectedCategoryId}
                    onChange={(e) => {
                      setSelectedCategoryId(e.target.value)
                      setCategoryProductsStats([])
                    }}
                    className="stats-select"
                  >
                    <option value="">Выберите категорию</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              )}

            </div>

            {/* График по дням */}
            {productViewType === 'day' && (
              <div className="chart-section day-top-products-section">
                <div className="day-top-products-header">
                  <h3>Топ 5 товаров</h3>
                  <div className="day-info">
                    {selectedDate && (
                      <span className="day-date">
                        {new Date(selectedDate).toLocaleDateString('ru-RU', { 
                          day: 'numeric', 
                          month: 'long', 
                          year: 'numeric' 
                        })}
                      </span>
                    )}
                    {dayTopProducts?.products?.length > 0 && (
                      <span className="day-total">
                        Всего: {dayTopProducts.products.reduce((s, p) => s + (p.revenue || 0), 0).toFixed(2)} BYN
                      </span>
                    )}
                  </div>
                </div>
                {dayTopProducts && dayTopProducts.products && dayTopProducts.products.length > 0 ? (
                  <div className="day-top-products-content">
                    <div className="donut-chart-container">
                      <ResponsiveContainer width="100%" height={350}>
                        <PieChart>
                          <Pie
                            data={dayTopProducts.products}
                            cx="50%"
                            cy="50%"
                            innerRadius={80}
                            outerRadius={140}
                            paddingAngle={2}
                            dataKey="revenue"
                            label={renderPieLabel}
                            labelLine={false}
                          >
                            {dayTopProducts.products.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                const data = payload[0].payload
                                return (
                                  <div className="chart-tooltip">
                                    <p className="chart-tooltip-label">{data.name}</p>
                                    <p className="chart-tooltip-value">{data.percentage}%</p>
                                    <p className="chart-tooltip-value">{data.revenue.toFixed(2)} BYN</p>
                                    <p className="chart-tooltip-count">Количество: {data.quantity} шт</p>
                                  </div>
                                )
                              }
                              return null
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="day-top-products-legend">
                      {dayTopProducts.products.map((product, index) => (
                        <div key={product.id || index} className="legend-item">
                          <div 
                            className="legend-color" 
                            style={{ backgroundColor: product.color || COLORS[index % COLORS.length] }}
                          />
                          <div className="legend-content">
                            <div className="legend-percentage">{product.percentage}%</div>
                            <div className="legend-name">{product.name}</div>
                            <div className="legend-revenue">{product.revenue.toFixed(2)} BYN</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="empty-state">Нет данных за выбранный день</div>
                )}
              </div>
            )}

            {/* Общий график — объединённые данные по всем точкам (Червенский + Валерианова) */}
            {productViewType === 'all' && (
              <>
                {productsStats.length > 0 && (
                  <DonutChartSection
                    title={`Продажи по напиткам ${getPeriodLabel()} (все точки)`}
                    data={productsStats.slice(0, 10)}
                  />
                )}

                {categoriesStats.length > 0 && (
                  <DonutChartSection
                    title={`Продажи по категориям товаров ${getPeriodLabel()} (все точки)`}
                    data={categoriesStats}
                  />
                )}

                {productsStats.length === 0 && categoriesStats.length === 0 && !chartLoading && (
                  <div className="chart-section">
                    <div className="empty-state">
                      <p>Нет данных за выбранный период</p>
                      <p className="empty-state-hint">
                        {(() => {
                          const { dateFrom, dateTo } = getDateRange(period)
                          return `Период: ${dateFrom} — ${dateTo}. Попробуйте «День» и сегодняшнюю дату.`
                        })()}
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* График по категории */}
            {productViewType === 'category' && selectedCategoryId && (
              <>
                {categoriesStats.length > 0 && (
                  <DonutChartSection
                    title={`Статистика категории ${getPeriodLabel()}`}
                    data={categoriesStats}
                  />
                )}

                {categoryProductsStats.length > 0 && (
                  <DonutChartSection
                    title={`Товары категории ${getPeriodLabel()}`}
                    data={categoryProductsStats.slice(0, 10)}
                  />
                )}

                {!selectedCategoryId && (
                  <div className="empty-state">Выберите категорию для отображения графика</div>
                )}
                {selectedCategoryId && categoryProductsStats.length === 0 && categoriesStats.length === 0 && !loading && (
                  <div className="empty-state">Нет данных для выбранной категории</div>
                )}
              </>
            )}

            {/* Другие графики */}
            {productViewType === 'other' && (
              <>
                {categoriesStats.length > 0 && (
                  <DonutChartSection
                    title={`Продажи по категориям (группы) ${getPeriodLabel()}`}
                    data={categoriesStats}
                  />
                )}
                {productsStats.length > 0 && (
                  <DonutChartSection
                    title={`Топ товаров ${getPeriodLabel()}`}
                    data={productsStats.slice(0, 10)}
                  />
                )}
                {paymentStats && (paymentStats.cash?.total > 0 || paymentStats.card?.total > 0) && (
                  <DonutChartSection
                    title={`Способы оплаты ${getPeriodLabel()}`}
                    data={[
                      { name: 'Наличные', revenue: paymentStats.cash?.total || 0, count: paymentStats.cash?.count || 0 },
                      { name: 'Карта', revenue: paymentStats.card?.total || 0, count: paymentStats.card?.count || 0 }
                    ]}
                  />
                )}
                {productViewType === 'other' && categoriesStats.length === 0 && productsStats.length === 0 && (!paymentStats || (paymentStats.cash?.total === 0 && paymentStats.card?.total === 0)) && !loading && (
                  <div className="empty-state">Нет данных для отображения</div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default StatsPage
