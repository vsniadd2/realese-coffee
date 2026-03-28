import { useState, useEffect, useRef } from 'react'
import { clientService } from '../services/clientService'
import { useAuth } from '../contexts/AuthContext'

export const useClientCheck = (clientId, price) => {
  const [clientInfo, setClientInfo] = useState(null)
  const [loading, setLoading] = useState(false)
  const { refreshAccessToken } = useAuth()
  const abortControllerRef = useRef(null)
  const cacheRef = useRef(new Map())

  useEffect(() => {
    if (!clientId) {
      setClientInfo(null)
      return
    }

    const checkClient = async () => {
      try {
        // Отменяем предыдущий запрос
        if (abortControllerRef.current) {
          abortControllerRef.current.abort()
        }
        abortControllerRef.current = new AbortController()

        // Проверяем кэш
        if (cacheRef.current.has(clientId)) {
          const cached = cacheRef.current.get(clientId)
          const age = Date.now() - cached.timestamp
          // Используем кэш, если данные свежие (< 3 секунд)
          if (age < 3000) {
            setClientInfo(cached.data)
            return
          }
        }

        setLoading(true)
        const client = await clientService.getById(clientId)
        
        // Обновляем состояние плавно
        requestAnimationFrame(() => {
          setClientInfo(client)
          // Сохраняем в кэш
          cacheRef.current.set(clientId, {
            data: client,
            timestamp: Date.now()
          })
        })
      } catch (err) {
        if (err.name === 'AbortError') {
          return
        }
        if (err.message === 'UNAUTHORIZED') {
          await refreshAccessToken()
        }
        setClientInfo(null)
      } finally {
        setLoading(false)
      }
    }

    checkClient()

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [clientId, refreshAccessToken])

  const calculateDiscount = () => {
    if (!price || price <= 0) return null

    // Скидка только при статусе GOLD (GOLD даётся при общей сумме заказов >= 500)
    const status = clientInfo?.status || 'standart'
    const hasDiscount = status === 'gold'

    if (hasDiscount) {
      return {
        hasDiscount: true,
        originalPrice: price,
        finalPrice: price * 0.9,
        discount: 10
      }
    }

    return null
  }

  return {
    clientInfo,
    loading,
    discountInfo: calculateDiscount()
  }
}
