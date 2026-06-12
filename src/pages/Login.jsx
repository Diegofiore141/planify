import { Link } from 'react-router'

function Login() {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <h1>Accedi</h1>
        <p>Entra nel tuo account Planify.</p>

        <form className="auth-form">
          <label>
            Email
            <input type="email" placeholder="Inserisci la tua email" />
          </label>

          <label>
            Password
            <input type="password" placeholder="Inserisci la tua password" />
          </label>

          <button type="submit" className="btn btn-primary">
            Accedi
          </button>
        </form>

        <p className="auth-link">
          Non hai un account? <Link to="/register">Registrati</Link>
        </p>

        <Link to="/" className="back-home">
          Torna alla home
        </Link>
      </section>
    </main>
  )
}

export default Login