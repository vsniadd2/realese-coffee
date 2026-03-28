import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { orderStatsService } from '../services/orderStatsService'
import { useNotification } from './NotificationProvider'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer
} from 'recharts'
import './OrderDetailsPage.css'

const OrderDetailsPage = () => {
  const { refreshAccessToken } = useAuth()
  const { showNotification } = useNotification()
  const [loading, setLoading] = useState(true)
  const [paymentStats, setPaymentStats] = useState(null)
  const [productsStats, setProductsStats] = useState([])
  const [categoriesStats, setCategoriesStats] = useState([])
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const loadStats = async () => {
    try {
      setLoading(true)
      try {
        const [paymentData, productsData, categoriesData] = await Promise.all([
          orderStatsService.getPaymentStats(dateFrom || null, dateTo || null),
          orderStatsService.getProductsStats(dateFrom || null, dateTo || null),
          orderStatsService.getCategoriesStats(dateFrom || null, dateTo || null)
        ])
        setPaymentStats(paymentData)
        setProductsStats(productsData.products || [])
        setCategoriesStats(categoriesData.categories || [])
      } catch (e) {
        if (e?.message === 'UNAUTHORIZED') {
          const refreshed = await refreshAccessToken()
          if (refreshed) {
            const [paymentData, productsData, categoriesData] = await Promise.all([
              orderStatsService.getPaymentStats(dateFrom || null, dateTo || null),
              orderStatsService.getProductsStats(dateFrom || null, dateTo || null),
              orderStatsService.getCategoriesStats(dateFrom || null, dateTo || null)
            ])
            setPaymentStats(paymentData)
            setProductsStats(productsData.products || [])
            setCategoriesStats(categoriesData.categories || [])
            return
          }
        }
        throw e
      }
    } catch (err) {
      showNotification(err.message || 'Ошибка загрузки статистики', 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStats()
  }, [dateFrom, dateTo])

  const handleClearFilters = () => {
    setDateFrom('')
    setDateTo('')
  }

  const dateLabel = dateFrom && dateTo
    ? (dateFrom === dateTo
        ? new Date(dateFrom).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
        : `${new Date(dateFrom).toLocaleDateString('ru-RU')} – ${new Date(dateTo).toLocaleDateString('ru-RU')}`)
    : null

  const COLORS = ['#ef4444', '#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

  const renderPieLabel = (props) => {
    const { cx, cy, midAngle, innerRadius, outerRadius, percent, percentage } = props
    const RADIAN = Math.PI / 180
    const r = ((innerRadius || 0) + outerRadius) / 2
    const x = cx + r * Math.cos(-midAngle * RADIAN)
    const y = cy + r * Math.sin(-midAngle * RADIAN)
    const pct = percentage != null ? Number(percentage) : (percent != null ? percent * 100 : 0)
    return (
      <text x={x} y={y} fill="#1a1a1a" stroke="#fff" strokeWidth={2} strokeLinejoin="round" textAnchor="middle" dominantBaseline="central" style={{ fontSize: 13, fontWeight: 600, paintOrder: 'stroke' }}>
        {`${pct.toFixed(1)}%`}
      </text>
    )
  }

  const toDonutData = (items, limit = 10) => {
    if (!items || items.length === 0) return []
    const total = items.reduce((s, i) => s + (i.revenue || i.value || 0), 0)
    return items.slice(0, limit).map((item, i) => ({
      ...item,
      id: item.id || item.name,
      revenue: item.revenue ?? item.value ?? 0,
      percentage: total > 0 ? (((item.revenue ?? item.value ?? 0) / total * 100).toFixed(1)) : '0',
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
                          {d.count != null && (
                            <p className="chart-tooltip-count">Продаж: {d.count}</p>
                          )}
                          {d.quantity != null && (
                            <p className="chart-tooltip-count">Количество: {d.quantity} шт</p>
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

  // Данные для графика способов оплаты (формат как для donut)
  const paymentChartData = paymentStats ? [
    { name: 'Наличные', revenue: paymentStats.cash.total, count: paymentStats.cash.count },
    { name: 'Карта', revenue: paymentStats.card.total, count: paymentStats.card.count }
  ] : []

  if (loading) {
    return (
      <div className="order-details-page">
        <div className="order-details-loading">
          <div className="loading-spinner">Загрузка статистики...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="order-details-page">
      <div className="order-details-header">
        <h2>Статистика продаж</h2>
        <div className="order-details-filters">
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
          {(dateFrom || dateTo) && (
            <button onClick={handleClearFilters} className="clear-btn">
              Сбросить
            </button>
          )}
        </div>
      </div>

      <div className="order-details-content">
        {/* График способов оплаты */}
        {paymentStats && paymentChartData.length > 0 ? (
          <>
            <DonutChartSection title="Способы оплаты" dateLabel={dateLabel} data={paymentChartData} />
            <div className="chart-section">
              <div className="chart-summary">
                <div className="summary-item">
                  <span className="summary-label">Наличные:</span>
                  <span className="summary-value">{paymentStats.cash.total.toFixed(2)} BYN</span>
                  <span className="summary-count">({paymentStats.cash.count} продаж)</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Карта:</span>
                  <span className="summary-value">{paymentStats.card.total.toFixed(2)} BYN</span>
                  <span className="summary-count">({paymentStats.card.count} продаж)</span>
                </div>
                <div className="summary-item summary-total">
                  <span className="summary-label">Всего:</span>
                  <span className="summary-value">{paymentStats.total.total.toFixed(2)} BYN</span>
                  <span className="summary-count">({paymentStats.total.count} продаж)</span>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="chart-section">
            <h3>Способы оплаты</h3>
            <div className="empty-state">Нет данных для отображения</div>
          </div>
        )}

        {/* График продаж по товарам (напитки) */}
        {productsStats.length > 0 ? (
          <DonutChartSection title="Продажи по напиткам" dateLabel={dateLabel} data={productsStats.slice(0, 10)} />
        ) : (
          <div className="chart-section">
            <h3>Продажи по напиткам</h3>
            <div className="empty-state">Нет данных для отображения</div>
          </div>
        )}

        {/* График продаж по категориям */}
        {categoriesStats.length > 0 ? (
          <DonutChartSection title="Продажи по категориям товаров" dateLabel={dateLabel} data={categoriesStats} />
        ) : (
          <div className="chart-section">
            <h3>Продажи по категориям товаров</h3>
            <div className="empty-state">Нет данных для отображения</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default OrderDetailsPage
