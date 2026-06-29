import { useEffect, useState } from 'react'
import { Navigate } from 'react-router'
import { signOut } from 'firebase/auth'

import { useAuth } from '../context/AuthContext'
import { auth } from '../services/firebase'

function ProtectedRoute({ children }) {
  const { user, loading, refreshUser } = useAuth()
  const [checkingVerification, setCheckingVerification] = useState(true)
  const [isVerified, setIsVerified] = useState(false)

  useEffect(() => {
    async function checkEmailVerification() {
      if (loading) return

      if (!user) {
        setIsVerified(false)
        setCheckingVerification(false)
        return
      }

      try {
        const refreshedUser = await refreshUser()

        if (refreshedUser?.emailVerified) {
          setIsVerified(true)
        } else {
          setIsVerified(false)
          await signOut(auth)
        }
      } catch (error) {
        console.error('Errore controllo verifica email:', error)
        setIsVerified(false)
        await signOut(auth)
      } finally {
        setCheckingVerification(false)
      }
    }

    checkEmailVerification()
  }, [user, loading, refreshUser])

  if (loading || checkingVerification) {
    return (
      <main className="dashboard-page">
        <section className="dashboard-card">
          <p>Caricamento...</p>
        </section>
      </main>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (!isVerified) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          error: 'Devi verificare la tua email prima di accedere a Planify.',
        }}
      />
    )
  }

  return children
}

export default ProtectedRoute