import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import {
  GoogleAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth'

import { auth } from '../services/firebase'
import logo from '../assets/logo.png'
import SoftAuroraBackground from '../components/SoftAuroraBackground'

// Validazione input e messaggi leggibili per errori Firebase Auth.
function normalizeEmail(email) {
  return email.trim().toLowerCase()
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function getFirebaseLoginErrorMessage(error) {
  if (
    error.code === 'auth/invalid-credential' ||
    error.code === 'auth/user-not-found' ||
    error.code === 'auth/wrong-password'
  ) {
    return 'Email o password non corretti.'
  }

  if (error.code === 'auth/invalid-email') {
    return 'Email non valida. Controlla di averla scritta correttamente.'
  }

  if (error.code === 'auth/network-request-failed') {
    return 'Problema di connessione. Controlla internet e riprova.'
  }

  if (error.code === 'auth/too-many-requests') {
    return 'Troppi tentativi. Aspetta qualche minuto e riprova.'
  }

  if (error.code === 'auth/popup-closed-by-user') {
    return 'Accesso con Google annullato.'
  }

  if (error.code === 'auth/cancelled-popup-request') {
    return 'Accesso con Google annullato.'
  }

  if (error.code === 'auth/popup-blocked') {
    return 'Il popup di Google è stato bloccato dal browser.'
  }

  return 'Errore durante l’accesso. Riprova.'
}

function getFirebaseResetPasswordErrorMessage(error) {
  if (error.code === 'auth/invalid-email') {
    return 'Email non valida. Controlla di averla scritta correttamente.'
  }

  if (error.code === 'auth/user-not-found') {
    return 'Non esiste nessun account associato a questa email.'
  }

  if (error.code === 'auth/network-request-failed') {
    return 'Problema di connessione. Controlla internet e riprova.'
  }

  if (error.code === 'auth/too-many-requests') {
    return 'Troppi tentativi. Aspetta qualche minuto e riprova.'
  }

  return 'Errore durante l’invio dell’email di recupero password.'
}

function Login() {
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(location.state?.error || '')
  const [successMessage, setSuccessMessage] = useState(
    location.state?.message || ''
  )
  const [loading, setLoading] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [verificationLoading, setVerificationLoading] = useState(false)

  // Usato quando l'utente richiede un nuovo link di verifica email.
  function validateEmailAndPasswordForVerification() {
    const cleanEmail = normalizeEmail(email)

    if (!cleanEmail) {
      return 'Inserisci la tua email.'
    }

    if (!isValidEmail(cleanEmail)) {
      return 'Email non valida. Inserisci un indirizzo email corretto.'
    }

    if (!password) {
      return 'Inserisci la password.'
    }

    return ''
  }

  // Login classico: blocca l'accesso se l'email non e' verificata.
  async function handleLogin(event) {
    event.preventDefault()

    if (loading || resetLoading || verificationLoading) return

    setError('')
    setSuccessMessage('')

    const cleanEmail = normalizeEmail(email)

    if (!cleanEmail) {
      setError('Inserisci la tua email.')
      return
    }

    if (!isValidEmail(cleanEmail)) {
      setError('Email non valida. Inserisci un indirizzo email corretto.')
      return
    }

    if (!password) {
      setError('Inserisci la password.')
      return
    }

    setLoading(true)

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        cleanEmail,
        password
      )

      await userCredential.user.reload()

      if (!userCredential.user.emailVerified) {
        await signOut(auth)

        setError(
          'Devi verificare la tua email prima di accedere. Controlla la mail ricevuta dopo la registrazione oppure richiedi un nuovo link.'
        )

        return
      }

      navigate('/dashboard')
    } catch (loginError) {
      console.error(loginError)
      setError(getFirebaseLoginErrorMessage(loginError))
    } finally {
      setLoading(false)
    }
  }

  // Reinvia la mail di verifica dopo aver confermato email e password.
  async function handleResendVerificationEmail() {
    if (loading || resetLoading || verificationLoading) return

    setError('')
    setSuccessMessage('')

    const validationError = validateEmailAndPasswordForVerification()

    if (validationError) {
      setError(validationError)
      return
    }

    setVerificationLoading(true)

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        normalizeEmail(email),
        password
      )

      await userCredential.user.reload()

      if (userCredential.user.emailVerified) {
        await signOut(auth)

        setSuccessMessage(
          'Questa email risulta già verificata. Ora puoi accedere normalmente.'
        )

        return
      }

      await sendEmailVerification(userCredential.user)
      await signOut(auth)

      setSuccessMessage(
        'Ti abbiamo inviato un nuovo link di verifica. Usa l’ultima email ricevuta e controlla anche spam o posta indesiderata.'
      )
    } catch (verificationError) {
      console.error(verificationError)
      setError(getFirebaseLoginErrorMessage(verificationError))
    } finally {
      setVerificationLoading(false)
    }
  }

  // Invia la mail Firebase per reimpostare la password.
  async function handlePasswordReset() {
    if (loading || resetLoading || verificationLoading) return

    setError('')
    setSuccessMessage('')

    const cleanEmail = normalizeEmail(email)

    if (!cleanEmail) {
      setError('Inserisci la tua email per recuperare la password.')
      return
    }

    if (!isValidEmail(cleanEmail)) {
      setError('Email non valida. Inserisci un indirizzo email corretto.')
      return
    }

    setResetLoading(true)

    try {
      await sendPasswordResetEmail(auth, cleanEmail)

      setSuccessMessage(
        'Ti abbiamo inviato una email per reimpostare la password.'
      )
    } catch (resetError) {
      console.error(resetError)
      setError(getFirebaseResetPasswordErrorMessage(resetError))
    } finally {
      setResetLoading(false)
    }
  }

  // Login rapido tramite account Google.
  async function handleGoogleLogin() {
    if (loading || resetLoading || verificationLoading) return

    setError('')
    setSuccessMessage('')
    setLoading(true)

    try {
      const provider = new GoogleAuthProvider()
      await signInWithPopup(auth, provider)
      navigate('/dashboard')
    } catch (googleError) {
      console.error(googleError)
      setError(getFirebaseLoginErrorMessage(googleError))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-page auth-page-v2">
      <SoftAuroraBackground />

      <section className="auth-v2-shell">
        <div className="auth-v2-info">
          <Link to="/" className="auth-v2-logo">
            <img src={logo} alt="Logo Planify" />
            <span>Planify</span>
          </Link>

          <span className="auth-v2-badge">Bentornato</span>

          <h1>Accedi alla tua area personale.</h1>

          <p>
            Entra in Planify per gestire eventi, attività, calendario,
            notifiche e partecipazioni agli eventi pubblici.
          </p>

          <div className="auth-v2-preview">
            <div>
              <strong>📅 Calendario</strong>
              <span>Eventi e task in un’unica vista</span>
            </div>

            <div>
              <strong>🌍 Eventi pubblici</strong>
              <span>Scopri e aggiungi eventi alla tua agenda</span>
            </div>

            <div>
              <strong>🔔 Promemoria</strong>
              <span>Notifiche locali per i tuoi impegni</span>
            </div>
          </div>
        </div>

        <section className="auth-card auth-card-v2">
          <div className="auth-card-v2-header">
            <span>Accesso</span>
            <h2>Accedi</h2>
            <p>Inserisci le tue credenziali per continuare.</p>
          </div>

          <form className="auth-form auth-form-v2" onSubmit={handleLogin}>
            <label>
              Email
              <input
                type="email"
                placeholder="Inserisci la tua email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                disabled={loading || resetLoading || verificationLoading}
                required
              />
            </label>

            <label>
              Password
              <input
                type="password"
                placeholder="Inserisci la tua password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                disabled={loading || resetLoading || verificationLoading}
                required
              />
            </label>

            <div className="auth-inline-actions">
              <button
                type="button"
                className="auth-small-action"
                onClick={handlePasswordReset}
                disabled={loading || resetLoading || verificationLoading}
              >
                {resetLoading ? 'Invio email...' : 'Password dimenticata?'}
              </button>

              <button
                type="button"
                className="auth-small-action"
                onClick={handleResendVerificationEmail}
                disabled={loading || resetLoading || verificationLoading}
              >
                {verificationLoading
                  ? 'Invio link...'
                  : 'Reinvia email di verifica'}
              </button>
            </div>

            {successMessage && (
              <p className="success-message">{successMessage}</p>
            )}

            {error && <p className="error-message">{error}</p>}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || resetLoading || verificationLoading}
            >
              {loading ? 'Accesso in corso...' : 'Accedi'}
            </button>
          </form>

          <div className="auth-divider">
            <span>oppure</span>
          </div>

          <button
            type="button"
            className="btn btn-google auth-google-button"
            onClick={handleGoogleLogin}
            disabled={loading || resetLoading || verificationLoading}
          >
            Continua con Google
          </button>

          <p className="auth-link">
            Non hai un account? <Link to="/register">Registrati</Link>
          </p>

          <Link to="/" className="back-home">
            Torna alla home
          </Link>
        </section>
      </section>
    </main>
  )
}

export default Login
