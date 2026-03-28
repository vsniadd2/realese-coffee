import React, { createContext, useContext, useState, useEffect } from 'react'
import { authService } from '../services/authService'
import { isAccessTokenExpired } from '../config/api'

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
  const [accessToken, setAccessToken] = useState(localStorage.getItem('accessToken'))
  const [refreshToken, setRefreshToken] = useState(localStorage.getItem('refreshToken'))
  const [loading, setLoading] = useState(true)
  const [showHelloAfterLogin, setShowHelloAfterLogin] = useState(false)

  useEffect(() => {
    if (accessToken) {
      try {
        const stored = localStorage.getItem('userInfo')
        if (stored) {
          setUser(JSON.parse(stored))
        } else {
          setUser({ token: accessToken })
        }
      } catch {
        setUser({ token: accessToken })
      }
    }
    setLoading(false)
  }, [])

  const login = async (username, password) => {
    try {
      const data = await authService.login(username, password)
      
      setAccessToken(data.accessToken)
      setRefreshToken(data.refreshToken)
      setUser(data.user)
      setShowHelloAfterLogin(true)
      
      localStorage.setItem('accessToken', data.accessToken)
      localStorage.setItem('refreshToken', data.refreshToken)
      if (data.user) localStorage.setItem('userInfo', JSON.stringify(data.user))
      
      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  const clearShowHello = () => setShowHelloAfterLogin(false)

  const logout = () => {
    setAccessToken(null)
    setRefreshToken(null)
    setUser(null)
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('userInfo')
  }

  const refreshAccessToken = async () => {
    const rtk = refreshToken || localStorage.getItem('refreshToken')
    if (!rtk) {
      logout()
      return false
    }

    try {
      const data = await authService.refreshToken(rtk)
      setAccessToken(data.accessToken)
      setRefreshToken(rtk)
      localStorage.setItem('accessToken', data.accessToken)
      if (data.user) {
        setUser(prev => {
          const merged = { ...prev, ...data.user }
          localStorage.setItem('userInfo', JSON.stringify(merged))
          return merged
        })
      }
      return true
    } catch (error) {
      logout()
      return false
    }
  }

  /** Обновляет access token, если он истёк (чтобы не получать 403 при запросах) */
  const ensureValidToken = async () => {
    const token = localStorage.getItem('accessToken')
    if (!token) return
    if (!isAccessTokenExpired(token)) return
    await refreshAccessToken()
  }

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
