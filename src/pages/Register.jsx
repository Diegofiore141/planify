import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth'

import { auth } from '../services/firebase'
import logo from '../assets/logo.png'
import SoftAuroraBackground from '../components/SoftAuroraBackground'

function Register() {
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleRegister(event) {
    event.preventDefault()

    setError('')
    setLoading(true)

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      )

      await updateProfile(userCredential.user, {
        displayName: name.trim(),
      })

      navigate('/dashboard')
    } catch (error) {
      console.error(error)
      setError('Errore durante la registrazione. Controlla email e password.')
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleRegister() {
    setError('')
    setLoading(true)

    try {
      const provider = new GoogleAuthProvider()
      await signInWithPopup(auth, provider)
      navigate('/dashboard')
    } catch (error) {
      console.error(error)
      setError('Errore durante la registrazione con Google.')
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

          <span className="auth-v2-badge">Nuovo account</span>

          <h1>Crea il tuo spazio personale.</h1>

          <p>
            Registrati per organizzare eventi privati, pubblicare eventi,
            gestire attività e visualizzare tutto nel calendario.
          </p>

          <div className="auth-v2-preview">
            <div>
              <strong>🔐 Area personale</strong>
              <span>I tuoi dati restano separati dagli altri utenti</span>
            </div>

            <div>
              <strong>🌍 Interazione</strong>
              <span>Pubblica eventi e gestisci partecipanti</span>
            </div>

            <div>
              <strong>📲 PWA</strong>
              <span>App installabile con supporto offline</span>
            </div>
          </div>
        </div>

        <section className="auth-card auth-card-v2">
          <div className="auth-card-v2-header">
            <span>Registrazione</span>
            <h2>Crea account</h2>
            <p>Compila i dati per iniziare a usare Planify.</p>
          </div>

          <form className="auth-form auth-form-v2" onSubmit={handleRegister}>
            <label>
              Nome
              <input
                type="text"
                placeholder="Inserisci il tuo nome"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </label>

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
                placeholder="Crea una password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength="6"
              />
            </label>

            {error && <p className="error-message">{error}</p>}

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creazione account...' : 'Crea account'}
            </button>
          </form>

          <div className="auth-divider">
            <span>oppure</span>
          </div>

          <button
            type="button"
            className="btn btn-google auth-google-button"
            onClick={handleGoogleRegister}
            disabled={loading}
          >
            Registrati con Google
          </button>

          <p className="auth-link">
            Hai già un account? <Link to="/login">Accedi</Link>
          </p>

          <Link to="/" className="back-home">
            Torna alla home
          </Link>
        </section>
      </section>
    </main>
  )
}

export default Register