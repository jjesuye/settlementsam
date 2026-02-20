/**
 * lib/distribution/sheets.ts
 * Pushes lead rows to a client's Google Sheets spreadsheet via Sheets API v4.
 *
 * Requires env vars:
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL
 *   GOOGLE_SERVICE_ACCOUNT_KEY   (private key PEM, with literal \n for newlines)
 *
 * The spreadsheet must have the service account added as an Editor.
 * The first row is assumed to be a header row that already exists.
 */

import { google } from 'googleapis';
import { formatCurrency } from '@/lib/estimator/logic';
import type { FsLead } from '@/lib/firebase/types';

const SHEET_RANGE = 'Sheet1!A:Q';
const SCOPES      = ['https://www.googleapis.com/auth/spreadsheets'];

const INJURY_LABELS: Record<string, string> = {
  soft_tissue: 'Soft Tissue', fracture: 'Fracture',
  tbi:         'TBI',         spinal:   'Spinal Cord', other: 'Other',
};

function bool(v: boolean | null) { return v ? 'Yes' : 'No'; }

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key   = (process.env.GOOGLE_SERVICE_ACCOUNT_KEY ?? '').replace(/\\n/g, '\n');

  if (!email || !key) {
    throw new Error('Google service account credentials not configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_KEY in .env');
  }

  return new google.auth.JWT(email, undefined, key, SCOPES);
}

/** The header row written once when the sheet is first created. */
export const SHEET_HEADERS = [
  'ID', 'Name', 'Phone', 'Carrier', 'Injury Type', 'Surgery', 'Hospitalized',
  'In Treatment', 'Missed Work', 'Lost Wages',
  'Estimate Low', 'Estimate High', 'Score', 'Tier', 'Source',
  'Verified', 'Submitted',
];

/**
 * Ensures the header row exists (row 1). Idempotent — only writes if row 1 is empty.
 */
export async function ensureSheetHeaders(sheetsId: string): Promise<void> {
  const auth   = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetsId,
    range:         'Sheet1!A1:Q1',
  });

  if (!res.data.values || res.data.values.length === 0) {
    await sheets.spreadsheets.values.append({
      spreadsheetId:    sheetsId,
      range:            SHEET_RANGE,
      valueInputOption: 'RAW',
      requestBody:      { values: [SHEET_HEADERS] },
    });
  }
}

/**
 * Appends one lead row to the client's Google Sheet.
 * Returns the updated range string.
 */
export async function appendLeadToSheet(sheetsId: string, lead: FsLead & { id: string }): Promise<string> {
  await ensureSheetHeaders(sheetsId);

  const auth   = getAuth();
  const sheets = google.sheets({ version: 'v4', auth });

  const row = [
    lead.id,
    lead.name,
    lead.phone,
    lead.carrier,
    INJURY_LABELS[lead.injury_type] ?? lead.injury_type,
    bool(lead.surgery),
    bool(lead.hospitalized),
    bool(lead.still_treating),
    bool(lead.missed_work),
    lead.lost_wages_estimate > 0 ? formatCurrency(lead.lost_wages_estimate) : '$0',
    formatCurrency(lead.estimate_low),
    formatCurrency(lead.estimate_high),
    lead.score,
    lead.tier,
    lead.source,
    bool(lead.verified),
    new Date(lead.timestamp).toISOString(),
  ];

  const res = await sheets.spreadsheets.values.append({
    spreadsheetId:    sheetsId,
    range:            SHEET_RANGE,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody:      { values: [row] },
  });

  return res.data.updates?.updatedRange ?? SHEET_RANGE;
}

/**
 * Pushes all provided leads to the client's Google Sheet.
 * Returns the count of leads pushed.
 */
export async function pushUndeliveredLeadsToSheet(
  sheetsId: string,
  leads: (FsLead & { id: string })[],
): Promise<number> {
  let count = 0;
  for (const lead of leads) {
    await appendLeadToSheet(sheetsId, lead);
    count++;
  }
  return count;
}
