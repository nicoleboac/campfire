import { useState } from 'react'
import type { Suggestion, LineItem } from '../data/seed'
import { cls, tokens } from '../theme/tokens'
import { MatchDetail } from './MatchDetail'

interface Props {
  suggestion: Suggestion
  items: LineItem[]
  onAccept: (suggestion: Suggestion, adjustmentOverride?: { amount: number; account: string; accountCode: string; description: string }) => void
  onReject: (suggestionId: string) => void
}

function fmt(n: number) {
  const abs = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return n < 0 ? `(${abs})` : `$${abs}`
}

function fmtDate(d: string) {
  const dt = new Date(d + 'T00:00:00')
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function SuggestionCard({ suggestion, items, onAccept, onReject }: Props) {
  const [showDetail, setShowDetail] = useState(false)

  const bankItems = suggestion.bankIds.map(id => items.find(i => i.id === id)!).filter(Boolean)
  const ledgerItems = suggestion.ledgerIds.map(id => items.find(i => i.id === id)!).filter(Boolean)
  const allItems = [...bankItems, ...ledgerItems]

  const confidenceCls = tokens.confidence[suggestion.confidence]

  const actionLabel: Record<string, string> = {
    'match': 'Match',
    'match-with-adjustment': 'Match + Adjust',
    'create-entry': 'Create Entry',
    'void-duplicate': 'Void Duplicate',
    'mark-outstanding': 'Mark Outstanding',
    'no-match': 'No Match',
  }

  function handleAccept() {
    if (suggestion.action === 'match-with-adjustment' || suggestion.action === 'create-entry') {
      setShowDetail(true)
    } else {
      onAccept(suggestion)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors">
      {/* Card header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Items summary */}
            <div className="flex flex-wrap gap-2 mb-2">
              {allItems.map(item => (
                <div key={item.id} className="flex items-center gap-1.5">
                  <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                    item.side === 'bank' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
                  }`}>{item.id}</span>
                  <span className="text-sm text-gray-700 truncate max-w-[180px]">{item.description}</span>
                  <span className={`text-sm font-medium ${item.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {fmt(item.amount)}
                  </span>
                  <span className="text-xs text-gray-400">{fmtDate(item.date)}</span>
                </div>
              ))}
            </div>

            {/* Reason */}
            <div className="flex items-center flex-wrap gap-1.5">
              <span className={`${cls.badge} ${confidenceCls}`}>
                {suggestion.confidence} confidence
              </span>
              {suggestion.reasonChips.map((chip, i) => (
                <span key={i} className={`${cls.badge} bg-gray-100 text-gray-600`}>{chip}</span>
              ))}
            </div>

            {/* Adjustment preview */}
            {suggestion.adjustment && !showDetail && (
              <div className="mt-2 text-xs text-gray-500">
                → {actionLabel[suggestion.action]}:{' '}
                <span className="font-medium text-gray-700">{suggestion.adjustment.account} ({suggestion.adjustment.accountCode})</span>
                {' '}· {fmt(suggestion.adjustment.amount)}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onReject(suggestion.id)}
              className={cls.btnGhost}
              title="Reject suggestion"
            >
              Skip
            </button>
            {suggestion.action !== 'no-match' && (
              <button
                onClick={handleAccept}
                className={cls.btnPrimary}
              >
                {suggestion.confidence === 'high' ? '✓ ' : ''}{actionLabel[suggestion.action]}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Match detail panel */}
      {showDetail && (
        <MatchDetail
          suggestion={suggestion}
          items={items}
          onConfirm={(adj) => {
            setShowDetail(false)
            onAccept(suggestion, adj)
          }}
          onCancel={() => setShowDetail(false)}
        />
      )}
    </div>
  )
}
