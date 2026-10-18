import { useMemo, useState, useRef, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { Item, Source } from '../data/seed'
import { SOURCES } from '../data/seed'
import type { Resolution } from '../hooks/useReconcile'
import type { useReconcile } from '../hooks/useReconcile'
import { AUTO_MATCHED_PAIRS } from '../data/autoMatched'
import type { AutoMatchedPair } from '../data/autoMatched'

interface Props {
  items: Item[]
  resolutions: Resolution[]
  resolvedItemIds: Set<string>
  sourceFilter: Source | 'all'
  onSourceFilterChange: (s: Source) => void
  searchQuery: string
  onUnmatch: (pairId: string) => void
  onResolve: (resolution: Omit<Resolution, 'timestamp'>) => void
  activeSuggestions: never[]    // kept for prop compat but unused
  scrollToItemKey?: string
  getRelatedItems: ReturnType<typeof useReconcile>['getRelatedItems']
  unmatchedPairIds: string[]
  allItems: Item[]
  onRowClick?: (key: string) => void
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

// ── Matched row inline unmatch ──────────────────────────────────────────────

interface UnmatchPanelProps {
  pair: AutoMatchedPair
  onUnmatch: (pairId: string) => void
  onClose: () => void
}

function UnmatchPanel({ pair, onUnmatch, onClose }: UnmatchPanelProps) {
  const [confirmUnmatch, setConfirmUnmatch] = useState(false)
  const ref = pair.sourceItem.reference || pair.ledgerItem.reference || '—'

  function handleUnmatch() {
    onUnmatch(pair.id)
    onClose()
  }

  return (
    <div className="px-3 pb-3 bg-white border-t border-gray-100">
      <div className="border border-gray-200 rounded-lg p-3 mt-2">
        {/* Pair details */}
        <div className="grid grid-cols-2 gap-3 text-xs mb-3">
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
              {SOURCES[pair.source].sourceSideLabel}
            </div>
            <div className="text-gray-700 font-medium truncate">{pair.sourceItem.description}</div>
            <div className="text-gray-400 mt-0.5">
              {fmtDateShort(pair.sourceItem.date)} · {fmtAmt(pair.sourceItem.amount)}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
              {SOURCES[pair.source].ledgerSideLabel}
            </div>
            <div className="text-gray-700 font-medium truncate">{pair.ledgerItem.description}</div>
            <div className="text-gray-400 mt-0.5">
              {fmtDateShort(pair.ledgerItem.date)} · {fmtAmt(pair.ledgerItem.amount)}
            </div>
          </div>
        </div>

        {confirmUnmatch ? (
          <div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs">
            <div className="font-medium text-amber-800 mb-1">Break this match?</div>
            <div className="text-amber-700 mb-2">Both items will return to the issues queue.</div>
            <div className="flex gap-2">
              <button
                onClick={handleUnmatch}
                className="bg-red-600 hover:bg-red-700 text-white text-xs px-2 py-1 rounded font-medium transition-colors"
              >
                Break match
              </button>
              <button onClick={() => setConfirmUnmatch(false)} className="text-gray-500 hover:text-gray-700 text-xs px-2 py-1 rounded transition-colors">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Ref: {ref}</span>
            <button
              onClick={() => setConfirmUnmatch(true)}
              className="text-xs text-red-600 hover:text-red-700 px-2 py-1 rounded border border-red-200 hover:bg-red-50 transition-colors font-medium"
            >
              Unmatch
            </button>
            <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600 transition-colors ml-auto">
              Close
            </button>
          </div>
        )}
      </div>
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
  onResolve: _onResolve,
  scrollToItemKey,
  unmatchedPairIds,
  onRowClick,
}: Props) {
  const [unmatchedOnly, setUnmatchedOnly] = useState(false)
  const [localSearch, setLocalSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('2026-09-01')
  const [dateTo, setDateTo] = useState('2026-09-30')
  const [selectedRow, setSelectedRow] = useState<string | null>(null)

  const parentRef = useRef<HTMLDivElement>(null)

  // Use 'bank' as fallback if sourceFilter is 'all' (should not happen with new initial state)
  const effectiveSource: Source = sourceFilter === 'all' ? 'bank' : sourceFilter

  const allRows = useMemo((): LedgerRow[] => {
    const rows: LedgerRow[] = []
    for (const pair of AUTO_MATCHED_PAIRS) {
      if (pair.source !== effectiveSource) continue
      if (unmatchedPairIds.includes(pair.id)) continue
      rows.push({ type: 'matched', pair })
    }
    for (const item of items) {
      if (item.source !== effectiveSource) continue
      const isSource = ['bank', 'stripe', 'payment', 'card'].includes(item.side)
      rows.push({ type: isSource ? 'unmatched-source' : 'unmatched-ledger', item })
    }
    rows.sort((a, b) => rowDate(a).localeCompare(rowDate(b)))
    return rows
  }, [effectiveSource, items, unmatchedPairIds])

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

  // Scroll to item when selectedItemKey changes from the right panel.
  // Direct scrollTop is reliable regardless of virtualizer state.
  useEffect(() => {
    if (!scrollToItemKey || filteredRows.length === 0) return
    const idx = filteredRows.findIndex(r => rowKey(r) === scrollToItemKey)
    if (idx < 0 || !parentRef.current) return
    const el = parentRef.current
    const targetOffset = idx * ROW_HEIGHT
    const center = targetOffset - el.clientHeight / 2 + ROW_HEIGHT / 2
    el.scrollTop = Math.max(0, center)
  }, [scrollToItemKey, filteredRows])

  const src = SOURCES[effectiveSource]

  return (
    <div className="h-full flex flex-col">

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
            <span className="font-medium">{ACCOUNT_CODE[effectiveSource]}</span>
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
                effectiveSource === s
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
      <div ref={parentRef} className="flex-1 overflow-auto">
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
            // scrollToItemKey highlight overrides (pink = selected from right panel)
            if (isHighlighted) rowBg = ''

            const showUnmatchPanel = isSelected && row.type === 'matched'

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
                    isHighlighted
                      ? 'bg-pink-100 ring-2 ring-inset ring-pink-400'
                      : isSelected
                        ? 'bg-pink-100 ring-1 ring-inset ring-pink-400'
                        : rowBg + ' hover:bg-gray-50'
                  }`}
                  onClick={() => {
                    const next = isSelected ? null : key
                    setSelectedRow(next)
                    if (onRowClick) {
                      if (isUnmatched) {
                        // pass the item key (not pair id) for unmatched rows
                        onRowClick(isSelected ? '' : (row as { item: Item }).item.key)
                      }
                    }
                  }}
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

                {/* Inline unmatch panel for matched rows (renders below the row) */}
                {showUnmatchPanel && row.type === 'matched' && (
                  <UnmatchPanel
                    pair={row.pair}
                    onUnmatch={onUnmatch}
                    onClose={() => setSelectedRow(null)}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
