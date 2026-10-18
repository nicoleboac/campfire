import { useState } from 'react'
import { SOURCES } from '../data/seed'
import type { Source } from '../data/seed'
import { cls } from '../theme/tokens'
import type { Resolution } from '../hooks/useReconcile'
import type { Item } from '../data/seed'

interface Props {
  perSource: Record<Source, { adjSource: number; adjLedger: number; unexplained: number; openCount: number }>
  sourceFilter: Source | 'all'
  onSourceFilterChange: (s: Source) => void
  resolvedCount: number
  totalItems: number
  canFinish: boolean
  finishBlockReason: string
  onFinish: () => void
  isLocked: boolean
  sentForReview: boolean
  resolutions: Resolution[]
  items: Item[]
  onUndo: (id: string) => void
}

const SOURCE_ORDER: Source[] = ['bank', 'stripe', 'receivables', 'cards']

const sourceBadgeCls: Record<Source, string> = {
  bank:        'bg-blue-100 text-blue-700',
  stripe:      'bg-violet-100 text-violet-700',
  receivables: 'bg-teal-100 text-teal-700',
  cards:       'bg-orange-100 text-orange-700',
}

const typeLabel: Record<string, string> = {
  'matched':                'Matched',
  'matched-with-adjustment':'Matched + Adjusted',
  'created-entry':          'Entry Created',
  'voided':                 'Voided',
  'outstanding':            'Outstanding',
  'suspense':               'Suspense',
  'flagged':                'Flagged',
  'no-match':               'No Match',
  'applied-payment':        'Payment Applied',
  'credit-memo':            'Credit Memo',
  'coded-expense':          'Expense Coded',
}

const typeBadgeCls: Record<string, string> = {
  'matched':                'bg-green-100 text-green-700',
  'matched-with-adjustment':'bg-blue-100 text-blue-700',
  'created-entry':          'bg-blue-100 text-blue-700',
  'voided':                 'bg-red-100 text-red-700',
  'outstanding':            'bg-orange-100 text-orange-700',
  'suspense':               'bg-yellow-100 text-yellow-700',
  'flagged':                'bg-gray-100 text-gray-600',
  'applied-payment':        'bg-teal-100 text-teal-700',
  'credit-memo':            'bg-violet-100 text-violet-700',
  'coded-expense':          'bg-orange-100 text-orange-700',
}

function fmtAmt(n: number) {
  const abs = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return n < 0 ? `(${abs})` : `$${abs}`
}

function fmtDate(d: string) {
  const dt = new Date(d + 'T00:00:00')
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function fmt(n: number): string {
  return Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function AppHeader({
  perSource,
  sourceFilter,
  onSourceFilterChange,
  resolvedCount,
  totalItems,
  canFinish,
  finishBlockReason,
  onFinish,
  isLocked,
  sentForReview,
  resolutions,
  items,
  onUndo,
}: Props) {
  const [showResolved, setShowResolved] = useState(false)
  const [showFinishModal, setShowFinishModal] = useState(false)


  const reconciledCount = SOURCE_ORDER.filter(src =>
    perSource[src].unexplained === 0 && perSource[src].openCount === 0
  ).length

  function handleFinishClick() {
    if (canFinish && !sentForReview) {
      setShowFinishModal(true)
    }
  }

  function handleConfirmFinish() {
    onFinish()
    setShowFinishModal(false)
  }

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
      {/* Date + actions row */}
      <div className="px-8 pt-3 pb-0 flex items-center justify-between">
        <span className="text-xs text-gray-400 font-medium">Sep 1–30, 2026 · Close period</span>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">
            {resolvedCount} of {totalItems} resolved · {reconciledCount} of 4 reconciled
          </span>
          <button
            onClick={() => setShowResolved(true)}
            className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded px-2 py-1 hover:bg-gray-50 transition-colors"
          >
            Resolved ({resolvedCount})
          </button>
          {sentForReview ? (
            <span className="text-xs text-green-600 font-medium bg-green-50 border border-green-200 rounded px-2 py-1">
              Sent for review ✓
            </span>
          ) : (
            <button
              onClick={handleFinishClick}
              disabled={!canFinish || isLocked}
              title={!canFinish ? finishBlockReason : undefined}
              className={`text-xs font-medium px-3 py-1 rounded transition-colors ${
                canFinish && !isLocked
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              Finish →
            </button>
          )}
        </div>
      </div>

      {/* Source tiles row */}
      <div className="grid grid-cols-4 gap-4 px-8 py-4">
        {SOURCE_ORDER.map(src => {
          const ps = perSource[src]
          const info = SOURCES[src]
          const isBalanced = ps.unexplained === 0 && ps.openCount === 0
          const isSelected = sourceFilter === src
          return (
            <button
              key={src}
              onClick={() => onSourceFilterChange(src)}
              className={`border rounded-xl p-4 text-left bg-white hover:bg-gray-50 transition-colors ${
                isSelected
                  ? 'border-gray-400 shadow-sm'
                  : 'border-gray-200'
              }`}
            >
              <span className={`${cls.badge} ${sourceBadgeCls[src]} text-xs`}>{info.label}</span>
              <div className="text-xs text-gray-400 mt-1 truncate">{info.description}</div>
              <div className={`text-2xl font-bold mt-3 ${isBalanced ? 'text-green-600' : 'text-red-500'}`}>
                {isBalanced ? '$0.00' : `$${fmt(Math.abs(ps.unexplained))}`}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {isBalanced && ps.openCount === 0 ? 'Reconciled ✓' : `${ps.openCount} open`}
              </div>
            </button>
          )
        })}
      </div>

      {/* Resolved slide-over panel */}
      {showResolved && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setShowResolved(false)}>
          <div
            className="w-[480px] h-full bg-white shadow-xl border-l border-gray-200 flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900">Resolved ({resolutions.length})</h2>
              <button
                onClick={() => setShowResolved(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {resolutions.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <div className="text-3xl mb-2">📋</div>
                  <div>No items resolved yet</div>
                </div>
              ) : (
                <div>
                  <div className="text-xs text-gray-500 mb-3">
                    {resolutions.length} resolved item{resolutions.length !== 1 ? 's' : ''}
                  </div>
                  <div className="space-y-2">
                    {[...resolutions].reverse().map(r => {
                      const relatedItems = r.itemIds.map(key => items.find(i => i.key === key)!).filter(Boolean)
                      return (
                        <div key={r.id} className="bg-white border border-gray-200 rounded-lg p-3 flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className={`${cls.badge} ${typeBadgeCls[r.type] || 'bg-gray-100 text-gray-600'}`}>
                                {typeLabel[r.type] || r.type}
                              </span>
                              {r.adjustmentAccount && (
                                <span className="text-xs text-gray-400">→ {r.adjustmentAccount}</span>
                              )}
                              {r.adjustmentAmount !== undefined && (
                                <span className={`text-xs font-medium ${r.adjustmentAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {fmtAmt(r.adjustmentAmount)}
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-700">{r.description}</div>
                            {r.note && <div className="text-xs text-gray-400 mt-0.5">Note: {r.note}</div>}
                            {relatedItems.length > 0 && (
                              <div className="flex flex-wrap gap-3 mt-1">
                                {relatedItems.map(item => (
                                  <span key={item.key} className="text-xs text-gray-400">
                                    {fmtDate(item.date)} · {item.reference || item.description} · {fmtAmt(item.amount)}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => onUndo(r.id)}
                            className="text-xs text-blue-600 hover:text-blue-700 font-medium shrink-0 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
                          >
                            Undo
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Finish modal */}
      {showFinishModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowFinishModal(false)}>
          <div
            className="bg-white rounded-xl shadow-xl w-[480px] p-6"
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Send for Review</h2>
            <p className="text-sm text-gray-600 mb-4">
              All 4 sources are reconciled with $0.00 unexplained. This reconciliation will be sent for review.
            </p>
            <div className="grid grid-cols-2 gap-3 mb-5">
              {SOURCE_ORDER.map(src => (
                <div key={src} className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className={`${cls.badge} ${sourceBadgeCls[src]} text-xs mb-1`}>
                    {SOURCES[src].label}
                  </div>
                  <div className="text-xs text-green-700 font-medium">Reconciled ✓</div>
                  <div className="text-xs text-gray-500 mt-0.5">$0.00 unexplained</div>
                </div>
              ))}
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowFinishModal(false)} className={cls.btnGhost}>
                Cancel
              </button>
              <button onClick={handleConfirmFinish} className="bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-md hover:bg-green-700 transition-colors">
                Send for Review
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
