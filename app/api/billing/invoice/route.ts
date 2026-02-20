/**
 * POST /api/billing/invoice
 *
 * Creates a Stripe invoice for a client purchasing a prepaid lead package.
 * Minimum package: 25 leads at $250/lead = $6,250.
 *
 * Body: { clientId: number, quantity: number }
 * Response 200: { success: true, invoiceId: string, invoiceUrl: string, amountDue: number }
 *
 * On payment:  Stripe fires invoice.payment_succeeded → /api/billing/webhook
 *              which updates client.balance and client.leads_purchased in SQLite.
 */

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import Stripe from 'stripe';
import { db } from '@/lib/db';
import type { DbClient } from '@/lib/db';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-in-production';
const STRIPE_SK  = process.env.STRIPE_SECRET_KEY ?? '';

const LEAD_PRICE_CENTS = 25_000;   // $250.00
const MIN_LEADS        = 25;

function verifyAdmin(req: NextRequest): boolean {
  try {
    const auth = req.headers.get('authorization') ?? '';
    const tok  = auth.replace(/^Bearer\s+/i, '');
    const p    = jwt.verify(tok, JWT_SECRET) as { role?: string };
    return p.role === 'admin';
  } catch { return false; }
}

export async function POST(req: NextRequest) {
  if (!verifyAdmin(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  if (!STRIPE_SK) {
    return NextResponse.json({ error: 'stripe_not_configured', message: 'Set STRIPE_SECRET_KEY in .env' }, { status: 500 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { clientId, quantity } = body;
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 });

  const qty = Number(quantity ?? MIN_LEADS);
  if (!Number.isInteger(qty) || qty < MIN_LEADS) {
    return NextResponse.json({
      error:   'invalid_quantity',
      message: `Minimum purchase is ${MIN_LEADS} leads.`,
    }, { status: 400 });
  }

  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(Number(clientId)) as DbClient | undefined;
  if (!client) return NextResponse.json({ error: 'client_not_found' }, { status: 404 });

  const stripe = new Stripe(STRIPE_SK);

  // ── Ensure Stripe customer exists ─────────────────────────────────────────
  let stripeCustomerId = client.stripe_customer_id;
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      name:     `${client.name} — ${client.firm}`,
      email:    client.email,
      metadata: { settlement_sam_client_id: String(client.id) },
    });
    stripeCustomerId = customer.id;
    db.prepare('UPDATE clients SET stripe_customer_id = ? WHERE id = ?').run(stripeCustomerId, client.id);
  }

  // ── Create invoice ────────────────────────────────────────────────────────
  const totalCents = qty * LEAD_PRICE_CENTS;

  const invoice = await stripe.invoices.create({
    customer:              stripeCustomerId,
    collection_method:     'send_invoice',
    days_until_due:        14,
    auto_advance:          false,
    metadata: {
      settlement_sam_client_id: String(client.id),
      lead_quantity:            String(qty),
    },
  });

  // Add line item
  await stripe.invoiceItems.create({
    customer:    stripeCustomerId,
    invoice:     invoice.id,
    amount:      totalCents,
    currency:    'usd',
    description: `${qty} verified personal injury leads — Settlement Sam`,
  });

  // Finalize so it has a hosted URL
  const finalized = await stripe.invoices.finalizeInvoice(invoice.id);

  // Send the invoice email through Stripe
  await stripe.invoices.sendInvoice(finalized.id);

  console.log(`[billing] Invoice ${finalized.id} → Client #${client.id} (${client.firm}) — $${(totalCents / 100).toFixed(2)} for ${qty} leads`);

  return NextResponse.json({
    success:    true,
    invoiceId:  finalized.id,
    invoiceUrl: finalized.hosted_invoice_url,
    amountDue:  totalCents,
    quantity:   qty,
  });
}
