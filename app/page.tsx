'use client';

/**
 * app/page.tsx — Settlement Sam Landing Page
 *
 * Sections:
 *   1. Nav
 *   2. Hero
 *   3. Problem / Pain Points
 *   4. Embedded Widget ("Try It Now")
 *   5. Social Proof
 *   6. How It Works
 *   7. For Attorneys CTA
 *   8. Footer
 */

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import CaseEstimatorWidget from '@/components/widget/CaseEstimatorWidget';

// ── Animation presets ─────────────────────────────────────────────────────────

const fadeUp = {
  hidden:  { opacity: 0, y: 32 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: 'easeOut' } },
};

const stagger = { visible: { transition: { staggerChildren: 0.12 } } };


// ── Pain point cards ──────────────────────────────────────────────────────────

const painPoints = [
  { icon: '😤', title: 'Lowball Offers',           body: "Insurance companies offer 10–30¢ on the dollar, hoping you don't know better." },
  { icon: '⏳', title: 'Endless Delays',            body: 'Cases drag for months or years while your bills pile up.' },
  { icon: '😰', title: "No Idea What You're Worth", body: "Without an estimate, you can't negotiate. You're flying blind." },
  { icon: '⚖️', title: 'Settling Too Soon',         body: 'Adjusters pressure you to sign fast — before you finish treatment or know your real damages.' },
];

// ── How-it-works steps ────────────────────────────────────────────────────────

const steps = [
  { n: '01', title: 'Answer 12 Quick Questions', body: 'About your injury, treatment, and lost wages. Takes under 3 minutes.' },
  { n: '02', title: 'Get Your Instant Estimate', body: 'Sam calculates a realistic settlement range based on real case data.' },
  { n: '03', title: 'Verify by Text', body: 'Confirm your number so we can connect you with the right attorney.' },
  { n: '04', title: 'Talk to a Specialist', body: 'A pre-screened PI attorney contacts you — no spam, no cold callers.' },
];

// ── Social proof data ─────────────────────────────────────────────────────────

const testimonials = [
  { name: 'Marcus T., Florida', text: 'I had no clue what my back injury was worth. Sam told me $47k–$120k. My attorney settled for $89k. Couldn\'t have done it without the estimate.' },
  { name: 'Priya S., Texas',    text: 'After my car accident, the insurance offered $4,500. Sam said I should expect $25k–$75k. I got $68k.' },
  { name: 'Derek M., Georgia',  text: 'Quick, honest, no pressure. Sam gave me the confidence to actually fight back.' },
];

const stats = [
  { value: '12,400+', label: 'Cases Estimated' },
  { value: '$2.1M',   label: 'Avg Settlement Range Shown' },
  { value: '94%',     label: 'Users Got More Than the First Offer' },
  { value: '< 3 min', label: 'Average Completion Time' },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="sl-page">
      {/* ── NAV ─────────────────────────────────────────────────────────────── */}
      <nav className="sl-nav">
        <div className="sl-nav-inner">
          <span className="sl-logo">
            <img src="/images/sam-icons/sam-logo.png" alt="Settlement Sam" />
          </span>
          <div className="sl-nav-links">
            <a href="#how-it-works">How It Works</a>
            <a href="#estimate">Get Estimate</a>
            <Link href="/attorneys" className="sl-nav-cta">For Attorneys</Link>
          </div>
          <button
            className={`sl-hamburger${menuOpen ? ' sl-hamburger--open' : ''}`}
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Toggle navigation"
            aria-expanded={menuOpen}
          >
            <span /><span /><span />
          </button>
        </div>
        <div className={`sl-nav-drawer${menuOpen ? ' is-open' : ''}`}>
          <a href="#how-it-works" onClick={closeMenu}>How It Works</a>
          <a href="#estimate" onClick={closeMenu}>Get Estimate</a>
          <Link href="/attorneys" className="sl-nav-cta" onClick={closeMenu}>For Attorneys</Link>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────────────────────── */}
      <section className="sl-hero">
        <div className="container">
          <div className="sl-hero-grid">
            {/* Left copy */}
            <motion.div
              className="sl-hero-copy"
              initial="hidden" whileInView="visible"
              viewport={{ once: true }}
              variants={stagger}
            >
              <motion.div variants={fadeUp} className="sl-hero-badge">
                Free · No Lawyers · Instant
              </motion.div>
              <motion.h1 variants={fadeUp} className="sl-hero-h1">
                Find Out What Your<br />
                <span className="sl-text-gold">Injury Case</span> Is Worth
              </motion.h1>
              <motion.p variants={fadeUp} className="sl-hero-sub">
                Insurance companies have algorithms. Now you do too.
                Sam gives you an honest estimate in under 3 minutes — no signup, no pressure.
              </motion.p>
              <motion.div variants={fadeUp} className="sl-hero-actions">
                <a href="#estimate" className="sl-btn-primary">
                  Get My Free Estimate
                </a>
                <Link href="/quiz" className="sl-btn-secondary">
                  Take the Full Quiz →
                </Link>
              </motion.div>
              <motion.p variants={fadeUp} className="sl-hero-trust">
                🔒 Your info is never sold. No spam. No lawyers calling at 2am.
              </motion.p>
            </motion.div>

            {/* Sam floating avatar */}
            <motion.div
              className="sl-hero-sam"
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
            >
              <div className="sl-sam-avatar-wrap">
                <img src="/images/sam-icons/sam-logo.png" className="sl-sam-avatar" alt="Settlement Sam" />
              </div>
              <motion.div
                className="sl-speech-bubble"
                initial={{ opacity: 0, scale: 0.85 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.45, duration: 0.35 }}
              >
                "Let me show you what you're really worth."
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── STATS BAR ───────────────────────────────────────────────────────── */}
      <section className="sl-stats-bar">
        <div className="container">
          <div className="sl-stats-grid">
            {stats.map((s) => (
              <div key={s.label} className="sl-stat">
                <span className="sl-stat-value">{s.value}</span>
                <span className="sl-stat-label">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PROBLEM SECTION ─────────────────────────────────────────────────── */}
      <section className="section sl-problem">
        <div className="container">
          <motion.div
            className="sl-section-header"
            initial="hidden" whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
          >
            <motion.h2 variants={fadeUp}>
              The Insurance Company<br /><span className="sl-text-coral">Is Not on Your Side</span>
            </motion.h2>
            <motion.p variants={fadeUp} className="sl-section-sub">
              They're counting on you not knowing what your case is worth. Sam levels the playing field.
            </motion.p>
          </motion.div>
          <motion.div
            className="sl-pain-grid"
            initial="hidden" whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
          >
            {painPoints.map((p) => (
              <motion.div key={p.title} variants={fadeUp} className="sl-pain-card">
                <div className="sl-pain-icon">{p.icon}</div>
                <h3>{p.title}</h3>
                <p>{p.body}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── EMBEDDED WIDGET ─────────────────────────────────────────────────── */}
      <section className="section sl-widget-section" id="estimate">
        <div className="container">
          <motion.div
            className="sl-section-header"
            initial="hidden" whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
          >
            <motion.h2 variants={fadeUp}>Get Your Instant Estimate</motion.h2>
            <motion.p variants={fadeUp} className="sl-section-sub">
              Free. Confidential. Takes under 3 minutes.
            </motion.p>
          </motion.div>
          <div className="sl-widget-wrap">
            <CaseEstimatorWidget />
          </div>
          <p className="sl-widget-alt">
            Want a more detailed estimate?{' '}
            <Link href="/quiz">Take the full quiz →</Link>
          </p>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────────────────────── */}
      <section className="section sl-how" id="how-it-works">
        <div className="container">
          <motion.div
            className="sl-section-header"
            initial="hidden" whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
          >
            <motion.h2 variants={fadeUp}>How Sam Works</motion.h2>
          </motion.div>
          <motion.div
            className="sl-steps-grid"
            initial="hidden" whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
          >
            {steps.map((s, i) => (
              <motion.div key={s.n} variants={fadeUp} className="sl-step">
                <div className="sl-step-num">{s.n}</div>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
                {i < steps.length - 1 && <div className="sl-step-arrow">→</div>}
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── SOCIAL PROOF ────────────────────────────────────────────────────── */}
      <section className="section sl-testimonials">
        <div className="container">
          <motion.div
            className="sl-section-header"
            initial="hidden" whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
          >
            <motion.h2 variants={fadeUp}>Real People. Real Results.</motion.h2>
          </motion.div>
          <motion.div
            className="sl-testi-grid"
            initial="hidden" whileInView="visible"
            viewport={{ once: true }}
            variants={stagger}
          >
            {testimonials.map((t) => (
              <motion.div key={t.name} variants={fadeUp} className="sl-testi-card">
                <div className="sl-testi-stars">★★★★★</div>
                <p className="sl-testi-text">"{t.text}"</p>
                <p className="sl-testi-name">— {t.name}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── FOR ATTORNEYS CTA ───────────────────────────────────────────────── */}
      <section className="section sl-attorneys-cta">
        <div className="container">
          <motion.div
            className="sl-attorneys-inner"
            initial={{ opacity: 0, y: 32 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55 }}
          >
            <div className="sl-attorneys-copy">
              <h2>Are You a Personal Injury Attorney?</h2>
              <p>
                Settlement Sam pre-screens every claimant so your intake team
                only speaks with qualified, SMS-verified prospects.
                No contracts. Cancel anytime.
              </p>
              <Link href="/attorneys" className="sl-btn-primary">
                See How It Works →
              </Link>
            </div>
            <div className="sl-attorneys-badges">
              <div className="sl-badge-card">
                <span className="sl-badge-val">✓</span>
                <span className="sl-badge-desc">SMS Verified</span>
              </div>
              <div className="sl-badge-card sl-badge-warm">
                <span className="sl-badge-val">📋</span>
                <span className="sl-badge-desc">Full Injury Profile</span>
              </div>
              <div className="sl-badge-card sl-badge-cold">
                <span className="sl-badge-val">⚡</span>
                <span className="sl-badge-desc">Instant Delivery</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────────── */}
      <footer className="sl-footer">
        <div className="container">
          <div className="sl-footer-grid">
            <div className="sl-footer-brand">
              <span className="sl-logo"><img src="/images/sam-icons/sam-logo.png" height="28" alt="Settlement Sam" style={{ display: 'block' }} /></span>
              <p>Instant personal injury case estimates. Free, private, and honest.</p>
            </div>
            <div className="sl-footer-links">
              <h4>Product</h4>
              <Link href="/quiz">Take the Quiz</Link>
              <a href="#estimate">Quick Estimate</a>
              <a href="#how-it-works">How It Works</a>
            </div>
            <div className="sl-footer-links">
              <h4>Attorneys</h4>
              <Link href="/attorneys">Get Leads</Link>
              <Link href="/attorneys#roi">ROI Calculator</Link>
              <Link href="/attorneys#pricing">Pricing</Link>
            </div>
            <div className="sl-footer-links">
              <h4>Legal</h4>
              <a href="#">Privacy Policy</a>
              <a href="#">Terms of Service</a>
              <a href="#">Disclaimer</a>
            </div>
          </div>
          <div className="sl-footer-bottom">
            <p>© {new Date().getFullYear()} Settlement Sam. All rights reserved.</p>
            <p className="sl-disclaimer">
              Settlement Sam is not a law firm and does not provide legal advice.
              Case estimates are based on general data and may not reflect actual outcomes.
              Every case is different.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
