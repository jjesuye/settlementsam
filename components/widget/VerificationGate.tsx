'use client';
/**
 * components/widget/VerificationGate.tsx
 *
 * Firebase Phone Auth gate for the case estimator widget.
 * Step 1: collect name. Step 2: SMSVerification component.
 * On success calls onSuccess(token, firstName).
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency } from '@/lib/estimator/logic';
import type { EstimateRange, EstimatorInputs } from '@/lib/estimator/types';
import SMSVerification from '@/components/SMSVerification';

export interface VerificationGateProps {
  estimate:    EstimateRange;
  inputs:      EstimatorInputs;
  apiBase:     string;
  onSuccess:   (token: string, firstName: string) => void;
  onBack:      () => void;
  isQuizMode?: boolean;
  quizAnswers?: Record<string, unknown>;
}

export function VerificationGate({
  estimate, inputs, apiBase, onSuccess, onBack,
  isQuizMode = false, quizAnswers,
}: VerificationGateProps) {
  const [subStep,  setSubStep]  = useState<'name' | 'verify'>('name');
  const [name,     setName]     = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  // Blurred estimate preview shown behind the gate
  const BlurredPreview = (
    <div className="ss-gate-preview">
      <div className="ss-gate-preview__blur" aria-hidden="true">
        <div className="ss-result-label">Your case may be worth</div>
        <div className="ss-range-main">
          {formatCurrency(estimate.low)}&nbsp;–&nbsp;{formatCurrency(estimate.high)}
        </div>
      </div>
      <div className="ss-gate-preview__overlay">
        <span className="ss-gate-lock-icon">🔒</span>
        <span>Verify to unlock your estimate</span>
      </div>
    </div>
  );

  // Called by SMSVerification after phone is verified
  const handleSmsVerified = async (phoneNumber: string, phoneToken: string) => {
    setLoading(true);
    setError('');
    try {
      const body: Record<string, unknown> = {
        phoneToken,
        name:         name.trim(),
        phone:        phoneNumber,
        injuryType:   inputs.injuryType,
        surgery:      inputs.hasSurgery,
        lostWages:    inputs.lostWages,
        estimateLow:  estimate.low,
        estimateHigh: estimate.high,
        source:       isQuizMode ? 'quiz' : 'widget',
        ...(isQuizMode && quizAnswers ? quizAnswers : {}),
      };
      const res  = await fetch(`${apiBase}/verify-code`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Verification failed.');
      onSuccess(data.token ?? '', name.trim());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <>
      <AnimatePresence mode="wait">
        {subStep === 'name' ? (
          <motion.div
            key="name"
            className="ss-step ss-gate-step"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.25 }}
          >
            {BlurredPreview}

            <div className="ss-lock-card">
              <div className="ss-sam-wrap">
                <img src="/images/sam-icons/sam-logo.png" width={72} height={72} alt="Settlement Sam"
                  style={{ borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
              </div>
              <h3 className="ss-lock-headline">Almost there!</h3>
              <p className="ss-lock-sub">Just need to confirm it's really you.&nbsp;👋</p>

              <div className="ss-fields">
                <div className="ss-field">
                  <label className="ss-field-label" htmlFor="ss-name">First Name</label>
                  <input
                    id="ss-name"
                    className="ss-field-input"
                    type="text"
                    placeholder="Sam"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    autoComplete="given-name"
                  />
                </div>
              </div>

              <button
                className="ss-bridge-cta"
                onClick={() => { if (name.trim()) setSubStep('verify'); }}
                disabled={!name.trim()}
              >
                Continue 📱
              </button>

              <p className="ss-gate-fine">
                Standard message rates may apply. Sam doesn't sell your info — ever.
              </p>
            </div>

            <div className="ss-nav" style={{ marginTop: 16 }}>
              <button className="ss-btn-back" onClick={onBack}>← Back</button>
            </div>
          </motion.div>

        ) : (
          <motion.div
            key="verify"
            className="ss-step ss-gate-step"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.25 }}
          >
            {BlurredPreview}

            <div className="ss-lock-card">
              {loading ? (
                <p style={{ textAlign: 'center', color: 'var(--ss-muted)', padding: '24px 0' }}>
                  Saving your results…
                </p>
              ) : error ? (
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  <p style={{ color: '#EF4444', marginBottom: 12 }}>{error}</p>
                  <button className="ss-btn-back" onClick={() => setError('')}>Try again</button>
                </div>
              ) : (
                <SMSVerification
                  leadName={name}
                  onVerified={handleSmsVerified}
                />
              )}
            </div>

            {!loading && !error && (
              <div className="ss-nav" style={{ marginTop: 8 }}>
                <button className="ss-btn-back" onClick={() => setSubStep('name')}>← Back</button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
