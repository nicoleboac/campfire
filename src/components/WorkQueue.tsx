import { useState } from 'react'
import { CREATE_ENTRY_DEFAULTS } from '../data/seed'
import type { LineItem, Suggestion } from '../data/seed'
import type { Resolution } from '../hooks/useReconcile'
import { cls } from '../theme/tokens'
import { SuggestionCard } from './SuggestionCard'
import { CreateEntryForm } from './CreateEntryForm'

interface Props {
  items: LineItem[]
  allItems: LineItem[]
  activeSuggestions: Suggestion[]
  itemsWithoutSuggestion: LineItem[]
  matchesSearch: (item: LineItem) => boolean
  searchQuery: string
  onResolve: (resolution: Omit<Resolution, 'timestamp'>) => void
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

type ItemAction =
  | { type: 'create-entry'; itemId: string }
  | { type: 'outstanding'; itemId: string }
  | { type: 'void'; itemId: string }
  | { type: 'flag'; itemId: string }
  | { type: 'suspense'; itemId: string }
  | null

export function WorkQueue({
  items,
  allItems,
  activeSuggestions,
  itemsWithoutSuggestion,
  matchesSearch,
  searchQuery,
  onResolve,
  onReject,
}: Props) {
  const [activeAction, setActiveAction] = useState<ItemAction>(null)
  const [flagNote, setFlagNote] = useState('')
  const [flagAssignee, setFlagAssignee] = useState('')
  const [suspenseNote, setSuspenseNote] = useState('')
  const [voidReason, setVoidReason] = useState('')

  // Filter suggestions by search
  const filteredSuggestions = activeSuggestions.filter(s => {
    const relatedItems = [...s.bankIds, ...s.ledgerIds]
      .map(id => allItems.find(i => i.id === id)!)
      .filter(Boolean)
    return relatedItems.some(item => matchesSearch(item))
  })

  // Group orphan items by type
  const orphans = itemsWithoutSuggestion.filter(matchesSearch)
  const orphanBankMissing = orphans.filter(i => i.side === 'bank')
  const orphanLedgerMissing = orphans.filter(i => i.side === 'ledger')

  const totalVisible = filteredSuggestions.length + orphans.length

  function handleAcceptSuggestion(
    suggestion: Suggestion,
    adjustmentOverride?: { amount: number; account: string; accountCode: string; description: string }
  ) {
    const adj = adjustmentOverride || suggestion.adjustment
    const itemIds = [...suggestion.bankIds, ...suggestion.ledgerIds]

    if (suggestion.action === 'match') {
      onResolve({
        id: `res-${suggestion.id}`,
        itemIds,
        suggestionId: suggestion.id,
        type: 'matched',
        description: `Matched ${itemIds.join(', ')}`,
      })
    } else if (suggestion.action === 'match-with-adjustment') {
      onResolve({
        id: `res-${suggestion.id}`,
        itemIds,
        suggestionId: suggestion.id,
        type: 'matched-with-adjustment',
        description: `Matched ${itemIds.join(', ')} with ${adj?.account} adjustment`,
        adjustmentAmount: adj?.amount,
        adjustmentAccount: adj?.account,
      })
    } else if (suggestion.action === 'create-entry') {
      setActiveAction({ type: 'create-entry', itemId: suggestion.bankIds[0] })
    } else if (suggestion.action === 'void-duplicate') {
      setActiveAction({ type: 'void', itemId: suggestion.ledgerIds[0] })
    } else if (suggestion.action === 'mark-outstanding') {
      onResolve({
        id: `res-${suggestion.id}`,
        itemIds,
        suggestionId: suggestion.id,
        type: 'outstanding',
        description: `Marked ${itemIds.join(', ')} outstanding (carries to October)`,
      })
    } else if (suggestion.action === 'no-match') {
      setActiveAction({ type: 'flag', itemId: suggestion.bankIds[0] })
    }
  }

  function handleCreateEntry(itemId: string, entry: { account: string; accountCode: string; vendor: string; memo: string }) {
    const item = allItems.find(i => i.id === itemId)!
    onResolve({
      id: `res-create-${itemId}`,
      itemIds: [itemId],
      type: 'created-entry',
      description: `Created ${entry.account} entry for ${itemId} (${fmt(item.amount)})`,
      adjustmentAmount: item.amount,
      adjustmentAccount: entry.account,
    })
    setActiveAction(null)
  }

  function handleFlag(itemId: string) {
    onResolve({
      id: `res-flag-${itemId}`,
      itemIds: [itemId],
      type: 'flagged',
      description: `Flagged ${itemId} for follow-up${flagAssignee ? ` → ${flagAssignee}` : ''}`,
      note: flagNote,
    })
    setFlagNote('')
    setFlagAssignee('')
    setActiveAction(null)
  }

  function handleSuspense(itemId: string) {
    const item = allItems.find(i => i.id === itemId)!
    onResolve({
      id: `res-suspense-${itemId}`,
      itemIds: [itemId],
      type: 'suspense',
      description: `Posted ${itemId} (${fmt(item.amount)}) to Suspense (2999)`,
      note: suspenseNote,
    })
    setSuspenseNote('')
    setActiveAction(null)
  }

  function handleVoid(itemId: string) {
    onResolve({
      id: `res-void-${itemId}`,
      itemIds: [itemId],
      type: 'voided',
      description: `Voided duplicate entry ${itemId}`,
      note: voidReason,
    })
    setVoidReason('')
    setActiveAction(null)
  }

  function renderOrphanActions(item: LineItem) {
    if (activeAction?.itemId === item.id) {
      if (activeAction.type === 'create-entry') {
        const defaults = CREATE_ENTRY_DEFAULTS[item.id] || {}
        return (
          <CreateEntryForm
            item={item}
            defaultAccount={defaults.account}
            defaultAccountCode={defaults.accountCode}
            defaultVendor={defaults.vendor}
            defaultMemo={defaults.memo}
            onSave={(entry) => handleCreateEntry(item.id, entry)}
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
              <button onClick={() => handleFlag(item.id)} className={cls.btnPrimary}>Flag for Follow-up</button>
              <button
                onClick={() => {
                  setActiveAction({ type: 'suspense', itemId: item.id })
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
        const item2 = allItems.find(i => i.id === activeAction.itemId)!
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
              <button onClick={() => handleSuspense(activeAction.itemId)} disabled={!suspenseNote.trim()} className={cls.btnPrimary}>Post to Suspense</button>
              <button onClick={() => setActiveAction(null)} className={cls.btnGhost}>Cancel</button>
            </div>
          </div>
        )
      }
      if (activeAction.type === 'void') {
        const item3 = allItems.find(i => i.id === activeAction.itemId)!
        return (
          <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md">
            <div className="text-xs font-medium text-red-700 mb-2">Void Duplicate Entry</div>
            <div className="bg-white border border-red-100 rounded p-2 mb-2">
              <div className="text-xs text-gray-500">{item3.id} · {fmtDate(item3.date)}</div>
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
              <button onClick={() => handleVoid(activeAction.itemId)} disabled={!voidReason.trim()} className={cls.btnDanger}>Void Duplicate</button>
              <button onClick={() => setActiveAction(null)} className={cls.btnGhost}>Cancel</button>
            </div>
          </div>
        )
      }
    }
    return null
  }

  // Handle outstanding directly from sidebar suggestion
  function handleOrphanOutstanding(item: LineItem) {
    onResolve({
      id: `res-outstanding-${item.id}`,
      itemIds: [item.id],
      type: 'outstanding',
      description: `Marked ${item.id} outstanding — carries to October`,
    })
    setActiveAction(null)
  }

  // Render an item with inline outstanding button action
  function renderOrphanItemExtended(item: LineItem) {
    const isBank = item.side === 'bank'
    const isActive = activeAction?.itemId === item.id
    return (
      <div key={item.id} className="bg-white border border-gray-200 rounded-lg p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                isBank ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
              }`}>{item.id}</span>
              <span className="text-xs text-gray-400">{fmtDate(item.date)}</span>
              {item.ref && <span className="text-xs text-gray-400">{item.ref}</span>}
            </div>
            <div className="text-sm text-gray-800">{item.description}</div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-sm font-semibold ${item.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {fmt(item.amount)}
            </span>
            {isBank && (
              <>
                <button onClick={() => setActiveAction({ type: 'create-entry', itemId: item.id })} className={cls.btnSecondary}>Create Entry</button>
                <button onClick={() => setActiveAction({ type: 'flag', itemId: item.id })} className={cls.btnGhost}>Can't Resolve</button>
              </>
            )}
            {!isBank && (
              <>
                <button
                  onClick={() => handleOrphanOutstanding(item)}
                  className={cls.btnSecondary}
                >
                  Mark Outstanding
                </button>
                <button onClick={() => setActiveAction({ type: 'void', itemId: item.id })} className="text-red-600 hover:text-red-700 text-xs px-2 py-1 rounded border border-red-200 hover:bg-red-50 transition-colors">Void</button>
              </>
            )}
          </div>
        </div>
        {isActive && renderOrphanActions(item)}
      </div>
    )
  }

  const hasMatches = filteredSuggestions.length > 0
  const hasMissingLedger = orphanBankMissing.length > 0
  const hasMissingBank = orphanLedgerMissing.length > 0

  if (totalVisible === 0 && searchQuery) {
    return (
      <div className="text-center py-12 text-gray-400">
        <div className="text-2xl mb-2">🔍</div>
        <div>No items match "{searchQuery}"</div>
      </div>
    )
  }

  if (totalVisible === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <div className="text-2xl mb-2">✓</div>
        <div className="text-gray-600 font-medium">All items resolved</div>
        <div className="text-sm mt-1">Switch to Resolved view to review or undo</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {searchQuery && (
        <div className="text-xs text-gray-500">
          Showing {totalVisible} of {items.length} items
        </div>
      )}

      {/* Likely Matches */}
      {hasMatches && (
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

      {/* Missing from Ledger (bank items with no suggestion) */}
      {hasMissingLedger && (
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Missing from Ledger
            <span className="ml-1.5 text-gray-400 font-normal normal-case">({orphanBankMissing.length})</span>
          </h2>
          <div className="space-y-2">
            {orphanBankMissing.map(item => renderOrphanItemExtended(item))}
          </div>
        </section>
      )}

      {/* Missing from Bank (ledger items with no suggestion) */}
      {hasMissingBank && (
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Missing from Bank
            <span className="ml-1.5 text-gray-400 font-normal normal-case">({orphanLedgerMissing.length})</span>
          </h2>
          <div className="space-y-2">
            {orphanLedgerMissing.map(item => renderOrphanItemExtended(item))}
          </div>
        </section>
      )}
    </div>
  )
}
