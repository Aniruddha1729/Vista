import { Link } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import PixelCard from '../components/PixelCard'
import { SidebarUnfoldableExample } from '../components/Sidebar'
import './PlansPage.css'

const freeFeatures = [
  'Create and share campus events',
  'Core email invitation designs',
  'Team registration and event permissions',
  'Manage registrations and entry tickets',
]

const proFeatures = [
  'More premium invitation templates',
  'Paid event registrations',
  'Guaranteed immediate payment withdrawals',
  'Unlimited event permissions',
  'Enhanced event pages',
  'Unlimited invitations',
]

function PlansPage() {
  const { user } = useAuth()
  const isPro = user?.plan === 'pro'

  return (
    <div className="plans-layout">
      <aside className="plans-sidebar"><SidebarUnfoldableExample /></aside>
      <main className="plans-page">
      <div className="plans-shell">
        <header className="plans-heading">
          <span className="section-eyebrow">Vista plans</span>
          <h1>Make room for<br /><em>what’s next.</em></h1>
          <p>Keep creating with Free, or see what Pro is being built to unlock.</p>
        </header>

        <div className="plans-current"><span className="plans-current-dot" />Your current plan: <strong>{isPro ? 'Pro' : 'Free'}</strong></div>

        <section className="plans-grid" aria-label="Compare Vista plans">
          <PixelCard
            className="plan-pixel-card plan-free-card"
            colors={['#dce9bd', '#c5db88', '#9caf63']}
            glowColor="#9caf63"
            gap={8}
            pixelSize={2.5}
            speed={22}
            shape="square"
            origin="center"
            revealDuration={700}
            spotlight={0.32}
            glow={0.35}
            opacity={0.32}
            fade={0.65}
            trigger="hover"
            clickPulse
            intro
            theme="light"
            radius={26}
            introDelay={0}
          >
            <div className="plan-card-content">
              <div className="plan-card-topline"><span className="plan-name">Free</span>{!isPro && <span className="plan-current-tag">Current plan</span>}</div>
              <div className="plan-price">₹0 <span>forever</span></div>
              <p className="plan-description">Everything you need to bring campus events together.</p>
              <ul className="plan-feature-list">{freeFeatures.map((feature) => <li key={feature}><span aria-hidden="true">✓</span>{feature}</li>)}</ul>
              <Link className={`plan-action plan-action-free${!isPro ? ' is-current' : ''}`} to="/events">{isPro ? 'Explore Vista' : 'Your current plan'}</Link>
            </div>
          </PixelCard>

          <PixelCard
            className="plan-pixel-card plan-pro-card"
            colors={['#d8f66a', '#b9e746', '#8faf24']}
            glowColor="#b9e746"
            gap={7}
            pixelSize={2.8}
            speed={30}
            shape="square"
            origin="center"
            revealDuration={760}
            spotlight={0.48}
            glow={0.48}
            opacity={0.38}
            fade={0.58}
            trigger="hover"
            clickPulse
            intro
            theme="dark"
            radius={26}
            introDelay={160}
          >
            <div className="plan-card-content">
              <div className="plan-card-topline"><span className="plan-name">Pro</span>{isPro ? <span className="plan-current-tag pro-current-tag">Current plan</span> : <span className="plan-coming-tag">Coming soon</span>}</div>
              <div className="plan-price pro-price">More room<span>for bigger ideas</span></div>
              <p className="plan-description">For organisers who want more reach, flexibility, and control.</p>
              <ul className="plan-feature-list">{proFeatures.map((feature) => <li key={feature}><span aria-hidden="true">✦</span>{feature}</li>)}</ul>
              <button className="plan-action plan-action-pro" type="button" disabled>{isPro ? 'Your current plan' : 'Pro upgrade coming soon'}</button>
            </div>
          </PixelCard>
        </section>

        <p className="plans-note">This is a preview of the two Vista tiers. Pro billing, paid registrations, withdrawals, and premium feature controls are not connected yet, so this page won’t change your plan.</p>
      </div>
      </main>
    </div>
  )
}

export default PlansPage
