import { Link } from 'react-router'

function Register() {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <h1>Registrati</h1>
        <p>Crea il tuo account Planify.</p>

        <form className="auth-form">
          <label>
            Nome
            <input type="text" placeholder="Inserisci il tuo nome" />
          </label>

          <label>
            Email
            <input type="email" placeholder="Inserisci la tua email" />
          </label>

          <label>
            Password
            <input type="password" placeholder="Crea una password" />
          </label>

          <button type="submit" className="btn btn-primary">
            Crea account
          </button>
        </form>

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