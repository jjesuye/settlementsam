'use client';

/**
 * app/attorneys/page.tsx — B2B Lead Acquisition Page
 *
 * Pricing is gated behind a lead capture form.
 * The pricing section is NOT rendered in the initial HTML — it only mounts
 * after the form is submitted and Firestore confirms the inquiry.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { validateEmailFormat } from '@/lib/validate-email';
import { US_STATES } from '@/lib/quiz/questions';

// ── Animation presets ─────────────────────────────────────────────────────────

const fadeUp = {
  hidden:  { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};
const stagger = { visible: { transition: { staggerChildren: 0.1 } } };

// ── ROI Calculator ────────────────────────────────────────────────────────────

function RoiCalculator() {
  const [leads,     setLeads]     = useState(25);
  const [closeRate, setCloseRate] = useState(15);
  const [avgFee,    setAvgFee]    = useState(12000);

  const cost        = leads * 250;
  const closedCases = Math.round((leads * closeRate) / 100);
  const revenue     = closedCases * avgFee;
  const profit      = revenue - cost;
  const roi         = cost > 0 ? Math.round(((revenue - cost) / cost) * 100) : 0;

  return (
    <div className="sl-roi-card" id="roi">
      <h3>ROI Calculator</h3>
      <p className="sl-roi-sub">See your projected return before you commit a single dollar.</p>

      <div className="sl-roi-inputs">
        <label>
          <span>Leads purchased</span>
          <input type="range" min={25} max={500} step={25} value={leads}
            onChange={e => setLeads(Number(e.target.value))} className="sl-slider" />
          <strong>{leads}</strong>
        </label>
        <label>
          <span>Close rate (%)</span>
          <input type="range" min={5} max={40} step={1} value={closeRate}
            onChange={e => setCloseRate(Number(e.target.value))} className="sl-slider" />
          <strong>{closeRate}%</strong>
        </label>
        <label>
          <span>Avg. contingency fee ($)</span>
          <input type="range" min={3000} max={50000} step={1000} value={avgFee}
            onChange={e => setAvgFee(Number(e.target.value))} className="sl-slider" />
          <strong>${avgFee.toLocaleString()}</strong>
        </label>
      </div>

      <div className="sl-roi-results">
        <div className="sl-roi-row">
          <span>Lead cost</span>
          <span className="sl-roi-val sl-muted">${cost.toLocaleString()}</span>
        </div>
        <div className="sl-roi-row">
          <span>Estimated cases closed</span>
          <span className="sl-roi-val">{closedCases}</span>
        </div>
        <div className="sl-roi-row">
          <span>Projected revenue</span>
          <span className="sl-roi-val sl-gold">${revenue.toLocaleString()}</span>
        </div>
        <div className="sl-roi-row sl-roi-total">
          <span>Net profit</span>
          <span className={`sl-roi-val ${profit >= 0 ? 'sl-green' : 'sl-red'}`}>
            ${profit.toLocaleString()}
          </span>
        </div>
        <div className="sl-roi-row sl-roi-total">
          <span>ROI</span>
          <span className={`sl-roi-val sl-roi-big ${roi >= 0 ? 'sl-green' : 'sl-red'}`}>
            {roi}%
          </span>
        </div>
      </div>

      <p className="sl-roi-disclaimer">
        Estimates based on your inputs. Actual results vary by market, firm, and case mix.
      </p>
    </div>
  );
}

// ── Pricing tiers (rendered ONLY after form submission) ───────────────────────

const pricingTiers = [
  {
    name: 'Starter',
    qty: 25,
    price: '$6,250',
    perLead: '$250/lead',
    features: ['25 SMS-verified leads', 'Mixed quality tiers', 'Email delivery', 'Full injury profile', 'Replacement guarantee'],
    cta: 'Get Started',
    highlight: false,
  },
  {
    name: 'Growth',
    qty: 100,
    price: '$22,500',
    perLead: '$225/lead',
    features: ['100 SMS-verified leads', 'Google Sheets push', 'Priority high-value leads', 'Dedicated account manager', 'Replacement guarantee', 'Weekly reporting'],
    cta: 'Most Popular',
    highlight: true,
  },
  {
    name: 'Scale',
    qty: 250,
    price: '$50,000',
    perLead: '$200/lead',
    features: ['250 SMS-verified leads', 'Custom lead scoring', 'White-glove onboarding', 'API access', 'SLA guarantee', 'Priority support'],
    cta: 'Contact Us',
    highlight: false,
  },
];

function PricingSection({ name, state }: { name: string; state: string }) {
  return (
    <motion.section
      className="section sl-pricing"
      id="pricing"
      initial={{ opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
    >
      <div className="container">
        <div className="sl-pricing-confirmation">
          <span className="sl-pricing-confirm-icon">✓</span>
          <p>
            Thanks {name.split(' ')[0]}. Here's our current pricing for{' '}
            <strong>{state || 'your state'}</strong>-based firms:
          </p>
        </div>

        <div className="sl-section-header">
          <h2>Simple, Transparent Pricing</h2>
          <p className="sl-section-sub">
            No monthly fees. No contracts. Buy what you need, when you need it.
          </p>
        </div>
        <div className="sl-pricing-grid">
          {pricingTiers.map((tier) => (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className={`sl-pricing-card ${tier.highlight ? 'sl-pricing-highlight' : ''}`}
            >
              {tier.highlight && <div className="sl-pricing-badge">Most Popular</div>}
              <h3>{tier.name}</h3>
              <div className="sl-pricing-price">{tier.price}</div>
              <div className="sl-pricing-per">{tier.perLead}</div>
              <ul className="sl-pricing-features">
                {tier.features.map(f => <li key={f}>✓ {f}</li>)}
              </ul>
              <a href="#book" className={`${tier.highlight ? 'sl-btn-primary' : 'sl-btn-outline'} sl-btn-full`}>
                {tier.cta}
              </a>
            </motion.div>
          ))}
        </div>
        <p className="sl-pricing-note">
          All packages delivered via Stripe invoice. Pay securely online. Funds credited instantly.
        </p>
      </div>
    </motion.section>
  );
}

// ── Pricing gate form ─────────────────────────────────────────────────────────

type GateState = 'idle' | 'submitting' | 'error';

function PricingGate({ onUnlock }: { onUnlock: (name: string, state: string) => void }) {
  const router       = useRouter();
  const [gateState,   setGateState]   = useState<GateState>('idle');
  const [name,        setName]        = useState('');
  const [firm,        setFirm]        = useState('');
  const [email,       setEmail]       = useState('');
  const [emailError,  setEmailError]  = useState('');
  const [phone,       setPhone]       = useState('');
  const [state,       setState]       = useState('');
  const [caseVolume,  setCaseVolume]  = useState('');
  const [formError,   setFormError]   = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');

    const emailErr = validateEmailFormat(email);
    if (emailErr) { setEmailError(emailErr); return; }
    setEmailError('');

    setGateState('submitting');
    try {
      const res  = await fetch('/api/attorney-inquiry', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name, firm, email, phone, state, case_volume: caseVolume }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'invalid_email') {
          setEmailError(data.message);
          setGateState('idle');
          return;
        }
        throw new Error(data.message ?? 'Submission failed.');
      }
      // Redirect to attorney thank-you page with context
      const params = new URLSearchParams({
        name, firm, email, phone, state, case_volume: caseVolume,
      });
      router.push(`/thank-you/attorney?${params.toString()}`);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setGateState('idle');
    }
  }

  return (
    <motion.section
      className="section sl-pricing-gate"
      id="pricing"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
    >
      <div className="container">
        <div className="sl-gate-card">
          <div className="sl-gate-lock">🔒</div>
          <h2 className="sl-gate-headline">Get Our Current Lead Pricing</h2>
          <p className="sl-gate-sub">
            Pricing is shared exclusively with verified law firms. Takes 30 seconds.
          </p>

          <form className="sl-gate-form" onSubmit={handleSubmit}>
            <div className="sl-form-row">
              <div className="sl-form-field">
                <label>Full Name *</label>
                <input
                  required value={name} onChange={e => setName(e.target.value)}
                  placeholder="Jane Smith" className="sl-input"
                />
              </div>
              <div className="sl-form-field">
                <label>Law Firm Name *</label>
                <input
                  required value={firm} onChange={e => setFirm(e.target.value)}
                  placeholder="Smith & Associates" className="sl-input"
                />
              </div>
            </div>

            <div className="sl-form-row">
              <div className="sl-form-field">
                <label>Email Address *</label>
                <input
                  required type="email" value={email}
                  onChange={e => { setEmail(e.target.value); if (emailError) setEmailError(''); }}
                  onBlur={() => { if (email) setEmailError(validateEmailFormat(email) ?? ''); }}
                  placeholder="jane@smithlaw.com"
                  className={`sl-input${emailError ? ' sl-input--error' : ''}`}
                />
                {emailError && <p className="sl-field-error">{emailError}</p>}
              </div>
              <div className="sl-form-field">
                <label>Phone Number *</label>
                <input
                  required type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="(555) 000-1234" className="sl-input"
                />
              </div>
            </div>

            <div className="sl-form-row">
              <div className="sl-form-field">
                <label>State where you practice *</label>
                <div className="sl-select-wrap">
                  <select
                    required value={state} onChange={e => setState(e.target.value)}
                    className="sl-input sl-select"
                  >
                    <option value="">Select state…</option>
                    {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <span className="sl-select-arrow">▾</span>
                </div>
              </div>
              <div className="sl-form-field">
                <label>PI cases per month *</label>
                <div className="sl-select-wrap">
                  <select
                    required value={caseVolume} onChange={e => setCaseVolume(e.target.value)}
                    className="sl-input sl-select"
                  >
                    <option value="">Select volume…</option>
                    <option value="1-5">1–5 cases</option>
                    <option value="5-15">5–15 cases</option>
                    <option value="15-30">15–30 cases</option>
                    <option value="30+">30+ cases</option>
                  </select>
                  <span className="sl-select-arrow">▾</span>
                </div>
              </div>
            </div>

            {formError && <p className="sl-form-error">{formError}</p>}

            <button
              type="submit"
              className="sl-btn-primary sl-btn-full sl-gate-submit"
              disabled={gateState === 'submitting'}
            >
              {gateState === 'submitting' ? 'Verifying…' : 'Show Me Pricing →'}
            </button>
          </form>
        </div>
      </div>
    </motion.section>
  );
}

// ── How It Works ──────────────────────────────────────────────────────────────

const features = [
  { icon: '🎯', title: 'Pre-screened Leads',    body: 'Every lead goes through a multi-step intake screening before you ever see it. No more guessing.' },
  { icon: '✅', title: 'SMS Verified',           body: 'Leads verify their phone number via Firebase text code. No bots. No fake numbers.' },
  { icon: '📋', title: 'Full Injury Profile',    body: 'Surgery, hospitalization, treatment status, lost wages, fault level — all captured upfront.' },
  { icon: '📊', title: 'Google Sheets Push',     body: "New leads land directly in your firm's spreadsheet. Integrate with your CRM in minutes." },
  { icon: '🔄', title: 'Replacement Guarantee',  body: 'If a lead is uncontactable within 48 hours, we replace it. No questions asked.' },
  { icon: '⚡', title: 'Instant Delivery',       body: 'Lead data hits your inbox and your Sheet within seconds of verification.' },
];

const howItWorks = [
  { n: '01', title: 'Purchase Your Package',        body: 'Choose a lead package and pay via secure Stripe invoice. Funds load to your account instantly.' },
  { n: '02', title: 'Configure Your Profile',       body: 'Tell us your target injury types, geographic markets, and preferred lead quality.' },
  { n: '03', title: 'Leads Arrive Automatically',   body: 'As users complete the quiz and verify their phones, matching leads are pushed directly to your email and Sheet.' },
  { n: '04', title: 'Call Fast, Win Cases',         body: 'Contact high-value leads within 5 minutes of delivery for the highest conversion rates.' },
];

// ── Booking form ──────────────────────────────────────────────────────────────

type BookingState = 'idle' | 'submitting' | 'success' | 'error';

function BookingForm() {
  const [state,   setState_]  = useState<BookingState>('idle');
  const [name,    setName]    = useState('');
  const [firm,    setFirm]    = useState('');
  const [email,   setEmail]   = useState('');
  const [phone,   setPhone]   = useState('');
  const [message, setMessage] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState_('submitting');
    try {
      await new Promise(r => setTimeout(r, 1200));
      setState_('success');
    } catch {
      setState_('error');
    }
  }

  if (state === 'success') {
    return (
      <div className="sl-form-success">
        <div className="sl-success-icon">✓</div>
        <h3>Thanks, {name.split(' ')[0]}!</h3>
        <p>We'll reach out within one business day to set up your intake demo and get you started.</p>
      </div>
    );
  }

  return (
    <form className="sl-booking-form" onSubmit={handleSubmit}>
      <div className="sl-form-row">
        <div className="sl-form-field">
          <label>Full Name *</label>
          <input required value={name} onChange={e => setName(e.target.value)} placeholder="Jane Smith" className="sl-input" />
        </div>
        <div className="sl-form-field">
          <label>Law Firm *</label>
          <input required value={firm} onChange={e => setFirm(e.target.value)} placeholder="Smith & Associates" className="sl-input" />
        </div>
      </div>
      <div className="sl-form-row">
        <div className="sl-form-field">
          <label>Email *</label>
          <input required type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@smithlaw.com" className="sl-input" />
        </div>
        <div className="sl-form-field">
          <label>Phone</label>
          <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(555) 000-1234" className="sl-input" />
        </div>
      </div>
      <div className="sl-form-field">
        <label>Tell us about your firm</label>
        <textarea rows={3} value={message} onChange={e => setMessage(e.target.value)}
          placeholder="Practice areas, current lead sources, monthly intake targets..."
          className="sl-input sl-textarea" />
      </div>
      {state === 'error' && (
        <p className="sl-form-error">Something went wrong. Please try again or email us directly.</p>
      )}
      <button type="submit" className="sl-btn-primary sl-btn-full" disabled={state === 'submitting'}>
        {state === 'submitting' ? 'Sending...' : 'Schedule My Demo →'}
      </button>
    </form>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AttorneysPage() {
  const [menuOpen,        setMenuOpen]        = useState(false);
  const [pricingUnlocked, setPricingUnlocked] = useState(false);
  const [unlockedName,    setUnlockedName]    = useState('');
  const [unlockedState,   setUnlockedState]   = useState('');

  const closeMenu = () => setMenuOpen(false);

  function handlePricingUnlock(name: string, state: string) {
    setUnlockedName(name);
    setUnlockedState(state);
    setPricingUnlocked(true);
    // Scroll to pricing after a tick
    setTimeout(() => {
      document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }

  return (
    <div className="sl-page">
      {/* ── NAV ─────────────────────────────────────────────────────────────── */}
      <nav className="sl-nav">
        <div className="sl-nav-inner">
          <Link href="/" className="sl-logo">
            <img src="/images/sam-icons/sam-icon.png" className="sl-logo-icon" alt="Settlement Sam" />
            <span className="sl-logo-text">Settlement Sam</span>
          </Link>
          <div className="sl-nav-links">
            <a href="#features">Features</a>
            <a href="#roi">ROI Calculator</a>
            <a href="#pricing">Pricing</a>
            <a href="#book" className="sl-nav-cta">Schedule Demo</a>
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
          <a href="#features" onClick={closeMenu}>Features</a>
          <a href="#roi" onClick={closeMenu}>ROI Calculator</a>
          <a href="#pricing" onClick={closeMenu}>Pricing</a>
          <a href="#book" className="sl-nav-cta" onClick={closeMenu}>Schedule Demo</a>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────────────────────── */}
      <section className="sl-hero sl-hero--attorneys">
        <div className="container">
          <div className="sl-hero-grid">
            <motion.div
              className="sl-hero-copy"
              initial="hidden" whileInView="visible"
              viewport={{ once: true }} variants={stagger}
            >
              <motion.div variants={fadeUp} className="sl-hero-badge">
                For Personal Injury Attorneys
              </motion.div>
              <motion.h1 variants={fadeUp} className="sl-hero-h1">
                Pre-Screened PI Leads,<br />
                <span className="sl-text-gold">Ready When You Are</span>
              </motion.h1>
              <motion.p variants={fadeUp} className="sl-hero-sub">
                Stop wasting intake hours on unqualified callers.
                Settlement Sam delivers SMS-verified leads with full injury profiles,
                pre-screened so your team knows exactly who to call first.
              </motion.p>
              <motion.div variants={fadeUp} className="sl-hero-actions">
                <a href="#pricing" className="sl-btn-primary">Get Pricing</a>
                <a href="#book" className="sl-btn-secondary">Schedule a Demo →</a>
              </motion.div>
            </motion.div>
            <motion.div
              className="sl-hero-sam"
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
            >
              <div className="sl-sam-avatar-wrap">
                <img src="/images/sam-icons/sam-icon.png" className="sl-sam-avatar" alt="Settlement Sam" />
              </div>
              <motion.div
                className="sl-speech-bubble"
                initial={{ opacity: 0, scale: 0.85 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.45, duration: 0.35 }}
              >
                "Your next case is already in the queue."
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ────────────────────────────────────────────────────────── */}
      <section className="section sl-features" id="features">
        <div className="container">
          <motion.div className="sl-section-header" initial="hidden" whileInView="visible"
            viewport={{ once: true }} variants={stagger}>
            <motion.h2 variants={fadeUp}>
              Not Just Leads — <span className="sl-text-coral">Intelligence</span>
            </motion.h2>
            <motion.p variants={fadeUp} className="sl-section-sub">
              Every lead arrives pre-qualified with the data your intake team needs to close.
            </motion.p>
          </motion.div>
          <motion.div className="sl-features-grid" initial="hidden" whileInView="visible"
            viewport={{ once: true }} variants={stagger}>
            {features.map((f) => (
              <motion.div key={f.title} variants={fadeUp} className="sl-feature-card">
                <div className="sl-feature-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.body}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────────────────────── */}
      <section className="section sl-how">
        <div className="container">
          <motion.div className="sl-section-header" initial="hidden" whileInView="visible"
            viewport={{ once: true }} variants={stagger}>
            <motion.h2 variants={fadeUp}>From Purchase to Pipeline</motion.h2>
          </motion.div>
          <motion.div className="sl-steps-grid" initial="hidden" whileInView="visible"
            viewport={{ once: true }} variants={stagger}>
            {howItWorks.map((s, i) => (
              <motion.div key={s.n} variants={fadeUp} className="sl-step">
                <div className="sl-step-num">{s.n}</div>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
                {i < howItWorks.length - 1 && <div className="sl-step-arrow">→</div>}
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── ROI CALCULATOR ──────────────────────────────────────────────────── */}
      <section className="section sl-roi-section">
        <div className="container">
          <motion.div className="sl-section-header" initial="hidden" whileInView="visible"
            viewport={{ once: true }} variants={stagger}>
            <motion.h2 variants={fadeUp}>Run Your Own Numbers</motion.h2>
            <motion.p variants={fadeUp} className="sl-section-sub">
              Plug in your close rate and average fee to see your projected ROI.
            </motion.p>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.5 }}>
            <RoiCalculator />
          </motion.div>
        </div>
      </section>

      {/* ── PRICING GATE / PRICING SECTION ──────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {pricingUnlocked ? (
          <PricingSection
            key="pricing-unlocked"
            name={unlockedName}
            state={unlockedState}
          />
        ) : (
          <PricingGate key="pricing-gate" onUnlock={handlePricingUnlock} />
        )}
      </AnimatePresence>

      {/* ── BOOKING FORM ────────────────────────────────────────────────────── */}
      <section className="section sl-book" id="book">
        <div className="container">
          <div className="sl-book-grid">
            <motion.div className="sl-book-copy" initial="hidden" whileInView="visible"
              viewport={{ once: true }} variants={stagger}>
              <motion.h2 variants={fadeUp}>Ready to Fill Your Pipeline?</motion.h2>
              <motion.p variants={fadeUp}>
                Schedule a 20-minute demo with our team. We'll walk you through the platform,
                show you sample lead profiles, and help you set up your first intake run.
              </motion.p>
              <motion.ul variants={fadeUp} className="sl-book-bullets">
                <li>✓ No obligation</li>
                <li>✓ See real lead samples</li>
                <li>✓ Get your Google Sheet configured live</li>
                <li>✓ Start receiving leads same day</li>
              </motion.ul>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }} transition={{ duration: 0.5 }}>
              <BookingForm />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────────────────── */}
      <footer className="sl-footer">
        <div className="container">
          <div className="sl-footer-grid">
            <div className="sl-footer-brand">
              <Link href="/" className="sl-logo">
                <img src="/images/sam-icons/sam-logo.png" height="28" alt="Settlement Sam" style={{ display: 'block' }} />
              </Link>
              <p>Pre-screened PI leads for personal injury attorneys.</p>
            </div>
            <div className="sl-footer-links">
              <h4>Product</h4>
              <a href="#features">Features</a>
              <a href="#roi">ROI Calculator</a>
              <a href="#pricing">Pricing</a>
            </div>
            <div className="sl-footer-links">
              <h4>For Claimants</h4>
              <Link href="/">Get an Estimate</Link>
              <Link href="/quiz">Take the Quiz</Link>
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
              Settlement Sam connects attorneys with pre-qualified leads. We are not a law firm.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
