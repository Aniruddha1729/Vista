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
      <section className="home-stats" aria-label="Vista at a glance">
        <div><strong>{discovery?.publishedEvents.toLocaleString() ?? '—'}</strong><span>published campus events</span></div><div><strong>{discovery?.categories.length.toLocaleString() ?? '—'}</strong><span>event categories to explore</span></div><div><strong>{discovery?.registeredPlaces.toLocaleString() ?? '—'}</strong><span>confirmed event places</span></div>
      </section>
      <section className="home-final-cta"><span className="section-eyebrow">Make the next one count</span><h2>Your campus is full<br />of <em>good stories.</em></h2><p>Find the next event, or make one happen.</p><div><Link to="/events" className="primary-cta"><span>Explore events</span><b>↗</b></Link><Link to="/host-event" className="home-host-link">Host an event <span>↗</span></Link></div></section>
      <Footer />
    </div>
  );
}

export default Home;
