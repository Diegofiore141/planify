import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth'
import { auth } from '../services/firebase'

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
        email,
        password
      )

      await updateProfile(userCredential.user, {
        displayName: name,
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
    <main className="auth-page">
      <section className="auth-card">
        <h1>Registrati</h1>
        <p>Crea il tuo account Planify.</p>

        <form className="auth-form" onSubmit={handleRegister}>
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
          className="btn btn-google"
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
    </main>
  )
}

export default Register