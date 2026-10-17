import { useState } from 'react'
import { ACCOUNT } from '../data/seed'
import { cls } from '../theme/tokens'

interface Props {
  adjBank: number
  adjLedger: number
  unexplained: number
  outstandingTotal: number
  resolvedCount: number
  totalItems: number
}

function fmt(n: number): string {
  return Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtSigned(n: number): string {
  const abs = n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return n < 0 ? `(${fmt(n)})` : abs
}

export function StatusHeader({ adjBank, adjLedger, unexplained, outstandingTotal, resolvedCount, totalItems }: Props) {
  const [autoMatchOpen, setAutoMatchOpen] = useState(false)
  const isBalanced = unexplained === 0

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
      <div className="max-w-7xl mx-auto px-6 py-3">
        {/* Account + period */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-sm font-semibold text-gray-900">
              {ACCOUNT.name} ••{ACCOUNT.mask}
            </span>
            <span className="text-sm text-gray-500 ml-2">{ACCOUNT.period}</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setAutoMatchOpen(v => !v)}
              className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
              {ACCOUNT.autoMatchedCount} auto-matched
              <span className="ml-0.5">{autoMatchOpen ? '▲' : '▼'}</span>
            </button>
            <span className="text-xs text-gray-400">
              {resolvedCount} of {totalItems} resolved
            </span>
          </div>
        </div>

        {/* Auto-match expanded */}
        {autoMatchOpen && (
          <div className="mb-3 p-3 bg-green-50 border border-green-100 rounded-md text-xs text-green-700">
            <strong>{ACCOUNT.autoMatchedCount} transactions</strong> were automatically matched by amount, date, and payee.
            No action required. <button className="underline" onClick={() => setAutoMatchOpen(false)}>Dismiss</button>
          </div>
        )}

        {/* Balance grid */}
        <div className="grid grid-cols-4 gap-4">
          <div>
            <div className={cls.label}>Bank Ending Balance</div>
            <div className="text-sm font-semibold text-gray-900">${fmt(ACCOUNT.bankBalance)}</div>
          </div>
          <div>
            <div className={cls.label}>Ledger Balance</div>
            <div className="text-sm font-semibold text-gray-900">${fmt(ACCOUNT.ledgerBalance)}</div>
          </div>
          <div>
            <div className={cls.label}>Timing Differences</div>
            <div className={`text-sm font-semibold ${outstandingTotal !== 0 ? 'text-orange-600' : 'text-gray-400'}`}>
              {outstandingTotal !== 0 ? fmtSigned(outstandingTotal) : '—'}
            </div>
            {outstandingTotal !== 0 && (
              <div className="text-xs text-gray-400">outstanding items</div>
            )}
          </div>
          <div>
            <div className={cls.label}>Unexplained Difference</div>
            <div className={`text-base font-bold ${isBalanced ? 'text-green-600' : 'text-red-600'}`}>
              {isBalanced ? '✓ $0.00' : `$${fmt(unexplained)}`}
            </div>
            {!isBalanced && (
              <div className="flex gap-2 mt-0.5">
                <span className="text-xs text-gray-500">Adj bank ${fmt(adjBank)}</span>
                <span className="text-xs text-gray-300">·</span>
                <span className="text-xs text-gray-500">Adj ledger ${fmt(adjLedger)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
