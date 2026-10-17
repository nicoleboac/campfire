import type { Resolution } from '../hooks/useReconcile'
import { cls } from '../theme/tokens'

interface Props {
  resolutions: Resolution[]
  adjBank: number
  adjLedger: number
  unexplained: number
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

export function FinishSummary({
  resolutions,
  adjBank,
  adjLedger,
  unexplained,
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
          Reconciliation locked. Operating Checking ••4821, Sep 2026.
        </p>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-left text-sm">
          <div className="font-medium text-gray-700 mb-2">Summary</div>
          <div className="space-y-1 text-gray-600">
            <div className="flex justify-between">
              <span>Adjusted bank balance</span>
              <span className="font-medium">${fmt(adjBank)}</span>
            </div>
            <div className="flex justify-between">
              <span>Adjusted ledger balance</span>
              <span className="font-medium">${fmt(adjLedger)}</span>
            </div>
            <div className="flex justify-between font-medium text-green-700 border-t border-gray-200 pt-1 mt-1">
              <span>Difference</span>
              <span>$0.00 ✓</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto py-8">
      <h1 className="text-xl font-semibold text-gray-900 mb-1">Finish Reconciliation</h1>
      <p className="text-sm text-gray-500 mb-6">Operating Checking ••4821 · Sep 1–30, 2026</p>

      {/* Balance check */}
      <div className={`rounded-lg p-4 mb-6 ${unexplained === 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
        <div className="flex items-center justify-between">
          <div>
            <div className={`text-sm font-medium ${unexplained === 0 ? 'text-green-800' : 'text-red-800'}`}>
              {unexplained === 0 ? 'Balanced — ready to finish' : 'Not balanced'}
            </div>
            {unexplained !== 0 && (
              <div className="text-xs text-red-600 mt-0.5">{finishBlockReason}</div>
            )}
          </div>
          <div className={`text-lg font-bold ${unexplained === 0 ? 'text-green-700' : 'text-red-700'}`}>
            {unexplained === 0 ? '✓ $0.00' : `$${fmt(Math.abs(unexplained))} unexplained`}
          </div>
        </div>
        <div className="flex gap-4 mt-2 text-xs text-gray-500">
          <span>Adj bank: ${fmt(adjBank)}</span>
          <span>Adj ledger: ${fmt(adjLedger)}</span>
        </div>
      </div>

      {/* Resolution summary */}
      <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-100 mb-6">
        <div className="px-4 py-3">
          <div className="text-sm font-medium text-gray-700">Resolution Summary</div>
        </div>
        {[
          { label: 'Items matched', count: matched, color: 'text-green-600' },
          { label: 'Entries created', count: created, color: 'text-blue-600' },
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
