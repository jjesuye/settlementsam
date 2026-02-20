'use client';
/**
 * components/widget/Gauge.tsx
 * Animated arc gauge — speedometer energy.
 * Gradient fill: amber #E8A838 → forest green #4A7C59
 * Spring overshoot animation via Framer Motion.
 */

import { motion, useSpring, useTransform } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { formatCurrency } from '@/lib/estimator/logic';
import type { EstimateRange } from '@/lib/estimator/types';

// ── Gauge geometry ─────────────────────────────────────────────────────────────
const SIZE        = 280;
const CX          = SIZE / 2;
const CY          = SIZE / 2 + 16;   // arc center slightly below SVG center
const RADIUS      = 110;
const STROKE_W    = 18;
const START_ANGLE = -200;             // degrees (12 o'clock - 20°)
const END_ANGLE   =   20;            // degrees
const ARC_SPAN    = END_ANGLE - START_ANGLE;  // 220°

/** Convert polar coordinates to SVG x,y */
function polar(angle: number, r = RADIUS): { x: number; y: number } {
  const rad = ((angle - 90) * Math.PI) / 180;
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

/** Build an SVG arc path string */
function arcPath(startAngle: number, endAngle: number): string {
  const s    = polar(startAngle);
  const e    = polar(endAngle);
  const span = endAngle - startAngle;
  const large = span > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${RADIUS} ${RADIUS} 0 ${large} 1 ${e.x} ${e.y}`;
}

// Full track path (always rendered, semi-transparent)
const TRACK_PATH = arcPath(START_ANGLE, END_ANGLE);

interface GaugeProps {
  estimate:   EstimateRange | null;
  /** True while user is dragging the wage slider — suppresses overshoot. */
  isDragging: boolean;
}

export function Gauge({ estimate, isDragging }: GaugeProps) {
  // Fraction of arc to fill: 0 → 1
  // We anchor the fraction to the midpoint of the estimate range so the needle
  // reflects the centre value rather than always pinning to one end.
  const midValue  = estimate ? (estimate.low + estimate.high) / 2 : 0;
  const maxValue  = 2_500_000;  // upper bound of the gauge scale
  const fraction  = estimate ? Math.min(midValue / maxValue, 1) : 0;

  // Spring animation for smooth overshoot
  const spring = useSpring(0, {
    stiffness: isDragging ? 200 : 120,
    damping:   isDragging ? 30  : 14,
    mass:      0.8,
  });

  useEffect(() => {
    spring.set(fraction);
  }, [fraction, spring]);

  // Convert spring value → end angle for the fill arc
  const fillEndAngle = useTransform(spring, v =>
    START_ANGLE + v * ARC_SPAN
  );

  // Stroke-dasharray / dashoffset trick for the gradient arc
  // We draw a full arc circle (circumference) and offset it
  const circumference = 2 * Math.PI * RADIUS;
  const arcLength     = (ARC_SPAN / 360) * circumference;

  const dashOffset = useTransform(spring, v => {
    const filled = v * arcLength;
    return arcLength - filled;
  });

  // Needle tip position
  const needleTip = useTransform(spring, v => {
    const angle = START_ANGLE + v * ARC_SPAN;
    return polar(angle, RADIUS);
  });

  const gradientId  = 'gauge-gradient';
  const trackId     = 'gauge-track-clip';

  return (
    <svg
      width={SIZE}
      height={SIZE * 0.72}
      viewBox={`0 0 ${SIZE} ${SIZE * 0.72}`}
      aria-label={
        estimate
          ? `Estimated case value: ${formatCurrency(estimate.low)} to ${formatCurrency(estimate.high)}`
          : 'Waiting for inputs'
      }
      role="img"
    >
      <defs>
        {/* Amber → Forest Green gradient along the arc */}
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#E8A838" />
          <stop offset="50%"  stopColor="#8FB88A" />
          <stop offset="100%" stopColor="#4A7C59" />
        </linearGradient>

        {/* Soft glow filter on the fill arc */}
        <filter id="gauge-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Track — full arc, low opacity */}
      <path
        d={TRACK_PATH}
        fill="none"
        stroke="rgba(44,62,53,0.08)"
        strokeWidth={STROKE_W}
        strokeLinecap="round"
      />

      {/* Fill arc — animated via dashoffset */}
      <motion.path
        d={TRACK_PATH}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={STROKE_W}
        strokeLinecap="round"
        filter="url(#gauge-glow)"
        strokeDasharray={arcLength}
        style={{ strokeDashoffset: dashOffset }}
        pathLength={1}
      />

      {/* Needle dot */}
      <motion.circle
        r={STROKE_W / 2 + 2}
        fill="#E8A838"
        filter="url(#gauge-glow)"
        style={{
          cx: useTransform(needleTip, p => p.x),
          cy: useTransform(needleTip, p => p.y),
        }}
      />
      <motion.circle
        r={4}
        fill="#2C3E35"
        style={{
          cx: useTransform(needleTip, p => p.x),
          cy: useTransform(needleTip, p => p.y),
        }}
      />

      {/* Centre pivot dot */}
      <circle cx={CX} cy={CY} r={7} fill="#FDF6E9" stroke="#E8A838" strokeWidth={2} />

      {/* Dollar labels */}
      {estimate && (
        <>
          <text
            x={CX}
            y={CY - RADIUS - STROKE_W - 10}
            textAnchor="middle"
            fill="#6B7C74"
            fontSize={12}
            fontFamily="Inter, system-ui, sans-serif"
          >
            Your case may be worth
          </text>
          <text
            x={CX}
            y={CY - RADIUS - STROKE_W - 28}
            textAnchor="middle"
            fill="#2C3E35"
            fontSize={11}
            fontFamily="Inter, system-ui, sans-serif"
            opacity={0.5}
          >
            estimated range
          </text>
        </>
      )}
    </svg>
  );
}
