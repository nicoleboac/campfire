/**
 * Pure reconciliation math functions.
 * No UI dependencies — fully unit-testable.
 *
 * Sign convention: money IN = positive, money OUT = negative.
 *
 * Bank Reconciliation formula:
 *   Adjusted Bank  = Bank ending balance + outstanding item amounts
 *                    (outstanding check is negative, so this REDUCES bank balance)
 *   Adjusted Ledger = Ledger balance + adjustment entries − voided item amounts
 *                     (voiding a negative duplicate entry ADDS back to ledger)
 *   At balance: Adjusted Bank = Adjusted Ledger → unexplained diff = $0.00
 */

export interface ReconcileState {
  bankBalance: number
  ledgerBalance: number
  outstandingItems: { id: string; amount: number }[]
  adjustments: { id: string; amount: number }[]   // entries created/corrected
  suspenseItems: { id: string; amount: number }[] // B4-style items posted to suspense
  voidedItems: { id: string; amount: number }[]   // duplicate voids
}

/**
 * Adjusted bank = bank ending balance + outstanding item amounts
 * Outstanding check L1 = −3,200: 1,284,516.32 + (−3,200) = 1,281,316.32 ✓
 */
export function adjustedBankBalance(state: ReconcileState): number {
  const outstandingSum = state.outstandingItems.reduce((s, i) => s + i.amount, 0)
  return round2(state.bankBalance + outstandingSum)
}

/**
 * Adjusted ledger = ledger balance + adjustment amounts − voided item amounts
 * Voiding L3 (amount = −14,388.20): ledger − (−14,388.20) = ledger + 14,388.20 ✓
 */
export function adjustedLedgerBalance(state: ReconcileState): number {
  const adjSum = state.adjustments.reduce((s, a) => s + a.amount, 0)
  const voidSum = state.voidedItems.reduce((s, v) => s + v.amount, 0)
  return round2(state.ledgerBalance + adjSum - voidSum)
}

/**
 * Unexplained difference = adjusted bank − adjusted ledger
 * At $0.00 the rec is balanced.
 */
export function unexplainedDifference(state: ReconcileState): number {
  return round2(adjustedBankBalance(state) - adjustedLedgerBalance(state))
}

/**
 * The initial difference before any work:
 * 1,284,516.32 − 1,273,419.52 = 11,096.80
 */
export function initialDifference(bankBalance: number, ledgerBalance: number): number {
  return round2(bankBalance - ledgerBalance)
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// ── Expected end-state constants (used in tests) ─────────────────────────────

export const EXPECTED = {
  adjustedBank: 1_281_316.32,
  adjustedLedgerWithB4Flagged: 1_278_816.32,
  adjustedLedgerWithB4Suspense: 1_281_316.32,
  unexplainedWithB4: 2_500.00,
  unexplainedBalanced: 0.00,
}
