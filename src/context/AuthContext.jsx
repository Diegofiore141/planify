import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../services/firebase'

const AuthContext = createContext(null)

// Stato auth condiviso da tutte le pagine protette.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Rilegge Firebase Auth quando serve sapere se l'email e' stata verificata.
  async function refreshUser() {
    const currentUser = auth.currentUser

    if (!currentUser) {
      setUser(null)
      return null
    }

    try {
      await currentUser.reload()
      setUser(auth.currentUser)
      return auth.currentUser
    } catch (error) {
      console.error('Errore aggiornamento utente:', error)
      setUser(auth.currentUser)
      return auth.currentUser
    }
  }

  // Mantiene sincronizzato lo stato utente con Firebase.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        setUser(null)
        setLoading(false)
        return
      }

      try {
        await currentUser.reload()
        setUser(auth.currentUser)
      } catch (error) {
        console.error('Errore caricamento utente:', error)
        setUser(currentUser)
      } finally {
        setLoading(false)
      }
    })

    return () => unsubscribe()
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

// Hook comodo per leggere utente, loading e refreshUser.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext)
}
