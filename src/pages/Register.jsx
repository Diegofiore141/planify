import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendEmailVerification,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth'

import { auth } from '../services/firebase'
import logo from '../assets/logo.png'
import SoftAuroraBackground from '../components/SoftAuroraBackground'

// Validazione base e traduzione degli errori Firebase.
function normalizeEmail(email) {
  return email.trim().toLowerCase()
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function getFirebaseRegisterErrorMessage(error) {
  if (error.code === 'auth/email-already-in-use') {
    return 'Questa email è già registrata. Prova ad accedere.'
  }

  if (error.code === 'auth/invalid-email') {
    return 'Email non valida. Controlla di averla scritta correttamente.'
  }

  if (error.code === 'auth/weak-password') {
    return 'La password è troppo debole. Usa almeno 6 caratteri.'
  }

  if (error.code === 'auth/network-request-failed') {
    return 'Problema di connessione. Controlla internet e riprova.'
  }

  if (error.code === 'auth/popup-closed-by-user') {
    return 'Registrazione con Google annullata.'
  }

  if (error.code === 'auth/cancelled-popup-request') {
    return 'Registrazione con Google annullata.'
  }

  if (error.code === 'auth/popup-blocked') {
    return 'Il popup di Google è stato bloccato dal browser.'
  }

  if (error.code === 'auth/too-many-requests') {
    return 'Troppi tentativi. Aspetta qualche minuto e riprova.'
  }

  return 'Errore durante la registrazione. Controlla email e password.'
}

function Register() {
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Controlla i campi prima di creare l'utente su Firebase.
  function validateRegisterForm() {
    const cleanName = name.trim()
    const cleanEmail = normalizeEmail(email)

    if (!cleanName) {
      return 'Inserisci il tuo nome.'
    }

    if (cleanName.length < 2) {
      return 'Il nome deve contenere almeno 2 caratteri.'
    }

    if (!cleanEmail) {
      return 'Inserisci la tua email.'
    }

    if (cleanEmail.includes(' ')) {
      return 'L’email non può contenere spazi.'
    }

    if (!isValidEmail(cleanEmail)) {
      return 'Email non valida. Inserisci un indirizzo email corretto.'
    }

    if (!password) {
      return 'Inserisci una password.'
    }

    if (password.length < 6) {
      return 'La password deve contenere almeno 6 caratteri.'
    }

    if (!confirmPassword) {
      return 'Conferma la password.'
    }

    if (password !== confirmPassword) {
      return 'Le password non coincidono.'
    }

    return ''
  }

  // Crea account email/password, invia verifica e forza il login dopo conferma.
  async function handleRegister(event) {
    event.preventDefault()

    if (loading) return

    setError('')

    const validationError = validateRegisterForm()

    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)

    let createdUser = null

    try {
      const cleanName = name.trim()
      const cleanEmail = normalizeEmail(email)

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        cleanEmail,
        password
      )

      createdUser = userCredential.user

      await updateProfile(createdUser, {
        displayName: cleanName,
      })

      await sendEmailVerification(createdUser)

      await signOut(auth)

      navigate('/login', {
        state: {
          message:
            'Account creato. Controlla la tua email e conferma il tuo indirizzo prima di accedere. Se non trovi la mail, controlla anche spam o posta indesiderata.',
        },
      })
    } catch (registerError) {
      console.error(registerError)

      if (createdUser) {
        await signOut(auth)
      }

      setError(getFirebaseRegisterErrorMessage(registerError))
    } finally {
      setLoading(false)
    }
  }

  // Registrazione rapida tramite popup Google.
  async function handleGoogleRegister() {
    if (loading) return

    setError('')
    setLoading(true)

    try {
      const provider = new GoogleAuthProvider()
      await signInWithPopup(auth, provider)
      navigate('/dashboard')
    } catch (googleError) {
      console.error(googleError)
      setError(getFirebaseRegisterErrorMessage(googleError))
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
                autoComplete="name"
                disabled={loading}
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
                autoComplete="email"
                disabled={loading}
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
                autoComplete="new-password"
                disabled={loading}
                required
                minLength="6"
              />
            </label>

            <label>
              Conferma password
              <input
                type="password"
                placeholder="Ripeti la password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                disabled={loading}
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
