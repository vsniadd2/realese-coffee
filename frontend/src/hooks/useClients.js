import { useState, useEffect, useCallback, useRef } from 'react'
import { clientService } from '../services/clientService'
import { useAuth } from '../contexts/AuthContext'

export const useClients = ({ page = 1, limit = 20, search = '' } = {}) => {
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1
  })
  const { refreshAccessToken } = useAuth()
  const isInitialLoadRef = useRef(true)
  const abortControllerRef = useRef(null)

  const loadClients = useCallback(async (currentPage = page, currentLimit = limit, searchQuery = search, silent = false) => {
    try {
      // Отменяем предыдущий запрос, если он еще выполняется
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      abortControllerRef.current = new AbortController()

      // Показываем loading только при первой загрузке или если не silent режим
      if (!silent && isInitialLoadRef.current) {
        setLoading(true)
      }
      setError(null)
      
      const data = await clientService.getAll({ 
        page: currentPage, 
        limit: currentLimit, 
        search: searchQuery 
      })
      
      // Проверяем, не был ли запрос отменен
      if (abortControllerRef.current?.signal.aborted) {
        return
      }

      // Обновляем состояние с использованием requestAnimationFrame для плавности
      requestAnimationFrame(() => {
        setClients(data.clients || [])
        setPagination(data.pagination || {
          page: currentPage,
          limit: currentLimit,
          total: 0,
          totalPages: 1
        })
      })
      
      isInitialLoadRef.current = false
    } catch (err) {
      if (err.name === 'AbortError') {
        return
      }
      if (err.message === 'UNAUTHORIZED') {
        const refreshed = await refreshAccessToken()
        if (refreshed) {
          return loadClients(currentPage, currentLimit, searchQuery, silent)
        }
      }
      setError(err.message)
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }, [page, limit, search, refreshAccessToken])

  useEffect(() => {
    loadClients(page, limit, search)
  }, [loadClients, page, limit, search])

  const addClient = async (clientData) => {
    try {
      const newClient = await clientService.create(clientData)
      await loadClients(page, limit, search)
      return { success: true, client: newClient }
    } catch (err) {
      if (err.message === 'UNAUTHORIZED') {
        const refreshed = await refreshAccessToken()
        if (refreshed) {
          // Повторяем попытку после обновления токена
          try {
            const newClient = await clientService.create(clientData)
            await loadClients(page, limit, search)
            return { success: true, client: newClient }
          } catch (retryErr) {
            return { success: false, error: retryErr.message }
          }
        }
        return { success: false, error: 'Сессия истекла. Пожалуйста, войдите снова.' }
      }
      return { success: false, error: err.message }
    }
  }

  const addPurchase = async (clientDbId, price, items = [], paymentMethod = 'cash', employeeDiscount = 0, mixedParts = null) => {
    try {
      const result = await clientService.addPurchase(clientDbId, price, items, paymentMethod, employeeDiscount, mixedParts)
      await loadClients(page, limit, search)
      return { success: true, result }
    } catch (err) {
      if (err.message === 'UNAUTHORIZED') {
        const refreshed = await refreshAccessToken()
        if (refreshed) {
          try {
            const result = await clientService.addPurchase(clientDbId, price, items, paymentMethod, employeeDiscount, mixedParts)
            await loadClients(page, limit, search)
            return { success: true, result }
          } catch (retryErr) {
            return { success: false, error: retryErr.message }
          }
        }
        return { success: false, error: 'Сессия истекла. Пожалуйста, войдите снова.' }
      }
      return { success: false, error: err.message }
    }
  }

  return {
    clients,
    loading,
    error,
    pagination,
    loadClients,
    addClient,
    addPurchase
  }
}
