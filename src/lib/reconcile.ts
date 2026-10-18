/**
 * Pure reconciliation math functions.
 * No UI dependencies — fully unit-testable.
 *
 * Sign convention: money IN = positive, money OUT = negative.
 *
 * Per-source reconciliation formula:
 *   Adjusted source balance = sourceBalance - sum(outstanding source-side amounts)
 *   Adjusted ledger balance = ledgerBalance + sum(adjustments) + sum(suspense adjustments)
 *   Unexplained = adjustedSource - adjustedLedger → $0.00 when balanced
 */

export interface SourceState {
  source: string
  sourceBalance: number
  ledgerBalance: number
  outstandingItems: { key: string; amount: number }[]
  adjustments: { key: string; amount: number }[]
  suspenseItems: { key: string; amount: number }[]
}

/**
 * Adjusted source balance = sourceBalance - sum(outstanding source-side amounts)
 * Outstanding check bank-3 = −3,200: 1,284,516.32 + (−3,200) = 1,281,316.32
 * (subtract outstanding because outstanding = not yet reflected in source)
 */
export function adjustedSourceBalance(s: SourceState): number {
  const outstandingSum = s.outstandingItems.reduce((acc, i) => acc + i.amount, 0)
  return round2(s.sourceBalance + outstandingSum)
}

/**
 * Adjusted ledger balance = ledgerBalance + sum(adjustments) + sum(suspense adjustments)
 */
export function adjustedLedgerBalance(s: SourceState): number {
  const adjSum = s.adjustments.reduce((acc, a) => acc + a.amount, 0)
  const suspenseSum = s.suspenseItems.reduce((acc, i) => acc + i.amount, 0)
  return round2(s.ledgerBalance + adjSum + suspenseSum)
}

/**
 * Unexplained difference = adjustedSource − adjustedLedger
 * At $0.00 the rec is balanced.
 */
export function unexplainedDifference(s: SourceState): number {
  return round2(adjustedSourceBalance(s) - adjustedLedgerBalance(s))
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}
