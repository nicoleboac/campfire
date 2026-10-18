import { useState } from 'react'
import { SOURCES } from '../data/seed'
import type { Source } from '../data/seed'
import { cls } from '../theme/tokens'

interface PerSourceState {
  adjSource: number
  adjLedger: number
  unexplained: number
  openCount: number
}

interface Props {
  perSource: Record<Source, PerSourceState>
  resolvedCount: number
  totalItems: number
}

function fmt(n: number): string {
  return Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const SOURCE_ORDER: Source[] = ['bank', 'stripe', 'receivables', 'cards']

const sourceBadgeCls: Record<Source, string> = {
  bank:        'bg-blue-100 text-blue-700',
  stripe:      'bg-violet-100 text-violet-700',
  receivables: 'bg-teal-100 text-teal-700',
  cards:       'bg-orange-100 text-orange-700',
}

export function StatusHeader({ perSource, resolvedCount, totalItems }: Props) {
  const [autoMatchOpen, setAutoMatchOpen] = useState(false)

  const reconciledCount = SOURCE_ORDER.filter(src =>
    perSource[src].unexplained === 0 && perSource[src].openCount === 0
  ).length

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
      <div className="max-w-7xl mx-auto px-6 py-3">
        {/* Top row */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-sm font-semibold text-gray-900">Sep 1–30, 2026</span>
            <span className="text-sm text-gray-500 ml-2">Multi-source reconciliation</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setAutoMatchOpen(v => !v)}
              className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
              1,286 auto-matched across 4 sources
              <span className="ml-0.5">{autoMatchOpen ? '▲' : '▼'}</span>
            </button>
            <span className="text-xs text-gray-400">
              {resolvedCount} of {totalItems} resolved · {reconciledCount} of 4 sources reconciled
            </span>
          </div>
        </div>

        {/* Auto-match expanded */}
        {autoMatchOpen && (
          <div className="mb-3 p-3 bg-green-50 border border-green-100 rounded-md text-xs text-green-700">
            <strong>1,286 transactions</strong> were automatically matched across all 4 sources by amount, date, and payee.
            No action required. <button className="underline" onClick={() => setAutoMatchOpen(false)}>Dismiss</button>
          </div>
        )}

        {/* Source tiles */}
        <div className="grid grid-cols-4 gap-3">
          {SOURCE_ORDER.map(src => {
            const ps = perSource[src]
            const info = SOURCES[src]
            const isBalanced = ps.unexplained === 0 && ps.openCount === 0
            return (
              <div key={src} className={`rounded-lg border p-3 ${isBalanced ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white'}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`${cls.badge} ${sourceBadgeCls[src]} text-xs`}>{info.label}</span>
                  {isBalanced && (
                    <span className="text-xs font-medium text-green-600 bg-green-100 px-1.5 py-0.5 rounded-full">Reconciled</span>
                  )}
                </div>
                <div className="text-xs text-gray-400 mb-2 truncate">{info.description}</div>
                <div className={`text-base font-bold ${isBalanced ? 'text-green-600' : 'text-red-600'}`}>
                  {isBalanced ? '✓ $0.00' : `$${fmt(Math.abs(ps.unexplained))}`}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {ps.openCount > 0 ? `${ps.openCount} open` : 'all resolved'}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </header>
  )
}
