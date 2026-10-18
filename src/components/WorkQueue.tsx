import { useState } from 'react'
import { CREATE_ENTRY_DEFAULTS, SOURCES } from '../data/seed'
import type { Item, Suggestion, Source } from '../data/seed'
import type { Resolution } from '../hooks/useReconcile'
import { cls } from '../theme/tokens'
import { SuggestionCard } from './SuggestionCard'
import { CreateEntryForm } from './CreateEntryForm'

interface Props {
  items: Item[]
  allItems: Item[]
  activeSuggestions: Suggestion[]
  itemsWithoutSuggestion: Item[]
  matchesSearch: (item: Item) => boolean
  searchQuery: string
  sourceFilter: Source | 'all'
  onResolve: (resolution: Omit<Resolution, 'timestamp'>) => void
  onReject: (suggestionId: string) => void
  onSetSourceFilter: (f: Source | 'all') => void
}

function fmt(n: number) {
  const abs = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return n < 0 ? `(${abs})` : `$${abs}`
}

function fmtDate(d: string) {
  const dt = new Date(d + 'T00:00:00')
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

type ItemAction =
  | { type: 'create-entry'; itemKey: string }
  | { type: 'outstanding'; itemKey: string }
  | { type: 'void'; itemKey: string }
  | { type: 'flag'; itemKey: string }
  | { type: 'suspense'; itemKey: string }
  | null

const SOURCE_ORDER: Source[] = ['bank', 'stripe', 'receivables', 'cards']

const sourceBadgeCls: Record<Source, string> = {
  bank:        'bg-blue-50 text-blue-700',
  stripe:      'bg-violet-50 text-violet-700',
  receivables: 'bg-teal-50 text-teal-700',
  cards:       'bg-orange-50 text-orange-700',
}

const sideBadgeCls: Record<string, string> = {
  bank:        'bg-blue-50 text-blue-600',
  ledger:      'bg-purple-50 text-purple-700',
  stripe:      'bg-violet-50 text-violet-700',
  payment:     'bg-teal-50 text-teal-700',
  invoice:     'bg-indigo-50 text-indigo-700',
  card:        'bg-orange-50 text-orange-700',
}

export function WorkQueue({
  items,
  allItems,
  activeSuggestions,
  itemsWithoutSuggestion,
  matchesSearch,
  searchQuery,
  sourceFilter,
  onResolve,
  onReject,
  onSetSourceFilter,
}: Props) {
  const [activeAction, setActiveAction] = useState<ItemAction>(null)
  const [flagNote, setFlagNote] = useState('')
  const [flagAssignee, setFlagAssignee] = useState('')
  const [suspenseNote, setSuspenseNote] = useState('')
  const [voidReason, setVoidReason] = useState('')

  // Source filter tabs — count open items per source
  const sourceCounts = SOURCE_ORDER.reduce<Record<string, number>>((acc, src) => {
    acc[src] = items.filter(i => i.source === src).length
    return acc
  }, {})

  // Apply source filter to suggestions
  const sourcedSuggestions = sourceFilter === 'all'
    ? activeSuggestions
    : activeSuggestions.filter(s => s.source === sourceFilter)

  // Filter suggestions by search
  const filteredSuggestions = sourcedSuggestions.filter(s => {
    const relatedItems = s.itemKeys
      .map(key => allItems.find(i => i.key === key)!)
      .filter(Boolean)
    return relatedItems.some(item => matchesSearch(item))
  })

  // Orphan items filtered by source and search
  const sourcedOrphans = sourceFilter === 'all'
    ? itemsWithoutSuggestion
    : itemsWithoutSuggestion.filter(i => i.source === sourceFilter)

  const orphans = sourcedOrphans.filter(matchesSearch)

  const totalVisible = filteredSuggestions.length + orphans.length

  function handleAcceptSuggestion(
    suggestion: Suggestion,
    adjustmentOverride?: { amount: number; account: string; accountCode: string; description: string },
    note?: string
  ) {
    const adj = adjustmentOverride || suggestion.adjustment
    const itemKeys = suggestion.itemKeys

    if (suggestion.action === 'match') {
      onResolve({
        id: `res-${suggestion.id}`,
        itemIds: itemKeys,
        suggestionId: suggestion.id,
        type: 'matched',
        description: `Matched ${itemKeys.map(k => {
          const it = allItems.find(i => i.key === k)
          return it?.reference || it?.description || k
        }).join(', ')}`,
      })
    } else if (suggestion.action === 'match-with-adjustment') {
      onResolve({
        id: `res-${suggestion.id}`,
        itemIds: itemKeys,
        suggestionId: suggestion.id,
        type: 'matched-with-adjustment',
        description: `Matched with ${adj?.account} adjustment`,
        adjustmentAmount: adj?.amount,
        adjustmentAccount: adj?.account,
      })
    } else if (suggestion.action === 'apply-payment') {
      if (adj) {
        onResolve({
          id: `res-${suggestion.id}`,
          itemIds: itemKeys,
          suggestionId: suggestion.id,
          type: 'applied-payment',
          description: `Applied payment — ${adj.description}`,
          adjustmentAmount: adj.amount,
          adjustmentAccount: adj.account,
        })
      } else {
        onResolve({
          id: `res-${suggestion.id}`,
          itemIds: itemKeys,
          suggestionId: suggestion.id,
          type: 'applied-payment',
          description: `Applied payment for ${itemKeys.length} item(s)`,
        })
      }
    } else if (suggestion.action === 'create-entry' || suggestion.action === 'create-credit-memo' || suggestion.action === 'code-expense') {
      setActiveAction({ type: 'create-entry', itemKey: itemKeys[0] })
    } else if (suggestion.action === 'void-duplicate') {
      onResolve({
        id: `res-${suggestion.id}`,
        itemIds: itemKeys,
        suggestionId: suggestion.id,
        type: 'voided',
        description: `Voided duplicate entry`,
        note: note || 'Duplicate of already-matched entry',
      })
    } else if (suggestion.action === 'mark-outstanding') {
      onResolve({
        id: `res-${suggestion.id}`,
        itemIds: itemKeys,
        suggestionId: suggestion.id,
        type: 'outstanding',
        description: `Marked outstanding (carries to October)`,
      })
    } else if (suggestion.action === 'no-match') {
      setActiveAction({ type: 'flag', itemKey: itemKeys[0] })
    }
  }

  function handleCreateEntry(itemKey: string, entry: { account: string; accountCode: string; vendor: string; memo: string }) {
    const item = allItems.find(i => i.key === itemKey)!
    onResolve({
      id: `res-create-${itemKey}`,
      itemIds: [itemKey],
      type: 'created-entry',
      description: `Created ${entry.account} entry for ${item.reference || item.description} (${fmt(item.amount)})`,
      adjustmentAmount: item.amount,
      adjustmentAccount: entry.account,
    })
    setActiveAction(null)
  }

  function handleFlag(itemKey: string) {
    onResolve({
      id: `res-flag-${itemKey}`,
      itemIds: [itemKey],
      type: 'flagged',
      description: `Flagged for follow-up${flagAssignee ? ` → ${flagAssignee}` : ''}`,
      note: flagNote,
    })
    setFlagNote('')
    setFlagAssignee('')
    setActiveAction(null)
  }

  function handleSuspense(itemKey: string) {
    const item = allItems.find(i => i.key === itemKey)!
    onResolve({
      id: `res-suspense-${itemKey}`,
      itemIds: [itemKey],
      type: 'suspense',
      description: `Posted ${item.reference || item.description} (${fmt(item.amount)}) to Suspense (2999)`,
      note: suspenseNote,
    })
    setSuspenseNote('')
    setActiveAction(null)
  }

  function handleVoid(itemKey: string) {
    onResolve({
      id: `res-void-${itemKey}`,
      itemIds: [itemKey],
      type: 'voided',
      description: `Voided duplicate entry`,
      note: voidReason,
    })
    setVoidReason('')
    setActiveAction(null)
  }

  function handleOrphanOutstanding(item: Item) {
    onResolve({
      id: `res-outstanding-${item.key}`,
      itemIds: [item.key],
      type: 'outstanding',
      description: `Marked ${item.reference || item.description} outstanding — carries to October`,
    })
    setActiveAction(null)
  }

  function renderOrphanActions(item: Item) {
    if (activeAction?.itemKey === item.key) {
      if (activeAction.type === 'create-entry') {
        const defaults = CREATE_ENTRY_DEFAULTS[item.key] || {}
        return (
          <CreateEntryForm
            item={item}
            defaultAccount={defaults.account}
            defaultAccountCode={defaults.accountCode}
            defaultVendor={defaults.vendor}
            defaultMemo={defaults.memo}
            onSave={(entry) => handleCreateEntry(item.key, entry)}
            onCancel={() => setActiveAction(null)}
          />
        )
      }
      if (activeAction.type === 'flag') {
        return (
          <div className="mt-2 p-3 bg-orange-50 border border-orange-200 rounded-md">
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
              <button onClick={() => handleFlag(item.key)} className={cls.btnPrimary}>Flag for Follow-up</button>
              <button
                onClick={() => {
                  setActiveAction({ type: 'suspense', itemKey: item.key })
                  setFlagNote('')
                  setFlagAssignee('')
                }}
                className={cls.btnSecondary}
              >
                Post to Suspense instead
              </button>
              <button onClick={() => setActiveAction(null)} className={cls.btnGhost}>Cancel</button>
            </div>
          </div>
        )
      }
      if (activeAction.type === 'suspense') {
        const item2 = allItems.find(i => i.key === activeAction.itemKey)!
        return (
          <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-md">
            <div className="text-xs font-medium text-gray-700 mb-2">Post to Suspense (2999)</div>
            <div className="text-xs text-gray-500 mb-2">
              This will book {fmt(item2.amount)} to Suspense and clear the unexplained difference.
            </div>
            <div className="mb-2">
              <label className={cls.label}>Required note *</label>
              <input className={cls.input} value={suspenseNote} onChange={e => setSuspenseNote(e.target.value)} placeholder="Reason for suspense posting" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleSuspense(activeAction.itemKey)} disabled={!suspenseNote.trim()} className={cls.btnPrimary}>Post to Suspense</button>
              <button onClick={() => setActiveAction(null)} className={cls.btnGhost}>Cancel</button>
            </div>
          </div>
        )
      }
      if (activeAction.type === 'void') {
        const item3 = allItems.find(i => i.key === activeAction.itemKey)!
        return (
          <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md">
            <div className="text-xs font-medium text-red-700 mb-2">Void Duplicate Entry</div>
            <div className="bg-white border border-red-100 rounded p-2 mb-2">
              <div className="text-xs text-gray-500">{fmtDate(item3.date)}</div>
              <div className="text-sm text-gray-800">{item3.description}</div>
              <div className={`text-sm font-semibold ${item3.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {fmt(item3.amount)}
              </div>
            </div>
            <div className="mb-2">
              <label className={cls.label}>Reason *</label>
              <input className={cls.input} value={voidReason} onChange={e => setVoidReason(e.target.value)} placeholder="Duplicate of which entry?" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => handleVoid(activeAction.itemKey)} disabled={!voidReason.trim()} className={cls.btnDanger}>Void Duplicate</button>
              <button onClick={() => setActiveAction(null)} className={cls.btnGhost}>Cancel</button>
            </div>
          </div>
        )
      }
    }
    return null
  }

  function renderOrphanItem(item: Item) {
    const isSourceSide = item.side === 'bank' || item.side === 'stripe' || item.side === 'payment' || item.side === 'card'
    const isActive = activeAction?.itemKey === item.key
    return (
      <div key={item.key} className="bg-white border border-gray-200 rounded-lg p-3">
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
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-sm font-semibold ${item.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {fmt(item.amount)}
            </span>
            {isSourceSide && (
              <>
                <button onClick={() => setActiveAction({ type: 'create-entry', itemKey: item.key })} className={cls.btnSecondary}>Create Entry</button>
                <button onClick={() => setActiveAction({ type: 'flag', itemKey: item.key })} className={cls.btnGhost}>Can't Resolve</button>
              </>
            )}
            {!isSourceSide && (
              <>
                <button onClick={() => handleOrphanOutstanding(item)} className={cls.btnSecondary}>Mark Outstanding</button>
                <button onClick={() => setActiveAction({ type: 'void', itemKey: item.key })} className="text-red-600 hover:text-red-700 text-xs px-2 py-1 rounded border border-red-200 hover:bg-red-50 transition-colors">Void</button>
              </>
            )}
          </div>
        </div>
        {isActive && renderOrphanActions(item)}
      </div>
    )
  }

  if (totalVisible === 0 && searchQuery) {
    return (
      <div>
        {/* Source filter tabs */}
        <SourceTabs items={items} sourceFilter={sourceFilter} sourceCounts={sourceCounts} onSetSourceFilter={onSetSourceFilter} />
        <div className="text-center py-12 text-gray-400">
          <div className="text-2xl mb-2">🔍</div>
          <div>No items match "{searchQuery}"</div>
        </div>
      </div>
    )
  }

  if (totalVisible === 0) {
    return (
      <div>
        <SourceTabs items={items} sourceFilter={sourceFilter} sourceCounts={sourceCounts} onSetSourceFilter={onSetSourceFilter} />
        <div className="text-center py-12 text-gray-400">
          <div className="text-2xl mb-2">✓</div>
          <div className="text-gray-600 font-medium">All items resolved</div>
          <div className="text-sm mt-1">Switch to Resolved view to review or undo</div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Source filter tabs */}
      <SourceTabs items={items} sourceFilter={sourceFilter} sourceCounts={sourceCounts} onSetSourceFilter={onSetSourceFilter} />

      {searchQuery && (
        <div className="text-xs text-gray-500">
          Showing {totalVisible} item{totalVisible !== 1 ? 's' : ''}
        </div>
      )}

      <div className="space-y-6">
        {/* Likely Matches */}
        {filteredSuggestions.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Likely Matches
              <span className="ml-1.5 text-gray-400 font-normal normal-case">({filteredSuggestions.length})</span>
            </h2>
            <div className="space-y-2">
              {filteredSuggestions.map(suggestion => (
                <SuggestionCard
                  key={suggestion.id}
                  suggestion={suggestion}
                  items={allItems}
                  onAccept={handleAcceptSuggestion}
                  onReject={onReject}
                />
              ))}
            </div>
          </section>
        )}

        {/* Orphan items */}
        {orphans.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Needs Attention
              <span className="ml-1.5 text-gray-400 font-normal normal-case">({orphans.length})</span>
            </h2>
            <div className="space-y-2">
              {orphans.map(item => renderOrphanItem(item))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

function SourceTabs({
  items,
  sourceFilter,
  sourceCounts,
  onSetSourceFilter,
}: {
  items: Item[]
  sourceFilter: Source | 'all'
  sourceCounts: Record<string, number>
  onSetSourceFilter: (f: Source | 'all') => void
}) {
  const allCount = items.length
  return (
    <div className="flex items-center gap-1 border-b border-gray-200 pb-0 -mb-px overflow-x-auto">
      {(['all', ...SOURCE_ORDER] as (Source | 'all')[]).map(src => {
        const count = src === 'all' ? allCount : (sourceCounts[src] ?? 0)
        const label = src === 'all' ? 'All' : SOURCES[src].label
        const active = sourceFilter === src
        return (
          <button
            key={src}
            onClick={() => onSetSourceFilter(src)}
            className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 transition-colors ${
              active
                ? 'border-blue-600 text-blue-700 font-medium'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {label}
            {count > 0 && (
              <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${active ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
