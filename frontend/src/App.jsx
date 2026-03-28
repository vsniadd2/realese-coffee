import React from 'react'
import { AuthProvider } from './contexts/AuthContext'
import { DataRefreshProvider } from './contexts/DataRefreshContext'
import AppRouter from './components/AppRouter'
import NotificationProvider from './components/NotificationProvider'

function App() {
  return (
    <AuthProvider>
      <DataRefreshProvider>
        <NotificationProvider>
          <AppRouter />
        </NotificationProvider>
      </DataRefreshProvider>
    </AuthProvider>
  )
}

export default App
