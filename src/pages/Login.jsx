import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import {
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth'

import { auth } from '../services/firebase'
import logo from '../assets/logo.png'
import SoftAuroraBackground from '../components/SoftAuroraBackground'

function Login() {
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(event) {
    event.preventDefault()

    setError('')
    setLoading(true)

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password)
      navigate('/dashboard')
    } catch (error) {
      console.error(error)
      setError('Email o password non corretti.')
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleLogin() {
    setError('')
    setLoading(true)

    try {
      const provider = new GoogleAuthProvider()
      await signInWithPopup(auth, provider)
      navigate('/dashboard')
    } catch (error) {
      console.error(error)
      setError('Errore durante l’accesso con Google.')
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
                required
              />
            </label>

            {error && <p className="error-message">{error}</p>}

            <button type="submit" className="btn btn-primary" disabled={loading}>
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
            disabled={loading}
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