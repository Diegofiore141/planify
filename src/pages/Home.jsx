import { useState } from 'react'
import { Link } from 'react-router'
import logo from '../assets/logo.png'

const previewDays = [
  {
    label: 'Oggi',
    title: 'Organizza la giornata',
    items: [
      {
        icon: '📅',
        title: 'Evento all’aperto',
        text: 'Meteo disponibile alle 18:00',
      },
      {
        icon: '✅',
        title: 'Finire progetto',
        text: 'Priorità alta · Scadenza oggi',
      },
      {
        icon: '🔔',
        title: 'Promemoria attivo',
        text: 'Notifica evento programmata',
      },
    ],
  },
  {
    label: 'Settimana',
    title: 'Tieni tutto sotto controllo',
    items: [
      {
        icon: '🗓️',
        title: 'Lezione universitaria',
        text: 'Mercoledì alle 10:30',
      },
      {
        icon: '📌',
        title: 'Consegna attività',
        text: 'Priorità media',
      },
      {
        icon: '📲',
        title: 'App installabile',
        text: 'Accesso rapido come PWA',
      },
    ],
  },
  {
    label: 'Offline',
    title: 'Anche senza connessione',
    items: [
      {
        icon: '📴',
        title: 'Pagina offline',
        text: 'Fallback personalizzato',
      },
      {
        icon: '🔄',
        title: 'Riprova connessione',
        text: 'Controllo automatico dello stato online',
      },
      {
        icon: '🔐',
        title: 'Dati protetti',
        text: 'Accesso separato per ogni utente',
      },
    ],
  },
]

function Home() {
  const [activePreview, setActivePreview] = useState(0)

  const currentPreview = previewDays[activePreview]

  return (
    <main className="app">
      <nav className="navbar">
        <Link to="/" className="logo">
          <img src={logo} alt="Logo Planify" className="logo-image" />
          <span>Planify</span>
        </Link>

        <div className="nav-actions">
          <Link to="/login" className="btn btn-ghost">
            Accedi
          </Link>

          <Link to="/register" className="btn btn-primary">
            Registrati
          </Link>
        </div>
      </nav>

      <section className="home-v2-hero">
        <div className="home-v2-content">
          <span className="home-v2-badge">
            Eventi, attività e promemoria in un’unica app
          </span>

          <h1>Organizza la tua giornata con Planify.</h1>

          <p>
            Crea eventi, gestisci attività, controlla le scadenze e visualizza
            tutto in un calendario interattivo con notifiche, meteo e supporto
            offline.
          </p>

          <div className="home-v2-actions">
            <Link to="/register" className="btn btn-primary large">
              Inizia ora
            </Link>

            <Link to="/login" className="btn btn-secondary large">
              Accedi
            </Link>
          </div>

          <div className="home-v2-highlights">
            <div>
              <strong>Calendario</strong>
              <span>Drag & drop</span>
            </div>

            <div>
              <strong>Notifiche</strong>
              <span>Promemoria eventi</span>
            </div>

            <div>
              <strong>PWA</strong>
              <span>Installabile e offline</span>
            </div>
          </div>
        </div>

        <div className="home-v2-preview-card">
          <div className="home-v2-preview-top">
            <div>
              <span>Anteprima Planify</span>
              <h2>{currentPreview.title}</h2>
            </div>

            <div className="home-v2-preview-dots">
              {previewDays.map((day, index) => (
                <button
                  key={day.label}
                  className={
                    activePreview === index
                      ? 'home-v2-dot active'
                      : 'home-v2-dot'
                  }
                  onClick={() => setActivePreview(index)}
                  aria-label={`Mostra ${day.label}`}
                ></button>
              ))}
            </div>
          </div>

          <div className="home-v2-preview-tabs">
            {previewDays.map((day, index) => (
              <button
                key={day.label}
                className={
                  activePreview === index
                    ? 'home-v2-tab active'
                    : 'home-v2-tab'
                }
                onClick={() => setActivePreview(index)}
              >
                {day.label}
              </button>
            ))}
          </div>

          <div className="home-v2-preview-list">
            {currentPreview.items.map((item) => (
              <article className="home-v2-preview-item" key={item.title}>
                <span>{item.icon}</span>

                <div>
                  <strong>{item.title}</strong>
                  <p>{item.text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="home-v2-features">
        <article>
          <span>📅</span>
          <h3>Calendario interattivo</h3>
          <p>
            Visualizza eventi e attività in una vista mensile, settimanale o
            giornaliera. Puoi creare, modificare e spostare gli impegni
            direttamente dal calendario.
          </p>
        </article>

        <article>
          <span>✅</span>
          <h3>Attività con priorità</h3>
          <p>
            Organizza le cose da fare con scadenze e priorità colorate, così è
            più semplice capire cosa completare prima.
          </p>
        </article>

        <article>
          <span>🌤️</span>
          <h3>Meteo sugli eventi</h3>
          <p>
            Per gli eventi con luogo, data e ora, Planify può recuperare una
            previsione meteo tramite API esterna.
          </p>
        </article>

        <article>
          <span>🔔</span>
          <h3>Promemoria</h3>
          <p>
            Attiva notifiche locali per ricordarti gli eventi programmati mentre
            Planify è aperta nel browser.
          </p>
        </article>

        <article>
          <span>📲</span>
          <h3>PWA installabile</h3>
          <p>
            Planify è pensata come Progressive Web App: può essere installata e
            include una pagina offline personalizzata.
          </p>
        </article>

        <article>
          <span>🔐</span>
          <h3>Area personale</h3>
          <p>
            Ogni utente autenticato accede ai propri eventi e alle proprie
            attività salvate su Firestore.
          </p>
        </article>
      </section>

      <section className="home-v2-cta">
        <div>
          <span className="home-v2-badge">Pronto a organizzarti?</span>

          <h2>Accedi alla tua area personale e inizia a pianificare.</h2>

          <p>
            Dashboard, calendario, eventi, attività e notifiche sono raccolti in
            un’unica esperienza semplice e ordinata.
          </p>
        </div>

        <Link to="/register" className="btn btn-primary large">
          Crea un account
        </Link>
      </section>
    </main>
  )
}

export default Home