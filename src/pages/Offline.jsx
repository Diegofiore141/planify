import logo from '../assets/logo.png'

function Offline() {
  function handleRetry() {
    window.location.reload()
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '24px',
        background:
          'radial-gradient(circle at top left, rgba(37, 99, 235, 0.18), transparent 35%), linear-gradient(135deg, #eef2ff 0%, #f8fafc 50%, #e0f2fe 100%)',
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: '460px',
          padding: '34px',
          borderRadius: '24px',
          background: 'rgba(255, 255, 255, 0.92)',
          boxShadow: '0 25px 70px rgba(15, 23, 42, 0.14)',
          textAlign: 'center',
        }}
      >
        <img
          src={logo}
          alt="Logo Planify"
          style={{
            width: '82px',
            height: '82px',
            borderRadius: '18px',
            objectFit: 'cover',
            marginBottom: '16px',
          }}
        />

        <h1
          style={{
            margin: '0 0 12px',
            fontSize: '32px',
            color: '#0f172a',
          }}
        >
          Sei offline
        </h1>

        <p
          style={{
            color: '#64748b',
            lineHeight: '1.6',
            marginBottom: '24px',
          }}
        >
          Al momento non hai connessione.
        </p>

        <button className="btn btn-primary" onClick={handleRetry}>
          Riprova
        </button>
      </section>
    </main>
  )
}

export default Offline