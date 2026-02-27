/**
 * POST /api/billing/webhook
 *
 * Stripe webhook handler. Listens for invoice.payment_succeeded events and:
 *   1. Updates client balance and leads_purchased in Firestore.
 *   2. Creates/updates a delivery_schedule document for throttled distribution.
 *
 * Set STRIPE_WEBHOOK_SECRET to the signing secret from the Stripe dashboard.
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { generateDeliverySchedule, isoDate } from '@/lib/deliverySchedule';
import type { ThrottleMode } from '@/lib/deliverySchedule';

const STRIPE_SK             = process.env.STRIPE_SECRET_KEY     ?? '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? '';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!STRIPE_SK || !STRIPE_WEBHOOK_SECRET) {
    console.error('[billing/webhook] Stripe env vars not configured');
    return NextResponse.json({ error: 'not_configured' }, { status: 500 });
  }

  const rawBody = await req.text();
  const sig     = req.headers.get('stripe-signature') ?? '';
  const stripe  = new Stripe(STRIPE_SK);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'invalid signature';
    console.error('[billing/webhook] Signature verification failed:', msg);
    return NextResponse.json({ error: 'invalid_signature', message: msg }, { status: 400 });
  }

  switch (event.type) {
    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice;
      await handlePaymentSucceeded(invoice);
      break;
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      console.warn(`[billing/webhook] Payment FAILED — invoice ${invoice.id}, customer ${invoice.customer}`);
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
  const clientId    = invoice.metadata?.settlement_sam_client_id;
  const leadQtyStr  = invoice.metadata?.lead_quantity;
  const tierName    = invoice.metadata?.tier_name         ?? 'Starter';
  const priceStr    = invoice.metadata?.price_per_case    ?? '250';
  const throttleRaw = invoice.metadata?.throttle_mode     ?? 'standard';

  if (!clientId) {
    console.warn(`[billing/webhook] invoice ${invoice.id} has no settlement_sam_client_id metadata — skipping`);
    return;
  }

  const leadQty      = parseInt(leadQtyStr ?? '0', 10);
  const amountPaid   = invoice.amount_paid;
  const pricePerCase = parseInt(priceStr, 10);
  const throttleMode = (['conservative', 'standard', 'aggressive'].includes(throttleRaw)
    ? throttleRaw
    : 'standard') as ThrottleMode;

  if (leadQty <= 0 || amountPaid <= 0) {
    console.warn(`[billing/webhook] invoice ${invoice.id} — invalid qty=${leadQty} or amount=${amountPaid}`);
    return;
  }

  const amountDollars = amountPaid / 100;
  const startDate     = new Date();
  const startIso      = isoDate(startDate.getTime());

  // ── Update client balance & leads_purchased ────────────────────────────────────
  await adminDb.collection('clients').doc(clientId).update({
    balance:         FieldValue.increment(amountDollars),
    leads_purchased: FieldValue.increment(leadQty),
  });

  // ── Record payment ─────────────────────────────────────────────────────────────
  await adminDb.collection('payments').add({
    client_id:         clientId,
    stripe_invoice_id: invoice.id,
    amount:            amountDollars,
    quantity:          leadQty,
    tier_name:         tierName,
    price_per_case:    pricePerCase,
    status:            'paid',
    created_at:        Date.now(),
  });

  // ── Generate delivery schedule ─────────────────────────────────────────────────
  const schedule = generateDeliverySchedule(leadQty, startDate, throttleMode);

  await adminDb.collection('delivery_schedules').add({
    client_id:         clientId,
    throttle_mode:     throttleMode,
    total_qty:         leadQty,
    schedule,
    delivered_by_date: {},
    created_at:        Date.now(),
    start_date:        startIso,
    tier_name:         tierName,
    price_per_case:    pricePerCase,
    stripe_invoice_id: invoice.id,
  });

  console.log(
    `[billing/webhook] ✓ Payment received — Client ${clientId} | +${leadQty} cases | +$${amountDollars.toFixed(2)} | ` +
    `${tierName} @ $${pricePerCase}/case | ${throttleMode} throttle`,
  );
}
