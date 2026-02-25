'use client';
/**
 * app/thank-you/lead/page.tsx
 *
 * Thank you page shown after a lead completes the quiz + SMS verification.
 * Dynamic data (first name, state) pulled from URL search params.
 * Redirects to /quiz if accessed directly without params.
 *
 * URL: /thank-you/lead?name=Sam&state=California
 */

import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Suspense } from 'react';
import Link from 'next/link';

const fadeUp = {
  hidden:  { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};
const stagger = { visible: { transition: { staggerChildren: 0.12 } } };

function LeadThankYouContent() {
  const params    = useSearchParams();
  const firstName = params.get('name') ?? 'there';
  const state     = params.get('state') ?? 'your state';

  return (
    <div className="ty-page">
      {/* Ambient glow */}
      <div className="ty-glow" aria-hidden="true" />

      <motion.div
        className="ty-card"
        initial="hidden"
        animate="visible"
        variants={stagger}
      >
        {/* Sam icon */}
        <motion.div variants={fadeUp} className="ty-sam-wrap">
          <motion.img
            src="/images/sam-icons/sam-logo.png"
            alt="Settlement Sam"
            className="ty-sam-icon"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 280, damping: 18, delay: 0.1 }}
          />
        </motion.div>

        {/* Headline */}
        <motion.h1 variants={fadeUp} className="ty-headline">
          You're all set, {firstName}! 🎉
        </motion.h1>

        {/* Subtext */}
        <motion.p variants={fadeUp} className="ty-sub">
          A licensed personal injury attorney in{' '}
          <strong>{state}</strong> will reach out to review your case.
          This is completely free — attorneys only get paid when you win.
        </motion.p>

        {/* What happens next */}
        <motion.div variants={fadeUp} className="ty-next-card">
          <h3 className="ty-next-title">What happens next</h3>
          <ol className="ty-steps">
            <li>
              <span className="ty-step-num">1</span>
              <span>An attorney reviews your case details</span>
            </li>
            <li>
              <span className="ty-step-num">2</span>
              <span>They contact you within 1 business day</span>
            </li>
            <li>
              <span className="ty-step-num">3</span>
              <span>Your free consultation is scheduled</span>
            </li>
            <li>
              <span className="ty-step-num">4</span>
              <span>You decide if you want to move forward</span>
            </li>
          </ol>
        </motion.div>

        {/* Sam quote */}
        <motion.blockquote variants={fadeUp} className="ty-quote">
          <p>
            "I've seen cases like yours result in life-changing settlements.
            You deserve to know what you're really worth."
          </p>
          <cite>— Sam</cite>
        </motion.blockquote>

        {/* Back to home */}
        <motion.div variants={fadeUp}>
          <Link href="/" className="ty-home-btn">← Back to Homepage</Link>
        </motion.div>
      </motion.div>
    </div>
  );
}

export default function LeadThankYouPage() {
  return (
    <Suspense fallback={<div className="ty-page" />}>
      <LeadThankYouContent />
    </Suspense>
  );
}
