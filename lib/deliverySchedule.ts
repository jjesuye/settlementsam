/**
 * lib/deliverySchedule.ts
 * Generates and checks delivery throttle schedules for case packages.
 *
 * Throttle modes:
 *   conservative  3–5 / day
 *   standard      5–7 / day
 *   aggressive    8–12 / day
 *
 * Day 1 ramps at half rate. Each day gets a random ±2 variation
 * within the mode range.
 */

export type ThrottleMode = 'conservative' | 'standard' | 'aggressive';

export const THROTTLE_RANGES: Record<ThrottleMode, { min: number; max: number }> = {
  conservative: { min: 3, max: 5  },
  standard:     { min: 5, max: 7  },
  aggressive:   { min: 8, max: 12 },
};

/** ISO date string YYYY-MM-DD for a given timestamp. */
export function isoDate(ts = Date.now()): string {
  return new Date(ts).toISOString().split('T')[0];
}

/**
 * Generate a daily delivery schedule.
 * Returns an object mapping ISO dates to target case counts.
 */
export function generateDeliverySchedule(
  qty:       number,
  startDate: Date,
  mode:      ThrottleMode,
): Record<string, number> {
  const { min, max } = THROTTLE_RANGES[mode];
  const schedule: Record<string, number> = {};
  let remaining = qty;
  const date    = new Date(startDate);
  let isFirst   = true;

  while (remaining > 0) {
    const dateStr = date.toISOString().split('T')[0];

    // Base target with ±2 variation, clamped to mode range
    const base      = min + Math.floor(Math.random() * (max - min + 1));
    const variation = Math.floor(Math.random() * 5) - 2;
    let   target    = Math.max(min, Math.min(max, base + variation));

    // Day 1 ramp-up: deliver at half rate (minimum 1)
    if (isFirst) {
      target  = Math.max(1, Math.floor(target / 2));
      isFirst = false;
    }

    // Never exceed remaining
    target = Math.min(target, remaining);
    schedule[dateStr] = target;
    remaining        -= target;

    date.setDate(date.getDate() + 1);
  }

  return schedule;
}

/** Today's scheduled target for a client; 0 if not in schedule. */
export function todayTarget(schedule: Record<string, number>): number {
  return schedule[isoDate()] ?? 0;
}

/** Whether today's throttle has been reached. */
export function throttleExceeded(
  schedule:        Record<string, number>,
  deliveredToday:  number,
): boolean {
  return deliveredToday >= todayTarget(schedule);
}
