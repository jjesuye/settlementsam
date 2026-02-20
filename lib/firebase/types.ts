/**
 * lib/firebase/types.ts
 * TypeScript interfaces for every Firestore collection document.
 * These replace the old DbLead, DbClient, etc. from lib/db/index.ts.
 */

export interface FsLead {
  id?: string;               // Firestore document ID (set after fetch)
  name: string;
  phone: string;
  email: string | null;
  carrier: string;
  state: string | null;
  injury_type: string;       // soft_tissue | fracture | tbi | spinal | motor_vehicle | slip_fall | workplace | med_mal | other
  surgery: boolean;
  hospitalized: boolean;
  still_treating: boolean;
  missed_work: boolean;
  lost_wages_estimate: number;
  insurance_contacted: boolean;
  has_attorney: boolean;
  at_fault: boolean;
  score: number;
  tier: string;              // HOT | WARM | COLD
  verified: boolean;
  source: string;            // widget | quiz
  timestamp: number;         // Unix ms
  delivered: boolean;
  replaced: boolean;
  disputed: boolean;
  client_id: string | null;  // Firestore client doc ID
  estimate_low: number;
  estimate_high: number;
  incident_timeframe: string | null;
  statute_warning: boolean;
  disqualified: boolean;
  disqualify_reason: string | null;
}

export interface FsVerificationCode {
  id?: string;
  phone: string;
  code: string;
  expires_at: number;        // Unix ms
  used: boolean;
  attempts: number;
  timestamp: number;         // Unix ms (created at)
}

export interface FsClient {
  id?: string;
  name: string;
  firm: string;
  email: string;
  sheets_id: string | null;
  leads_purchased: number;
  leads_delivered: number;
  leads_replaced: number;
  balance: number;           // prepaid credit in dollars
  stripe_customer_id: string | null;
  created_at: number;        // Unix ms
}

export interface FsDelivery {
  id?: string;
  lead_id: string;           // Firestore lead doc ID
  client_id: string;         // Firestore client doc ID
  method: string;            // email | sheets | both
  delivered_at: number;      // Unix ms
  status: string;            // delivered | failed | disputed | replaced
}

export interface FsPayment {
  id?: string;
  client_id: string;         // Firestore client doc ID
  amount: number;            // amount in dollars
  stripe_invoice_id: string;
  status: string;            // paid | failed
  created_at: number;        // Unix ms
}

export interface FsLoginAttempt {
  id?: string;
  identifier: string;        // email::ip
  attempted_at: number;      // Unix ms
  success: boolean;
}

export interface FsAdmin {
  id?: string;
  username: string;
  password_hash: string;
  created_at: number;        // Unix ms
}
