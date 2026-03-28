import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * Хук для оптимизированной загрузки данных без визуальных скачков
 * @param {Function} fetchFn - Функция для загрузки данных
 * @param {Array} deps - Зависимости для перезагрузки
 * @param {Object} options - Опции: { cacheKey, silentRefresh, debounceMs }
 */
export const useOptimizedData = (fetchFn, deps = [], options = {}) => {
  const {
    cacheKey = null,
    silentRefresh = true,
    debounceMs = 300
  } = options

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const isInitialLoadRef = useRef(true)
  const abortControllerRef = useRef(null)
  const debounceTimerRef = useRef(null)
  const cacheRef = useRef(new Map())

  const loadData = useCallback(async (silent = false) => {
    try {
      // Отменяем предыдущий запрос
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      abortControllerRef.current = new AbortController()

      // Проверяем кэш
      if (cacheKey && cacheRef.current.has(cacheKey)) {
        const cached = cacheRef.current.get(cacheKey)
        const age = Date.now() - cached.timestamp
        // Используем кэш, если данные свежие (< 5 секунд)
        if (age < 5000) {
          setData(cached.data)
          if (isInitialLoadRef.current) {
            setLoading(false)
            isInitialLoadRef.current = false
          }
          return
        }
      }

      // Показываем loading только при первой загрузке
      if (!silent && isInitialLoadRef.current) {
        setLoading(true)
      } else if (!silent && !isInitialLoadRef.current) {
        setIsRefreshing(true)
      }

      setError(null)

      const result = await fetchFn(abortControllerRef.current.signal)

      // Проверяем, не был ли запрос отменен
      if (abortControllerRef.current?.signal.aborted) {
        return
      }

      // Обновляем данные плавно
      requestAnimationFrame(() => {
        setData(result)
        
        // Сохраняем в кэш
        if (cacheKey) {
          cacheRef.current.set(cacheKey, {
            data: result,
            timestamp: Date.now()
          })
        }
      })

      isInitialLoadRef.current = false

    } catch (err) {
      if (err.name === 'AbortError') {
        return
      }
      setError(err.message || 'Ошибка загрузки данных')
    } finally {
      if (!silent) {
        setLoading(false)
        setIsRefreshing(false)
      }
    }
  }, [fetchFn, cacheKey, ...deps])

  // Дебаунс загрузки
  const debouncedLoad = useCallback((silent = false) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    if (debounceMs > 0 && !isInitialLoadRef.current) {
      debounceTimerRef.current = setTimeout(() => {
        loadData(silent)
      }, debounceMs)
    } else {
      loadData(silent)
    }
  }, [loadData, debounceMs])

  useEffect(() => {
    debouncedLoad(false)

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [debouncedLoad])

  const refresh = useCallback((silent = silentRefresh) => {
    loadData(silent)
  }, [loadData, silentRefresh])

  return {
    data,
    loading,
    error,
    isRefreshing,
    refresh
  }
}
