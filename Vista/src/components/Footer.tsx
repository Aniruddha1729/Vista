import { Link } from 'react-router-dom'

function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-top">
        <div className="footer-brand"><Link className="brand" to="/" aria-label="Vista home"><img className="brand-wordmark" src="/vista-wordmark.png" alt="Vista" /></Link><p>Make room for<br /><em>the good stuff.</em></p></div>
        <div className="footer-column"><strong>Discover</strong><Link to="/events">Explore events</Link><Link to="/saved-events">Saved events</Link><a href="#how-it-works">How it works</a></div>
        <div className="footer-column"><strong>Host</strong><Link to="/host-event">Create an event</Link><Link to="/my-events">My events</Link><Link to="/registered-events">Registered events</Link><Link to="/signup">Join Vista</Link></div>
        <div className="footer-column"><strong>Follow along</strong><a href="https://www.instagram.com/" target="_blank" rel="noreferrer" aria-label="Instagram">◎ Instagram</a><a href="https://www.linkedin.com/" target="_blank" rel="noreferrer" aria-label="LinkedIn">in LinkedIn</a></div>
      </div>
      <div className="footer-bottom"><small>© {new Date().getFullYear()} Vista. Made for campus moments.</small><a href="#top" onClick={(event) => { event.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>Back to top ↑</a></div>
    </footer>
  )
}

export default Footer
