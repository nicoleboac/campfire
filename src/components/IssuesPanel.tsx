import { useState } from 'react'
import type { Item, Suggestion, Source } from '../data/seed'
import { SOURCES, CREATE_ENTRY_DEFAULTS } from '../data/seed'
import type { Resolution, useReconcile } from '../hooks/useReconcile'
import { cls, tokens } from '../theme/tokens'
import { MatchDetail } from './MatchDetail'
import { CreateEntryForm } from './CreateEntryForm'

interface Props {
  activeSuggestions: Suggestion[]
  itemsWithoutSuggestion: Item[]
  allItems: Item[]
  sourceFilter: Source | 'all'
  onSourceFilterChange: (s: Source) => void
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

const sourceBadgeCls: Record<Source, string> = {
  bank:        'bg-blue-100 text-blue-700',
  stripe:      'bg-violet-100 text-violet-700',
  receivables: 'bg-teal-100 text-teal-700',
  cards:       'bg-orange-100 text-orange-700',
}

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
  isSelected,
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

  const isExpanded = isSelected

  return (
    <div
      className={`bg-white border rounded-xl transition-colors ${
        isExpanded
          ? 'ring-2 ring-blue-500 border-blue-300 bg-blue-50/30'
          : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      {/* Card header — always visible */}
      <div
        className="p-4 cursor-pointer"
        onClick={onSelect}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Source badge */}
            <div className="flex items-center gap-2 mb-2">
              <span className={`${cls.badge} ${sourceBadgeCls[suggestion.source]}`}>
                {SOURCES[suggestion.source].label}
              </span>
            </div>

            {/* Items summary */}
            <div className="flex flex-wrap gap-2 mb-2">
              {suggestionItems.map(item => (
                <div key={item.key} className="flex items-center gap-1.5">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${sideBadgeCls[item.side] || 'bg-gray-50 text-gray-600'}`}>
                    {item.side}
                  </span>
                  <span className="text-sm text-gray-700 truncate max-w-[180px]">
                    {item.reference ? (
                      <><span className="font-medium text-gray-800">{item.reference}</span> — {item.description}</>
                    ) : item.description}
                  </span>
                  <span className={`text-sm font-medium ${item.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {fmt(item.amount)}
                  </span>
                  <span className="text-xs text-gray-400">{fmtDate(item.date)}</span>
                  {item.meta?.cardholder && (
                    <span className="text-xs text-gray-400">{item.meta.cardholder} ···{item.meta.cardLast4}</span>
                  )}
                </div>
              ))}
            </div>

            {/* Confidence + reason chips */}
            <div className="flex items-center flex-wrap gap-1.5">
              <span className={`${cls.badge} ${tokens.confidence[suggestion.confidence]}`}>
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
                <span className="font-medium text-gray-700">
                  {suggestion.adjustment.account} ({suggestion.adjustment.accountCode})
                </span>
                {' '}· {fmt(suggestion.adjustment.amount)}
              </div>
            )}
          </div>

          {/* Quick action buttons */}
          <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
            <button onClick={() => onReject(suggestion.id)} className={cls.btnGhost} title="Skip suggestion">
              Skip
            </button>
            {suggestion.action !== 'no-match' && (
              <button onClick={handleAccept} className={cls.btnPrimary}>
                {suggestion.confidence === 'high' ? '✓ ' : ''}{actionLabel[suggestion.action]}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Expanded resolution workspace */}
      {isExpanded && !showDetail && !showVoidForm && !showFlagForm && !showSuspenseForm && (
        <div className="px-4 pb-4 border-t border-blue-100">
          <div className="pt-3 text-xs text-gray-400">
            Click an action above to resolve, or use the buttons to skip or handle manually.
          </div>
        </div>
      )}

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

function OrphanCard({ item, allItems: _allItems, isSelected, onSelect, onResolve }: OrphanCardProps) {
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
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${sourceBadgeCls[item.source]}`}>
                {SOURCES[item.source].label}
              </span>
              <span className={`text-xs px-1.5 py-0.5 rounded ${sideBadgeCls[item.side] || 'bg-gray-50 text-gray-600'}`}>
                {item.side}
              </span>
              <span className="text-xs text-gray-400">{fmtDate(item.date)}</span>
              {item.reference && <span className="text-xs text-gray-500 font-medium">{item.reference}</span>}
              {item.meta?.cardholder && (
                <span className="text-xs text-gray-400">{item.meta.cardholder} ···{item.meta.cardLast4}</span>
              )}
            </div>
            <div className="text-sm text-gray-800">{item.description}</div>
          </div>
          <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
            <span className={`text-sm font-semibold ${item.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {fmt(item.amount)}
            </span>
            {isSourceSide ? (
              <>
                <button onClick={() => setShowCreateEntry(true)} className={cls.btnSecondary}>Create Entry</button>
                <button onClick={() => setShowFlagForm(true)} className={cls.btnGhost}>Can't Resolve</button>
              </>
            ) : (
              <>
                <button onClick={handleOutstanding} className={cls.btnSecondary}>Mark Outstanding</button>
                <button onClick={() => setShowFlagForm(true)} className={cls.btnGhost}>Flag</button>
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
                    onSelectItem(selectedItemKey === item.key ? null : item.key)
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
  onSourceFilterChange: (s: Source) => void
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
          onClick={() => { /* all is controlled by header tiles; show everything */ }}
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
