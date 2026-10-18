import { useState } from 'react'
import type { Item, Suggestion, Source } from '../data/seed'
import { SOURCES, CREATE_ENTRY_DEFAULTS } from '../data/seed'
import type { Resolution, useReconcile } from '../hooks/useReconcile'
import { cls } from '../theme/tokens'
import { MatchDetail } from './MatchDetail'
import { CreateEntryForm } from './CreateEntryForm'
import { AUTO_MATCHED_PAIRS } from '../data/autoMatched'

// Returns the 1-based line number of an item in the ledger for its source,
// using the same Sep 2026 date window and sort order as LedgerView.
function ledgerLineNumber(itemKey: string, source: Source, allItems: Item[]): number | null {
  const rows: { date: string; key: string }[] = []
  for (const pair of AUTO_MATCHED_PAIRS) {
    if (pair.source !== source) continue
    rows.push({ date: pair.sourceItem.date, key: pair.id })
  }
  for (const item of allItems) {
    if (item.source !== source) continue
    rows.push({ date: item.date, key: item.key })
  }
  rows.sort((a, b) => a.date.localeCompare(b.date))
  const filtered = rows.filter(r => r.date >= '2026-09-01' && r.date <= '2026-09-30')
  const idx = filtered.findIndex(r => r.key === itemKey)
  return idx >= 0 ? idx + 1 : null
}

function orphanGuidance(item: Item): string {
  if (item.source === 'bank') {
    if (item.side === 'bank')
      return 'No matching ledger entry found. Create a ledger entry or post to Suspense (2999) with a note.'
    return 'This check or entry hasn\'t cleared the bank yet. Mark as outstanding if payment was issued but not yet cashed.'
  }
  if (item.source === 'stripe') {
    if (item.side === 'stripe')
      return 'No clearing entry found. Create an entry to Stripe clearing (1015), or investigate the charge.'
    return 'No matching Stripe transaction. Check for a timing difference or create a credit memo.'
  }
  if (item.source === 'receivables') {
    if (item.side === 'payment')
      return 'Unapplied payment. Apply to an open invoice, or post to unearned revenue if no invoice exists.'
    return 'Invoice is still open. Follow up with the customer, or mark outstanding if payment is expected soon.'
  }
  if (item.source === 'cards') {
    if (item.side === 'card')
      return 'No expense entry found. Code to the appropriate expense account and request a receipt if missing.'
    return 'No matching card charge. Verify the entry, or void if it was entered in error.'
  }
  return 'Review this item and choose the appropriate action.'
}

interface Props {
  activeSuggestions: Suggestion[]
  itemsWithoutSuggestion: Item[]
  allItems: Item[]
  sourceFilter: Source | 'all'
  onSourceFilterChange: (s: Source | 'all') => void
  onResolve: (resolution: Omit<Resolution, 'timestamp'>) => void
  onReject: (suggestionId: string) => void
  getRelatedItems: ReturnType<typeof useReconcile>['getRelatedItems']
  searchQuery: string
  onSearch: (q: string) => void
  onSelectItem: (key: string | null) => void
  selectedItemKey: string | null
  resolvedCount: number
  totalItems: number
}

const SOURCE_ORDER: Source[] = ['bank', 'stripe', 'receivables', 'cards']


const sideBadgeCls: Record<string, string> = {
  bank:        'bg-blue-50 text-blue-600',
  ledger:      'bg-purple-50 text-purple-700',
  stripe:      'bg-violet-50 text-violet-700',
  payment:     'bg-teal-50 text-teal-700',
  invoice:     'bg-indigo-50 text-indigo-700',
  card:        'bg-orange-50 text-orange-700',
}

const actionLabel: Record<string, string> = {
  'match':                 'Match',
  'match-with-adjustment': 'Match + Adjust',
  'create-entry':          'Create Entry',
  'void-duplicate':        'Void Duplicate',
  'mark-outstanding':      'Mark Outstanding',
  'no-match':              'No Match',
  'apply-payment':         'Apply Payment',
  'create-credit-memo':    'Create Credit Memo',
  'code-expense':          'Code Expense',
}

function fmt(n: number) {
  const abs = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return n < 0 ? `(${abs})` : `$${abs}`
}

function fmtDate(d: string) {
  const dt = new Date(d + 'T00:00:00')
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ── Suggestion Card (IssuesPanel version) ────────────────────────────────────

interface SuggestionCardProps {
  suggestion: Suggestion
  allItems: Item[]
  isSelected: boolean
  onSelect: () => void
  onResolve: (resolution: Omit<Resolution, 'timestamp'>) => void
  onReject: (id: string) => void
}

function IssueSuggestionCard({
  suggestion,
  allItems,
  onSelect,
  onResolve,
  onReject,
}: SuggestionCardProps) {
  const [showDetail, setShowDetail] = useState(false)
  const [showVoidForm, setShowVoidForm] = useState(false)
  const [voidReason, setVoidReason] = useState('Duplicate of already-matched entry')
  const [flagNote, setFlagNote] = useState('')
  const [flagAssignee, setFlagAssignee] = useState('')
  const [suspenseNote, setSuspenseNote] = useState('')
  const [showFlagForm, setShowFlagForm] = useState(false)
  const [showSuspenseForm, setShowSuspenseForm] = useState(false)

  const suggestionItems = suggestion.itemKeys
    .map(key => allItems.find(i => i.key === key)!)
    .filter(Boolean)

  function handleAcceptSuggestion(
    sug: Suggestion,
    adjustmentOverride?: { amount: number; account: string; accountCode: string; description: string },
    note?: string
  ) {
    const adj = adjustmentOverride || sug.adjustment
    const itemKeys = sug.itemKeys

    if (sug.action === 'match') {
      onResolve({
        id: `res-${sug.id}`,
        itemIds: itemKeys,
        suggestionId: sug.id,
        type: 'matched',
        description: `Matched ${itemKeys.map(k => {
          const it = allItems.find(i => i.key === k)
          return it?.reference || it?.description || k
        }).join(', ')}`,
      })
    } else if (sug.action === 'match-with-adjustment') {
      onResolve({
        id: `res-${sug.id}`,
        itemIds: itemKeys,
        suggestionId: sug.id,
        type: 'matched-with-adjustment',
        description: `Matched with ${adj?.account} adjustment`,
        adjustmentAmount: adj?.amount,
        adjustmentAccount: adj?.account,
      })
    } else if (sug.action === 'apply-payment') {
      if (adj) {
        onResolve({
          id: `res-${sug.id}`,
          itemIds: itemKeys,
          suggestionId: sug.id,
          type: 'applied-payment',
          description: `Applied payment — ${adj.description}`,
          adjustmentAmount: adj.amount,
          adjustmentAccount: adj.account,
        })
      } else {
        onResolve({
          id: `res-${sug.id}`,
          itemIds: itemKeys,
          suggestionId: sug.id,
          type: 'applied-payment',
          description: `Applied payment for ${itemKeys.length} item(s)`,
        })
      }
    } else if (
      sug.action === 'create-entry' ||
      sug.action === 'create-credit-memo' ||
      sug.action === 'code-expense'
    ) {
      onResolve({
        id: `res-${sug.id}`,
        itemIds: itemKeys,
        suggestionId: sug.id,
        type: sug.action === 'code-expense' ? 'coded-expense' : 'created-entry',
        description: `Created ${adj?.account || 'entry'} for ${itemKeys.join(', ')}`,
        adjustmentAmount: adj?.amount,
        adjustmentAccount: adj?.account,
      })
    } else if (sug.action === 'void-duplicate') {
      onResolve({
        id: `res-${sug.id}`,
        itemIds: itemKeys,
        suggestionId: sug.id,
        type: 'voided',
        description: `Voided duplicate entry`,
        note: note || 'Duplicate of already-matched entry',
      })
    } else if (sug.action === 'mark-outstanding') {
      onResolve({
        id: `res-${sug.id}`,
        itemIds: itemKeys,
        suggestionId: sug.id,
        type: 'outstanding',
        description: `Marked outstanding (carries to October)`,
      })
    } else if (sug.action === 'no-match') {
      setShowFlagForm(true)
    }
  }

  function handleAccept() {
    if (
      suggestion.action === 'match-with-adjustment' ||
      suggestion.action === 'create-entry' ||
      suggestion.action === 'create-credit-memo' ||
      suggestion.action === 'code-expense' ||
      (suggestion.action === 'apply-payment' && suggestion.adjustment)
    ) {
      setShowDetail(true)
    } else if (suggestion.action === 'void-duplicate') {
      setShowVoidForm(true)
    } else {
      handleAcceptSuggestion(suggestion)
    }
  }

  function handleFlag() {
    if (suggestionItems[0]) {
      onResolve({
        id: `res-flag-${suggestion.id}`,
        itemIds: suggestion.itemKeys,
        type: 'flagged',
        description: `Flagged for follow-up${flagAssignee ? ` → ${flagAssignee}` : ''}`,
        note: flagNote,
      })
    }
    setShowFlagForm(false)
    setFlagNote('')
    setFlagAssignee('')
  }

  function handleSuspense() {
    if (suggestionItems[0]) {
      onResolve({
        id: `res-suspense-${suggestion.id}`,
        itemIds: suggestion.itemKeys,
        type: 'suspense',
        description: `Posted to Suspense (2999)`,
        note: suspenseNote,
      })
    }
    setShowSuspenseForm(false)
    setSuspenseNote('')
  }

  const [showReview, setShowReview] = useState(false)

  return (
    <div className="bg-white border border-gray-200 rounded-xl hover:border-gray-300 transition-colors">
      {/* Card body */}
      <div className="p-4 cursor-pointer" onClick={onSelect}>
        <div className="flex items-start gap-4">
          {/* Items list */}
          <div className="flex-1 min-w-0 space-y-3">
            {suggestionItems.map(item => {
              const lineNum = ledgerLineNumber(item.key, suggestion.source, allItems)
              const title = item.reference
                ? `${item.reference} · ${item.description}`
                : item.description
              const sideLabel = item.side.charAt(0).toUpperCase() + item.side.slice(1)
              return (
                <div key={item.key}>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sideBadgeCls[item.side] || 'bg-gray-100 text-gray-600'}`}>
                    {sideLabel}
                  </span>
                  <div className="text-base font-semibold text-gray-900 mt-0.5 truncate">{title}</div>
                  <div className="text-sm text-gray-400">
                    {lineNum !== null ? `Line ${lineNum} · ` : ''}{fmtDate(item.date)}
                    {item.meta?.cardholder ? ` · ${item.meta.cardholder}` : ''}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 shrink-0 pt-1" onClick={e => e.stopPropagation()}>
            <button onClick={() => onReject(suggestion.id)} className="text-sm text-gray-500 hover:text-gray-700 font-medium">
              Skip
            </button>
            {suggestion.source === 'cards' && (
              <button
                onClick={() => onResolve({
                  id: `res-receipt-${suggestion.id}`,
                  itemIds: suggestion.itemKeys,
                  type: 'flagged',
                  description: 'Missing receipt — follow up with cardholder',
                  note: 'Receipt requested',
                })}
                className="text-sm text-amber-600 hover:text-amber-700 font-medium border border-amber-200 px-3 py-1.5 rounded-lg hover:bg-amber-50 transition-colors"
              >
                Missing receipt
              </button>
            )}
            {suggestion.action !== 'no-match' && (
              <button onClick={handleAccept} className="bg-green-600 text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-green-700 transition-colors">
                Resolve
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Review toggle */}
      <div className="px-4 pb-3 border-t border-gray-100 pt-2" onClick={e => e.stopPropagation()}>
        <button
          className="text-sm font-semibold text-gray-700 flex items-center gap-1"
          onClick={() => setShowReview(v => !v)}
        >
          Review {showReview ? '∨' : '>'}
        </button>
        {showReview && (
          <div className="mt-1.5 space-y-0.5">
            {suggestion.reasonChips.map((chip, i) => (
              <div key={i} className="text-sm text-gray-400">{chip}</div>
            ))}
            {suggestion.adjustment && (
              <div className="text-sm text-gray-400">
                {actionLabel[suggestion.action]}: {suggestion.adjustment.account} · {fmt(suggestion.adjustment.amount)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Match/create detail panel */}
      {showDetail && (
        <MatchDetail
          suggestion={suggestion}
          items={allItems}
          onConfirm={(adj) => {
            setShowDetail(false)
            handleAcceptSuggestion(suggestion, adj)
          }}
          onCancel={() => setShowDetail(false)}
        />
      )}

      {/* Void duplicate panel */}
      {showVoidForm && (
        <div className="px-4 pb-4 pt-0">
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <div className="text-xs font-medium text-red-700 mb-2">Void Duplicate Entry</div>
            {suggestionItems[0] && (
              <div className="bg-white border border-red-100 rounded p-2 mb-2">
                <div className="text-xs text-gray-500">{fmtDate(suggestionItems[0].date)}</div>
                <div className="text-sm text-gray-800">{suggestionItems[0].description}</div>
                {suggestionItems[0].reference && <div className="text-xs text-gray-400">{suggestionItems[0].reference}</div>}
                <div className={`text-sm font-semibold ${suggestionItems[0].amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {fmt(suggestionItems[0].amount)}
                </div>
              </div>
            )}
            <div className="mb-2">
              <label className={cls.label}>Reason</label>
              <input
                className={cls.input}
                value={voidReason}
                onChange={e => setVoidReason(e.target.value)}
                placeholder="Reason for voiding"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowVoidForm(false)
                  handleAcceptSuggestion(suggestion, undefined, voidReason)
                }}
                className="text-white bg-red-600 hover:bg-red-700 text-xs px-3 py-1.5 rounded font-medium transition-colors"
              >
                Void Duplicate
              </button>
              <button onClick={() => setShowVoidForm(false)} className={cls.btnGhost}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Flag form */}
      {showFlagForm && (
        <div className="px-4 pb-4 pt-0">
          <div className="p-3 bg-orange-50 border border-orange-200 rounded-md">
            <div className="text-xs font-medium text-orange-700 mb-2">Flag for follow-up</div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div>
                <label className={cls.label}>Note</label>
                <input className={cls.input} value={flagNote} onChange={e => setFlagNote(e.target.value)} placeholder="Why can't this be resolved?" />
              </div>
              <div>
                <label className={cls.label}>Assign to</label>
                <input className={cls.input} value={flagAssignee} onChange={e => setFlagAssignee(e.target.value)} placeholder="Name or email" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleFlag} className={cls.btnPrimary}>Flag for Follow-up</button>
              <button onClick={() => { setShowFlagForm(false); setShowSuspenseForm(true) }} className={cls.btnSecondary}>Post to Suspense instead</button>
              <button onClick={() => setShowFlagForm(false)} className={cls.btnGhost}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Suspense form */}
      {showSuspenseForm && (
        <div className="px-4 pb-4 pt-0">
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-md">
            <div className="text-xs font-medium text-gray-700 mb-2">Post to Suspense (2999)</div>
            <div className="mb-2">
              <label className={cls.label}>Required note *</label>
              <input className={cls.input} value={suspenseNote} onChange={e => setSuspenseNote(e.target.value)} placeholder="Reason for suspense posting" />
            </div>
            <div className="flex gap-2">
              <button onClick={handleSuspense} disabled={!suspenseNote.trim()} className={cls.btnPrimary}>Post to Suspense</button>
              <button onClick={() => setShowSuspenseForm(false)} className={cls.btnGhost}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Orphan item card ──────────────────────────────────────────────────────────

interface OrphanCardProps {
  item: Item
  allItems: Item[]
  isSelected: boolean
  onSelect: () => void
  onResolve: (resolution: Omit<Resolution, 'timestamp'>) => void
}

function OrphanCard({ item, allItems, isSelected, onSelect, onResolve }: OrphanCardProps) {
  const [showCreateEntry, setShowCreateEntry] = useState(false)
  const [showFlagForm, setShowFlagForm] = useState(false)
  const [showSuspenseForm, setShowSuspenseForm] = useState(false)
  const [flagNote, setFlagNote] = useState('')
  const [flagAssignee, setFlagAssignee] = useState('')
  const [suspenseNote, setSuspenseNote] = useState('')

  const isSourceSide = item.side === 'bank' || item.side === 'stripe' || item.side === 'payment' || item.side === 'card'

  function handleCreateEntry(entry: { account: string; accountCode: string; vendor: string; memo: string }) {
    onResolve({
      id: `res-create-${item.key}`,
      itemIds: [item.key],
      type: 'created-entry',
      description: `Created ${entry.account} entry for ${item.reference || item.description} (${fmt(item.amount)})`,
      adjustmentAmount: item.amount,
      adjustmentAccount: entry.account,
    })
    setShowCreateEntry(false)
  }

  function handleOutstanding() {
    onResolve({
      id: `res-outstanding-${item.key}`,
      itemIds: [item.key],
      type: 'outstanding',
      description: `Marked ${item.reference || item.description} outstanding — carries to October`,
    })
  }

  function handleFlag() {
    onResolve({
      id: `res-flag-${item.key}`,
      itemIds: [item.key],
      type: 'flagged',
      description: `Flagged for follow-up${flagAssignee ? ` → ${flagAssignee}` : ''}`,
      note: flagNote,
    })
    setShowFlagForm(false)
    setFlagNote('')
    setFlagAssignee('')
  }

  function handleSuspense() {
    onResolve({
      id: `res-suspense-${item.key}`,
      itemIds: [item.key],
      type: 'suspense',
      description: `Posted ${item.reference || item.description} (${fmt(item.amount)}) to Suspense (2999)`,
      note: suspenseNote,
    })
    setShowSuspenseForm(false)
    setSuspenseNote('')
  }

  const defaults = CREATE_ENTRY_DEFAULTS[item.key] || {}

  return (
    <div
      className={`bg-white border rounded-xl transition-colors ${
        isSelected
          ? 'ring-2 ring-blue-500 border-blue-300 bg-blue-50/30'
          : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="p-4 cursor-pointer" onClick={onSelect}>
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            {(() => {
              const lineNum = ledgerLineNumber(item.key, item.source, allItems)
              const sideLabel = item.side.charAt(0).toUpperCase() + item.side.slice(1)
              const title = item.reference ? `${item.reference} · ${item.description}` : item.description
              return (
                <>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sideBadgeCls[item.side] || 'bg-gray-100 text-gray-600'}`}>
                    {sideLabel}
                  </span>
                  <div className="text-base font-semibold text-gray-900 mt-0.5 truncate">{title}</div>
                  <div className="text-sm text-gray-400">
                    {lineNum !== null ? `Line ${lineNum} · ` : ''}{fmtDate(item.date)}
                    {item.meta?.cardholder ? ` · ${item.meta.cardholder}` : ''}
                  </div>
                  <div className="text-sm text-gray-400 italic mt-1">{orphanGuidance(item)}</div>
                </>
              )
            })()}
          </div>
          <div className="flex items-center gap-3 shrink-0 pt-1" onClick={e => e.stopPropagation()}>
            {isSourceSide ? (
              <>
                <button onClick={() => setShowFlagForm(true)} className="text-sm text-gray-500 hover:text-gray-700 font-medium">Skip</button>
                {item.source === 'cards' && (
                  <button
                    onClick={() => onResolve({
                      id: `res-receipt-${item.key}`,
                      itemIds: [item.key],
                      type: 'flagged',
                      description: 'Missing receipt — follow up with cardholder',
                      note: 'Receipt requested',
                    })}
                    className="text-sm text-amber-600 hover:text-amber-700 font-medium border border-amber-200 px-3 py-1.5 rounded-lg hover:bg-amber-50 transition-colors"
                  >
                    Missing receipt
                  </button>
                )}
                <button onClick={() => setShowCreateEntry(true)} className="bg-green-600 text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-green-700 transition-colors">Resolve</button>
              </>
            ) : (
              <>
                <button onClick={() => setShowFlagForm(true)} className="text-sm text-gray-500 hover:text-gray-700 font-medium">Flag</button>
                <button onClick={handleOutstanding} className="bg-green-600 text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-green-700 transition-colors">Mark Outstanding</button>
              </>
            )}
          </div>
        </div>
      </div>

      {showCreateEntry && (
        <div className="px-4 pb-4">
          <CreateEntryForm
            item={item}
            defaultAccount={defaults.account}
            defaultAccountCode={defaults.accountCode}
            defaultVendor={defaults.vendor}
            defaultMemo={defaults.memo}
            onSave={handleCreateEntry}
            onCancel={() => setShowCreateEntry(false)}
          />
        </div>
      )}

      {showFlagForm && (
        <div className="px-4 pb-4">
          <div className="p-3 bg-orange-50 border border-orange-200 rounded-md">
            <div className="text-xs font-medium text-orange-700 mb-2">Flag for follow-up</div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div>
                <label className={cls.label}>Note</label>
                <input className={cls.input} value={flagNote} onChange={e => setFlagNote(e.target.value)} placeholder="Why can't this be resolved?" />
              </div>
              <div>
                <label className={cls.label}>Assign to</label>
                <input className={cls.input} value={flagAssignee} onChange={e => setFlagAssignee(e.target.value)} placeholder="Name or email" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleFlag} className={cls.btnPrimary}>Flag for Follow-up</button>
              <button
                onClick={() => { setShowFlagForm(false); setShowSuspenseForm(true) }}
                className={cls.btnSecondary}
              >
                Post to Suspense instead
              </button>
              <button onClick={() => setShowFlagForm(false)} className={cls.btnGhost}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showSuspenseForm && (
        <div className="px-4 pb-4">
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-md">
            <div className="text-xs font-medium text-gray-700 mb-2">Post to Suspense (2999)</div>
            <div className="text-xs text-gray-500 mb-2">
              This will book {fmt(item.amount)} to Suspense and clear the unexplained difference.
            </div>
            <div className="mb-2">
              <label className={cls.label}>Required note *</label>
              <input className={cls.input} value={suspenseNote} onChange={e => setSuspenseNote(e.target.value)} placeholder="Reason for suspense posting" />
            </div>
            <div className="flex gap-2">
              <button onClick={handleSuspense} disabled={!suspenseNote.trim()} className={cls.btnPrimary}>Post to Suspense</button>
              <button onClick={() => setShowSuspenseForm(false)} className={cls.btnGhost}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── IssuesPanel ───────────────────────────────────────────────────────────────

export function IssuesPanel({
  activeSuggestions,
  itemsWithoutSuggestion,
  allItems,
  sourceFilter,
  onSourceFilterChange,
  onResolve,
  onReject,
  getRelatedItems: _getRelatedItems,
  searchQuery,
  onSearch,
  onSelectItem,
  selectedItemKey,
  resolvedCount,
  totalItems,
}: Props) {
  // Source filter applies to displayed cards
  const sourcedSuggestions = sourceFilter === 'all'
    ? activeSuggestions
    : activeSuggestions.filter(s => s.source === sourceFilter)

  const filteredSuggestions = searchQuery
    ? sourcedSuggestions.filter(s => {
        const relatedItems = s.itemKeys.map(key => allItems.find(i => i.key === key)!).filter(Boolean)
        const q = searchQuery.trim().toLowerCase()
        return relatedItems.some(item => {
          const desc = item.description.toLowerCase()
          const ref = (item.reference || '').toLowerCase()
          const amt = Math.abs(item.amount).toFixed(2)
          return desc.includes(q) || ref.includes(q) || amt.includes(q)
        })
      })
    : sourcedSuggestions

  const sourcedOrphans = sourceFilter === 'all'
    ? itemsWithoutSuggestion
    : itemsWithoutSuggestion.filter(i => i.source === sourceFilter)

  const filteredOrphans = searchQuery
    ? sourcedOrphans.filter(item => {
        const q = searchQuery.trim().toLowerCase()
        const desc = item.description.toLowerCase()
        const ref = (item.reference || '').toLowerCase()
        const amt = Math.abs(item.amount).toFixed(2)
        return desc.includes(q) || ref.includes(q) || amt.includes(q)
      })
    : sourcedOrphans

  // Count for source filter pills
  const allSuggestionsCount = activeSuggestions.length + itemsWithoutSuggestion.length
  const sourceCounts: Record<string, number> = {}
  SOURCE_ORDER.forEach(src => {
    sourceCounts[src] = activeSuggestions.filter(s => s.source === src).length +
      itemsWithoutSuggestion.filter(i => i.source === src).length
  })

  const totalVisible = filteredSuggestions.length + filteredOrphans.length

  // All resolved empty state
  if (totalVisible === 0 && !searchQuery) {
    return (
      <div className="p-6">
        <IssuesPanelHeader
          searchQuery={searchQuery}
          onSearch={onSearch}
          sourceFilter={sourceFilter}
          onSourceFilterChange={onSourceFilterChange}
          allCount={allSuggestionsCount}
          sourceCounts={sourceCounts}
          resolvedCount={resolvedCount}
          totalItems={totalItems}
        />
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">All issues resolved</h3>
          <p className="text-sm text-gray-500">This source has no remaining items to review.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <IssuesPanelHeader
        searchQuery={searchQuery}
        onSearch={onSearch}
        sourceFilter={sourceFilter}
        onSourceFilterChange={onSourceFilterChange}
        allCount={allSuggestionsCount}
        sourceCounts={sourceCounts}
        resolvedCount={resolvedCount}
        totalItems={totalItems}
      />

      {searchQuery && totalVisible === 0 && (
        <div className="text-center py-12 text-gray-400">
          <div className="text-2xl mb-2">🔍</div>
          <div>No items match "{searchQuery}"</div>
        </div>
      )}

      <div className="space-y-6 mt-4">
        {/* Likely Matches */}
        {filteredSuggestions.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Likely Matches
              <span className="ml-1.5 text-gray-400 font-normal normal-case">({filteredSuggestions.length})</span>
            </h3>
            <div className="space-y-2">
              {filteredSuggestions.map(suggestion => {
                const isSelected = suggestion.itemKeys.some(k => k === selectedItemKey)
                return (
                  <IssueSuggestionCard
                    key={suggestion.id}
                    suggestion={suggestion}
                    allItems={allItems}
                    isSelected={isSelected}
                    onSelect={() => {
                      if (isSelected) {
                        onSelectItem(null)
                      } else {
                        onSourceFilterChange(suggestion.source)
                        onSelectItem(suggestion.itemKeys[0])
                      }
                    }}
                    onResolve={onResolve}
                    onReject={onReject}
                  />
                )
              })}
            </div>
          </section>
        )}

        {/* Orphan items */}
        {filteredOrphans.length > 0 && (
          <section>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Needs Attention
              <span className="ml-1.5 text-gray-400 font-normal normal-case">({filteredOrphans.length})</span>
            </h3>
            <div className="space-y-2">
              {filteredOrphans.map(item => (
                <OrphanCard
                  key={item.key}
                  item={item}
                  allItems={allItems}
                  isSelected={selectedItemKey === item.key}
                  onSelect={() => {
                    if (selectedItemKey === item.key) {
                      onSelectItem(null)
                    } else {
                      onSourceFilterChange(item.source)
                      onSelectItem(item.key)
                    }
                  }}
                  onResolve={onResolve}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

// ── Header sub-component ──────────────────────────────────────────────────────

interface HeaderProps {
  searchQuery: string
  onSearch: (q: string) => void
  sourceFilter: Source | 'all'
  onSourceFilterChange: (s: Source | 'all') => void
  allCount: number
  sourceCounts: Record<string, number>
  resolvedCount: number
  totalItems: number
}

function IssuesPanelHeader({
  searchQuery,
  onSearch,
  sourceFilter,
  onSourceFilterChange,
  allCount,
  sourceCounts,
}: HeaderProps) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-gray-900">Issues to resolve</h2>
        <div className="relative w-60">
          <input
            type="search"
            placeholder="Search description, amount, ref…"
            value={searchQuery}
            onChange={e => onSearch(e.target.value)}
            className="border border-gray-300 rounded-md pl-8 pr-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <svg className="absolute left-2.5 top-2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Source filter pills */}
      <div className="flex items-center gap-1 flex-wrap">
        <button
          onClick={() => onSourceFilterChange('all')}
          className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
            sourceFilter === 'all'
              ? 'bg-gray-800 text-white border-gray-800'
              : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
          }`}
        >
          All ({allCount})
        </button>
        {SOURCE_ORDER.map(src => {
          const count = sourceCounts[src] ?? 0
          const active = sourceFilter === src
          return (
            <button
              key={src}
              onClick={() => onSourceFilterChange(src)}
              className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                active
                  ? 'bg-gray-800 text-white border-gray-800'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              {SOURCES[src].label} ({count})
            </button>
          )
        })}
      </div>
    </div>
  )
}
