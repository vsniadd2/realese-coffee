import React, { createContext, useContext, useState, useCallback, useRef } from 'react'
import './NotificationProvider.css'

const NotificationContext = createContext(null)

export const useNotification = () => {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider')
  }
  return context
}

const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([])
  const timeoutsRef = useRef(new Map())

  const showNotification = useCallback((message, type = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const notification = { id, message, type }

    setNotifications(prev => [...prev, notification])

    const timeoutId = setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id))
      timeoutsRef.current.delete(id)
    }, 3000)
    timeoutsRef.current.set(id, timeoutId)
  }, [])

  const dismissNotification = useCallback((id) => {
    const timeoutId = timeoutsRef.current.get(id)
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutsRef.current.delete(id)
    }
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  const getIcon = (type) => {
    if (type === 'success') return '✓'
    if (type === 'error') return '!'
    return 'i'
  }

  return (
    <NotificationContext.Provider value={{ showNotification }}>
      {children}
      <div className="notifications-container">
        {notifications.map(notification => (
          <div
            key={notification.id}
            className={`notification ${notification.type}`}
          >
            <div className="notification-inner">
              <div className={`notification-icon ${notification.type}`}>{getIcon(notification.type)}</div>
              <div className="notification-message">{notification.message}</div>
              <button
                type="button"
                className="notification-close"
                onClick={() => dismissNotification(notification.id)}
                aria-label="Закрыть уведомление"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  )
}

export default NotificationProvider
