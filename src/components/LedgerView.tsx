import { useMemo, useState, useRef, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { Item, Source, Suggestion } from '../data/seed'
import { SOURCES } from '../data/seed'
import type { Resolution } from '../hooks/useReconcile'
import type { useReconcile } from '../hooks/useReconcile'
import { AUTO_MATCHED_PAIRS } from '../data/autoMatched'
import type { AutoMatchedPair } from '../data/autoMatched'
import { cls, tokens } from '../theme/tokens'
import { ItemContext } from './ItemContext'

interface Props {
  items: Item[]
  resolutions: Resolution[]
  resolvedItemIds: Set<string>
  sourceFilter: Source | 'all'
  onSourceFilterChange: (s: Source) => void
  searchQuery: string
  onUnmatch: (pairId: string) => void
  onResolve: (resolution: Omit<Resolution, 'timestamp'>) => void
  onReject: (suggestionId: string) => void
  activeSuggestions: Suggestion[]
  scrollToItemKey?: string
  getRelatedItems: ReturnType<typeof useReconcile>['getRelatedItems']
  unmatchedPairIds: string[]
  allItems: Item[]
}

type LedgerRow =
  | { type: 'matched'; pair: AutoMatchedPair }
  | { type: 'unmatched-source'; item: Item }
  | { type: 'unmatched-ledger'; item: Item }

const ROW_HEIGHT = 44

const SOURCE_ORDER: Source[] = ['bank', 'stripe', 'receivables', 'cards']

const ACCOUNT_CODE: Record<Source, string> = {
  bank:        '1010 · Cash',
  stripe:      '1015 · Stripe',
  receivables: '1200 · AR',
  cards:       '2110 · Cards',
}

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

function fmtMoney(n: number) {
  return Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtAmt(n: number) {
  const abs = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return n < 0 ? `(${abs})` : `$${abs}`
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    month: '2-digit', day: '2-digit', year: 'numeric',
  })
}

function fmtDateShort(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function rowDate(row: LedgerRow): string {
  return row.type === 'matched' ? row.pair.sourceItem.date : row.item.date
}

function rowKey(row: LedgerRow): string {
  return row.type === 'matched' ? row.pair.id : row.item.key
}

function rowAmount(row: LedgerRow): number {
  return row.type === 'matched' ? row.pair.sourceItem.amount : row.item.amount
}

function rowDescription(row: LedgerRow): string {
  if (row.type === 'matched') return row.pair.sourceItem.description
  return row.item.description
}

function rowReference(row: LedgerRow): string {
  if (row.type === 'matched') {
    return row.pair.sourceItem.reference || row.pair.ledgerItem.reference || ''
  }
  return row.item.reference || ''
}

function rowCardholder(row: LedgerRow): string {
  if (row.type === 'matched') {
    const m = row.pair.sourceItem.meta
    return m?.cardholder ? `${m.cardholder} ···${m.cardLast4}` : ''
  }
  const m = row.item.meta
  return m?.cardholder ? `${m.cardholder} ···${m.cardLast4}` : ''
}

// ── Workspace Panel ────────────────────────────────────────────────────────────

type WorkspaceAction =
  | { type: 'create-entry'; itemKey: string }
  | { type: 'flag'; itemKey: string }
  | { type: 'suspense'; itemKey: string }
  | { type: 'confirm-accept'; suggestion: Suggestion }
  | null

const actionLabel: Record<string, string> = {
  'match':               'Match',
  'match-with-adjustment': 'Match + Adjust',
  'create-entry':        'Create Entry',
  'void-duplicate':      'Void Duplicate',
  'mark-outstanding':    'Mark Outstanding',
  'no-match':            'No Match',
  'apply-payment':       'Apply Payment',
  'create-credit-memo':  'Create Credit Memo',
  'code-expense':        'Code Expense',
}

interface WorkspaceProps {
  selectedRow: string | null
  filteredRows: LedgerRow[]
  activeSuggestions: Suggestion[]
  allItems: Item[]
  onResolve: (resolution: Omit<Resolution, 'timestamp'>) => void
  onReject: (suggestionId: string) => void
  onUnmatch: (pairId: string) => void
  getRelatedItems: ReturnType<typeof useReconcile>['getRelatedItems']
  setSelectedRow: (key: string | null) => void
}

function WorkspacePanel({
  selectedRow,
  filteredRows,
  activeSuggestions,
  allItems,
  onResolve,
  onReject,
  onUnmatch,
  getRelatedItems,
  setSelectedRow,
}: WorkspaceProps) {
  const [workspaceAction, setWorkspaceAction] = useState<WorkspaceAction>(null)
  const [confirmUnmatch, setConfirmUnmatch] = useState(false)
  const [flagNote, setFlagNote] = useState('')
  const [flagAssignee, setFlagAssignee] = useState('')
  const [suspenseNote, setSuspenseNote] = useState('')

  // Inline form state for suggestions that need an adjustment entry
  const [adjAccount, setAdjAccount] = useState('')
  const [adjAccountCode, setAdjAccountCode] = useState('')
  const [adjMemo, setAdjMemo] = useState('')
  const [adjAmount, setAdjAmount] = useState('')

  // Reset action state when selection changes
  useEffect(() => {
    setWorkspaceAction(null)
    setConfirmUnmatch(false)
    setFlagNote('')
    setFlagAssignee('')
    setSuspenseNote('')
    setAdjAccount('')
    setAdjAccountCode('')
    setAdjMemo('')
    setAdjAmount('')
  }, [selectedRow])

  if (!selectedRow) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        Select a transaction from the ledger to review or resolve it
      </div>
    )
  }

  const row = filteredRows.find(r => rowKey(r) === selectedRow)
  if (!row) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">
        Select a transaction from the ledger to review or resolve it
      </div>
    )
  }

  // ── Matched row workspace ──────────────────────────────────────────────────

  if (row.type === 'matched') {
    const pair = row.pair
    const ref = pair.sourceItem.reference || pair.ledgerItem.reference || '—'

    function handleUnmatch() {
      onUnmatch(pair.id)
      setSelectedRow(null)
    }

    return (
      <div>
        {/* Box 1: Auto-matched pair */}
        <div className="border-2 border-red-200 bg-red-50/20 rounded-lg p-4 mb-4">
          <div className="text-xs text-gray-400 mb-2">Auto-matched pair</div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                {SOURCES[pair.source].sourceSideLabel}
              </div>
              <div className="text-gray-800 font-medium truncate">{pair.sourceItem.description}</div>
              <div className="text-xs text-gray-500 mt-1">
                {fmtDateShort(pair.sourceItem.date)}
                {' · '}
                <span className={pair.sourceItem.amount >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                  {fmtAmt(pair.sourceItem.amount)}
                </span>
              </div>
              {pair.sourceItem.reference && (
                <div className="text-xs text-gray-400 mt-0.5">{pair.sourceItem.reference}</div>
              )}
              {pair.sourceItem.meta?.cardholder && (
                <div className="text-xs text-gray-400 mt-0.5">
                  {pair.sourceItem.meta.cardholder} ···{pair.sourceItem.meta.cardLast4}
                </div>
              )}
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                {SOURCES[pair.source].ledgerSideLabel}
              </div>
              <div className="text-gray-800 font-medium truncate">{pair.ledgerItem.description}</div>
              <div className="text-xs text-gray-500 mt-1">
                {fmtDateShort(pair.ledgerItem.date)}
                {' · '}
                <span className={pair.ledgerItem.amount >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                  {fmtAmt(pair.ledgerItem.amount)}
                </span>
              </div>
              {pair.ledgerItem.reference && (
                <div className="text-xs text-gray-400 mt-0.5">{pair.ledgerItem.reference}</div>
              )}
            </div>
          </div>
        </div>

        {/* Box 2: Unmatch section */}
        <div className="border border-gray-200 bg-white rounded-lg p-4">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Unmatch</div>
          {confirmUnmatch ? (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-sm">
              <div className="font-medium text-amber-800 mb-1">Break this match?</div>
              <div className="text-xs text-amber-700 mb-3">Both items will return to the work queue for manual review.</div>
              <div className="flex gap-2">
                <button onClick={handleUnmatch} className={cls.btnDanger}>Break match</button>
                <button onClick={() => setConfirmUnmatch(false)} className={cls.btnGhost}>Cancel</button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-600 mb-3">Break this match? Both items will return to the work queue.</p>
              <div className="text-xs text-gray-400 mb-3">Match reference: {ref}</div>
              <button
                onClick={() => setConfirmUnmatch(true)}
                className="text-xs text-red-600 hover:text-red-700 px-3 py-1.5 rounded border border-red-200 hover:bg-red-50 transition-colors font-medium"
              >
                Unmatch
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Unmatched row workspace ────────────────────────────────────────────────

  const item = row.item
  const isSourceSide = item.side === 'bank' || item.side === 'stripe' || item.side === 'payment' || item.side === 'card'

  // Find active suggestion for this item
  const suggestion = activeSuggestions.find(s => s.itemKeys.includes(item.key))

  // Related items
  const related = getRelatedItems(item)

  function handleAcceptSuggestion(
    sug: Suggestion,
    adjustmentOverride?: { amount: number; account: string; accountCode: string; description: string }
  ) {
    const adj = adjustmentOverride || sug.adjustment
    const itemIds = sug.itemKeys

    if (sug.action === 'match' || (sug.action === 'apply-payment' && !sug.adjustment)) {
      onResolve({
        id: `res-${sug.id}`,
        itemIds,
        suggestionId: sug.id,
        type: 'matched',
        description: `Matched ${itemIds.join(', ')}`,
      })
      setSelectedRow(null)
    } else if (sug.action === 'match-with-adjustment' || (sug.action === 'apply-payment' && sug.adjustment)) {
      onResolve({
        id: `res-${sug.id}`,
        itemIds,
        suggestionId: sug.id,
        type: 'applied-payment',
        description: `Applied payment ${itemIds.join(', ')} with ${adj?.account} adjustment`,
        adjustmentAmount: adj?.amount,
        adjustmentAccount: adj?.account,
      })
      setSelectedRow(null)
    } else if (sug.action === 'mark-outstanding') {
      onResolve({
        id: `res-${sug.id}`,
        itemIds,
        suggestionId: sug.id,
        type: 'outstanding',
        description: `Marked ${itemIds.join(', ')} outstanding (carries to October)`,
      })
      setSelectedRow(null)
    } else if (
      sug.action === 'create-entry' ||
      sug.action === 'create-credit-memo' ||
      sug.action === 'code-expense'
    ) {
      onResolve({
        id: `res-${sug.id}`,
        itemIds,
        suggestionId: sug.id,
        type: sug.action === 'code-expense' ? 'coded-expense' : 'created-entry',
        description: `Created ${adj?.account} entry for ${itemIds.join(', ')}`,
        adjustmentAmount: adj?.amount,
        adjustmentAccount: adj?.account,
      })
      setSelectedRow(null)
    }
  }

  // Determines whether "Accept" needs to open an inline form
  function needsInlineForm(sug: Suggestion): boolean {
    return (
      sug.action === 'match-with-adjustment' ||
      sug.action === 'create-entry' ||
      sug.action === 'create-credit-memo' ||
      sug.action === 'code-expense' ||
      (sug.action === 'apply-payment' && !!sug.adjustment)
    )
  }

  function handleAcceptClick() {
    if (!suggestion) return
    if (needsInlineForm(suggestion)) {
      // Pre-fill from suggestion adjustment
      const adj = suggestion.adjustment
      setAdjAccount(adj?.account || '')
      setAdjAccountCode(adj?.accountCode || '')
      setAdjMemo(adj?.description || '')
      setAdjAmount(adj?.amount !== undefined ? String(Math.abs(adj.amount)) : '')
      setWorkspaceAction({ type: 'confirm-accept', suggestion })
    } else {
      handleAcceptSuggestion(suggestion)
    }
  }

  function handleConfirmPost() {
    if (workspaceAction?.type !== 'confirm-accept') return
    const sug = workspaceAction.suggestion
    const adj = sug.adjustment
    const overrideAdj = {
      amount: adj ? (adj.amount < 0 ? -parseFloat(adjAmount) : parseFloat(adjAmount)) : -parseFloat(adjAmount),
      account: adjAccount,
      accountCode: adjAccountCode,
      description: adjMemo,
    }
    handleAcceptSuggestion(sug, overrideAdj)
    setWorkspaceAction(null)
  }

  function handleFlag() {
    onResolve({
      id: `res-flag-${item.key}`,
      itemIds: [item.key],
      type: 'flagged',
      description: `Flagged for follow-up${flagAssignee ? ` → ${flagAssignee}` : ''}`,
      note: flagNote,
    })
    setSelectedRow(null)
  }

  function handleSuspense() {
    onResolve({
      id: `res-suspense-${item.key}`,
      itemIds: [item.key],
      type: 'suspense',
      description: `Posted ${item.reference || item.description} (${fmtAmt(item.amount)}) to Suspense (2999)`,
      note: suspenseNote,
    })
    setSelectedRow(null)
  }

  function handleManualOutstanding() {
    onResolve({
      id: `res-outstanding-${item.key}`,
      itemIds: [item.key],
      type: 'outstanding',
      description: `Marked ${item.reference || item.description} outstanding — carries to October`,
    })
    setSelectedRow(null)
  }

  return (
    <div>
      {/* Box 1: Selected transaction card */}
      <div className="border-2 border-red-300 bg-red-50/30 rounded-lg p-4 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${sourceBadgeCls[item.source]}`}>
            {SOURCES[item.source].label}
          </span>
          <span className={`text-xs px-1.5 py-0.5 rounded ${sideBadgeCls[item.side] || 'bg-gray-50 text-gray-600'}`}>
            {item.side}
          </span>
        </div>
        <div className="text-sm font-semibold text-gray-800 mb-2">{item.description}</div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{fmtDateShort(item.date)}</span>
          <span className={`px-2 py-0.5 rounded font-medium ${item.amount >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
            {fmtAmt(item.amount)}
          </span>
          {item.reference && (
            <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{item.reference}</span>
          )}
          {item.meta?.cardholder && (
            <span className="bg-gray-100 text-gray-500 px-2 py-0.5 rounded">
              {item.meta.cardholder} ···{item.meta.cardLast4}
            </span>
          )}
        </div>
      </div>

      {/* Box 2: Campfire suggestion */}
      {suggestion && (
        <div className="border border-gray-200 bg-white rounded-lg p-4 mb-4">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Campfire Suggestion</div>

          {/* Confidence + reason chips */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            <span className={`${cls.badge} ${tokens.confidence[suggestion.confidence]}`}>
              {suggestion.confidence} confidence
            </span>
            {suggestion.reasonChips.map((chip, i) => (
              <span key={i} className={`${cls.badge} bg-gray-100 text-gray-600`}>{chip}</span>
            ))}
          </div>

          {/* Items in suggestion */}
          <div className="space-y-1.5 mb-3">
            {suggestion.itemKeys.map(key => {
              const it = allItems.find(i => i.key === key)
              if (!it) return null
              return (
                <div key={key} className="flex items-center gap-2 text-xs bg-gray-50 rounded px-2.5 py-1.5">
                  <span className={`px-1.5 py-0.5 rounded ${sideBadgeCls[it.side] || 'bg-gray-100 text-gray-600'}`}>
                    {it.side}
                  </span>
                  <span className="flex-1 truncate text-gray-700">{it.description}</span>
                  <span className={`font-medium tabular-nums shrink-0 ${it.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {fmtAmt(it.amount)}
                  </span>
                  <span className="text-gray-400 shrink-0">{fmtDateShort(it.date)}</span>
                </div>
              )
            })}
          </div>

          {/* Adjustment preview */}
          {suggestion.adjustment && workspaceAction?.type !== 'confirm-accept' && (
            <div className="text-xs text-gray-500 mb-3">
              → {actionLabel[suggestion.action]}:{' '}
              <span className="font-medium text-gray-700">
                {suggestion.adjustment.account} ({suggestion.adjustment.accountCode})
              </span>
              {' '}· {fmtAmt(suggestion.adjustment.amount)}
            </div>
          )}

          {/* Action label */}
          <div className="text-xs text-gray-400 mb-2">
            Suggested action: <span className="font-medium text-gray-600">{actionLabel[suggestion.action]}</span>
          </div>

          {/* Accept / Skip buttons */}
          {workspaceAction?.type !== 'confirm-accept' && (
            <div className="flex gap-2">
              <button onClick={() => onReject(suggestion.id)} className={cls.btnGhost}>
                Skip
              </button>
              {suggestion.action !== 'no-match' && (
                <button onClick={handleAcceptClick} className={cls.btnPrimary}>
                  {suggestion.confidence === 'high' ? '✓ ' : ''}{actionLabel[suggestion.action]}
                </button>
              )}
            </div>
          )}

          {/* Inline form for suggestions needing adjustment */}
          {workspaceAction?.type === 'confirm-accept' && (
            <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-md">
              <div className="text-xs font-medium text-gray-700 mb-2">Confirm & Post</div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>
                  <label className={cls.label}>Account *</label>
                  <input
                    className={cls.input}
                    value={adjAccount}
                    onChange={e => setAdjAccount(e.target.value)}
                    placeholder="e.g. Merchant Fees"
                  />
                </div>
                <div>
                  <label className={cls.label}>Account Code</label>
                  <input
                    className={cls.input}
                    value={adjAccountCode}
                    onChange={e => setAdjAccountCode(e.target.value)}
                    placeholder="e.g. 6815"
                  />
                </div>
                <div>
                  <label className={cls.label}>Memo</label>
                  <input
                    className={cls.input}
                    value={adjMemo}
                    onChange={e => setAdjMemo(e.target.value)}
                    placeholder="Description"
                  />
                </div>
                <div>
                  <label className={cls.label}>Amount</label>
                  <input
                    className={cls.input}
                    value={adjAmount}
                    onChange={e => setAdjAmount(e.target.value)}
                    placeholder="0.00"
                    type="number"
                    step="0.01"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleConfirmPost}
                  disabled={!adjAccount.trim()}
                  className={cls.btnPrimary}
                >
                  Confirm & Post
                </button>
                <button onClick={() => setWorkspaceAction(null)} className={cls.btnGhost}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Box 3: Manual resolution */}
      <div className="border border-gray-200 bg-white rounded-lg p-4 mb-4">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Resolve Manually</div>

        {workspaceAction?.type === 'flag' && (
          <div className="p-3 bg-orange-50 border border-orange-200 rounded-md mb-3">
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
                onClick={() => {
                  setWorkspaceAction({ type: 'suspense', itemKey: item.key })
                  setFlagNote('')
                  setFlagAssignee('')
                }}
                className={cls.btnSecondary}
              >
                Post to Suspense instead
              </button>
              <button onClick={() => setWorkspaceAction(null)} className={cls.btnGhost}>Cancel</button>
            </div>
          </div>
        )}

        {workspaceAction?.type === 'suspense' && (
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-md mb-3">
            <div className="text-xs font-medium text-gray-700 mb-2">Post to Suspense (2999)</div>
            <div className="text-xs text-gray-500 mb-2">
              This will book {fmtAmt(item.amount)} to Suspense and clear the unexplained difference.
            </div>
            <div className="mb-2">
              <label className={cls.label}>Required note *</label>
              <input className={cls.input} value={suspenseNote} onChange={e => setSuspenseNote(e.target.value)} placeholder="Reason for suspense posting" />
            </div>
            <div className="flex gap-2">
              <button onClick={handleSuspense} disabled={!suspenseNote.trim()} className={cls.btnPrimary}>Post to Suspense</button>
              <button onClick={() => setWorkspaceAction(null)} className={cls.btnGhost}>Cancel</button>
            </div>
          </div>
        )}

        {(!workspaceAction || (workspaceAction.type !== 'flag' && workspaceAction.type !== 'suspense')) && (
          <div className="flex flex-wrap gap-2">
            {isSourceSide ? (
              <>
                <button
                  onClick={() => setWorkspaceAction({ type: 'flag', itemKey: item.key })}
                  className={cls.btnSecondary}
                >
                  Flag for follow-up
                </button>
                <button
                  onClick={() => setWorkspaceAction({ type: 'suspense', itemKey: item.key })}
                  className={cls.btnSecondary}
                >
                  Post to Suspense
                </button>
              </>
            ) : (
              <>
                <button onClick={handleManualOutstanding} className={cls.btnSecondary}>Mark Outstanding</button>
                <button
                  onClick={() => setWorkspaceAction({ type: 'flag', itemKey: item.key })}
                  className={cls.btnSecondary}
                >
                  Flag for follow-up
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Box 4: Related context */}
      {related.length > 0 && (
        <div className="border border-gray-200 bg-white rounded-lg p-4">
          <ItemContext
            item={item}
            getRelatedItems={getRelatedItems}
            onViewInLedger={() => {}}
            onMatchInstead={() => {}}
          />
        </div>
      )}
    </div>
  )
}

// ── Main LedgerView ────────────────────────────────────────────────────────────

export function LedgerView({
  items,
  resolutions: _resolutions,
  resolvedItemIds: _resolvedItemIds,
  sourceFilter,
  onSourceFilterChange,
  searchQuery,
  onUnmatch,
  onResolve,
  onReject,
  activeSuggestions,
  scrollToItemKey,
  getRelatedItems,
  unmatchedPairIds,
  allItems,
}: Props) {
  const [unmatchedOnly, setUnmatchedOnly] = useState(false)
  const [localSearch, setLocalSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedRow, setSelectedRow] = useState<string | null>(null)

  const parentRef = useRef<HTMLDivElement>(null)

  const allRows = useMemo((): LedgerRow[] => {
    if (sourceFilter === 'all') return []
    const rows: LedgerRow[] = []
    for (const pair of AUTO_MATCHED_PAIRS) {
      if (pair.source !== sourceFilter) continue
      if (unmatchedPairIds.includes(pair.id)) continue
      rows.push({ type: 'matched', pair })
    }
    for (const item of items) {
      if (item.source !== sourceFilter) continue
      const isSource = ['bank', 'stripe', 'payment', 'card'].includes(item.side)
      rows.push({ type: isSource ? 'unmatched-source' : 'unmatched-ledger', item })
    }
    rows.sort((a, b) => rowDate(a).localeCompare(rowDate(b)))
    return rows
  }, [sourceFilter, items, unmatchedPairIds])

  const filteredRows = useMemo(() => {
    const q = (localSearch || searchQuery).trim().toLowerCase()
    return allRows.filter(row => {
      if (unmatchedOnly && row.type === 'matched') return false
      if (dateFrom && rowDate(row) < dateFrom) return false
      if (dateTo && rowDate(row) > dateTo) return false
      if (q) {
        const desc = rowDescription(row).toLowerCase()
        const ref = rowReference(row).toLowerCase()
        const amt = fmtMoney(rowAmount(row))
        const ch = rowCardholder(row).toLowerCase()
        if (!desc.includes(q) && !ref.includes(q) && !amt.includes(q) && !ch.includes(q)) return false
      }
      return true
    })
  }, [allRows, unmatchedOnly, localSearch, searchQuery, dateFrom, dateTo])

  const unmatchedCount = filteredRows.filter(r => r.type !== 'matched').length

  const virtualizer = useVirtualizer({
    count: filteredRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  })

  useEffect(() => {
    if (!scrollToItemKey || filteredRows.length === 0) return
    const idx = filteredRows.findIndex(r => rowKey(r) === scrollToItemKey)
    if (idx >= 0) virtualizer.scrollToIndex(idx, { align: 'center' })
  }, [scrollToItemKey, filteredRows])

  // Source picker when filter is 'all'
  if (sourceFilter === 'all') {
    return (
      <div className="flex flex-col items-center justify-center" style={{ height: 'calc(100vh - 140px)' }}>
        <div className="text-center">
          <div className="bg-[#2d6a4f] text-white text-center py-6 px-12 rounded-t-lg">
            <div className="text-2xl font-bold">Campfire</div>
            <div className="text-lg font-semibold mt-0.5">General Ledger</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-b-lg p-8 text-center">
            <p className="text-sm text-gray-500 mb-4">Select an account to view the full ledger</p>
            <div className="flex gap-3 justify-center flex-wrap">
              {SOURCE_ORDER.map(src => (
                <button
                  key={src}
                  onClick={() => onSourceFilterChange(src)}
                  className="bg-[#2d6a4f] hover:bg-[#1b4332] text-white text-sm font-medium px-4 py-2 rounded transition-colors"
                >
                  {SOURCES[src].label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const src = SOURCES[sourceFilter]

  return (
    <div className="flex" style={{ height: 'calc(100vh - 140px)' }}>

      {/* ── LEFT: ledger list ──────────────────────────────────────────── */}
      <div className="w-[38%] flex flex-col border-r border-gray-300 overflow-hidden bg-white">

        {/* Green header */}
        <div className="bg-[#2d6a4f] text-white px-3 py-2 shrink-0">
          <div className="text-sm font-bold">Campfire · General Ledger</div>
          <div className="text-xs text-green-200 mt-0.5">{src.label} · Sep 2026</div>
        </div>

        {/* Account meta row */}
        <div className="bg-white border-b border-gray-300 px-3 py-2 shrink-0">
          <div className="flex items-start justify-between text-xs">
            <div>
              <span className="font-semibold text-gray-800">Account:</span>{' '}
              <span className="text-gray-600">{src.label}</span>
            </div>
            <div className="text-gray-500">
              <span className="font-medium">{ACCOUNT_CODE[sourceFilter]}</span>
            </div>
          </div>
          <div className="text-xs text-gray-400 mt-0.5">Journal Period: Sep 2026</div>
        </div>

        {/* Filter bar */}
        <div className="bg-gray-50 border-b border-gray-300 px-2 py-1.5 shrink-0">
          {/* Source tabs */}
          <div className="flex items-center gap-0.5 mb-1.5">
            {SOURCE_ORDER.map(s => (
              <button
                key={s}
                onClick={() => onSourceFilterChange(s)}
                className={`px-2 py-0.5 text-xs rounded transition-colors font-medium ${
                  sourceFilter === s
                    ? 'bg-[#2d6a4f] text-white'
                    : 'text-gray-600 hover:bg-gray-200'
                }`}
              >
                {SOURCES[s].label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer select-none">
              <input type="checkbox" checked={unmatchedOnly} onChange={e => setUnmatchedOnly(e.target.checked)} className="rounded border-gray-300" />
              Unmatched only
            </label>
            <input
              type="text"
              placeholder="Search…"
              value={localSearch}
              onChange={e => setLocalSearch(e.target.value)}
              className="border border-gray-300 rounded px-1.5 py-0.5 text-xs w-24 focus:outline-none focus:ring-1 focus:ring-[#2d6a4f]"
            />
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="border border-gray-300 rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#2d6a4f]" />
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="border border-gray-300 rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#2d6a4f]" />
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {filteredRows.length} of {allRows.length} · {unmatchedCount} unmatched
          </div>
        </div>

        {/* Column headers */}
        <div className="bg-[#2d6a4f] text-white text-xs font-semibold border-b border-[#1b4332] shrink-0">
          <div className="grid gap-0" style={{ gridTemplateColumns: '44px 80px 1fr 80px 80px 90px' }}>
            <div className="px-2 py-1.5 border-r border-[#1b4332]">No</div>
            <div className="px-2 py-1.5 border-r border-[#1b4332]">Date</div>
            <div className="px-2 py-1.5 border-r border-[#1b4332]">Description</div>
            <div className="px-2 py-1.5 border-r border-[#1b4332] text-right">Debit</div>
            <div className="px-2 py-1.5 border-r border-[#1b4332] text-right">Credit</div>
            <div className="px-2 py-1.5">Ref</div>
          </div>
        </div>

        {/* Virtualized rows */}
        <div
          ref={parentRef}
          className="flex-1 overflow-auto"
        >
          <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
            {virtualizer.getVirtualItems().map(virtualRow => {
              const row = filteredRows[virtualRow.index]
              const key = rowKey(row)
              const rowNum = virtualRow.index + 1
              const amt = rowAmount(row)
              const isDebit = amt >= 0
              const isUnmatched = row.type !== 'matched'
              const isSelected = selectedRow === key
              const isHighlighted = scrollToItemKey === key
              const isEven = virtualRow.index % 2 === 0

              let rowBg = isUnmatched
                ? 'bg-amber-50'
                : isEven ? 'bg-white' : 'bg-[#f9fefe]'
              if (isSelected) rowBg = ''

              return (
                <div
                  key={key}
                  data-index={virtualRow.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                    height: ROW_HEIGHT,
                  }}
                >
                  <div
                    className={`border-b border-gray-200 cursor-pointer transition-colors h-full ${
                      isSelected
                        ? 'bg-pink-100 ring-1 ring-inset ring-pink-400'
                        : rowBg + (isHighlighted ? ' ring-2 ring-inset ring-yellow-400' : ' hover:bg-gray-50')
                    }`}
                    onClick={() => setSelectedRow(isSelected ? null : key)}
                  >
                    <div
                      className="grid h-full items-center text-xs gap-0"
                      style={{ gridTemplateColumns: '44px 80px 1fr 80px 80px 90px' }}
                    >
                      {/* No */}
                      <div className="px-2 border-r border-gray-200 text-gray-400 tabular-nums text-right">{rowNum}</div>

                      {/* Date */}
                      <div className="px-2 border-r border-gray-200 text-gray-600 tabular-nums text-xs">
                        {fmtDate(rowDate(row))}
                      </div>

                      {/* Description */}
                      <div className={`px-2 border-r border-gray-200 min-w-0 ${isUnmatched ? 'border-l-2 border-l-amber-400' : ''}`}>
                        <div className={`truncate ${isUnmatched ? 'text-gray-900 font-medium' : 'text-gray-600'}`}>
                          {rowDescription(row)}
                        </div>
                      </div>

                      {/* Debit */}
                      <div className="px-2 border-r border-gray-200 text-right tabular-nums">
                        {isDebit ? (
                          <span className="text-gray-800">${fmtMoney(amt)}</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </div>

                      {/* Credit */}
                      <div className="px-2 border-r border-gray-200 text-right tabular-nums">
                        {!isDebit ? (
                          <span className="text-gray-800">${fmtMoney(amt)}</span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </div>

                      {/* Ref */}
                      <div className="px-2 text-gray-500 truncate">
                        {rowReference(row) || <span className="text-gray-300">—</span>}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── RIGHT: workspace ───────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto bg-gray-50 p-6">
        <WorkspacePanel
          selectedRow={selectedRow}
          filteredRows={filteredRows}
          activeSuggestions={activeSuggestions}
          allItems={allItems}
          onResolve={onResolve}
          onReject={onReject}
          onUnmatch={onUnmatch}
          getRelatedItems={getRelatedItems}
          setSelectedRow={setSelectedRow}
        />
      </div>
    </div>
  )
}
