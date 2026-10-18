import type { Item } from '../data/seed'
import type { useReconcile } from '../hooks/useReconcile'

interface Props {
  item: Item
  getRelatedItems: ReturnType<typeof useReconcile>['getRelatedItems']
  onViewInLedger: (item: Item) => void
  onMatchInstead: (item: Item) => void
}

function fmt(n: number) {
  const abs = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return n < 0 ? `(${abs})` : `$${abs}`
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function ItemContext({ item, getRelatedItems, onViewInLedger, onMatchInstead }: Props) {
  const related = getRelatedItems(item)
  if (related.length === 0) return null

  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
        Related transactions
      </div>
      <div className="space-y-1.5">
        {related.map((rel, idx) => {
          const relItem = rel.item
          const statusText = rel.isMatched
            ? `Matched${rel.matchedWith ? ` · ${rel.matchedWith}` : ''}`
            : 'Unmatched'
          return (
            <div
              key={relItem.key ?? idx}
              className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded px-2.5 py-1.5 text-xs"
            >
              <span className="text-gray-400 shrink-0 w-12">{fmtDate(relItem.date)}</span>
              <span className="text-gray-700 flex-1 truncate">{relItem.description}</span>
              <span className={`font-mono tabular-nums shrink-0 ${relItem.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {fmt(relItem.amount)}
              </span>
              <span className={`shrink-0 px-1.5 py-0.5 rounded-full text-xs font-medium ${
                rel.isMatched
                  ? 'bg-green-100 text-green-700'
                  : 'bg-amber-100 text-amber-700'
              }`}>
                {statusText}
              </span>
              {!rel.isMatched && (
                <button
                  onClick={() => onMatchInstead(relItem as Item)}
                  className="shrink-0 text-xs text-blue-600 hover:text-blue-700 px-1.5 py-0.5 rounded hover:bg-blue-50 transition-colors font-medium"
                >
                  Match instead
                </button>
              )}
            </div>
          )
        })}
      </div>
      <button
        onClick={() => onViewInLedger(item)}
        className="mt-2 text-xs text-blue-600 hover:text-blue-700 font-medium"
      >
        View in full ledger →
      </button>
    </div>
  )
}
