import { useMemo, useState } from 'react'
import type { Item, Source } from '../data/seed'
import { ITEMS, SUGGESTIONS, SOURCES } from '../data/seed'
import type { Resolution } from '../hooks/useReconcile'

interface Props {
  seedItems: Item[]
  resolutions: Resolution[]
  resolvedItemIds: Set<string>
  searchQuery: string
}

type GroupBy = 'date' | 'source'
type SourceFilter = 'all' | Source

interface DisplayItem {
  key: string
  source: Source
  side: string
  date: string
  description: string
  amount: number
  reference?: string
  cardholder?: string
  cardLast4?: string
  status: 'matched' | 'resolved' | 'pending' | 'duplicate' | 'outstanding' | 'no-match' | 'flagged' | 'suspense'
  resolutionType?: string
}

function fmt(n: number) {
  const abs = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return n < 0 ? `(${abs})` : `$${abs}`
}

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Status badge styles
const statusStyles: Record<string, string> = {
  matched:     'bg-green-50 text-green-700 border border-green-200',
  resolved:    'bg-blue-50 text-blue-700 border border-blue-200',
  pending:     'bg-amber-50 text-amber-700 border border-amber-200',
  duplicate:   'bg-red-50 text-red-700 border border-red-200',
  outstanding: 'bg-orange-50 text-orange-700 border border-orange-200',
  'no-match':  'bg-gray-100 text-gray-600 border border-gray-200',
  flagged:     'bg-gray-100 text-gray-600 border border-gray-200',
  suspense:    'bg-yellow-50 text-yellow-700 border border-yellow-200',
}

const statusLabel: Record<string, string> = {
  matched:     'Matched',
  resolved:    'Resolved',
  pending:     'Needs review',
  duplicate:   'Duplicate',
  outstanding: 'Outstanding',
  'no-match':  'No match',
  flagged:     'Flagged',
  suspense:    'In suspense',
}

const issueRowBorder: Record<string, string> = {
  pending:     'border-l-4 border-l-amber-400',
  duplicate:   'border-l-4 border-l-red-400',
  outstanding: 'border-l-4 border-l-orange-400',
  'no-match':  'border-l-4 border-l-gray-400',
  flagged:     'border-l-4 border-l-gray-400',
  suspense:    'border-l-4 border-l-yellow-400',
}

const sourceBadgeCls: Record<Source, string> = {
  bank:        'bg-blue-50 text-blue-700',
  stripe:      'bg-violet-50 text-violet-700',
  receivables: 'bg-teal-50 text-teal-700',
  cards:       'bg-orange-50 text-orange-700',
}

const SOURCE_ORDER: Source[] = ['bank', 'stripe', 'receivables', 'cards']

export function LedgerView({ seedItems, resolutions, resolvedItemIds: _resolvedItemIds, searchQuery }: Props) {
  const [groupBy, setGroupBy] = useState<GroupBy>('date')
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')

  // Build issue type map from suggestions
  const issueTypeMap = useMemo(() => {
    const m: Record<string, DisplayItem['status']> = {}
    SUGGESTIONS.forEach(s => {
      if (s.action === 'void-duplicate') s.itemKeys.forEach(key => { m[key] = 'duplicate' })
      else if (s.action === 'mark-outstanding') s.itemKeys.forEach(key => { m[key] = 'outstanding' })
      else if (s.action === 'no-match') s.itemKeys.forEach(key => { m[key] = 'no-match' })
    })
    return m
  }, [])

  // Build resolution type map
  const resolutionMap = useMemo(() => {
    const m: Record<string, Resolution> = {}
    resolutions.forEach(r => r.itemIds.forEach(key => { m[key] = r }))
    return m
  }, [resolutions])

  // Build display items from ITEMS (all 14)
  const allDisplayItems = useMemo((): DisplayItem[] => {
    return ITEMS.map(item => {
      const resolution = resolutionMap[item.key]
      let status: DisplayItem['status'] = 'pending'

      if (resolution) {
        if (resolution.type === 'voided') status = 'duplicate'
        else if (resolution.type === 'outstanding') status = 'outstanding'
        else if (resolution.type === 'flagged') status = 'flagged'
        else if (resolution.type === 'suspense') status = 'suspense'
        else status = 'resolved'
      } else if (issueTypeMap[item.key]) {
        status = issueTypeMap[item.key]
      }

      return {
        key: item.key,
        source: item.source,
        side: item.side,
        date: item.date,
        description: item.description,
        amount: item.amount,
        reference: item.reference,
        cardholder: item.meta?.cardholder,
        cardLast4: item.meta?.cardLast4,
        status,
        resolutionType: resolution?.type,
      }
    }).sort((a, b) => a.date.localeCompare(b.date))
  }, [seedItems, resolutionMap, issueTypeMap])

  // Apply filters
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return allDisplayItems.filter(item => {
      if (sourceFilter !== 'all' && item.source !== sourceFilter) return false
      if (!q) return true
      const normalQ = q.replace(/,/g, '')
      const amount = Math.abs(item.amount).toFixed(2)
      return (
        item.description.toLowerCase().includes(q) ||
        (item.reference || '').toLowerCase().includes(q) ||
        (item.cardholder || '').toLowerCase().includes(q) ||
        item.date.includes(q) ||
        amount.includes(normalQ)
      )
    })
  }, [allDisplayItems, sourceFilter, searchQuery])

  // Group
  const groups = useMemo(() => {
    if (groupBy === 'date') return [{ label: '', items: filtered }]
    const map = new Map<Source, DisplayItem[]>()
    SOURCE_ORDER.forEach(src => map.set(src, []))
    filtered.forEach(item => {
      map.get(item.source)!.push(item)
    })
    return SOURCE_ORDER
      .filter(src => (map.get(src) || []).length > 0)
      .map(src => ({ label: SOURCES[src].label, items: map.get(src)! }))
  }, [filtered, groupBy])

  const issueCount = allDisplayItems.filter(i =>
    i.status === 'pending' || i.status === 'duplicate' || i.status === 'no-match'
  ).length
  const resolvedCount = allDisplayItems.filter(i =>
    i.status === 'resolved' || i.status === 'outstanding' || i.status === 'suspense' || i.status === 'flagged' || i.status === 'duplicate'
  ).length

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          {/* Group by toggle */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-md p-0.5">
            {(['date', 'source'] as const).map(g => (
              <button
                key={g}
                onClick={() => setGroupBy(g)}
                className={`px-3 py-1 text-xs rounded transition-colors ${
                  groupBy === g ? 'bg-white text-gray-900 shadow-sm font-medium' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {g === 'date' ? 'All' : 'By Source'}
              </button>
            ))}
          </div>
          {/* Source filter */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-md p-0.5">
            {(['all', ...SOURCE_ORDER] as SourceFilter[]).map(s => (
              <button
                key={s}
                onClick={() => setSourceFilter(s)}
                className={`px-3 py-1 text-xs rounded transition-colors ${
                  sourceFilter === s ? 'bg-white text-gray-900 shadow-sm font-medium' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {s === 'all' ? 'All' : SOURCES[s].label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span>{filtered.length} transactions</span>
          {issueCount > 0 && (
            <span className="text-amber-600 font-medium">{issueCount} need review</span>
          )}
        </div>
      </div>

      {/* Summary strip */}
      <div className="flex items-center gap-4 bg-white border border-gray-200 rounded-lg px-4 py-2.5 mb-4 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-400"></span>
          <span>{resolvedCount} manually resolved</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-400"></span>
          <span>{issueCount} needs review</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-gray-300"></span>
          <span>{allDisplayItems.length - resolvedCount - issueCount} pending</span>
        </div>
      </div>

      {/* Transaction table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[auto_auto_1fr_auto_auto_auto] gap-3 px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wider">
          <span>Date</span>
          <span>Source</span>
          <span>Description</span>
          <span className="text-right">Amount</span>
          <span>Side</span>
          <span>Status</span>
        </div>

        {groups.map((group, gi) => (
          <div key={gi}>
            {groupBy === 'source' && group.label && (
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-600 sticky top-0">
                {group.label}
                <span className="ml-2 font-normal text-gray-400">{group.items.length} transactions</span>
              </div>
            )}
            {group.items.map((item) => {
              const isIssue = item.status !== 'resolved' && item.status !== 'matched'
              const borderClass = isIssue ? (issueRowBorder[item.status] || '') : ''
              const rowBg = isIssue ? 'bg-amber-50/30' : 'bg-blue-50/20'
              return (
                <div
                  key={item.key}
                  className={`grid grid-cols-[auto_auto_1fr_auto_auto_auto] gap-3 items-center px-4 py-2.5 border-b border-gray-100 last:border-0 text-sm ${borderClass} ${rowBg} hover:bg-gray-50 transition-colors`}
                >
                  <span className="text-gray-500 text-xs w-14 shrink-0">{fmtDate(item.date)}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium whitespace-nowrap ${sourceBadgeCls[item.source]}`}>
                    {SOURCES[item.source].label}
                  </span>
                  <div className="min-w-0">
                    <div className={`truncate ${isIssue ? 'text-gray-900 font-medium' : 'text-gray-600'}`}>
                      {item.description}
                    </div>
                    {item.reference && <div className="text-xs text-gray-400">{item.reference}</div>}
                    {item.cardholder && (
                      <div className="text-xs text-gray-400">{item.cardholder} ···{item.cardLast4}</div>
                    )}
                  </div>
                  <span className={`text-right font-mono text-sm tabular-nums ${item.amount >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {fmt(item.amount)}
                  </span>
                  <span className={`text-xs px-1.5 py-0.5 rounded w-16 text-center ${
                    item.side === 'bank' ? 'bg-blue-50 text-blue-700' :
                    item.side === 'stripe' ? 'bg-violet-50 text-violet-700' :
                    item.side === 'payment' ? 'bg-teal-50 text-teal-700' :
                    item.side === 'invoice' ? 'bg-indigo-50 text-indigo-700' :
                    item.side === 'card' ? 'bg-orange-50 text-orange-700' :
                    'bg-purple-50 text-purple-700'
                  }`}>
                    {item.side}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${statusStyles[item.status]}`}>
                    {statusLabel[item.status]}
                  </span>
                </div>
              )
            })}
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">No transactions match your filters</div>
        )}
      </div>
    </div>
  )
}
