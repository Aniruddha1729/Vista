
import { Link } from 'react-router-dom'

function Hero() {
  return (
    <main className="hero-content">
      <div className="hero-logo-stage">
        <span className="hero-logo-aura" aria-hidden="true" />
        <img className="hero-wordmark" src="/vista-wordmark.png" alt="Vista" />
      </div>
      <h1>Plan beautifully.<br />Celebrate <em>together.</em></h1>
      <p className="hero-subtitle">
        The simple, thoughtful way to bring your people<br className="desktop-break" />
        together for moments that matter.
      </p>
      <Link className="primary-cta" id="start" to="/events">
        <span>Explore events</span><b>↗</b>
      </Link>
      <div className="hero-meta">
        <span className="meta-line" />
        <span>Made for the moments<br />you’ll remember</span>
        <span className="meta-line" />
      </div>
    </main>
  )
}

export default Hero
