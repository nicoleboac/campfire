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

function fmtBalance(n: number) {
  const abs = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return n < 0 ? `($${abs})` : `$${abs}`
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    month: '2-digit', day: '2-digit', year: 'numeric',
  })
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

  // Running balance (cumulative)
  const rowBalances = useMemo(() => {
    let bal = 0
    return filteredRows.map(row => {
      bal += rowAmount(row)
      return bal
    })
  }, [filteredRows])

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
      <div className="max-w-4xl mx-auto">
        <div className="bg-[#2d6a4f] text-white text-center py-6 rounded-t-lg">
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
    )
  }

  const src = SOURCES[sourceFilter]

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden shadow-sm">

      {/* ── Green header ──────────────────────────────────────────────── */}
      <div className="bg-[#2d6a4f] text-white text-center py-4">
        <div className="text-xl font-bold tracking-wide">Campfire</div>
        <div className="text-base font-semibold">General Ledger</div>
      </div>

      {/* ── Account meta row ─────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-300 px-4 py-2.5 flex items-start justify-between">
        <div className="text-sm">
          <div className="font-semibold text-gray-800">Account Name: {src.label}</div>
          <div className="text-gray-500 text-xs mt-0.5">Account number: {ACCOUNT_CODE[sourceFilter]}</div>
        </div>
        <div className="text-sm font-semibold text-gray-700 text-right">
          Journal Period: Sep 2026
        </div>
      </div>

      {/* ── Filter bar ───────────────────────────────────────────────── */}
      <div className="bg-gray-50 border-b border-gray-300 px-4 py-2 flex items-center gap-3 flex-wrap text-sm">
        {/* Source tabs */}
        <div className="flex items-center gap-0.5 mr-2">
          {SOURCE_ORDER.map(s => (
            <button
              key={s}
              onClick={() => onSourceFilterChange(s)}
              className={`px-2.5 py-1 text-xs rounded transition-colors font-medium ${
                sourceFilter === s
                  ? 'bg-[#2d6a4f] text-white'
                  : 'text-gray-600 hover:bg-gray-200'
              }`}
            >
              {SOURCES[s].label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
          <input type="checkbox" checked={unmatchedOnly} onChange={e => setUnmatchedOnly(e.target.checked)} className="rounded border-gray-300" />
          Unmatched only
        </label>
        <input
          type="text"
          placeholder="Search…"
          value={localSearch}
          onChange={e => setLocalSearch(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1 text-xs w-36 focus:outline-none focus:ring-1 focus:ring-[#2d6a4f]"
        />
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <span>From</span>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="border border-gray-300 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#2d6a4f]" />
          <span>To</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="border border-gray-300 rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#2d6a4f]" />
        </div>
        <span className="ml-auto text-xs text-gray-400">
          Showing {filteredRows.length} of {allRows.length} · {unmatchedCount} unmatched
        </span>
      </div>

      {/* ── Column headers ───────────────────────────────────────────── */}
      <div className="bg-[#2d6a4f] text-white text-xs font-semibold border-b border-[#1b4332]">
        <div className="grid gap-0" style={{ gridTemplateColumns: '44px 100px 1fr 100px 100px 110px 130px 120px' }}>
          <div className="px-3 py-2 border-r border-[#1b4332]">No</div>
          <div className="px-3 py-2 border-r border-[#1b4332]">Date</div>
          <div className="px-3 py-2 border-r border-[#1b4332]">Description</div>
          <div className="px-3 py-2 border-r border-[#1b4332] text-right">Debit</div>
          <div className="px-3 py-2 border-r border-[#1b4332] text-right">Credit</div>
          <div className="px-3 py-2 border-r border-[#1b4332] text-right">Balance</div>
          <div className="px-3 py-2 border-r border-[#1b4332]">Journal Reference</div>
          <div className="px-3 py-2">Account Code</div>
        </div>
      </div>

      {/* ── Virtualized rows ─────────────────────────────────────────── */}
      <div
        ref={parentRef}
        className="bg-white overflow-auto"
        style={{ height: 'calc(100vh - 320px)' }}
      >
        <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
          {virtualizer.getVirtualItems().map(virtualRow => {
            const row = filteredRows[virtualRow.index]
            const key = rowKey(row)
            const rowNum = virtualRow.index + 1
            const amt = rowAmount(row)
            const isDebit = amt >= 0
            const isUnmatched = row.type !== 'matched'
            const isHighlighted = scrollToItemKey === key
            const isOpen = selectedRow === key
            const cardholder = rowCardholder(row)
            const balance = rowBalances[virtualRow.index]
            const isEven = virtualRow.index % 2 === 0

            const rowBg = isUnmatched
              ? 'bg-amber-50'
              : isEven ? 'bg-white' : 'bg-[#f9fefe]'

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
                {/* Main row */}
                <div
                  className={`border-b border-gray-200 cursor-pointer transition-colors ${rowBg} ${isHighlighted ? 'ring-2 ring-inset ring-yellow-400' : ''} ${isOpen ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                  style={{ height: ROW_HEIGHT }}
                  onClick={() => setSelectedRow(isOpen ? null : key)}
                >
                  <div
                    className="grid h-full items-center text-xs gap-0"
                    style={{ gridTemplateColumns: '44px 100px 1fr 100px 100px 110px 130px 120px' }}
                  >
                    {/* No */}
                    <div className="px-3 border-r border-gray-200 text-gray-400 tabular-nums text-right">{rowNum}</div>

                    {/* Date */}
                    <div className="px-3 border-r border-gray-200 text-gray-600 tabular-nums">{fmtDate(rowDate(row))}</div>

                    {/* Description */}
                    <div className={`px-3 border-r border-gray-200 min-w-0 ${isUnmatched ? 'border-l-2 border-l-amber-400' : ''}`}>
                      <div className={`truncate ${isUnmatched ? 'text-gray-900 font-medium' : 'text-gray-600'}`}>
                        {rowDescription(row)}
                      </div>
                      {cardholder && <div className="text-gray-400 truncate">{cardholder}</div>}
                    </div>

                    {/* Debit */}
                    <div className="px-3 border-r border-gray-200 text-right tabular-nums">
                      {isDebit ? (
                        <span className="text-gray-800">${fmtMoney(amt)}</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </div>

                    {/* Credit */}
                    <div className="px-3 border-r border-gray-200 text-right tabular-nums">
                      {!isDebit ? (
                        <span className="text-gray-800">${fmtMoney(amt)}</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </div>

                    {/* Balance */}
                    <div className="px-3 border-r border-gray-200 text-right tabular-nums">
                      <span className={balance < 0 ? 'text-red-600' : 'text-gray-800'}>
                        {fmtBalance(balance)}
                      </span>
                    </div>

                    {/* Journal Reference */}
                    <div className="px-3 border-r border-gray-200 text-gray-600 truncate">
                      {rowReference(row) || <span className="text-gray-300">—</span>}
                    </div>

                    {/* Account Code */}
                    <div className="px-3 text-gray-500 truncate">
                      {ACCOUNT_CODE[sourceFilter]}
                    </div>
                  </div>
                </div>

                {/* Expanded panel */}
                {isOpen && (
                  <div className="border-b border-gray-200 bg-white px-4 py-3">
                    {row.type === 'matched' ? (
                      confirmUnmatch === key ? (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-md text-sm">
                          <div className="font-medium text-amber-800 mb-1">Break this match?</div>
                          <div className="text-xs text-amber-700 mb-2">Both items will go to the work queue for manual review.</div>
                          <div className="flex gap-2">
                            <button onClick={() => { onUnmatch(row.pair.id); setConfirmUnmatch(null); setSelectedRow(null) }} className={cls.btnDanger}>Break match</button>
                            <button onClick={() => setConfirmUnmatch(null)} className={cls.btnGhost}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-400">
                            Auto-matched · {row.pair.sourceItem.reference || row.pair.ledgerItem.reference || '—'}
                          </span>
                          <button
                            onClick={() => setConfirmUnmatch(key)}
                            className="text-xs text-red-600 hover:text-red-700 px-2 py-1 rounded border border-red-200 hover:bg-red-50 transition-colors"
                          >
                            Unmatch
                          </button>
                        </div>
                      )
                    ) : (
                      <ItemContext
                        item={row.item}
                        getRelatedItems={getRelatedItems}
                        onViewInLedger={() => {}}
                        onMatchInstead={() => {}}
                      />
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Footer total row ─────────────────────────────────────────── */}
      <div className="bg-[#2d6a4f] text-white text-xs font-semibold border-t border-[#1b4332]">
        <div className="grid gap-0" style={{ gridTemplateColumns: '44px 100px 1fr 100px 100px 110px 130px 120px' }}>
          <div className="px-3 py-2 border-r border-[#1b4332] col-span-3 text-right">Totals</div>
          <div className="px-3 py-2 border-r border-[#1b4332] text-right tabular-nums">
            ${fmtMoney(filteredRows.reduce((s, r) => s + (rowAmount(r) >= 0 ? rowAmount(r) : 0), 0))}
          </div>
          <div className="px-3 py-2 border-r border-[#1b4332] text-right tabular-nums">
            ${fmtMoney(filteredRows.reduce((s, r) => s + (rowAmount(r) < 0 ? Math.abs(rowAmount(r)) : 0), 0))}
          </div>
          <div className="px-3 py-2 border-r border-[#1b4332] text-right tabular-nums">
            {fmtBalance(rowBalances[rowBalances.length - 1] ?? 0)}
          </div>
          <div className="px-3 py-2 border-r border-[#1b4332]" />
          <div className="px-3 py-2" />
        </div>
      </div>
    </div>
  )
}
