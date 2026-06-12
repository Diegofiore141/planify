import { Link } from 'react-router'

function Dashboard() {
  return (
    <main className="dashboard-page">
      <section className="dashboard-card">
        <h1>Dashboard</h1>

        <p>
          Questa sarà l’area personale dell’utente, dove verranno mostrati
          eventi, scadenze, attività e notifiche.
        </p>

        <Link to="/" className="btn btn-secondary">
          Torna alla home
        </Link>
      </section>
    </main>
  )
}

export default Dashboard
