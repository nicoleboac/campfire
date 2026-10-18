import { useMemo, useState, useRef, useEffect } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { Item, Source } from '../data/seed'
import { SOURCES } from '../data/seed'
import type { Resolution } from '../hooks/useReconcile'
import type { useReconcile } from '../hooks/useReconcile'
import { AUTO_MATCHED_PAIRS } from '../data/autoMatched'
import type { AutoMatchedPair } from '../data/autoMatched'
import { cls } from '../theme/tokens'
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
  scrollToItemKey?: string
  getRelatedItems: ReturnType<typeof useReconcile>['getRelatedItems']
  unmatchedPairIds: string[]
}

type LedgerRow =
  | { type: 'matched'; pair: AutoMatchedPair }
  | { type: 'unmatched-source'; item: Item }
  | { type: 'unmatched-ledger'; item: Item }

const ROW_HEIGHT = 48

const SOURCE_ORDER: Source[] = ['bank', 'stripe', 'receivables', 'cards']

const sourceBadgeCls: Record<Source, string> = {
  bank:        'bg-blue-50 text-blue-700',
  stripe:      'bg-violet-50 text-violet-700',
  receivables: 'bg-teal-50 text-teal-700',
  cards:       'bg-orange-50 text-orange-700',
}

function fmt(n: number) {
  const abs = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return n < 0 ? `(${abs})` : `$${abs}`
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function rowDate(row: LedgerRow): string {
  if (row.type === 'matched') return row.pair.sourceItem.date
  return row.item.date
}

function rowKey(row: LedgerRow): string {
  if (row.type === 'matched') return row.pair.id
  return row.item.key
}

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
  getRelatedItems,
  unmatchedPairIds,
}: Props) {
  const [unmatchedOnly, setUnmatchedOnly] = useState(false)
  const [localSearch, setLocalSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedRow, setSelectedRow] = useState<string | null>(null)
  const [confirmUnmatch, setConfirmUnmatch] = useState<string | null>(null)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())

  const parentRef = useRef<HTMLDivElement>(null)

  // Build rows for the current source
  const allRows = useMemo((): LedgerRow[] => {
    if (sourceFilter === 'all') return []

    const rows: LedgerRow[] = []

    // Add matched pairs (excluding unmatched ones)
    for (const pair of AUTO_MATCHED_PAIRS) {
      if (pair.source !== sourceFilter) continue
      if (unmatchedPairIds.includes(pair.id)) continue
      rows.push({ type: 'matched', pair })
    }

    // Add unmatched items
    for (const item of items) {
      if (item.source !== sourceFilter) continue
      const isSourceSide = item.side === 'bank' || item.side === 'stripe' || item.side === 'payment' || item.side === 'card'
      rows.push({
        type: isSourceSide ? 'unmatched-source' : 'unmatched-ledger',
        item,
      })
    }

    // Sort by date ascending
    rows.sort((a, b) => rowDate(a).localeCompare(rowDate(b)))
    return rows
  }, [sourceFilter, items, unmatchedPairIds])

  // Apply filters
  const filteredRows = useMemo(() => {
    const q = (localSearch || searchQuery).trim().toLowerCase()
    return allRows.filter(row => {
      if (unmatchedOnly && row.type === 'matched') return false

      if (dateFrom || dateTo) {
        const d = rowDate(row)
        if (dateFrom && d < dateFrom) return false
        if (dateTo && d > dateTo) return false
      }

      if (q) {
        if (row.type === 'matched') {
          const si = row.pair.sourceItem
          const li = row.pair.ledgerItem
          const match = (it: Item) =>
            it.description.toLowerCase().includes(q) ||
            (it.reference || '').toLowerCase().includes(q) ||
            Math.abs(it.amount).toFixed(2).includes(q)
          if (!match(si) && !match(li)) return false
        } else {
          const it = row.item
          const matchItem =
            it.description.toLowerCase().includes(q) ||
            (it.reference || '').toLowerCase().includes(q) ||
            Math.abs(it.amount).toFixed(2).includes(q)
          if (!matchItem) return false
        }
      }

      return true
    })
  }, [allRows, unmatchedOnly, localSearch, searchQuery, dateFrom, dateTo])

  const unmatchedCount = filteredRows.filter(r => r.type !== 'matched').length

  // Virtualizer
  const virtualizer = useVirtualizer({
    count: filteredRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  })

  // Scroll to item
  useEffect(() => {
    if (!scrollToItemKey || filteredRows.length === 0) return
    const idx = filteredRows.findIndex(r => rowKey(r) === scrollToItemKey)
    if (idx >= 0) {
      virtualizer.scrollToIndex(idx, { align: 'center' })
    }
  }, [scrollToItemKey, filteredRows])

  if (sourceFilter === 'all') {
    return (
      <div>
        <div className="mb-4">
          <p className="text-sm text-gray-500 mb-3">Select a source to view the full ledger</p>
          <div className="flex gap-2 flex-wrap">
            {SOURCE_ORDER.map(src => (
              <button
                key={src}
                onClick={() => onSourceFilterChange(src)}
                className={`${cls.btnSecondary} flex items-center gap-1.5`}
              >
                <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${sourceBadgeCls[src]}`}>
                  {SOURCES[src].label}
                </span>
                View ledger
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Source tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200">
        {SOURCE_ORDER.map(src => (
          <button
            key={src}
            onClick={() => onSourceFilterChange(src)}
            className={`px-3 py-2 text-sm whitespace-nowrap border-b-2 transition-colors -mb-px ${
              sourceFilter === src
                ? 'border-blue-600 text-blue-700 font-medium'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {SOURCES[src].label}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={unmatchedOnly}
            onChange={e => setUnmatchedOnly(e.target.checked)}
            className="rounded border-gray-300"
          />
          Unmatched only
        </label>
        <input
          type="text"
          placeholder="Search ref or amount…"
          value={localSearch}
          onChange={e => setLocalSearch(e.target.value)}
          className="border border-gray-300 rounded-md px-2.5 py-1 text-sm w-48 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <div className="flex items-center gap-1.5 text-sm text-gray-500">
          <span>From</span>
          <input
            type="date"
            value={dateFrom}
            onChange={e => setDateFrom(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <span>To</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => setDateTo(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <span className="text-xs text-gray-400 ml-auto">
          Showing {filteredRows.length} of {allRows.length} · {unmatchedCount} unmatched
        </span>
      </div>

      {/* Table header */}
      <div className="bg-white border border-gray-200 rounded-t-lg overflow-hidden">
        <div className="grid grid-cols-[20px_70px_1fr_80px_80px_1fr_100px] gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wider">
          <span></span>
          <span>Date</span>
          <span>Source side</span>
          <span className="text-right">Amount</span>
          <span className="text-right">Amount</span>
          <span>Ledger side</span>
          <span>Status</span>
        </div>
      </div>

      {/* Virtualized rows */}
      <div
        ref={parentRef}
        className="bg-white border border-gray-200 rounded-b-lg overflow-auto"
        style={{ height: 'calc(100vh - 280px)' }}
      >
        <div
          style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}
        >
          {virtualizer.getVirtualItems().map(virtualRow => {
            const row = filteredRows[virtualRow.index]
            const key = rowKey(row)
            const isHighlighted = scrollToItemKey && key === scrollToItemKey
            const isSelected = selectedKeys.has(key)
            const isOpen = selectedRow === key

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
                }}
              >
                <div
                  className={`border-b border-gray-100 last:border-0 ${
                    isHighlighted ? 'ring-2 ring-yellow-400 ring-inset' : ''
                  } ${isOpen ? 'bg-blue-50/30' : 'hover:bg-gray-50'} transition-colors`}
                >
                  {/* Main row — always 48px */}
                  <div
                    className="grid grid-cols-[20px_70px_1fr_80px_80px_1fr_100px] gap-2 px-3 items-center cursor-pointer"
                    style={{ height: ROW_HEIGHT }}
                    onClick={() => {
                      if (row.type === 'matched') {
                        setSelectedRow(isOpen ? null : key)
                        setConfirmUnmatch(null)
                      } else {
                        setSelectedRow(isOpen ? null : key)
                      }
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={e => {
                        e.stopPropagation()
                        setSelectedKeys(prev => {
                          const next = new Set(prev)
                          if (e.target.checked) next.add(key)
                          else next.delete(key)
                          return next
                        })
                      }}
                      onClick={e => e.stopPropagation()}
                      className="rounded border-gray-300"
                    />

                    <span className="text-gray-400 text-xs">{fmtDate(rowDate(row))}</span>

                    {/* Source side */}
                    {row.type === 'matched' ? (
                      <div className="min-w-0">
                        <div className="text-xs text-gray-500 truncate">{row.pair.sourceItem.description}</div>
                        {row.pair.sourceItem.reference && (
                          <div className="text-xs text-gray-400">{row.pair.sourceItem.reference}</div>
                        )}
                        {row.pair.sourceItem.meta?.cardholder && (
                          <div className="text-xs text-gray-400">
                            {row.pair.sourceItem.meta.cardholder} ···{row.pair.sourceItem.meta.cardLast4}
                          </div>
                        )}
                      </div>
                    ) : row.type === 'unmatched-source' ? (
                      <div className="min-w-0 border-l-2 border-l-amber-400 pl-2">
                        <div className="text-xs text-gray-800 font-medium truncate">{row.item.description}</div>
                        {row.item.reference && <div className="text-xs text-gray-500">{row.item.reference}</div>}
                        {row.item.meta?.cardholder && (
                          <div className="text-xs text-gray-400">
                            {row.item.meta.cardholder} ···{row.item.meta.cardLast4}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-300 pl-2">—</div>
                    )}

                    {/* Source amount */}
                    {row.type === 'matched' ? (
                      <span className={`text-xs font-mono tabular-nums text-right ${row.pair.sourceItem.amount >= 0 ? 'text-green-600' : 'text-gray-500'}`}>
                        {fmt(row.pair.sourceItem.amount)}
                      </span>
                    ) : row.type === 'unmatched-source' ? (
                      <span className={`text-xs font-mono tabular-nums text-right font-medium ${row.item.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {fmt(row.item.amount)}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300 text-right">—</span>
                    )}

                    {/* Ledger amount */}
                    {row.type === 'matched' ? (
                      <span className={`text-xs font-mono tabular-nums text-right ${row.pair.ledgerItem.amount >= 0 ? 'text-green-600' : 'text-gray-500'}`}>
                        {fmt(row.pair.ledgerItem.amount)}
                      </span>
                    ) : row.type === 'unmatched-ledger' ? (
                      <span className={`text-xs font-mono tabular-nums text-right font-medium ${row.item.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {fmt(row.item.amount)}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300 text-right">—</span>
                    )}

                    {/* Ledger side */}
                    {row.type === 'matched' ? (
                      <div className="min-w-0">
                        <div className="text-xs text-gray-500 truncate">{row.pair.ledgerItem.description}</div>
                        {row.pair.ledgerItem.reference && (
                          <div className="text-xs text-gray-400">{row.pair.ledgerItem.reference}</div>
                        )}
                      </div>
                    ) : row.type === 'unmatched-ledger' ? (
                      <div className="min-w-0 border-l-2 border-l-amber-400 pl-2">
                        <div className="text-xs text-gray-800 font-medium truncate">{row.item.description}</div>
                        {row.item.reference && <div className="text-xs text-gray-500">{row.item.reference}</div>}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-300 pl-2">—</div>
                    )}

                    {/* Status */}
                    {row.type === 'matched' ? (
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium whitespace-nowrap">
                        Matched
                      </span>
                    ) : (
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium whitespace-nowrap">
                        Unmatched
                      </span>
                    )}
                  </div>

                  {/* Expanded panel */}
                  {isOpen && row.type === 'matched' && (
                    <div className="px-3 pb-3 border-t border-gray-100 bg-white">
                      {confirmUnmatch === key ? (
                        <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm">
                          <div className="font-medium text-amber-800 mb-1">Break this match?</div>
                          <div className="text-xs text-amber-700 mb-2">
                            Both items will go to the work queue for manual review.
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                onUnmatch(row.pair.id)
                                setConfirmUnmatch(null)
                                setSelectedRow(null)
                              }}
                              className={cls.btnDanger}
                            >
                              Break match
                            </button>
                            <button
                              onClick={() => setConfirmUnmatch(null)}
                              className={cls.btnGhost}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs text-gray-500">
                            Auto-matched · {row.pair.sourceItem.reference || row.pair.ledgerItem.reference || row.pair.id}
                          </span>
                          <button
                            onClick={() => setConfirmUnmatch(key)}
                            className="text-xs text-red-600 hover:text-red-700 px-2 py-1 rounded border border-red-200 hover:bg-red-50 transition-colors"
                          >
                            Unmatch
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {isOpen && (row.type === 'unmatched-source' || row.type === 'unmatched-ledger') && (
                    <div className="px-3 pb-3 border-t border-gray-100 bg-white">
                      <ItemContext
                        item={row.item}
                        getRelatedItems={getRelatedItems}
                        onViewInLedger={() => {/* already in ledger */}}
                        onMatchInstead={() => {/* handled by work queue */}}
                      />
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Multi-select tally */}
      {selectedKeys.size > 0 && (
        <div className="fixed bottom-16 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm rounded-lg px-4 py-2.5 flex items-center gap-4 shadow-lg z-40">
          <span>{selectedKeys.size} selected</span>
          <button
            onClick={() => setSelectedKeys(new Set())}
            className="text-gray-400 hover:text-gray-200 text-xs"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  )
}
