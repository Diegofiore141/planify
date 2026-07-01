import { useState } from 'react'
import logo from '../assets/logo.png'
import { checkOnlineConnection } from '../services/connection'

function Offline({ onReconnect }) {
  const [message, setMessage] = useState('')
  const [checking, setChecking] = useState(false)

  // Riprova a raggiungere il file statico usato per capire se si e' online.
  async function handleRetry() {
    setMessage('Controllo connessione...')
    setChecking(true)

    const connectionWorks = await checkOnlineConnection()

    if (connectionWorks) {
      setMessage('')
      setChecking(false)
      onReconnect?.()
      return
    } else {
      setMessage(
        'Sei ancora offline. Riprova quando la connessione torna disponibile.'
      )
    }

    setChecking(false)
  }

  // Evita una navigazione inutile se la connessione non e' ancora tornata.
  function handleGoHome() {
    if (!navigator.onLine) {
      setMessage(
        'Sei offline: per tornare alla home devi prima riconnetterti oppure premere Riprova.'
      )
      return
    }

    window.location.href = '/'
  }

  // La pagina offline ha CSS inline per funzionare anche fuori dal bundle.
  return (
    <main className="offline-page-v2">
      <style>
        {`
          .offline-page-v2 {
            min-height: 100vh;
            display: grid;
            place-items: center;
            padding: 24px;
            color: #0f172a;
            background:
              radial-gradient(circle at 15% 20%, rgba(96, 165, 250, 0.32), transparent 34%),
              radial-gradient(circle at 85% 25%, rgba(52, 211, 153, 0.25), transparent 32%),
              radial-gradient(circle at 50% 95%, rgba(167, 139, 250, 0.2), transparent 36%),
              #f8fafc;
            overflow: hidden;
          }

          .offline-card-v2 {
            width: min(920px, 100%);
            display: grid;
            grid-template-columns: 0.95fr 1.05fr;
            gap: 34px;
            align-items: center;
            padding: 42px;
            border-radius: 34px;
            background: rgba(255, 255, 255, 0.92);
            border: 1px solid rgba(226, 232, 240, 0.95);
            box-shadow: 0 34px 100px rgba(15, 23, 42, 0.16);
            backdrop-filter: blur(18px);
            animation: offlineCardEnter 0.55s ease both;
          }

          .offline-logo-v2 {
            display: inline-flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 26px;
            font-size: 24px;
            font-weight: 950;
          }

          .offline-logo-v2 img {
            width: 46px;
            height: 46px;
            border-radius: 15px;
            object-fit: cover;
            box-shadow: 0 12px 26px rgba(37, 99, 235, 0.18);
          }

          .offline-badge-v2 {
            display: inline-flex;
            margin-bottom: 16px;
            padding: 8px 14px;
            border-radius: 999px;
            background: #dbeafe;
            color: #1d4ed8;
            font-size: 13px;
            font-weight: 900;
          }

          .offline-text-v2 h1 {
            margin: 0;
            font-size: clamp(40px, 5.6vw, 64px);
            line-height: 1;
            letter-spacing: -1.8px;
          }

          .offline-text-v2 p {
            margin: 22px 0 0;
            color: #475569;
            font-size: 18px;
            line-height: 1.65;
          }

          .offline-actions-v2 {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            margin-top: 30px;
          }

          .offline-primary-button,
          .offline-secondary-button {
            border: 0;
            border-radius: 15px;
            padding: 14px 20px;
            font: inherit;
            font-weight: 900;
            cursor: pointer;
            text-decoration: none;
            transition:
              transform 0.18s ease,
              box-shadow 0.18s ease,
              background 0.18s ease;
          }

          .offline-primary-button {
            color: white;
            background: #2563eb;
            box-shadow: 0 16px 34px rgba(37, 99, 235, 0.28);
          }

          .offline-primary-button:disabled {
            cursor: not-allowed;
            opacity: 0.75;
          }

          .offline-secondary-button {
            color: #1d4ed8;
            background: #eff6ff;
          }

          .offline-primary-button:hover,
          .offline-secondary-button:hover {
            transform: translateY(-2px);
          }

          .offline-message-v2 {
            margin-top: 18px;
            margin-bottom: 0;
            color: #64748b;
            font-size: 14px;
            font-weight: 800;
          }

          .offline-visual-v2 {
            min-height: 390px;
            position: relative;
            display: grid;
            place-items: center;
          }

          .offline-orbit-v2 {
            position: absolute;
            width: 310px;
            height: 310px;
            border-radius: 999px;
            border: 2px dashed rgba(37, 99, 235, 0.22);
            animation: offlineRotateOrbit 16s linear infinite;
          }

          .offline-orbit-dot-v2 {
            position: absolute;
            top: 22px;
            left: 50%;
            width: 18px;
            height: 18px;
            border-radius: 999px;
            background: #2563eb;
            transform: translateX(-50%);
            box-shadow: 0 0 26px rgba(37, 99, 235, 0.45);
          }

          .offline-calendar-bot-v2 {
            position: relative;
            width: 235px;
            padding: 20px;
            border-radius: 30px;
            background: white;
            border: 1px solid #e2e8f0;
            box-shadow: 0 26px 70px rgba(15, 23, 42, 0.16);
            animation: offlineFloatBot 3.2s ease-in-out infinite;
          }

          .offline-calendar-top-v2 {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
          }

          .offline-calendar-rings-v2 {
            display: flex;
            gap: 8px;
          }

          .offline-calendar-rings-v2 span {
            width: 12px;
            height: 22px;
            border-radius: 999px;
            background: #2563eb;
          }

          .offline-bot-eyes-v2 {
            display: flex;
            gap: 12px;
          }

          .offline-bot-eyes-v2 span {
            width: 13px;
            height: 13px;
            border-radius: 999px;
            background: #0f172a;
            animation: offlineBlink 3s infinite;
          }

          .offline-calendar-face-v2 {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 9px;
          }

          .offline-calendar-face-v2 span {
            height: 34px;
            border-radius: 11px;
            background: #eff6ff;
          }

          .offline-calendar-face-v2 span:nth-child(2),
          .offline-calendar-face-v2 span:nth-child(5) {
            background: #bfdbfe;
          }

          .offline-calendar-face-v2 span:nth-child(8) {
            background: #bbf7d0;
          }

          .offline-cloud-v2 {
            position: absolute;
            right: 58px;
            top: 44px;
            padding: 12px 16px;
            border-radius: 999px;
            background: rgba(255, 255, 255, 0.92);
            box-shadow: 0 18px 45px rgba(15, 23, 42, 0.12);
            font-size: 24px;
            animation: offlineCloudMove 4s ease-in-out infinite;
          }

          .offline-bubble-v2 {
            position: absolute;
            bottom: 34px;
            left: 50%;
            transform: translateX(-50%);
            width: max-content;
            max-width: 260px;
            padding: 12px 16px;
            border-radius: 18px;
            background: #0f172a;
            color: white;
            font-size: 14px;
            font-weight: 800;
            text-align: center;
            animation: offlineMessagePulse 2.4s ease-in-out infinite;
          }

          @keyframes offlineCardEnter {
            from {
              opacity: 0;
              transform: translateY(14px);
            }

            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes offlineRotateOrbit {
            to {
              transform: rotate(360deg);
            }
          }

          @keyframes offlineFloatBot {
            0%,
            100% {
              transform: translateY(0);
            }

            50% {
              transform: translateY(-14px);
            }
          }

          @keyframes offlineBlink {
            0%,
            88%,
            100% {
              transform: scaleY(1);
            }

            92% {
              transform: scaleY(0.15);
            }
          }

          @keyframes offlineCloudMove {
            0%,
            100% {
              transform: translateX(0) translateY(0);
            }

            50% {
              transform: translateX(-18px) translateY(8px);
            }
          }

          @keyframes offlineMessagePulse {
            0%,
            100% {
              opacity: 0.88;
              transform: translateX(-50%) scale(1);
            }

            50% {
              opacity: 1;
              transform: translateX(-50%) scale(1.03);
            }
          }

          @media (max-width: 820px) {
            .offline-card-v2 {
              grid-template-columns: 1fr;
              padding: 28px;
            }

            .offline-visual-v2 {
              min-height: 320px;
            }

            .offline-orbit-v2 {
              width: 260px;
              height: 260px;
            }
          }

          @media (max-width: 560px) {
            .offline-card-v2 {
              padding: 24px;
            }

            .offline-text-v2 h1 {
              font-size: 38px;
            }

            .offline-visual-v2 {
              min-height: 280px;
            }

            .offline-calendar-bot-v2 {
              width: 205px;
            }
          }

          @media (prefers-reduced-motion: reduce) {
            .offline-page-v2 *,
            .offline-page-v2 *::before,
            .offline-page-v2 *::after {
              animation: none !important;
              transition: none !important;
            }
          }
        `}
      </style>

      <section className="offline-card-v2">
        <div className="offline-text-v2">
          <div className="offline-logo-v2">
            <img src={logo} alt="Logo Planify" />
            <span>Planify</span>
          </div>

          <span className="offline-badge-v2">Modalità offline</span>

          <h1>Ops, la connessione si è presa una pausa.</h1>

          <p>
            Non riesco a raggiungere Internet in questo momento. Puoi
            controllare la rete e riprovare tra poco.
          </p>

          <div className="offline-actions-v2">
            <button
              type="button"
              className="offline-primary-button"
              onClick={handleRetry}
              disabled={checking}
            >
              {checking ? 'Controllo...' : 'Riprova'}
            </button>

            <button
              type="button"
              className="offline-secondary-button"
              onClick={handleGoHome}
            >
              Torna alla home
            </button>
          </div>

          {message && <p className="offline-message-v2">{message}</p>}
        </div>

        <div className="offline-visual-v2" aria-hidden="true">
          <div className="offline-orbit-v2">
            <div className="offline-orbit-dot-v2"></div>
          </div>

          <div className="offline-cloud-v2">📡</div>

          <div className="offline-calendar-bot-v2">
            <div className="offline-calendar-top-v2">
              <div className="offline-calendar-rings-v2">
                <span></span>
                <span></span>
              </div>

              <div className="offline-bot-eyes-v2">
                <span></span>
                <span></span>
              </div>
            </div>

            <div className="offline-calendar-face-v2">
              <span></span>
              <span></span>
              <span></span>
              <span></span>
              <span></span>
              <span></span>
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>

          <div className="offline-bubble-v2">Sto cercando il Wi-Fi...</div>
        </div>
      </section>
    </main>
  )
}

export default Offline
