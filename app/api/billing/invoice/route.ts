/**
 * POST /api/billing/invoice
 *
 * Creates a Stripe invoice for a client purchasing a prepaid verified-case package.
 * Minimum package: 25 cases. Tier pricing:
 *   Starter  25+   $250/case
 *   Growth  100+   $225/case
 *   Scale   250+   $200/case
 *
 * Body: { clientId: string, quantity: number, throttleMode?: 'conservative' | 'standard' | 'aggressive' }
 * Response 200: { success: true, invoiceId, invoiceUrl, amountDue, quantity, tierName, pricePerCase }
 *
 * On payment: Stripe fires invoice.payment_succeeded → /api/billing/webhook
 *             which updates client balance, leads_purchased, and delivery schedule.
 */

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase/admin';
import type { FsClient } from '@/lib/firebase/types';
import { calculateOrderPrice, MIN_ORDER } from '@/lib/pricing';
import type { ThrottleMode } from '@/lib/deliverySchedule';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-in-production';
const STRIPE_SK  = process.env.STRIPE_SECRET_KEY ?? '';

function verifyAdmin(req: NextRequest): boolean {
  try {
    const auth = req.headers.get('authorization') ?? '';
    const tok  = auth.replace(/^Bearer\s+/i, '');
    const p    = jwt.verify(tok, JWT_SECRET) as { role?: string };
    return p.role === 'admin';
  } catch { return false; }
}

const VALID_THROTTLE_MODES: ThrottleMode[] = ['conservative', 'standard', 'aggressive'];

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  if (!STRIPE_SK) {
    return NextResponse.json(
      { error: 'stripe_not_configured', message: 'Set STRIPE_SECRET_KEY in .env' },
      { status: 500 },
    );
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { clientId, quantity, throttleMode = 'standard' } = body;
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 });

  const qty = Number(quantity ?? MIN_ORDER);
  if (!Number.isInteger(qty) || qty < MIN_ORDER) {
    return NextResponse.json(
      { error: 'invalid_quantity', message: `Minimum purchase is ${MIN_ORDER} verified cases.` },
      { status: 400 },
    );
  }

  const mode = String(throttleMode);
  if (!VALID_THROTTLE_MODES.includes(mode as ThrottleMode)) {
    return NextResponse.json(
      { error: 'invalid_throttle_mode', message: 'throttleMode must be conservative, standard, or aggressive.' },
      { status: 400 },
    );
  }

  const clientDoc = await adminDb.collection('clients').doc(String(clientId)).get();
  if (!clientDoc.exists) return NextResponse.json({ error: 'client_not_found' }, { status: 404 });

  const client = { id: clientDoc.id, ...clientDoc.data() } as FsClient & { id: string };
  const stripe  = new Stripe(STRIPE_SK);

  // ── Tier pricing ──────────────────────────────────────────────────────────────
  const { tierName, pricePerCase, totalCents } = calculateOrderPrice(qty);

  // ── Ensure Stripe customer exists ─────────────────────────────────────────────
  let stripeCustomerId = client.stripe_customer_id;
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      name:     `${client.name} — ${client.firm}`,
      email:    client.email,
      metadata: { settlement_sam_client_id: client.id },
    });
    stripeCustomerId = customer.id;
    await adminDb.collection('clients').doc(client.id).update({ stripe_customer_id: stripeCustomerId });
  }

  // ── Create invoice ─────────────────────────────────────────────────────────────
  const invoice = await stripe.invoices.create({
    customer:          stripeCustomerId,
    collection_method: 'send_invoice',
    days_until_due:    0,   // payment due upfront
    auto_advance:      false,
    metadata: {
      settlement_sam_client_id: client.id,
      lead_quantity:            String(qty),
      tier_name:                tierName,
      price_per_case:           String(pricePerCase),
      throttle_mode:            mode,
    },
    footer: 'Payment is due upon receipt. Verified cases will be delivered according to your selected throttle schedule once payment clears.',
  });

  await stripe.invoiceItems.create({
    customer:    stripeCustomerId,
    invoice:     invoice.id,
    amount:      totalCents,
    currency:    'usd',
    description: `${qty} SMS-verified personal injury cases — ${tierName} package ($${pricePerCase}/case) — Settlement Sam\n\nDelivery begins within 1 business day of payment. Cases are exclusive to your firm for 90 days from delivery. Full upfront payment required before delivery begins.`,
  });

  const finalized = await stripe.invoices.finalizeInvoice(invoice.id);
  await stripe.invoices.sendInvoice(finalized.id);

  console.log(
    `[billing] Invoice ${finalized.id} → Client ${client.id} (${client.firm}) — ` +
    `$${(totalCents / 100).toFixed(2)} for ${qty} cases (${tierName} @ $${pricePerCase}/case, ${mode} throttle)`,
  );

  return NextResponse.json({
    success:      true,
    invoiceId:    finalized.id,
    invoiceUrl:   finalized.hosted_invoice_url,
    amountDue:    totalCents,
    quantity:     qty,
    tierName,
    pricePerCase,
  });
}
