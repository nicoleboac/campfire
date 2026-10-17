import { describe, it, expect } from 'vitest'
import {
  adjustedBankBalance,
  adjustedLedgerBalance,
  unexplainedDifference,
  initialDifference,
  round2,
  EXPECTED,
} from './reconcile'
import { ACCOUNT } from '../data/seed'

const BASE_STATE = {
  bankBalance: ACCOUNT.bankBalance,
  ledgerBalance: ACCOUNT.ledgerBalance,
  outstandingItems: [],
  adjustments: [],
  suspenseItems: [],
  voidedItems: [],
}

describe('round2', () => {
  it('rounds to 2 decimal places', () => {
    expect(round2(1.006)).toBe(1.01)
    expect(round2(1.004)).toBe(1.00)
    expect(round2(-45.0)).toBe(-45)
    expect(round2(1284516.321)).toBe(1284516.32)
  })
})

describe('initialDifference', () => {
  it('computes the starting $11,096.80 gap', () => {
    expect(initialDifference(ACCOUNT.bankBalance, ACCOUNT.ledgerBalance)).toBe(11_096.80)
  })
})

describe('adjustedBankBalance', () => {
  it('returns bank balance unchanged when no outstanding items', () => {
    expect(adjustedBankBalance(BASE_STATE)).toBe(1_284_516.32)
  })

  it('reduces bank balance by outstanding check (L1 = −$3,200)', () => {
    const state = {
      ...BASE_STATE,
      // outstanding check: amount = -3200 (money out, not yet cleared)
      // adjusted bank = 1,284,516.32 + (−3,200) = 1,281,316.32
      outstandingItems: [{ id: 'L1', amount: -3_200.00 }],
    }
    expect(adjustedBankBalance(state)).toBe(EXPECTED.adjustedBank) // 1,281,316.32
  })
})

describe('adjustedLedgerBalance', () => {
  it('returns ledger balance unchanged with no adjustments', () => {
    expect(adjustedLedgerBalance(BASE_STATE)).toBe(1_273_419.52)
  })

  it('applies bank-fee adjustment for B1 (−$45)', () => {
    const state = {
      ...BASE_STATE,
      adjustments: [{ id: 'B1-adj', amount: -45.00 }],
    }
    // ledger + (-45) = 1,273,419.52 - 45 = 1,273,374.52
    expect(adjustedLedgerBalance(state)).toBe(round2(1_273_419.52 - 45.00))
  })

  it('reverses voided duplicate L3 (amount = −$14,388.20)', () => {
    const state = {
      ...BASE_STATE,
      // void L3: ledger - (L3.amount) = ledger - (-14388.20) = ledger + 14388.20
      voidedItems: [{ id: 'L3', amount: -14_388.20 }],
    }
    expect(adjustedLedgerBalance(state)).toBe(round2(1_273_419.52 + 14_388.20))
  })
})

describe('unexplainedDifference — full balanced scenario', () => {
  /**
   * Spec end state with B4 posted to suspense:
   *
   * Adjusted bank:
   *   1,284,516.32 + (−3,200.00) [outstanding check L1] = 1,281,316.32
   *
   * Adjusted ledger:
   *   1,273,419.52
   *   + (−45.00)     B1 bank fee entry
   *   + (−8,912.40)  B3 AWS cloud hosting entry
   *   + (−25.00)     B6/L5 wire fee adjustment
   *   + (−9.00)      B9/L7 ledger correction
   *   + 2,500.00     B4 suspense entry
   *   − (−14,388.20) void L3 duplicate (subtracts negative = adds back)
   *   = 1,281,316.32
   *
   * Difference = 0
   */
  it('reaches $0.00 when B4 is posted to suspense', () => {
    const state = {
      bankBalance: ACCOUNT.bankBalance,
      ledgerBalance: ACCOUNT.ledgerBalance,
      outstandingItems: [{ id: 'L1', amount: -3_200.00 }],
      adjustments: [
        { id: 'B1-fee',      amount: -45.00 },
        { id: 'B3-aws',      amount: -8_912.40 },
        { id: 'B6-wire',     amount: -25.00 },
        { id: 'B9-corr',     amount: -9.00 },
        { id: 'B4-suspense', amount: 2_500.00 },
      ],
      suspenseItems: [{ id: 'B4', amount: 2_500.00 }],
      voidedItems: [{ id: 'L3', amount: -14_388.20 }],
    }
    expect(adjustedBankBalance(state)).toBe(EXPECTED.adjustedBank)
    expect(adjustedLedgerBalance(state)).toBe(EXPECTED.adjustedLedgerWithB4Suspense)
    expect(unexplainedDifference(state)).toBe(EXPECTED.unexplainedBalanced)
  })

  it('shows $2,500.00 unexplained when B4 is only flagged (not in suspense)', () => {
    const state = {
      bankBalance: ACCOUNT.bankBalance,
      ledgerBalance: ACCOUNT.ledgerBalance,
      outstandingItems: [{ id: 'L1', amount: -3_200.00 }],
      adjustments: [
        { id: 'B1-fee',  amount: -45.00 },
        { id: 'B3-aws',  amount: -8_912.40 },
        { id: 'B6-wire', amount: -25.00 },
        { id: 'B9-corr', amount: -9.00 },
        // B4 NOT in adjustments — still unexplained
      ],
      suspenseItems: [],
      voidedItems: [{ id: 'L3', amount: -14_388.20 }],
    }
    // adj bank = 1,281,316.32
    // adj ledger = 1,273,419.52 - 45 - 8912.40 - 25 - 9 + 14388.20 = 1,278,816.32
    // diff = 1,281,316.32 - 1,278,816.32 = 2,500.00
    expect(adjustedBankBalance(state)).toBe(EXPECTED.adjustedBank)
    expect(adjustedLedgerBalance(state)).toBe(EXPECTED.adjustedLedgerWithB4Flagged)
    expect(unexplainedDifference(state)).toBe(EXPECTED.unexplainedWithB4)
  })
})
