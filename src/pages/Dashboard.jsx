import { Link, useNavigate } from 'react-router'
import { signOut } from 'firebase/auth'
import { auth } from '../services/firebase'

function Dashboard() {
  const navigate = useNavigate()
  const user = auth.currentUser

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