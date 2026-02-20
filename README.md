# ⚖ Settlement Sam

Personal injury lead generation SaaS. Estimates case value → captures verified leads → distributes to PI law firm clients.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router, TypeScript) |
| Database | SQLite via Node.js 22 `node:sqlite` (no driver deps) |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| SMS | Nodemailer → carrier email-to-SMS gateway |
| Email delivery | Nodemailer + Gmail SMTP |
| Google Sheets | googleapis (service account JWT) |
| Payments | Stripe (invoices + webhooks) |
| PDF reports | PDFKit |
| Animations | Framer Motion |
| Styling | Tailwind CSS + custom CSS design system |
| Tests | Jest + ts-jest |

---

## Project Structure

```
settlement-sam/
├── app/
│   ├── page.tsx                     # Landing page (/)
│   ├── quiz/page.tsx                # 12-step quiz funnel (/quiz)
│   ├── admin/page.tsx               # Admin dashboard (/admin)
│   ├── attorneys/page.tsx           # Attorney B2B page (/attorneys)
│   ├── globals.css                  # Full design system (ss- sq- sa- sl- prefixes)
│   └── api/
│       ├── health/route.ts          # GET /api/health
│       ├── send-code/route.ts       # POST /api/send-code
│       ├── verify-code/route.ts     # POST /api/verify-code
│       ├── admin/
│       │   ├── login/route.ts       # POST /api/admin/login
│       │   ├── leads/route.ts       # GET /api/admin/leads
│       │   ├── leads/[id]/route.ts  # GET|POST /api/admin/leads/:id
│       │   ├── leads/[id]/pdf/route.ts
│       │   ├── clients/route.ts     # GET|POST /api/admin/clients
│       │   ├── stats/route.ts       # GET /api/admin/stats
│       │   └── sms-stats/route.ts   # GET /api/admin/sms-stats
│       ├── distribute/
│       │   ├── route.ts             # POST /api/distribute
│       │   └── sheets/route.ts      # POST /api/distribute/sheets
│       └── billing/
│           ├── invoice/route.ts     # POST /api/billing/invoice
│           └── webhook/route.ts     # POST /api/billing/webhook (Stripe)
├── components/
│   ├── widget/                      # CaseEstimatorWidget, Gauge, VerificationGate
│   ├── quiz/QuizFlow.tsx            # 12-question quiz component
│   └── admin/                       # AdminLogin + 5 tab components
├── lib/
│   ├── db/index.ts                  # SQLite singleton + typed row interfaces
│   ├── db/schema.ts                 # All CREATE TABLE statements
│   ├── estimator/                   # logic.ts, types.ts, useEstimator.ts
│   ├── quiz/                        # questions.ts, scoring.ts, types.ts
│   ├── admin/auth.ts                # Token helpers, inactivity watcher
│   ├── distribution/
│   │   ├── email.ts                 # sendLeadEmail (Nodemailer/Gmail)
│   │   └── sheets.ts                # appendLeadToSheet (Google Sheets API v4)
│   └── sms.ts                       # sendSmsCode (carrier email gateway)
├── scripts/
│   └── admin-setup.ts               # CLI: setup | hash-password | reset-password
├── tests/
│   ├── estimator.test.ts
│   ├── sms.test.ts
│   ├── api-verification.test.ts
│   ├── quiz/scoring.test.ts
│   ├── admin/login.test.ts
│   └── distribution/distribute.test.ts
│   └── billing/billing.test.ts
└── deployment/
    ├── nginx.conf                   # nginx reverse-proxy config
    ├── ecosystem.config.js          # PM2 cluster config
    └── deploy.sh                    # One-command deploy script
```

---

## Local Development

### 1. Prerequisites

- **Node.js 22+** (required for `node:sqlite`)
- **npm 10+**

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
# ── Database ──────────────────────────────────────────────────────────────────
DATABASE_PATH=./db/settlement_sam.db    # created automatically on first run

# ── Admin auth ────────────────────────────────────────────────────────────────
JWT_SECRET=your-long-random-secret-here-min-32-chars
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_HASH=                             # leave blank initially, set after setup
# ADMIN_PASSWORD=                       # plaintext fallback (dev only, never production)

# ── SMS (carrier email-to-SMS gateway) ───────────────────────────────────────
GMAIL_USER=your@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx  # Google App Password (not your main password)

# ── Google Sheets (service account) ──────────────────────────────────────────
GOOGLE_SERVICE_ACCOUNT_EMAIL=sam@project-name.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_KEY=-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n

# ── Stripe ────────────────────────────────────────────────────────────────────
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...         # from Stripe dashboard webhook endpoint

# ── App ───────────────────────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Set up admin password

```bash
npm run admin:setup
```

Follow the prompts. This generates a bcrypt hash — copy the `ADMIN_HASH=` line into `.env`.

### 5. Run database migration

```bash
npm run db:migrate
```

### 6. Start dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 7. Run tests

```bash
npm test
```

---

## Admin Dashboard

URL: `/admin`

| Tab | Description |
|---|---|
| Pipeline | All leads with filtering, search, pagination |
| Lead Profile | Full lead detail + PDF export + distribute |
| SMS Controls | Verification stats, carrier breakdown, manual resend |
| Ad Performance | Campaign tracker (localStorage) |
| Client Management | CRUD for attorney clients + bulk sheet push |

**First login:** Run `npm run admin:setup` to create credentials.

**Forgot password:** `npm run admin:reset-password` — CLI only, no email reset.

**Auto-logout:** 30 minutes of inactivity.

**Brute-force protection:** 5 failed attempts → 15-minute lockout per IP/email combo.

---

## Lead Scoring

Leads are scored 0–150 across multiple factors:

| Factor | Points |
|---|---|
| Injury type | 10 (soft tissue) → 50 (spinal/TBI) |
| Surgery | +40 |
| Hospitalized | +20 |
| Still in treatment | +10 |
| Missed work | +10 |
| Days missed | up to +15 |
| Lost wages | up to +25 |
| Insurance contacted | up to +10 |
| Fault level | up to +5 |
| Incident recency | +1 to +5 |

| Tier | Score |
|---|---|
| 🔥 HOT | ≥ 85 |
| ⭐ WARM | 45–84 |
| 🧊 COLD | < 45 |

**Disqualifiers** (lead marked unqualified, not saved):
- Has existing attorney
- Fully at fault
- Incident > 3 years ago
- Never received treatment

---

## Lead Distribution

```
POST /api/distribute
Body: { leadId, clientId?, method: 'email' | 'sheets' | 'both' }
```

- Duplicate prevention: 409 if already delivered
- Updates `leads.delivered`, `clients.leads_delivered`, inserts `deliveries` row
- Email: branded HTML via Gmail SMTP
- Sheets: appends row to client's Google Sheet (service account must be Editor)

```
POST /api/distribute/sheets
Body: { clientId }
```

Pushes all verified leads for a client to their Google Sheet.

---

## Stripe Billing

```
POST /api/billing/invoice
Body: { clientId, quantity }   # quantity >= 25, $250/lead
```

Creates a Stripe invoice, finalizes it, and sends via email. Returns hosted invoice URL.

```
POST /api/billing/webhook
```

Handles `invoice.payment_succeeded`:
- Updates `clients.balance` (+dollars)
- Updates `clients.leads_purchased` (+quantity)
- Records payment in `payments` table

**Register in Stripe Dashboard:** Add endpoint pointing to `https://yourdomain.com/api/billing/webhook`, select `invoice.payment_succeeded` and `invoice.payment_failed`.

---

## Google Sheets Setup

1. Create a Google Cloud project and enable the **Google Sheets API**
2. Create a **Service Account** → download JSON key
3. Copy `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`
4. Copy `private_key` (replace real newlines with `\n`) → `GOOGLE_SERVICE_ACCOUNT_KEY`
5. Share each client's Google Sheet with the service account email as **Editor**
6. Copy the Sheet ID (from the URL: `docs.google.com/spreadsheets/d/**SHEET_ID**/edit`)
7. Add `sheets_id` to the client record in Admin → Client Management

---

## Production Deployment

### Server requirements

- Ubuntu 22.04 LTS (or similar)
- Node.js 22+
- nginx
- PM2 (`npm install -g pm2`)
- Certbot

### Step-by-step

#### 1. Clone and install on server

```bash
git clone https://github.com/youruser/settlement-sam.git /var/www/settlement-sam
cd /var/www/settlement-sam
npm ci --omit=dev
```

#### 2. Configure environment

```bash
cp .env.example .env
nano .env   # fill in all production values
```

#### 3. Set up admin credentials

```bash
npm run admin:setup
# copy ADMIN_HASH= line to .env
```

#### 4. Migrate database

```bash
npm run db:migrate
```

#### 5. Build

```bash
npm run build
```

#### 6. Start with PM2

```bash
pm2 start deployment/ecosystem.config.js --env production
pm2 save
pm2 startup   # follow the printed command
```

#### 7. Configure nginx

```bash
sudo cp deployment/nginx.conf /etc/nginx/sites-available/settlement-sam
sudo nano /etc/nginx/sites-available/settlement-sam
# Replace yourdomain.com everywhere
sudo ln -s /etc/nginx/sites-available/settlement-sam /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

Add rate limiting to `/etc/nginx/nginx.conf` inside the `http {}` block:

```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=30r/m;
```

#### 8. Issue SSL certificate (Certbot)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
# Certbot auto-populates the SSL block in nginx.conf
sudo systemctl reload nginx
```

Certbot auto-renews via cron. Verify: `sudo certbot renew --dry-run`

#### 9. DNS (IONOS)

In your IONOS control panel → DNS:

| Type | Name | Value | TTL |
|---|---|---|---|
| A | @ | `YOUR_SERVER_IP` | 3600 |
| A | www | `YOUR_SERVER_IP` | 3600 |

Propagation takes 5–60 minutes.

#### 10. Register Stripe webhook

In Stripe Dashboard → Developers → Webhooks → Add endpoint:
- URL: `https://yourdomain.com/api/billing/webhook`
- Events: `invoice.payment_succeeded`, `invoice.payment_failed`
- Copy the signing secret → `STRIPE_WEBHOOK_SECRET` in `.env`
- `pm2 reload sam`

#### 11. Future deploys

```bash
./deployment/deploy.sh main
```

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `DATABASE_PATH` | No | SQLite file path (default: `./db/settlement_sam.db`) |
| `JWT_SECRET` | **Yes** | Random secret for JWT signing (≥32 chars) |
| `ADMIN_EMAIL` | **Yes** | Admin login email |
| `ADMIN_HASH` | **Yes (prod)** | bcrypt hash of admin password |
| `ADMIN_PASSWORD` | Dev only | Plaintext fallback (never use in production) |
| `GMAIL_USER` | **Yes** | Gmail address for SMTP |
| `GMAIL_APP_PASSWORD` | **Yes** | Google App Password |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Sheets | Service account email |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Sheets | Private key PEM (`\n` escaped) |
| `STRIPE_SECRET_KEY` | Billing | Stripe secret key (`sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | Billing | Webhook signing secret (`whsec_...`) |
| `NEXT_PUBLIC_APP_URL` | **Yes** | Full app URL (`https://yourdomain.com`) |

---

## License

Proprietary. All rights reserved.
