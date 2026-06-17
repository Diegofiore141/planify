import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router'
import './App.css'

import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'

import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Events from './pages/Events'
import Tasks from './pages/Tasks'
import Offline from './pages/Offline'
import Notifications from './pages/Notifications'

function App() {
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    async function checkConnection() {
      if (!navigator.onLine) {
        setIsOnline(false)
        return
      }

      try {
        await fetch(`/online-check.txt?time=${Date.now()}`, {
          cache: 'no-store',
        })

        setIsOnline(true)
      } catch (error) {
        setIsOnline(false)
      }
    }

    function handleOnline() {
      checkConnection()
    }

    function handleOffline() {
      setIsOnline(false)
    }

    checkConnection()

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    const intervalId = setInterval(checkConnection, 3000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(intervalId)
    }
  }, [])

  if (!isOnline) {
    return <Offline />
  }

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/events"
            element={
              <ProtectedRoute>
                <Events />
              </ProtectedRoute>
            }
          />

          <Route
            path="/tasks"
            element={
              <ProtectedRoute>
                <Tasks />
              </ProtectedRoute>
            }
          />

          <Route
            path="/notifications"
            element={
              <ProtectedRoute>
                <Notifications />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App