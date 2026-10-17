export type Side = 'bank' | 'ledger'

export interface LineItem {
  id: string
  side: Side
  date: string        // ISO yyyy-mm-dd
  description: string
  amount: number      // positive = in, negative = out
  ref?: string
}

export interface Suggestion {
  id: string
  bankIds: string[]
  ledgerIds: string[]
  action: SuggestionAction
  confidence: 'high' | 'medium' | 'low'
  reason: string
  reasonChips: string[]
  adjustment?: {
    amount: number
    account: string
    accountCode: string
    description: string
  }
}

export type SuggestionAction =
  | 'match'
  | 'match-with-adjustment'
  | 'create-entry'
  | 'void-duplicate'
  | 'mark-outstanding'
  | 'no-match'

// ── Account info ──────────────────────────────────────────────────────────────

export const ACCOUNT = {
  name: 'Operating Checking',
  mask: '4821',
  period: 'Sep 1–30, 2026',
  bankBalance: 1_284_516.32,
  ledgerBalance: 1_273_419.52,
  autoMatchedCount: 412,
}

// ── Seed items ────────────────────────────────────────────────────────────────

export const SEED_ITEMS: LineItem[] = [
  { id: 'B1', side: 'bank',   date: '2026-09-30', description: 'MONTHLY SERVICE FEE',           amount: -45.00 },
  { id: 'B3', side: 'bank',   date: '2026-09-19', description: 'AWS EMEA ACH DEBIT',             amount: -8_912.40 },
  { id: 'B4', side: 'bank',   date: '2026-09-26', description: 'DEPOSIT REF 88213',              amount: 2_500.00,   ref: 'REF 88213' },
  { id: 'B5', side: 'bank',   date: '2026-09-18', description: 'ACH NORTHWIND SOFTWAR',          amount: -4_860.00 },
  { id: 'B6', side: 'bank',   date: '2026-09-24', description: 'INCOMING WIRE GLOBEX LTD',       amount: 29_975.00 },
  { id: 'B7', side: 'bank',   date: '2026-09-08', description: 'DEPOSIT',                        amount: 5_000.00 },
  { id: 'B8', side: 'bank',   date: '2026-09-08', description: 'DEPOSIT',                        amount: 3_750.00 },
  { id: 'B9', side: 'bank',   date: '2026-09-10', description: 'FIGMA INC',                      amount: -1_287.00 },
  { id: 'L1', side: 'ledger', date: '2026-09-29', description: 'Check #1043 Brightline Facilities', amount: -3_200.00, ref: 'CHK-1043' },
  { id: 'L3', side: 'ledger', date: '2026-09-12', description: 'Gusto payroll taxes',            amount: -14_388.20 },
  { id: 'L4', side: 'ledger', date: '2026-09-17', description: 'Northwind Software Inc. bill payment', amount: -4_860.00, ref: 'BILL-0918' },
  { id: 'L5', side: 'ledger', date: '2026-09-24', description: 'Globex payment',                 amount: 30_000.00,  ref: 'INV-2274' },
  { id: 'L6', side: 'ledger', date: '2026-09-08', description: 'Initech payment',                amount: 8_750.00,   ref: 'INV-2280' },
  { id: 'L7', side: 'ledger', date: '2026-09-10', description: 'Figma annual seats',             amount: -1_278.00,  ref: 'BILL-0910' },
]

// ── Suggestions ───────────────────────────────────────────────────────────────

export const SUGGESTIONS: Suggestion[] = [
  {
    id: 'S1',
    bankIds: ['B5'],
    ledgerIds: ['L4'],
    action: 'match',
    confidence: 'high',
    reason: 'Same amount · 1 day apart · Payee name similar · Bill BILL-0918',
    reasonChips: ['Same amount', '1 day apart', 'Payee name similar', 'BILL-0918'],
  },
  {
    id: 'S2',
    bankIds: ['B9'],
    ledgerIds: ['L7'],
    action: 'match-with-adjustment',
    confidence: 'high',
    reason: 'Same payee and date · $9.00 difference looks like transposed digits (1,278 vs 1,287)',
    reasonChips: ['Same payee', 'Same date', '$9.00 difference', 'Transposed digits'],
    adjustment: {
      amount: -9.00,
      account: 'Software Subscriptions',
      accountCode: '6310',
      description: 'Correct Figma bill amount (transposed digits)',
    },
  },
  {
    id: 'S3',
    bankIds: ['B6'],
    ledgerIds: ['L5'],
    action: 'match-with-adjustment',
    confidence: 'high',
    reason: 'Same customer and date · $25.00 short = standard incoming wire fee',
    reasonChips: ['Same customer', 'Same date', '$25.00 difference', 'Wire fee'],
    adjustment: {
      amount: -25.00,
      account: 'Bank Fees',
      accountCode: '6810',
      description: 'Incoming wire fee on Globex payment',
    },
  },
  {
    id: 'S4',
    bankIds: ['B7', 'B8'],
    ledgerIds: ['L6'],
    action: 'match',
    confidence: 'medium',
    reason: 'Two deposits on Sep 8 sum to INV-2280',
    reasonChips: ['2 bank items', '1 ledger item', 'Same date', 'Sums match'],
  },
  {
    id: 'S5',
    bankIds: ['B1'],
    ledgerIds: [],
    action: 'create-entry',
    confidence: 'high',
    reason: 'Recurring monthly fee',
    reasonChips: ['No ledger entry', 'Recurring monthly fee'],
    adjustment: {
      amount: -45.00,
      account: 'Bank Fees',
      accountCode: '6810',
      description: 'Monthly service fee',
    },
  },
  {
    id: 'S6',
    bankIds: ['B3'],
    ledgerIds: [],
    action: 'create-entry',
    confidence: 'medium',
    reason: 'Matches prior AWS debits; no bill entered',
    reasonChips: ['No ledger entry', 'Prior AWS debits found'],
    adjustment: {
      amount: -8_912.40,
      account: 'Cloud Hosting',
      accountCode: '6420',
      description: 'AWS EMEA cloud hosting',
    },
  },
  {
    id: 'S7',
    bankIds: [],
    ledgerIds: ['L3'],
    action: 'void-duplicate',
    confidence: 'high',
    reason: 'Same payee, amount, date and memo as an already-matched entry',
    reasonChips: ['Duplicate payee', 'Duplicate amount', 'Already matched'],
  },
  {
    id: 'S8',
    bankIds: [],
    ledgerIds: ['L1'],
    action: 'mark-outstanding',
    confidence: 'high',
    reason: 'Check written Sep 29, not yet cleared',
    reasonChips: ['Check not cleared', 'Written Sep 29', 'Carries to October'],
  },
  {
    id: 'S9',
    bankIds: ['B4'],
    ledgerIds: [],
    action: 'no-match',
    confidence: 'low',
    reason: 'No confident match. No open invoice for $2,500.00.',
    reasonChips: ['No match found', 'No open invoice'],
  },
]

// Pre-filled create-entry defaults keyed by bank item id
export const CREATE_ENTRY_DEFAULTS: Record<string, {
  account: string
  accountCode: string
  vendor: string
  memo: string
}> = {
  B1: { account: 'Bank Fees', accountCode: '6810', vendor: 'Chase Bank', memo: 'Monthly service fee Sep 2026' },
  B3: { account: 'Cloud Hosting', accountCode: '6420', vendor: 'Amazon Web Services', memo: 'AWS EMEA Sep 2026' },
  B4: { account: '', accountCode: '', vendor: '', memo: '' },
}
