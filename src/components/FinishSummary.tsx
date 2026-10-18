import type { Resolution } from '../hooks/useReconcile'
import type { Source } from '../data/seed'
import { SOURCES } from '../data/seed'
import { cls } from '../theme/tokens'

interface PerSourceState {
  adjSource: number
  adjLedger: number
  unexplained: number
  openCount: number
}

interface Props {
  resolutions: Resolution[]
  perSource: Record<Source, PerSourceState>
  canFinish: boolean
  finishBlockReason: string
  onFinish: () => void
  isLocked: boolean
  sentForReview: boolean
}

function fmt(n: number) {
  return Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function countByType(resolutions: Resolution[], type: string): number {
  return resolutions.filter(r => r.type === type).length
}

const SOURCE_ORDER: Source[] = ['bank', 'stripe', 'receivables', 'cards']

const sourceBadgeCls: Record<Source, string> = {
  bank:        'bg-blue-100 text-blue-700',
  stripe:      'bg-violet-100 text-violet-700',
  receivables: 'bg-teal-100 text-teal-700',
  cards:       'bg-orange-100 text-orange-700',
}

export function FinishSummary({
  resolutions,
  perSource,
  canFinish,
  finishBlockReason,
  onFinish,
  isLocked,
  sentForReview,
}: Props) {
  const matched = countByType(resolutions, 'matched') + countByType(resolutions, 'matched-with-adjustment')
  const created = countByType(resolutions, 'created-entry')
  const outstanding = countByType(resolutions, 'outstanding')
  const voided = countByType(resolutions, 'voided')
  const suspense = countByType(resolutions, 'suspense')
  const flagged = countByType(resolutions, 'flagged')
  const applied = countByType(resolutions, 'applied-payment')
  const creditMemos = countByType(resolutions, 'credit-memo')
  const coded = countByType(resolutions, 'coded-expense')

  const allBalanced = SOURCE_ORDER.every(src => perSource[src].unexplained === 0 && perSource[src].openCount === 0)

  if (sentForReview) {
    return (
      <div className="max-w-xl mx-auto text-center py-16">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Sent for Review</h2>
        <p className="text-gray-500 text-sm mb-6">
          Reconciliation locked. Sep 2026 · 4 sources.
        </p>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-left text-sm">
          <div className="font-medium text-gray-700 mb-3">Per-Source Summary</div>
          <div className="space-y-2">
            {SOURCE_ORDER.map(src => (
              <div key={src} className="flex justify-between items-center py-1 border-b border-gray-100 last:border-0">
                <span className={`${cls.badge} ${sourceBadgeCls[src]}`}>{SOURCES[src].label}</span>
                <span className="text-green-700 font-medium text-xs">✓ $0.00</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto py-8">
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Finish Reconciliation</h1>
      <p className="text-sm text-gray-500 mb-6">Sep 1–30, 2026 · 4 sources</p>

      {/* Per-source balance check */}
      <div className="space-y-2 mb-6">
        {SOURCE_ORDER.map(src => {
          const ps = perSource[src]
          const balanced = ps.unexplained === 0 && ps.openCount === 0
          return (
            <div
              key={src}
              className={`rounded-lg p-3 flex items-center justify-between ${
                balanced ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={`${cls.badge} ${sourceBadgeCls[src]}`}>{SOURCES[src].label}</span>
                <div>
                  <div className={`text-xs font-medium ${balanced ? 'text-green-800' : 'text-red-800'}`}>
                    {balanced ? 'Balanced' : 'Not balanced'}
                  </div>
                  {!balanced && ps.openCount > 0 && (
                    <div className="text-xs text-red-600">{ps.openCount} item{ps.openCount !== 1 ? 's' : ''} open</div>
                  )}
                </div>
              </div>
              <div className={`text-sm font-bold ${balanced ? 'text-green-700' : 'text-red-700'}`}>
                {balanced ? '✓ $0.00' : `$${fmt(Math.abs(ps.unexplained))} unexplained`}
              </div>
            </div>
          )
        })}
      </div>

      {/* Overall status */}
      {!allBalanced && finishBlockReason && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-6 text-xs text-red-700">
          {finishBlockReason}
        </div>
      )}

      {/* Resolution summary */}
      <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100 mb-6">
        <div className="px-4 py-3">
          <div className="text-sm font-medium text-gray-700">Resolution Summary</div>
        </div>
        {[
          { label: 'Items matched', count: matched, color: 'text-green-600' },
          { label: 'Payments applied', count: applied, color: 'text-teal-600' },
          { label: 'Entries created', count: created, color: 'text-blue-600' },
          { label: 'Credit memos', count: creditMemos, color: 'text-violet-600' },
          { label: 'Expenses coded', count: coded, color: 'text-orange-600' },
          { label: 'Carried forward (outstanding)', count: outstanding, color: 'text-orange-600' },
          { label: 'Duplicates voided', count: voided, color: 'text-red-600' },
          { label: 'Posted to Suspense', count: suspense, color: 'text-yellow-600' },
          { label: 'Flagged for follow-up', count: flagged, color: 'text-gray-600' },
        ].filter(r => r.count > 0).map(r => (
          <div key={r.label} className="px-4 py-2.5 flex justify-between items-center">
            <span className="text-sm text-gray-600">{r.label}</span>
            <span className={`text-sm font-semibold ${r.color}`}>{r.count}</span>
          </div>
        ))}
        {resolutions.length === 0 && (
          <div className="px-4 py-3 text-sm text-gray-400">No items resolved yet</div>
        )}
      </div>

      {/* Finish button */}
      <div className="flex items-center gap-3">
        <button
          onClick={onFinish}
          disabled={!canFinish || isLocked}
          className={`${cls.btnPrimary} px-6 py-2.5 text-base`}
        >
          {isLocked ? 'Locked' : 'Finish & Send for Review'}
        </button>
        {!canFinish && finishBlockReason && (
          <span className="text-sm text-gray-500">{finishBlockReason}</span>
        )}
      </div>
    </div>
  )
}
