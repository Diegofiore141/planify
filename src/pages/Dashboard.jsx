import { Link, useNavigate } from 'react-router'
import { signOut } from 'firebase/auth'
import { auth } from '../services/firebase'
import { useAuth } from '../context/AuthContext'

function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()

  async function handleLogout() {
    await signOut(auth)
    navigate('/')
  }

  return (
    <main className="dashboard-page">
      <section className="dashboard-card">
        <h1>Dashboard</h1>

        <p>Benvenuto {user?.displayName || user?.email || 'utente'}.</p>

        <p>
          Questa sarà l’area personale dove verranno mostrati eventi, scadenze,
          attività e notifiche.
        </p>

        <div className="dashboard-actions">
          <Link to="/events" className="btn btn-primary">
            Gestisci eventi
          </Link>

          <Link to="/tasks" className="btn btn-primary">
            Gestisci attività
          </Link>

          <Link to="/notifications" className="btn btn-primary">
            Notifiche
          </Link>

          <button className="btn btn-primary" onClick={handleLogout}>
            Esci
          </button>

          <Link to="/" className="btn btn-secondary">
            Torna alla home
          </Link>
        </div>
      </section>
    </main>
  )
}

export default Dashboard