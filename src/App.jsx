import { Component, useEffect, useRef, useState } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router'
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
import Calendar from './pages/Calendar'
import ExploreEvents from './pages/ExploreEvents'
import Notes from './pages/Notes'
import { checkOnlineConnection } from './services/connection'

// Cattura errori di una pagina senza bloccare tutta l'app.
class PageErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = {
      hasError: false,
      errorMessage: '',
    }
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message || 'Errore sconosciuto',
    }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Errore nella pagina:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="dashboard-page notes-v4-page">
          <section className="notes-v4-shell">
            <div className="notes-v4-empty-document">
              <h2>Qualcosa è andato storto</h2>
              <p>
                La pagina ha avuto un errore durante il caricamento, ma
                l’applicazione non è bloccata.
              </p>

              <p className="notes-v4-feedback error-feedback">
                {this.state.errorMessage}
              </p>

              <button
                type="button"
                className="btn btn-primary"
                onClick={() => window.location.reload()}
              >
                Ricarica pagina
              </button>
            </div>
          </section>
        </main>
      )
    }

    return this.props.children
  }
}

// Riporta la pagina in alto a ogni cambio rotta.
function ScrollToTop() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'auto',
    })
  }, [pathname])

  return null
}

function App() {
  const [isOnline, setIsOnline] = useState(true)
  const failedConnectionChecksRef = useRef(0)

  // Controllo online/offline usato per mostrare il fallback PWA.
  useEffect(() => {
    async function checkConnection() {
      if (!navigator.onLine) {
        failedConnectionChecksRef.current = 2
        setIsOnline(false)
        return
      }

      const connectionWorks = await checkOnlineConnection()

      if (connectionWorks) {
        failedConnectionChecksRef.current = 0
        setIsOnline(true)
        return
      }

      failedConnectionChecksRef.current += 1

      if (failedConnectionChecksRef.current >= 2) {
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
    return (
      <Offline
        onReconnect={() => {
          failedConnectionChecksRef.current = 0
          setIsOnline(true)
        }}
      />
    )
  }

  // Le rotte protette passano dal controllo login e verifica email.
  return (
    <AuthProvider>
      <BrowserRouter>
        <ScrollToTop />

        <PageErrorBoundary>
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

            <Route
              path="/calendar"
              element={
                <ProtectedRoute>
                  <Calendar />
                </ProtectedRoute>
              }
            />

            <Route
              path="/explore"
              element={
                <ProtectedRoute>
                  <ExploreEvents />
                </ProtectedRoute>
              }
            />

            <Route
              path="/notes"
              element={
                <ProtectedRoute>
                  <Notes />
                </ProtectedRoute>
              }
            />
          </Routes>
        </PageErrorBoundary>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
