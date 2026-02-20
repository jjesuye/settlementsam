/**
 * lib/distribution/email.ts
 * Sends a formatted lead notification email to a client (law firm).
 * Uses Nodemailer → Gmail SMTP.
 */

import nodemailer from 'nodemailer';
import { formatCurrency } from '@/lib/estimator/logic';
import type { DbLead, DbClient } from '@/lib/db';

const INJURY_LABELS: Record<string, string> = {
  soft_tissue: 'Soft Tissue (Sprains / Whiplash)',
  fracture:    'Broken Bone / Fracture',
  tbi:         'Head Injury / TBI',
  spinal:      'Spinal Cord Injury',
  other:       'Other / Multiple',
};

function bool(v: number | null) { return v ? 'Yes' : 'No'; }

function createMailer() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

/**
 * Sends a full lead profile email to the client's registered address.
 * Throws on SMTP failure so the caller can handle it.
 */
export async function sendLeadEmail(lead: DbLead, client: DbClient): Promise<void> {
  const mailer = createMailer();
  const tier   = lead.tier;
  const tierEmoji = tier === 'HOT' ? '🔥' : tier === 'WARM' ? '⭐' : '🧊';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Settlement Sam — New Lead</title>
</head>
<body style="margin:0;padding:0;background:#FDF6E9;font-family:'Inter',Arial,sans-serif;">

  <!-- Header -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#2C3E35;">
    <tr>
      <td style="padding:24px 32px;">
        <span style="font-size:22px;font-weight:800;color:#E8A838;">Settlement Sam</span>
        <span style="display:block;font-size:11px;color:#6B7C74;margin-top:4px;">New Verified Lead</span>
      </td>
    </tr>
  </table>

  <!-- Content -->
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;">
    <tr>
      <td style="padding:32px 24px 16px;">

        <!-- Tier badge -->
        <div style="display:inline-block;background:${tier === 'HOT' ? '#E8A838' : tier === 'WARM' ? '#4A7C59' : '#E8DCC8'};
          color:${tier === 'COLD' ? '#6B7C74' : '#fff'};font-size:12px;font-weight:700;padding:5px 14px;border-radius:999px;letter-spacing:0.5px;
          text-transform:uppercase;margin-bottom:20px;">
          ${tierEmoji} ${tier} Lead — Score ${lead.score}/150
        </div>

        <h2 style="margin:0 0 20px;font-size:24px;color:#2C3E35;">
          ${lead.name}
        </h2>

        <!-- Contact info box -->
        <table width="100%" cellpadding="0" cellspacing="0"
          style="background:#2C3E35;border-radius:12px;margin-bottom:20px;">
          <tr><td style="padding:20px 24px;">
            <p style="margin:0 0 4px;font-size:11px;color:#6B7C74;text-transform:uppercase;letter-spacing:0.5px;">Phone</p>
            <p style="margin:0 0 16px;font-size:18px;font-weight:700;color:#FDF6E9;">${lead.phone}</p>
            <p style="margin:0 0 4px;font-size:11px;color:#6B7C74;text-transform:uppercase;letter-spacing:0.5px;">Source</p>
            <p style="margin:0 0 0;font-size:14px;color:#E8A838;font-weight:600;text-transform:capitalize;">${lead.source} • Verified ${new Date(lead.timestamp).toLocaleString()}</p>
          </td></tr>
        </table>

        <!-- Injury details -->
        <table width="100%" cellpadding="0" cellspacing="0"
          style="background:#fff;border:1px solid #E8DCC8;border-radius:12px;margin-bottom:20px;">
          <tr><td style="padding:20px 24px;">
            <h3 style="margin:0 0 16px;font-size:14px;color:#2C3E35;border-bottom:1px solid #E8DCC8;padding-bottom:10px;">Injury Details</h3>
            <table width="100%" cellpadding="4">
              <tr><td style="font-size:12px;color:#6B7C74;width:180px;">Injury Type</td><td style="font-size:13px;font-weight:600;color:#2C3E35;">${INJURY_LABELS[lead.injury_type] ?? lead.injury_type}</td></tr>
              <tr><td style="font-size:12px;color:#6B7C74;">Surgery</td>      <td style="font-size:13px;font-weight:600;color:#2C3E35;">${bool(lead.surgery)}</td></tr>
              <tr><td style="font-size:12px;color:#6B7C74;">Hospitalized</td> <td style="font-size:13px;font-weight:600;color:#2C3E35;">${bool(lead.hospitalized)}</td></tr>
              <tr><td style="font-size:12px;color:#6B7C74;">In Treatment</td> <td style="font-size:13px;font-weight:600;color:#2C3E35;">${bool(lead.still_in_treatment)}</td></tr>
              <tr><td style="font-size:12px;color:#6B7C74;">Missed Work</td>  <td style="font-size:13px;font-weight:600;color:#2C3E35;">${bool(lead.missed_work)}</td></tr>
              ${lead.missed_work_days ? `<tr><td style="font-size:12px;color:#6B7C74;">Days Missed</td><td style="font-size:13px;font-weight:600;color:#2C3E35;">${lead.missed_work_days} days</td></tr>` : ''}
              <tr><td style="font-size:12px;color:#6B7C74;">Lost Wages</td>   <td style="font-size:13px;font-weight:600;color:#2C3E35;">${lead.lost_wages > 0 ? formatCurrency(lead.lost_wages) : '$0'}</td></tr>
            </table>
          </td></tr>
        </table>

        <!-- Estimate -->
        <table width="100%" cellpadding="0" cellspacing="0"
          style="background:#2C3E35;border-radius:12px;margin-bottom:20px;text-align:center;">
          <tr><td style="padding:24px;">
            <p style="margin:0 0 4px;font-size:12px;color:#6B7C74;">Estimated Case Value</p>
            <p style="margin:0;font-size:28px;font-weight:800;color:#E8A838;">
              ${formatCurrency(lead.estimate_low)} – ${formatCurrency(lead.estimate_high)}
            </p>
          </td></tr>
        </table>

        <!-- Disclaimer -->
        <p style="font-size:10px;color:#6B7C74;line-height:1.6;margin:0 0 24px;">
          This lead was submitted via Settlement Sam and verified via SMS. Estimate is based on general settlement data and is not legal advice.
          Every case is different. Actual results depend on specific facts, applicable law, and other factors.
        </p>

      </td>
    </tr>
  </table>

  <!-- Footer -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#2C3E35;margin-top:16px;">
    <tr><td style="padding:20px 32px;font-size:11px;color:#6B7C74;text-align:center;">
      Settlement Sam • Confidential lead report for ${client.firm} • Do not forward.
    </td></tr>
  </table>

</body>
</html>`;

  await mailer.sendMail({
    from:    `"Settlement Sam Leads" <${process.env.GMAIL_USER}>`,
    to:      client.email,
    subject: `${tierEmoji} New ${tier} Lead — ${lead.name} | Settlement Sam`,
    html,
    text:    `New ${tier} Lead: ${lead.name} | Phone: ${lead.phone} | Estimate: ${formatCurrency(lead.estimate_low)}–${formatCurrency(lead.estimate_high)} | Score: ${lead.score}/150`,
  });
}
