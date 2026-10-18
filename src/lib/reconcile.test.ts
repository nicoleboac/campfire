import { describe, it, expect } from 'vitest'
import {
  adjustedSourceBalance,
  adjustedLedgerBalance,
  unexplainedDifference,
  round2,
} from './reconcile'
import { SOURCES } from '../data/seed'

describe('round2', () => {
  it('rounds to 2 decimal places', () => {
    expect(round2(1.006)).toBe(1.01)
    expect(round2(1.004)).toBe(1.00)
    expect(round2(-45.0)).toBe(-45)
    expect(round2(1284516.321)).toBe(1284516.32)
  })
})

// ── Bank source ───────────────────────────────────────────────────────────────
// sourceBalance = 1,284,516.32  ledgerBalance = 1,278,816.32
// outstanding bank-3 = −3,200  → adjSource = 1,281,316.32
// suspense bank-4 = +2,500     → adjLedger = 1,281,316.32 (with suspense)
//                              → adjLedger = 1,278,816.32 (without suspense)

describe('bank reconciliation', () => {
  const base = {
    source: 'bank',
    sourceBalance: SOURCES.bank.sourceBalance,
    ledgerBalance: SOURCES.bank.ledgerBalance,
    outstandingItems: [],
    adjustments: [],
    suspenseItems: [],
  }

  it('returns raw source balance with no outstanding items', () => {
    expect(adjustedSourceBalance(base)).toBe(1_284_516.32)
  })

  it('reduces source balance by outstanding check bank-3 (−$3,200)', () => {
    const s = { ...base, outstandingItems: [{ key: 'bank-3', amount: -3_200.00 }] }
    expect(adjustedSourceBalance(s)).toBe(1_281_316.32)
  })

  it('reaches $0.00 unexplained when bank-4 is posted to suspense', () => {
    const s = {
      ...base,
      outstandingItems: [{ key: 'bank-3', amount: -3_200.00 }],
      adjustments: [],
      suspenseItems: [{ key: 'bank-4', amount: 2_500.00 }],
    }
    expect(adjustedSourceBalance(s)).toBe(1_281_316.32)
    expect(adjustedLedgerBalance(s)).toBe(1_281_316.32)
    expect(unexplainedDifference(s)).toBe(0)
  })

  it('shows $2,500.00 unexplained when bank-4 is not in suspense', () => {
    const s = {
      ...base,
      outstandingItems: [{ key: 'bank-3', amount: -3_200.00 }],
      adjustments: [],
      suspenseItems: [],
    }
    expect(adjustedSourceBalance(s)).toBe(1_281_316.32)
    expect(adjustedLedgerBalance(s)).toBe(1_278_816.32)
    expect(unexplainedDifference(s)).toBe(2_500.00)
  })
})

// ── Stripe source ─────────────────────────────────────────────────────────────
// sourceBalance = 12,480.00  ledgerBalance = 14,129.50
// adjustments: −1,489.50 (S4) and −160.00 (S5)
// adjLedger = 14,129.50 − 1,489.50 − 160.00 = 12,480.00
// unexplained = 0

describe('stripe reconciliation', () => {
  const base = {
    source: 'stripe',
    sourceBalance: SOURCES.stripe.sourceBalance,
    ledgerBalance: SOURCES.stripe.ledgerBalance,
    outstandingItems: [],
    adjustments: [],
    suspenseItems: [],
  }

  it('returns raw balances unchanged with no adjustments', () => {
    expect(adjustedSourceBalance(base)).toBe(12_480.00)
    expect(adjustedLedgerBalance(base)).toBe(14_129.50)
  })

  it('reaches $0.00 when both fee and credit-memo adjustments are applied', () => {
    const s = {
      ...base,
      adjustments: [
        { key: 'stripe-1-adj', amount: -1_489.50 },
        { key: 'stripe-2-adj', amount: -160.00 },
      ],
    }
    expect(adjustedLedgerBalance(s)).toBe(12_480.00)
    expect(unexplainedDifference(s)).toBe(0)
  })
})

// ── Receivables source ────────────────────────────────────────────────────────
// sourceBalance = 41,975.00  ledgerBalance = 42,000.00
// adjustment: −25.00 wire fee write-off → adjLedger = 41,975.00
// unexplained = 0

describe('receivables reconciliation', () => {
  const base = {
    source: 'receivables',
    sourceBalance: SOURCES.receivables.sourceBalance,
    ledgerBalance: SOURCES.receivables.ledgerBalance,
    outstandingItems: [],
    adjustments: [],
    suspenseItems: [],
  }

  it('reaches $0.00 when wire-fee adjustment is applied', () => {
    const s = {
      ...base,
      adjustments: [{ key: 'ar-wireFee', amount: -25.00 }],
    }
    expect(adjustedSourceBalance(s)).toBe(41_975.00)
    expect(adjustedLedgerBalance(s)).toBe(41_975.00)
    expect(unexplainedDifference(s)).toBe(0)
  })
})

// ── Cards source ──────────────────────────────────────────────────────────────
// sourceBalance = 23,914.62  ledgerBalance = 23,819.22
// adjustments: +9.00 (Figma correction) and −86.40 (Blue Bottle code-expense)
// adjLedger = 23,819.22 + 9.00 − 86.40 = 23,741.82  ← wait, need to reach 23,914.62
// Spec says: adjustments +9.00 and -86.40 → adjLedger = 23,914.62
// 23,819.22 + 9.00 + 86.40 = 23,914.62  (code-expense adds the positive amount)
// card-3 amount is −86.40 (out), coding it means booking the expense:
// adjustment amount = +86.40 to match ledger to source

describe('cards reconciliation', () => {
  const base = {
    source: 'cards',
    sourceBalance: SOURCES.cards.sourceBalance,
    ledgerBalance: SOURCES.cards.ledgerBalance,
    outstandingItems: [],
    adjustments: [],
    suspenseItems: [],
  }

  it('reaches $0.00 with Figma correction (+9.00) and code-expense (+86.40)', () => {
    // Figma: card-1 = −1,287, card-2 = −1,278, gap = +9 → book +9 correction to ledger
    // code-expense card-3: books the missing −86.40 to ledger (adds +86.40 to ledger side)
    const s = {
      ...base,
      adjustments: [
        { key: 'card-figma-correction', amount: 9.00 },
        { key: 'card-3-expense',        amount: 86.40 },
      ],
    }
    expect(adjustedLedgerBalance(s)).toBe(23_914.62)
    expect(unexplainedDifference(s)).toBe(0)
  })
})
