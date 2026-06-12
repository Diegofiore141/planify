import { useState } from 'react'
import { Link } from 'react-router'
import logo from '../assets/logo.png'

const previewDays = [
  {
    title: 'Ieri',
    tasks: [
      {
        icon: '✓',
        title: 'Riunione completata',
        description: 'Attività conclusa correttamente',
        completed: true,
      },
      {
        icon: '✓',
        title: 'Spesa settimanale',
        description: 'Promemoria completato',
        completed: true,
      },
      {
        icon: '☁',
        title: 'Passeggiata serale',
        description: 'Meteo consultato',
        completed: false,
      },
    ],
  },
  {
    title: 'Oggi',
    tasks: [
      {
        icon: '✓',
        title: 'Lezione',
        description: 'Completata',
        completed: true,
      },
      {
        icon: '!',
        title: 'Consegna progetto',
        description: 'Scadenza alle 18:00',
        completed: false,
      },
      {
        icon: '☁',
        title: 'Evento all’aperto',
        description: 'Meteo disponibile',
        completed: false,
      },
    ],
  },
  {
    title: 'Domani',
    tasks: [
      {
        icon: '!',
        title: 'Appuntamento personale',
        description: 'Promemoria attivo',
        completed: false,
      },
      {
        icon: '📌',
        title: 'Organizzare attività',
        description: 'Da pianificare',
        completed: false,
      },
      {
        icon: '☁',
        title: 'Controllo meteo',
        description: 'Previsione disponibile',
        completed: false,
      },
    ],
  },
]

function Home() {
  const [activeDay, setActiveDay] = useState(1)

  const currentDay = previewDays[activeDay]

  return (
    <main className="app">
      <nav className="navbar">
        <div className="logo">
          <img src={logo} alt="Logo Planify" className="logo-image" />
          <span>Planify</span>
        </div>

        <div className="nav-actions">
          <Link to="/login" className="btn btn-ghost">
            Accedi
          </Link>

          <Link to="/register" className="btn btn-primary">
            Registrati
          </Link>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-content">
          <span className="badge">Per organizzare i tuoi impegni</span>

          <h1>Organizza eventi, scadenze e attività in un unico posto</h1>

          <p>
            Planify ti aiuta a gestire promemoria, attività personali ed eventi,
            con accesso utente, notifiche e funzionalità offline.
          </p>

          <div className="hero-buttons">
            <Link to="/register" className="btn btn-primary large">
              Inizia ora
            </Link>

            <a href="#features" className="btn btn-secondary large">
              Scopri di più
            </a>
          </div>
        </div>

        <div className="preview-card">
          <div className="card-header">
            {previewDays.map((day, index) => (
              <button
                key={day.title}
                className={activeDay === index ? 'dot active' : 'dot'}
                onClick={() => setActiveDay(index)}
                aria-label={`Mostra ${day.title}`}
              ></button>
            ))}
          </div>

          <h3>{currentDay.title}</h3>

          {currentDay.tasks.map((task, index) => (
            <div
              className={task.completed ? 'task completed' : 'task'}
              key={index}
            >
              <span>{task.icon}</span>
              <div>
                <strong>{task.title}</strong>
                <p>{task.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="features" id="features">
        <article>
          <h3>Eventi</h3>
          <p>Crea e organizza appuntamenti, scadenze e promemoria personali.</p>
        </article>

        <article>
          <h3>Notifiche</h3>
          <p>Ricevi avvisi per ricordarti attività o eventi imminenti.</p>
        </article>

        <article>
          <h3>Offline</h3>
          <p>
            Anche senza connessione, Planify mostra una pagina offline
            personalizzata invece del normale errore del browser.
          </p>
        </article>
      </section>
    </main>
  )
}

export default Home