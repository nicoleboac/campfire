export type Source = 'bank' | 'stripe' | 'receivables' | 'cards'
export type Side = 'bank' | 'ledger' | 'stripe' | 'payment' | 'invoice' | 'card'

export interface Item {
  key: string           // data key only — NEVER render this
  source: Source
  side: Side
  date: string          // ISO yyyy-mm-dd
  description: string
  amount: number        // positive = in/received, negative = out/owed
  reference?: string    // invoice/bill/check/card ref — show this instead of key
  meta?: {
    cardholder?: string
    cardLast4?: string
    invoiceId?: string
  }
}

export interface Suggestion {
  id: string
  source: Source
  itemKeys: string[]
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
  | 'apply-payment'
  | 'create-credit-memo'
  | 'code-expense'

// ── Source info ───────────────────────────────────────────────────────────────

export const SOURCES: Record<Source, {
  label: string
  description: string
  sourceSideLabel: string
  ledgerSideLabel: string
  sourceBalance: number
  ledgerBalance: number
}> = {
  bank: {
    label: 'Operating Bank',
    description: '••4821',
    sourceSideLabel: 'Bank',
    ledgerSideLabel: 'Cash (1010)',
    sourceBalance: 1_284_516.32,
    ledgerBalance: 1_278_816.32,
  },
  stripe: {
    label: 'Stripe',
    description: 'Stripe balance vs Stripe clearing (1015)',
    sourceSideLabel: 'Stripe',
    ledgerSideLabel: 'Stripe clearing (1015)',
    sourceBalance: 12_480.00,
    ledgerBalance: 14_129.50,
  },
  receivables: {
    label: 'Receivables',
    description: 'Customer payments vs open invoices',
    sourceBalance: 41_975.00,
    ledgerBalance: 42_000.00,
    sourceSideLabel: 'Payments',
    ledgerSideLabel: 'Invoices',
  },
  cards: {
    label: 'Ramp Card',
    description: 'Ramp statement vs Card liability (2110)',
    sourceBalance: 23_914.62,
    ledgerBalance: 23_819.22,
    sourceSideLabel: 'Card',
    ledgerSideLabel: 'Card liability (2110)',
  },
}

// ── Items ─────────────────────────────────────────────────────────────────────

export const ITEMS: Item[] = [
  { key: 'bank-1', source: 'bank',        side: 'bank',    date: '2026-09-18', description: 'ACH NORTHWIND SOFTWAR',                              amount: -4_860.00 },
  { key: 'bank-2', source: 'bank',        side: 'ledger',  date: '2026-09-17', description: 'Northwind Software Inc. bill payment',               amount: -4_860.00, reference: 'BILL-0918' },
  { key: 'bank-3', source: 'bank',        side: 'ledger',  date: '2026-09-29', description: 'Brightline Facilities rent',                         amount: -3_200.00, reference: 'Check #1043' },
  { key: 'bank-4', source: 'bank',        side: 'bank',    date: '2026-09-26', description: 'DEPOSIT',                                            amount: 2_500.00,  reference: 'REF 88213' },
  { key: 'stripe-1', source: 'stripe',    side: 'stripe',  date: '2026-09-30', description: 'Processing fees, September',                         amount: -1_489.50 },
  { key: 'stripe-2', source: 'stripe',    side: 'stripe',  date: '2026-09-22', description: 'Refund to Hooli Inc.',                               amount: -160.00,   reference: 'INV-2288' },
  { key: 'ar-1',   source: 'receivables', side: 'payment', date: '2026-09-24', description: 'Wire from Globex Ltd',                               amount: 29_975.00 },
  { key: 'ar-2',   source: 'receivables', side: 'invoice', date: '2026-08-25', description: 'Globex Ltd, due Sep 24',                             amount: 30_000.00, reference: 'INV-2274' },
  { key: 'ar-3',   source: 'receivables', side: 'payment', date: '2026-09-08', description: 'ACH from Initech, memo "INV 2280 2281"',             amount: 12_000.00 },
  { key: 'ar-4',   source: 'receivables', side: 'invoice', date: '2026-08-08', description: 'Initech, due Sep 7',                                 amount: 8_750.00,  reference: 'INV-2280' },
  { key: 'ar-5',   source: 'receivables', side: 'invoice', date: '2026-08-15', description: 'Initech, due Sep 14',                                amount: 3_250.00,  reference: 'INV-2281' },
  { key: 'card-1', source: 'cards',       side: 'card',    date: '2026-09-10', description: 'FIGMA INC',                                          amount: -1_287.00, meta: { cardholder: 'Dev Patel', cardLast4: '7731' } },
  { key: 'card-2', source: 'cards',       side: 'ledger',  date: '2026-09-10', description: 'Figma annual seats',                                 amount: -1_278.00, reference: 'EXP-3392' },
  { key: 'card-3', source: 'cards',       side: 'card',    date: '2026-09-21', description: 'SQ *BLUE BOTTLE COFFEE',                             amount: -86.40,    meta: { cardholder: 'Priya Shah', cardLast4: '2290' } },
]

// ── Suggestions ───────────────────────────────────────────────────────────────

export const SUGGESTIONS: Suggestion[] = [
  {
    id: 'S1', source: 'bank', itemKeys: ['bank-1', 'bank-2'],
    action: 'match', confidence: 'high',
    reason: 'Same amount · 1 day apart · Payee name similar · BILL-0918',
    reasonChips: ['Same amount', '1 day apart', 'Payee name similar', 'BILL-0918'],
  },
  {
    id: 'S2', source: 'bank', itemKeys: ['bank-3'],
    action: 'mark-outstanding', confidence: 'high',
    reason: 'Check written Sep 29, not yet cashed',
    reasonChips: ['Check not cashed', 'Written Sep 29', 'Carries to October'],
  },
  {
    id: 'S3', source: 'bank', itemKeys: ['bank-4'],
    action: 'no-match', confidence: 'low',
    reason: 'No confident match. No open invoice or payout for $2,500.00.',
    reasonChips: ['No match found', 'No open invoice'],
  },
  {
    id: 'S4', source: 'stripe', itemKeys: ['stripe-1'],
    action: 'create-entry', confidence: 'high',
    reason: 'Monthly Stripe fee summary',
    reasonChips: ['No ledger entry', 'Monthly Stripe fees'],
    adjustment: { amount: -1_489.50, account: 'Merchant Fees', accountCode: '6815', description: 'Stripe processing fees September 2026' },
  },
  {
    id: 'S5', source: 'stripe', itemKeys: ['stripe-2'],
    action: 'create-credit-memo', confidence: 'high',
    reason: 'Refund references the INV-2288 charge',
    reasonChips: ['Refund', 'References INV-2288', 'Credit memo needed'],
    adjustment: { amount: -160.00, account: 'Revenue', accountCode: '4000', description: 'Credit memo for INV-2288 refund' },
  },
  {
    id: 'S6', source: 'receivables', itemKeys: ['ar-1', 'ar-2'],
    action: 'apply-payment', confidence: 'high',
    reason: 'Same customer · paid on due date · $25.00 short = standard wire fee',
    reasonChips: ['Same customer', 'Paid on due date', '$25.00 short', 'Wire fee'],
    adjustment: { amount: -25.00, account: 'Bank Fees', accountCode: '6810', description: 'Wire fee on Globex payment' },
  },
  {
    id: 'S7', source: 'receivables', itemKeys: ['ar-3', 'ar-4', 'ar-5'],
    action: 'apply-payment', confidence: 'medium',
    reason: 'Memo mentions both invoices · 8,750.00 + 3,250.00 = 12,000.00',
    reasonChips: ['Memo mentions both', 'INV-2280 + INV-2281', 'Sums match'],
  },
  {
    id: 'S8', source: 'cards', itemKeys: ['card-1', 'card-2'],
    action: 'match-with-adjustment', confidence: 'high',
    reason: 'Same merchant and date · $9.00 gap looks like transposed digits',
    reasonChips: ['Same merchant', 'Same date', '$9.00 difference', 'Transposed digits'],
    adjustment: { amount: -9.00, account: 'Software Subscriptions', accountCode: '6310', description: 'Correct Figma expense amount (transposed digits)' },
  },
  {
    id: 'S9', source: 'cards', itemKeys: ['card-3'],
    action: 'code-expense', confidence: 'medium',
    reason: "Matches Priya's past coffee charges · no receipt attached",
    reasonChips: ['Past coffee charges', 'No receipt', 'Request from Priya'],
    adjustment: { amount: -86.40, account: 'Meals', accountCode: '6550', description: 'Blue Bottle Coffee — Priya Shah' },
  },
]

// ── Create-entry defaults ─────────────────────────────────────────────────────

export const CREATE_ENTRY_DEFAULTS: Record<string, { account: string; accountCode: string; vendor: string; memo: string }> = {
  'stripe-1': { account: 'Merchant Fees', accountCode: '6815', vendor: 'Stripe', memo: 'Stripe processing fees Sep 2026' },
  'stripe-2': { account: 'Revenue', accountCode: '4000', vendor: 'Hooli Inc.', memo: 'Credit memo INV-2288' },
  'bank-4':   { account: '', accountCode: '', vendor: '', memo: '' },
  'card-3':   { account: 'Meals', accountCode: '6550', vendor: 'Blue Bottle Coffee', memo: 'Team coffee — Priya Shah' },
}
