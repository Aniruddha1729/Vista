import Header from "../components/Header";
import LiquidEther from "../components/LiquidEther";
import Hero from "../components/Hero";
import Footer from "../components/Footer";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { getEventDiscovery } from "../data/eventsApi";
import { useAuth } from "../auth/useAuth";

function Home() {
  const { user } = useAuth();
  const [discovery, setDiscovery] = useState<{ categories: string[]; publishedEvents: number; registeredPlaces: number } | null>(null);
  useEffect(() => { getEventDiscovery().then(setDiscovery).catch(() => setDiscovery(null)); }, []);
  const categoryIcons: Record<string, string> = {
    Hackathon: 'M8 9 3 12l5 3M16 9l5 3-5 3M14 6l-4 12',
    Competition: 'M8 4h8v4a4 4 0 0 1-8 0V4Zm0 2H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4m-4 0v4m-4 4h8m-7-4h6',
    Workshop: 'M12 3a7 7 0 0 0-4 12.7V19h8v-3.3A7 7 0 0 0 12 3Zm-3 19h6m-5-6h4',
    Conference: 'M12 3a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Zm-7 9v1a7 7 0 0 0 14 0v-1m-7 8v3m-4 0h8',
    'Skill lesson': 'M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21V5.5Zm0 0V21m4-13h8m-8 4h8',
  };
  return (
    <div className="app-shell" id="top">
      <section className="hero-section">
        <LiquidEther
          colors={["#78a81d", "#b9ed42", "#e4f7b0"]}
          mouseForce={20}
          cursorSize={100}
          persistence={0.78}
          autoDemo
          autoSpeed={0.5}
          autoIntensity={2.2}
          lightMode
          className="hero-liquid"
        />
        {!user && <Header />}
        <Hero />
      </section>
      <section className="home-categories" aria-labelledby="home-categories-title">
        <div className="home-section-title"><span className="section-eyebrow">Find your people</span><h2 id="home-categories-title">Something for<br /><em>every curiosity.</em></h2></div>
        <div className="home-category-grid">
          {(discovery?.categories || []).map((category, index) => (
            <Link className="home-category-tile" key={category} to={`/events?category=${encodeURIComponent(category)}`}><span>{String(index + 1).padStart(2, '0')}</span><svg className="home-category-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={categoryIcons[category] || 'M5 12h14m-7-7v14'} /></svg><strong>{category}</strong><b aria-hidden="true">↗</b></Link>
          ))}
        </div>
      </section>
      <section className="home-how" id="how-it-works">
        <div className="home-section-title"><span className="section-eyebrow">Easy from hello to check-in</span><h2>Good things happen<br /><em>in three steps.</em></h2></div>
        <div className="home-step-grid">
          <article><span>01</span><h3>Create</h3><p>Bring your campus idea to life with a clear event page and a link that is easy to share.</p></article>
          <article><span>02</span><h3>Register</h3><p>Guests find the details, sign up, and keep their entry pass ready on their phone.</p></article>
          <article><span>03</span><h3>Scan</h3><p>Welcome people in with a quick QR check-in at the door.</p></article>
        </div>
      </section>
      <section className="home-about" id="about" aria-labelledby="home-about-title">
        <div className="home-about-heading">
          <div><span className="section-eyebrow">A calmer way to bring people together</span><h2 id="home-about-title">Everything around<br />a great <em>event.</em></h2></div>
          <p>Vista gives campus communities one clear place to discover what’s happening, bring an idea to life, and welcome people through the door.</p>
        </div>
        <article className="home-about-feature">
          <div className="home-about-copy">
            <span className="home-about-kicker"><i /> Made for the whole journey</span>
            <h3>From “you’re invited”<br />to “you’re checked in.”</h3>
            <p>Create a polished event page, share it with your campus, collect registrations, and see who has arrived. The details and the check-in list stay together, so hosting feels easy before, during, and after the event.</p>
            <Link to="/events" className="home-about-link">See what’s happening <span>↗</span></Link>
          </div>
          <div className="home-about-art" aria-label="Illustration of a digital event ticket and QR check-in" role="img">
            <div className="about-orbit about-orbit-one" /><div className="about-orbit about-orbit-two" />
            <div className="about-ticket">
              <div className="about-ticket-top"><span>VISTA PASS</span><b>✳</b></div>
              <strong>Campus<br /><em>Film Night</em></strong>
              <div className="about-ticket-bottom"><span>FRI · 7:00 PM</span><span>GATE 02</span></div>
            </div>
            <div className="about-qr-card"><svg viewBox="0 0 7 7" aria-hidden="true"><path d="M0 0h3v3H0zM1 1v1h1V1zM4 0h3v3H4zM5 1v1h1V1zM0 4h3v3H0zM1 5v1h1V5zM4 4h1v1H4zM6 4h1v1H6zM4 6h1v1H4zM6 6h1v1H6zM3 3h1v1H3zM5 3h1v1H5zM3 5h1v1H3z" /></svg><span>Ready to scan</span></div>
            <div className="about-checkin-chip"><b>✓</b><span><strong>Entry verified</strong><small>Ticket scanned just now</small></span></div>
            <span className="about-art-spark about-art-spark-one">✳</span><span className="about-art-spark about-art-spark-two">✦</span>
          </div>
        </article>
        <div className="home-about-grid">
          <article className="home-about-card">
            <span className="about-card-number">01 / HOST</span><span className="about-card-icon" aria-hidden="true">✳</span>
            <h3>Hosting, without the hassle.</h3><p>Build a clear event page with the date, venue, capacity, team options, prizes, and the details people need to say yes.</p>
          </article>
          <article className="home-about-card">
            <span className="about-card-number">02 / INVITE</span><span className="about-card-icon about-card-icon-lime" aria-hidden="true">↗</span>
            <h3>Invites that feel like yours.</h3><p>Choose an invitation design, add your message, and send invitations or share a public link that’s easy to pass around.</p>
          </article>
          <article className="home-about-card">
            <span className="about-card-number">03 / REGISTER</span><span className="about-card-icon about-card-icon-cream" aria-hidden="true">◎</span>
            <h3>Registration made simple.</h3><p>Guests sign up online, accept team requests when needed, and keep their event ticket ready in Vista.</p>
          </article>
          <article className="home-about-card">
            <span className="about-card-number">04 / PAYMENTS</span><span className="about-card-icon about-card-icon-dark" aria-hidden="true">₹</span>
            <h3>Clear payments and tracking.</h3><p>Offer free or paid individual registration with Razorpay checkout. Organisers can review collections, fees, refunds, and recorded withdrawal requests in the event ledger.</p>
          </article>
        </div>
        <div className="home-about-footnote"><span>Designed for student organisers and curious campus communities.</span><Link to="/host-event">Start an event <b>↗</b></Link></div>
      </section>
      <section className="home-stats" aria-label="Vista at a glance">
        <div><strong>{discovery?.publishedEvents.toLocaleString() ?? '—'}</strong><span>published campus events</span></div><div><strong>{discovery?.categories.length.toLocaleString() ?? '—'}</strong><span>event categories to explore</span></div><div><strong>{discovery?.registeredPlaces.toLocaleString() ?? '—'}</strong><span>confirmed event places</span></div>
      </section>
      <section className="home-final-cta"><span className="section-eyebrow">Make the next one count</span><h2>Your campus is full<br />of <em>good stories.</em></h2><p>Find the next event, or make one happen.</p><div><Link to="/events" className="primary-cta"><span>Explore events</span><b>↗</b></Link><Link to="/host-event" className="home-host-link">Host an event <span>↗</span></Link></div></section>
      <Footer />
    </div>
  );
}

export default Home;
