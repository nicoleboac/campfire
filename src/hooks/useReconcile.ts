import { useState, useCallback, useMemo } from 'react'
import { ITEMS, SUGGESTIONS, SOURCES } from '../data/seed'
import type { Item, Suggestion, Source } from '../data/seed'
import {
  adjustedSourceBalance,
  adjustedLedgerBalance,
  unexplainedDifference,
} from '../lib/reconcile'
import type { SourceState } from '../lib/reconcile'

export type ResolutionType =
  | 'matched'
  | 'matched-with-adjustment'
  | 'created-entry'
  | 'voided'
  | 'outstanding'
  | 'suspense'
  | 'flagged'
  | 'no-match'
  | 'applied-payment'
  | 'credit-memo'
  | 'coded-expense'

export interface Resolution {
  id: string
  itemIds: string[]
  suggestionId?: string
  type: ResolutionType
  description: string
  adjustmentAmount?: number
  adjustmentAccount?: string
  note?: string
  timestamp: number
}

export interface ToastMessage {
  id: string
  text: string
  undoKey: string
}

export interface AppState {
  items: Item[]
  suggestions: Suggestion[]
  resolutions: Resolution[]
  rejectedPairs: string[]
  toasts: ToastMessage[]
  searchQuery: string
  sourceFilter: Source | 'all'
  view: 'queue' | 'resolved' | 'ledger' | 'finish'
  isLocked: boolean
  sentForReview: boolean
}

function initialState(): AppState {
  return {
    items: ITEMS,
    suggestions: SUGGESTIONS,
    resolutions: [],
    rejectedPairs: [],
    toasts: [],
    searchQuery: '',
    sourceFilter: 'all',
    view: 'queue',
    isLocked: false,
    sentForReview: false,
  }
}

export function useReconcile() {
  const [state, setState] = useState<AppState>(initialState)

  // ── Derived: resolved item keys ──────────────────────────────────────────
  const resolvedItemIds = useMemo((): Set<string> => {
    const s = new Set<string>()
    state.resolutions.forEach(r => r.itemIds.forEach(key => s.add(key)))
    return s
  }, [state.resolutions])

  const unresolvedItems = useMemo(() =>
    state.items.filter(i => !resolvedItemIds.has(i.key)),
    [state.items, resolvedItemIds]
  )

  // ── Per-source math ──────────────────────────────────────────────────────
  const perSource = useMemo((): Record<Source, { adjSource: number; adjLedger: number; unexplained: number; openCount: number }> => {
    const sources = (['bank', 'stripe', 'receivables', 'cards'] as Source[])

    return Object.fromEntries(sources.map(src => {
      const outstandingItems: { key: string; amount: number }[] = []
      const adjustments: { key: string; amount: number }[] = []
      const suspenseItems: { key: string; amount: number }[] = []

      state.resolutions.forEach(r => {
        // Only consider resolutions for items in this source
        const sourceItems = r.itemIds
          .map(key => state.items.find(i => i.key === key))
          .filter((item): item is Item => item !== undefined && item.source === src)

        if (sourceItems.length === 0) return

        if (r.type === 'outstanding') {
          sourceItems.forEach(item => {
            outstandingItems.push({ key: item.key, amount: item.amount })
          })
        } else if (
          r.type === 'created-entry' ||
          r.type === 'matched-with-adjustment' ||
          r.type === 'applied-payment' ||
          r.type === 'credit-memo' ||
          r.type === 'coded-expense'
        ) {
          if (r.adjustmentAmount !== undefined) {
            adjustments.push({ key: r.id, amount: r.adjustmentAmount })
          }
        } else if (r.type === 'suspense') {
          sourceItems.forEach(item => {
            suspenseItems.push({ key: item.key, amount: item.amount })
          })
        }
      })

      const s: SourceState = {
        source: src,
        sourceBalance: SOURCES[src].sourceBalance,
        ledgerBalance: SOURCES[src].ledgerBalance,
        outstandingItems,
        adjustments,
        suspenseItems,
      }

      const openCount = unresolvedItems.filter(i => i.source === src).length

      return [src, {
        adjSource: adjustedSourceBalance(s),
        adjLedger: adjustedLedgerBalance(s),
        unexplained: unexplainedDifference(s),
        openCount,
      }]
    })) as Record<Source, { adjSource: number; adjLedger: number; unexplained: number; openCount: number }>
  }, [state.resolutions, state.items, unresolvedItems])

  // ── Progress counting ────────────────────────────────────────────────────
  const totalItems = state.items.length        // 14
  const resolvedCount = resolvedItemIds.size

  // Items with no suggestion = unresolved queue items
  const activeSuggestions = useMemo(() =>
    state.suggestions.filter(s => {
      const anyResolved = s.itemKeys.some(key => resolvedItemIds.has(key))
      const pairKey = [...s.itemKeys].sort().join('-')
      const isRejected = state.rejectedPairs.includes(pairKey)
      return !anyResolved && !isRejected
    }),
    [state.suggestions, resolvedItemIds, state.rejectedPairs]
  )

  // Items with no active suggestion
  const itemsWithoutSuggestion = useMemo(() =>
    unresolvedItems.filter(item => {
      return !activeSuggestions.some(s => s.itemKeys.includes(item.key))
    }),
    [unresolvedItems, activeSuggestions]
  )

  // ── Search filter ────────────────────────────────────────────────────────
  const matchesSearch = useCallback((item: Item): boolean => {
    const q = state.searchQuery.trim().toLowerCase()
    if (!q) return true
    const normalizedQ = q.replace(/[,]/g, '').replace(/\./g, '.')
    const desc = item.description.toLowerCase()
    const ref = (item.reference || '').toLowerCase()
    const cardholder = (item.meta?.cardholder || '').toLowerCase()
    const amount = Math.abs(item.amount).toFixed(2)
    const amountNoComma = amount.replace(/,/g, '')
    return (
      desc.includes(q) ||
      ref.includes(q) ||
      cardholder.includes(q) ||
      amount.includes(normalizedQ) ||
      amountNoComma.includes(normalizedQ) ||
      item.date.includes(q)
    )
  }, [state.searchQuery])

  // ── Toast helpers ────────────────────────────────────────────────────────
  const addToast = useCallback((text: string, undoKey: string) => {
    const id = `toast-${Date.now()}`
    setState(prev => ({
      ...prev,
      toasts: [...prev.toasts, { id, text, undoKey }],
    }))
    setTimeout(() => {
      setState(prev => ({
        ...prev,
        toasts: prev.toasts.filter(t => t.id !== id),
      }))
    }, 5000)
  }, [])

  const dismissToast = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      toasts: prev.toasts.filter(t => t.id !== id),
    }))
  }, [])

  // ── Actions ──────────────────────────────────────────────────────────────

  const resolve = useCallback((resolution: Omit<Resolution, 'timestamp'>) => {
    setState(prev => ({
      ...prev,
      resolutions: [...prev.resolutions, { ...resolution, timestamp: Date.now() }],
    }))
    addToast(resolution.description, resolution.id)
  }, [addToast])

  const undo = useCallback((resolutionId: string) => {
    setState(prev => ({
      ...prev,
      resolutions: prev.resolutions.filter(r => r.id !== resolutionId),
    }))
  }, [])

  const rejectSuggestion = useCallback((suggestionId: string) => {
    const suggestion = state.suggestions.find(s => s.id === suggestionId)
    if (!suggestion) return
    const pairKey = [...suggestion.itemKeys].sort().join('-')
    setState(prev => ({
      ...prev,
      rejectedPairs: [...prev.rejectedPairs, pairKey],
    }))
  }, [state.suggestions])

  const setSearch = useCallback((q: string) => {
    setState(prev => ({ ...prev, searchQuery: q }))
  }, [])

  const setView = useCallback((view: AppState['view']) => {
    setState(prev => ({ ...prev, view }))
  }, [])

  const setSourceFilter = useCallback((sourceFilter: Source | 'all') => {
    setState(prev => ({ ...prev, sourceFilter }))
  }, [])

  const finish = useCallback(() => {
    setState(prev => ({ ...prev, isLocked: true, sentForReview: true }))
  }, [])

  // Can finish when: all 4 sources have unexplained === 0 and openCount === 0
  const sources = (['bank', 'stripe', 'receivables', 'cards'] as Source[])
  const canFinish = !state.isLocked && sources.every(src =>
    perSource[src].unexplained === 0 && perSource[src].openCount === 0
  )

  const finishBlockReason = useMemo(() => {
    const parts: string[] = []
    sources.forEach(src => {
      const ps = perSource[src]
      const label = SOURCES[src].label
      if (ps.openCount > 0) parts.push(`${label}: ${ps.openCount} open`)
      if (ps.unexplained !== 0) {
        parts.push(`${label}: $${Math.abs(ps.unexplained).toLocaleString('en-US', { minimumFractionDigits: 2 })} unexplained`)
      }
    })
    return parts.join(' · ')
  }, [perSource])

  return {
    // State
    state,
    items: state.items,
    resolutions: state.resolutions,
    resolvedItemIds,
    unresolvedItems,
    activeSuggestions,
    itemsWithoutSuggestion,
    matchesSearch,
    // Per-source math
    perSource,
    // Progress
    totalItems,
    resolvedCount,
    // Actions
    resolve,
    undo,
    rejectSuggestion,
    setSearch,
    setView,
    setSourceFilter,
    finish,
    addToast,
    dismissToast,
    canFinish,
    finishBlockReason,
  }
}
