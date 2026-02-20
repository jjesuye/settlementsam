/**
 * POST /api/billing/webhook
 *
 * Stripe webhook handler. Listens for invoice.payment_succeeded events and
 * updates the client's balance and leads_purchased count in SQLite.
 *
 * Set STRIPE_WEBHOOK_SECRET to the signing secret from the Stripe dashboard.
 * Register the webhook to receive: invoice.payment_succeeded, invoice.payment_failed
 */

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { db } from '@/lib/db';

const STRIPE_SK             = process.env.STRIPE_SECRET_KEY     ?? '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? '';

// Disable Next.js body parsing — Stripe needs the raw bytes to verify the signature
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!STRIPE_SK || !STRIPE_WEBHOOK_SECRET) {
    console.error('[billing/webhook] Stripe env vars not configured');
    return NextResponse.json({ error: 'not_configured' }, { status: 500 });
  }

  // Read raw body as text
  const rawBody = await req.text();
  const sig     = req.headers.get('stripe-signature') ?? '';

  const stripe = new Stripe(STRIPE_SK);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'invalid signature';
    console.error('[billing/webhook] Signature verification failed:', msg);
    return NextResponse.json({ error: 'invalid_signature', message: msg }, { status: 400 });
  }

  // ── Handle events ─────────────────────────────────────────────────────────

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
      // Silently ignore unhandled events
      break;
  }

  return NextResponse.json({ received: true });
}

async function handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
  const clientId    = invoice.metadata?.settlement_sam_client_id;
  const leadQtyStr  = invoice.metadata?.lead_quantity;

  if (!clientId) {
    console.warn(`[billing/webhook] invoice ${invoice.id} has no settlement_sam_client_id metadata — skipping`);
    return;
  }

  const leadQty    = parseInt(leadQtyStr ?? '0', 10);
  const amountPaid = invoice.amount_paid; // in cents

  if (leadQty <= 0 || amountPaid <= 0) {
    console.warn(`[billing/webhook] invoice ${invoice.id} — invalid qty=${leadQty} or amount=${amountPaid}`);
    return;
  }

  // Update client balance (in cents → dollars) and leads_purchased
  const amountDollars = amountPaid / 100;

  db.prepare(`
    UPDATE clients
    SET balance          = balance + ?,
        leads_purchased  = leads_purchased + ?
    WHERE id = ?
  `).run(amountDollars, leadQty, Number(clientId));

  // Log the payment
  db.prepare(`
    INSERT INTO payments (client_id, stripe_invoice_id, amount_cents, lead_quantity, paid_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(Number(clientId), invoice.id, amountPaid, leadQty, Date.now());

  console.log(`[billing/webhook] ✓ Payment received — Client #${clientId} | +${leadQty} leads | +$${amountDollars.toFixed(2)} balance`);
}
