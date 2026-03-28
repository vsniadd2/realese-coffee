import React, { useEffect, useState, useRef, useCallback } from 'react'
import { useClients } from '../hooks/useClients'
import { useDataRefresh } from '../contexts/DataRefreshContext'
import { useAuth } from '../contexts/AuthContext'
import { clientService } from '../services/clientService'
import Stats from './Stats'
import { formatMinskDateTime } from '../utils/dateTime'
import { normalizeMiddleNameForDisplay, normalizeClientIdForDisplay } from '../utils/clientDisplay'
import EditClientModal from './EditClientModal'
import LoadingIndicator from './LoadingIndicator'
import './ClientList.css'

const ClientList = ({ onSelectClient }) => {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  // Загружаем сохраненный поисковый запрос из localStorage
  const [page, setPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState(() => {
    try {
      return localStorage.getItem('clientList_searchQuery') || ''
    } catch {
      return ''
    }
  })
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(() => {
    try {
      return localStorage.getItem('clientList_searchQuery') || ''
    } catch {
      return ''
    }
  })
  const [editClient, setEditClient] = useState(null)
  const debounceTimerRef = useRef(null)
  const searchInputRef = useRef(null)
  const wasFocusedRef = useRef(false)
  const cursorPositionRef = useRef(null)
  const tableScrollRef = useRef(null)
  const savedScrollPositionRef = useRef(0)
  const isUserTypingRef = useRef(false)
  const hasLoadedOnceRef = useRef(false)
  const hasStatsLoadedRef = useRef(false)
  const limit = 20

  const { clients, loading, error, pagination, loadClients } = useClients({ 
    page, 
    limit, 
    search: debouncedSearchQuery 
  })
  const { refreshKey, registerRefreshCallback } = useDataRefresh()
  const [globalStats, setGlobalStats] = useState(null)
  const [statsLoading, setStatsLoading] = useState(true)

  // Сохраняем поисковый запрос в localStorage
  useEffect(() => {
    try {
      if (searchQuery) {
        localStorage.setItem('clientList_searchQuery', searchQuery)
      } else {
        localStorage.removeItem('clientList_searchQuery')
      }
    } catch (e) {
      // Игнорируем ошибки localStorage
    }
  }, [searchQuery])

  // Дебаунсинг для поиска
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
      setDebouncedSearchQuery(searchQuery)
      setPage(1) // Сбрасываем на первую страницу при новом поиске
      isUserTypingRef.current = false
    }, 500)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [searchQuery])

  // Функция для генерации UUID
  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0
      const v = c === 'x' ? r : (r & 0x3 | 0x8)
      return v.toString(16)
    })
  }

  // Функция для экспорта в CSV (экспортирует все клиенты, не только текущую страницу)
  const exportToCSV = async () => {
    try {
      // Загружаем все клиенты для экспорта (без пагинации)
      const allClientsData = await clientService.getAll({ page: 1, limit: 10000, search: debouncedSearchQuery })
      const allClients = allClientsData.clients || []

      if (!allClients || allClients.length === 0) {
        return
      }

      // Заголовки CSV
      const headers = ['Имя', 'Фамилия', 'Отчество', 'ID', 'Статус', 'Сумма (BYN)', 'Дата создания']
      
      // Преобразуем данные клиентов в строки CSV
      const csvRows = [
        headers.join(','), // Заголовки
        ...allClients.map(client => {
          const row = [
            `"${(client.first_name || '').replace(/"/g, '""')}"`,
            `"${(client.last_name || '').replace(/"/g, '""')}"`,
            `"${(normalizeMiddleNameForDisplay(client.middle_name) || '').replace(/"/g, '""')}"`,
            `"${(client.client_id || '').replace(/"/g, '""')}"`,
            `"${(client.status || '').toUpperCase()}"`,
            `"${Number.parseFloat(client.total_spent || 0).toFixed(2)}"`,
            `"${formatMinskDateTime(client.created_at)}"`
          ]
          return row.join(',')
        })
      ]

      // Объединяем все строки
      const csvContent = csvRows.join('\n')
      
      // Создаем BOM для правильного отображения кириллицы в Excel
      const BOM = '\uFEFF'
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
      
      // Создаем ссылку для скачивания
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      const uuid = generateUUID()
      link.setAttribute('href', url)
      link.setAttribute('download', `clients_${uuid}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      console.error('Ошибка экспорта CSV:', err)
      alert('Ошибка экспорта данных')
    }
  }

  // Сохраняем позицию скролла перед обновлением
  useEffect(() => {
    const tableWrap = document.querySelector('.clients-table-wrap')
    if (tableWrap) {
      tableScrollRef.current = tableWrap
      savedScrollPositionRef.current = tableWrap.scrollTop
    }
  }, [clients])

  // Загрузка глобальной статистики. Показываем «…» только при самой первой загрузке — при любых обновлениях числа меняются без дёргания.
  const loadGlobalStats = useCallback(async () => {
    const isFirstLoad = !hasStatsLoadedRef.current
    if (isFirstLoad) setStatsLoading(true)
    try {
      const stats = await clientService.getStats()
      setGlobalStats(stats)
      hasStatsLoadedRef.current = true
    } catch {
      setGlobalStats(null)
    } finally {
      if (isFirstLoad) setStatsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadGlobalStats()
  }, [loadGlobalStats, refreshKey])

  // Регистрируем callback для обновления при изменениях данных
  useEffect(() => {
    const unregister = registerRefreshCallback((silent) => {
      // Не обновляем если пользователь активно печатает
      if (isUserTypingRef.current) return

      // Сохраняем фокус, состояние и позицию скролла перед обновлением
      wasFocusedRef.current = document.activeElement === searchInputRef.current
      if (searchInputRef.current) {
        cursorPositionRef.current = searchInputRef.current.selectionStart
      }
      const tableWrap = document.querySelector('.clients-table-wrap')
      if (tableWrap) {
        savedScrollPositionRef.current = tableWrap.scrollTop
      }
      // Обновляем данные (silent режим передается из контекста)
      loadClients(page, limit, debouncedSearchQuery, silent !== false)
      loadGlobalStats()
    })
    return unregister
  }, [registerRefreshCallback, loadClients, loadGlobalStats, page, limit, debouncedSearchQuery])

  // Обновляем данные при изменении refreshKey
  useEffect(() => {
    if (refreshKey > 0 && !loading && !isUserTypingRef.current) {
      // Сохраняем фокус, состояние и позицию скролла перед обновлением
      wasFocusedRef.current = document.activeElement === searchInputRef.current
      if (searchInputRef.current) {
        cursorPositionRef.current = searchInputRef.current.selectionStart
      }
      const tableWrap = document.querySelector('.clients-table-wrap')
      if (tableWrap) {
        savedScrollPositionRef.current = tableWrap.scrollTop
      }
      // Обновляем данные в silent режиме (без показа loading)
      loadClients(page, limit, debouncedSearchQuery, true)
    }
  }, [refreshKey, loadClients, page, limit, debouncedSearchQuery, loading])

  // Восстанавливаем фокус и позицию скролла после обновления данных
  useEffect(() => {
    if (!loading && isUserTypingRef.current) {
      // Небольшая задержка для завершения рендеринга
      const timeoutId = setTimeout(() => {
        // Восстанавливаем фокус на input только если пользователь активно печатал
        if (wasFocusedRef.current && searchInputRef.current && searchQuery.length > 0) {
          const savedPosition = cursorPositionRef.current !== null 
            ? cursorPositionRef.current 
            : searchInputRef.current.value.length
          
          // Проверяем, что input все еще существует и имеет правильное значение
          if (searchInputRef.current.value === searchQuery) {
            searchInputRef.current.focus()
            // Восстанавливаем позицию курсора
            const position = Math.min(savedPosition, searchInputRef.current.value.length)
            searchInputRef.current.setSelectionRange(position, position)
          }
        }
        wasFocusedRef.current = false
        isUserTypingRef.current = false

        // Восстанавливаем позицию скролла таблицы
        const tableWrap = document.querySelector('.clients-table-wrap')
        if (tableWrap && savedScrollPositionRef.current > 0) {
          tableWrap.scrollTop = savedScrollPositionRef.current
        }
      }, 50)
      return () => clearTimeout(timeoutId)
    }
  }, [loading, searchQuery, clients])

  // Отмечаем, что хотя бы одна загрузка уже прошла (чтобы не заменять весь экран при поиске)
  if (!loading) {
    hasLoadedOnceRef.current = true
  }

  // Полноэкранный спиннер только при самой первой загрузке; при смене поиска/страницы инпут не трогаем
  if (loading && !hasLoadedOnceRef.current) {
    return <LoadingIndicator size="large" text="Загрузка клиентов..." />
  }

  if (error) {
    return (
      <div className="clients-error">
        <div className="error-message">Ошибка: {error}</div>
      </div>
    )
  }

  const handleClearSearch = () => {
    setSearchQuery('')
    setDebouncedSearchQuery('')
    setPage(1)
    try {
      localStorage.removeItem('clientList_searchQuery')
    } catch (e) {
      // Игнорируем ошибки localStorage
    }
    // Возвращаем фокус на input после очистки
    if (searchInputRef.current) {
      searchInputRef.current.focus()
    }
  }

  return (
    <>
      <div className="clients-header">
        <div className="clients-header-top">
          <h2>Список клиентов</h2>
          <div className="clients-header-buttons">
            {isAdmin && clients.length > 0 && (
              <button 
                onClick={exportToCSV} 
                className="export-csv-btn"
                title="Экспортировать в CSV"
              >
                <img src="/img/download-svgrepo-com.svg" alt="Download" className="download-icon" />
                <span>Экспортировать в CSV</span>
              </button>
            )}
          </div>
        </div>
        <div className="clients-search-container">
          <input
            ref={searchInputRef}
            type="text"
            className="clients-search-input"
            placeholder="Поиск по имени, фамилии или ID..."
            value={searchQuery}
            onChange={(e) => {
              // Сохраняем позицию курсора
              cursorPositionRef.current = e.target.selectionStart
              isUserTypingRef.current = true
              setSearchQuery(e.target.value)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                handleClearSearch()
              }
            }}
            onFocus={(e) => {
              wasFocusedRef.current = true
              // Восстанавливаем позицию курсора при фокусе
              if (cursorPositionRef.current !== null) {
                setTimeout(() => {
                  e.target.setSelectionRange(cursorPositionRef.current, cursorPositionRef.current)
                }, 0)
              }
            }}
            onBlur={() => {
              wasFocusedRef.current = false
            }}
          />
          {searchQuery && (
            <button 
              type="button"
              onClick={handleClearSearch}
              className="clients-search-clear"
              aria-label="Очистить поиск"
            >
              ×
            </button>
          )}
        </div>
        <Stats globalStats={globalStats} loading={statsLoading} />
      </div>
      {clients.length === 0 ? (
        <div className="empty-state">
          <img src="/img/coffee-svgrepo-com.svg" alt="Coffee" className="empty-icon" />
          <h3>Пока нет клиентов</h3>
          <p>Добавьте первого клиента, нажав кнопку "Новый клиент"</p>
        </div>
      ) : (
        <div className={`clients-table-wrap ${loading ? 'clients-table-wrap-loading' : ''}`}>
          {loading && (
            <div className="clients-table-loading-overlay" aria-hidden="true">
              Обновление…
            </div>
          )}
          <table className="clients-table">
            <thead>
              <tr>
                <th>Имя</th>
                <th>Фамилия</th>
                <th>Отчество</th>
                <th>ID</th>
                <th>Статус</th>
                <th className="num">Сумма</th>
                <th>Дата</th>
                <th className="clients-table-actions-th"></th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => {
                const isGold = client.status === 'gold'
                const statusText = client.status ? client.status.toUpperCase() : ''

                return (
                  <tr
                    key={client.id}
                    className={onSelectClient ? 'clickable-row' : undefined}
                    onClick={() => onSelectClient?.(client)}
                    role={onSelectClient ? 'button' : undefined}
                    tabIndex={onSelectClient ? 0 : undefined}
                    onKeyDown={(e) => {
                      if (!onSelectClient) return
                      if (e.key === 'Enter' || e.key === ' ') onSelectClient(client)
                    }}
                  >
                    <td className="name" data-label="Имя">
                      {client.first_name || '—'}
                    </td>
                    <td className="name" data-label="Фамилия">
                      {client.last_name || '—'}
                    </td>
                    <td className="name" data-label="Отчество">
                      {normalizeMiddleNameForDisplay(client.middle_name) || '—'}
                    </td>
                    <td className="mono id-cell" data-label="ID" title={client.client_id || ''}>
                      {normalizeClientIdForDisplay(client.client_id)}
                    </td>
                    <td>
                      <span className={`status-chip ${client.status}`} data-label="Статус">
                        {statusText}
                      </span>
                    </td>
                    <td className="num mono" data-label="Сумма">{Number.parseFloat(client.total_spent || 0).toFixed(2)} BYN</td>
                    <td className="date-cell" data-label="Дата">{formatMinskDateTime(client.created_at)}</td>
                    <td className="clients-table-actions-td" data-label="">
                      <button
                        type="button"
                        className="clients-edit-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          setEditClient(client)
                        }}
                        title="Редактировать клиента"
                        aria-label="Редактировать клиента"
                      >
                        <img src="/img/edit-3-svgrepo-com.svg" alt="" className="clients-edit-icon" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {pagination.totalPages > 1 && (
        <div className="clients-pagination">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || loading}
            className="pagination-btn"
          >
            Назад
          </button>
          <span className="pagination-info">
            Страница {pagination.page} из {pagination.totalPages} ({pagination.total} всего)
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
            disabled={page === pagination.totalPages || loading}
            className="pagination-btn"
          >
            Вперед
          </button>
        </div>
      )}
      {editClient && (
        <EditClientModal client={editClient} onClose={() => setEditClient(null)} />
      )}
    </>
  )
}

export default ClientList
