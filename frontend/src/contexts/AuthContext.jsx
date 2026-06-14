import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authService } from '../services/authService'
import { isAccessTokenExpired } from '../config/api'
import {
  getAccessToken,
  getRefreshToken,
  getUserInfo,
  saveAuthData,
  updateAccessToken,
  clearAuthData
} from '../utils/authStorage'

const AuthContext = createContext(null)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [accessToken, setAccessToken] = useState(getAccessToken)
  const [refreshToken, setRefreshToken] = useState(getRefreshToken)
  const [loading, setLoading] = useState(true)
  const [showHelloAfterLogin, setShowHelloAfterLogin] = useState(false)

  const logout = useCallback(() => {
    setAccessToken(null)
    setRefreshToken(null)
    setUser(null)
    clearAuthData()
  }, [])

  const refreshAccessToken = useCallback(async () => {
    const rtk = getRefreshToken()
    if (!rtk) {
      logout()
      return false
    }

    try {
      const data = await authService.refreshToken(rtk)
      setAccessToken(data.accessToken)
      setRefreshToken(rtk)
      if (data.user) {
        setUser(prev => {
          const merged = { ...prev, ...data.user }
          updateAccessToken(data.accessToken, merged)
          return merged
        })
      } else {
        updateAccessToken(data.accessToken)
      }
      return true
    } catch {
      logout()
      return false
    }
  }, [logout])

  /** До первого рендера приложения — иначе /api/* уходит с просроченным JWT и даёт 403 */
  const ensureValidToken = useCallback(async () => {
    const token = getAccessToken()
    if (!token) return
    if (!isAccessTokenExpired(token)) return
    await refreshAccessToken()
  }, [refreshAccessToken])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const at = getAccessToken()
      if (at) {
        try {
          const stored = getUserInfo()
          if (stored) {
            setUser(JSON.parse(stored))
          } else {
            setUser({ token: at })
          }
        } catch {
          setUser({ token: at })
        }
        await ensureValidToken()
      }
      if (!cancelled) {
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [ensureValidToken])

  // Продлеваем сессию, пока вкладка открыта (access token живёт ~24 ч)
  useEffect(() => {
    if (!accessToken) return

    const refreshIfNeeded = () => {
      const token = getAccessToken()
      if (token && isAccessTokenExpired(token)) {
        refreshAccessToken()
      }
    }

    refreshIfNeeded()
    const intervalId = setInterval(refreshIfNeeded, 2 * 60 * 1000)

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        ensureValidToken()
      }
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [accessToken, refreshAccessToken, ensureValidToken])

  const login = async (username, password, rememberMe = true) => {
    try {
      const data = await authService.login(username, password)
      
      setAccessToken(data.accessToken)
      setRefreshToken(data.refreshToken)
      setUser(data.user)
      setShowHelloAfterLogin(true)
      
      saveAuthData(
        {
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          user: data.user
        },
        rememberMe
      )
      
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  const clearShowHello = () => setShowHelloAfterLogin(false)

  const value = {
    user,
    accessToken,
    isAuthenticated: !!accessToken,
    login,
    logout,
    refreshAccessToken,
    ensureValidToken,
    loading,
    showHelloAfterLogin,
    clearShowHello
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
