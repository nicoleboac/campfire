import { useReconcile } from './hooks/useReconcile'
import type { Resolution } from './hooks/useReconcile'
import type { LineItem } from './data/seed'
import { StatusHeader } from './components/StatusHeader'
import { WorkQueue } from './components/WorkQueue'
import { FinishSummary } from './components/FinishSummary'
import { cls } from './theme/tokens'
import './index.css'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtAmt(n: number) {
  const abs = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return n < 0 ? `(${abs})` : `$${abs}`
}

function fmtDate(d: string) {
  const dt = new Date(d + 'T00:00:00')
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Resolved view ─────────────────────────────────────────────────────────────

const typeLabel: Record<string, string> = {
  'matched': 'Matched',
  'matched-with-adjustment': 'Matched + Adjusted',
  'created-entry': 'Entry Created',
  'voided': 'Voided',
  'outstanding': 'Outstanding',
  'suspense': 'Suspense',
  'flagged': 'Flagged',
  'no-match': 'No Match',
}

const typeBadgeCls: Record<string, string> = {
  'matched': 'bg-green-100 text-green-700',
  'matched-with-adjustment': 'bg-blue-100 text-blue-700',
  'created-entry': 'bg-blue-100 text-blue-700',
  'voided': 'bg-red-100 text-red-700',
  'outstanding': 'bg-orange-100 text-orange-700',
  'suspense': 'bg-yellow-100 text-yellow-700',
  'flagged': 'bg-gray-100 text-gray-600',
}

function ResolvedView({
  resolutions,
  items,
  onUndo,
}: {
  resolutions: Resolution[]
  items: LineItem[]
  onUndo: (id: string) => void
}) {
  if (resolutions.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <div className="text-3xl mb-2">📋</div>
        <div>No items resolved yet</div>
      </div>
    )
  }

  return (
    <div>
      <div className="text-xs text-gray-500 mb-3">{resolutions.length} resolved item{resolutions.length !== 1 ? 's' : ''}</div>
      <div className="space-y-2">
        {[...resolutions].reverse().map(r => {
          const relatedItems = r.itemIds.map(id => items.find(i => i.id === id)!).filter(Boolean)
          return (
            <div key={r.id} className="bg-white border border-gray-200 rounded-lg p-3 flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className={`${cls.badge} ${typeBadgeCls[r.type] || 'bg-gray-100 text-gray-600'}`}>
                    {typeLabel[r.type] || r.type}
                  </span>
                  {r.itemIds.map(id => (
                    <span key={id} className="text-xs font-mono text-gray-500 bg-gray-50 px-1 rounded">{id}</span>
                  ))}
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
                      <span key={item.id} className="text-xs text-gray-400">
                        {fmtDate(item.date)} · {item.description} · {fmtAmt(item.amount)}
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
  )
}

// ── Main App ──────────────────────────────────────────────────────────────────

function App() {
  const rec = useReconcile()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Status header */}
      <StatusHeader
        adjBank={rec.adjBank}
        adjLedger={rec.adjLedger}
        unexplained={rec.unexplained}
        outstandingTotal={rec.outstandingTotal}
        resolvedCount={rec.resolvedCount}
        totalItems={rec.totalItems}
      />

      {/* Nav + search bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-2 flex items-center justify-between gap-4">
          <nav className="flex items-center gap-1">
            {(['queue', 'resolved', 'finish'] as const).map(v => (
              <button
                key={v}
                onClick={() => rec.setView(v)}
                className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                  rec.state.view === v
                    ? 'bg-gray-100 text-gray-900 font-medium'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                {v === 'queue' && `Work Queue (${rec.unresolvedItems.length})`}
                {v === 'resolved' && `Resolved (${rec.resolvedCount})`}
                {v === 'finish' && 'Finish'}
              </button>
            ))}
          </nav>

          {rec.state.view !== 'finish' && (
            <div className="relative w-72">
              <input
                type="search"
                placeholder="Search description, amount, ref…"
                value={rec.state.searchQuery}
                onChange={e => rec.setSearch(e.target.value)}
                className="border border-gray-300 rounded-md pl-8 pr-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <svg className="absolute left-2.5 top-2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        {rec.state.view === 'queue' && (
          <WorkQueue
            items={rec.unresolvedItems}
            allItems={rec.items}
            activeSuggestions={rec.activeSuggestions}
            itemsWithoutSuggestion={rec.itemsWithoutSuggestion}
            matchesSearch={rec.matchesSearch}
            searchQuery={rec.state.searchQuery}
            onResolve={rec.resolve}
            onReject={rec.rejectSuggestion}
          />
        )}

        {rec.state.view === 'resolved' && (
          <ResolvedView
            resolutions={rec.resolutions}
            items={rec.items}
            onUndo={rec.undo}
          />
        )}

        {rec.state.view === 'finish' && (
          <FinishSummary
            resolutions={rec.resolutions}
            adjBank={rec.adjBank}
            adjLedger={rec.adjLedger}
            unexplained={rec.unexplained}
            canFinish={rec.canFinish}
            finishBlockReason={rec.finishBlockReason}
            onFinish={rec.finish}
            isLocked={rec.state.isLocked}
            sentForReview={rec.state.sentForReview}
          />
        )}
      </main>

      {/* Toast notifications */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm">
        {rec.state.toasts.map(toast => (
          <div
            key={toast.id}
            className="bg-gray-900 text-white text-sm rounded-lg px-4 py-3 flex items-center gap-3 shadow-lg"
          >
            <span className="flex-1 text-sm">{toast.text}</span>
            <button
              onClick={() => {
                rec.undo(toast.undoKey)
                rec.dismissToast(toast.id)
              }}
              className="text-blue-300 hover:text-blue-200 font-medium shrink-0 text-sm"
            >
              Undo
            </button>
            <button
              onClick={() => rec.dismissToast(toast.id)}
              className="text-gray-400 hover:text-gray-200 shrink-0 text-base leading-none"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default App
