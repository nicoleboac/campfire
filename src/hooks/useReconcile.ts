import { useState, useCallback, useMemo } from 'react'
import { SEED_ITEMS, SUGGESTIONS, ACCOUNT } from '../data/seed'
import type { LineItem, Suggestion } from '../data/seed'
import {
  adjustedBankBalance,
  adjustedLedgerBalance,
  unexplainedDifference,
} from '../lib/reconcile'
import type { ReconcileState } from '../lib/reconcile'

export type ResolutionType =
  | 'matched'
  | 'matched-with-adjustment'
  | 'created-entry'
  | 'voided'
  | 'outstanding'
  | 'suspense'
  | 'flagged'
  | 'no-match'

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
  items: LineItem[]
  suggestions: Suggestion[]
  resolutions: Resolution[]
  rejectedPairs: string[] // "B5-L4" format
  toasts: ToastMessage[]
  searchQuery: string
  view: 'queue' | 'resolved' | 'ledger' | 'finish'
  isLocked: boolean
  sentForReview: boolean
}

function initialState(): AppState {
  return {
    items: SEED_ITEMS,
    suggestions: SUGGESTIONS,
    resolutions: [],
    rejectedPairs: [],
    toasts: [],
    searchQuery: '',
    view: 'queue',
    isLocked: false,
    sentForReview: false,
  }
}

export function useReconcile() {
  const [state, setState] = useState<AppState>(initialState)

  // ── Derived: resolved item IDs ───────────────────────────────────────────
  const resolvedItemIds = useMemo((): Set<string> => {
    const s = new Set<string>()
    state.resolutions.forEach(r => r.itemIds.forEach(id => s.add(id)))
    return s
  }, [state.resolutions])

  const unresolvedItems = useMemo(() =>
    state.items.filter(i => !resolvedItemIds.has(i.id)),
    [state.items, resolvedItemIds]
  )

  // ── Reconcile math state ─────────────────────────────────────────────────
  const reconcileState = useMemo((): ReconcileState => {
    const outstandingItems: { id: string; amount: number }[] = []
    const adjustments: { id: string; amount: number }[] = []
    const suspenseItems: { id: string; amount: number }[] = []
    const voidedItems: { id: string; amount: number }[] = []

    state.resolutions.forEach(r => {
      if (r.type === 'outstanding') {
        // L1 check: carry as outstanding timing difference
        r.itemIds.forEach(id => {
          const item = state.items.find(i => i.id === id)
          if (item) outstandingItems.push({ id, amount: item.amount })
        })
      } else if (r.type === 'created-entry' || r.type === 'matched-with-adjustment') {
        if (r.adjustmentAmount !== undefined) {
          adjustments.push({ id: r.id, amount: r.adjustmentAmount })
        }
      } else if (r.type === 'suspense') {
        r.itemIds.forEach(id => {
          const item = state.items.find(i => i.id === id)
          if (item) {
            suspenseItems.push({ id, amount: item.amount })
            adjustments.push({ id: `${id}-suspense`, amount: item.amount })
          }
        })
      } else if (r.type === 'voided') {
        r.itemIds.forEach(id => {
          const item = state.items.find(i => i.id === id)
          if (item) voidedItems.push({ id, amount: item.amount })
        })
      }
    })

    return {
      bankBalance: ACCOUNT.bankBalance,
      ledgerBalance: ACCOUNT.ledgerBalance,
      outstandingItems,
      adjustments,
      suspenseItems,
      voidedItems,
    }
  }, [state.resolutions, state.items])

  const adjBank = useMemo(() => adjustedBankBalance(reconcileState), [reconcileState])
  const adjLedger = useMemo(() => adjustedLedgerBalance(reconcileState), [reconcileState])
  const unexplained = useMemo(() => unexplainedDifference(reconcileState), [reconcileState])

  const outstandingTotal = useMemo(() =>
    reconcileState.outstandingItems.reduce((s, i) => s + i.amount, 0),
    [reconcileState]
  )

  // ── Progress counting ────────────────────────────────────────────────────
  const totalItems = state.items.length        // 14
  const resolvedCount = resolvedItemIds.size

  // Items with no suggestion = unresolved queue items
  const activeSuggestions = useMemo(() =>
    state.suggestions.filter(s => {
      const allIds = [...s.bankIds, ...s.ledgerIds]
      const anyResolved = allIds.some(id => resolvedItemIds.has(id))
      const pairKey = [...s.bankIds, ...s.ledgerIds].sort().join('-')
      const isRejected = state.rejectedPairs.includes(pairKey)
      return !anyResolved && !isRejected
    }),
    [state.suggestions, resolvedItemIds, state.rejectedPairs]
  )

  // Items with no active suggestion
  const itemsWithoutSuggestion = useMemo(() =>
    unresolvedItems.filter(item => {
      return !activeSuggestions.some(s =>
        [...s.bankIds, ...s.ledgerIds].includes(item.id)
      )
    }),
    [unresolvedItems, activeSuggestions]
  )

  // ── Search filter ────────────────────────────────────────────────────────
  const matchesSearch = useCallback((item: LineItem): boolean => {
    const q = state.searchQuery.trim().toLowerCase()
    if (!q) return true
    const normalizedQ = q.replace(/[,]/g, '').replace(/\./g, '.')
    const desc = item.description.toLowerCase()
    const ref = (item.ref || '').toLowerCase()
    const amount = Math.abs(item.amount).toFixed(2)
    const amountNoComma = amount.replace(/,/g, '')
    return (
      desc.includes(q) ||
      ref.includes(q) ||
      item.id.toLowerCase().includes(q) ||
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
    const pairKey = [...suggestion.bankIds, ...suggestion.ledgerIds].sort().join('-')
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

  const finish = useCallback(() => {
    setState(prev => ({ ...prev, isLocked: true, sentForReview: true }))
  }, [])

  // Can finish when: no unresolved items open, difference = 0
  const openCount = unresolvedItems.length
  const canFinish = openCount === 0 && unexplained === 0 && !state.isLocked

  const finishBlockReason = useMemo(() => {
    const parts: string[] = []
    if (openCount > 0) parts.push(`${openCount} item${openCount !== 1 ? 's' : ''} open`)
    if (unexplained !== 0) parts.push(`$${Math.abs(unexplained).toLocaleString('en-US', { minimumFractionDigits: 2 })} unexplained`)
    return parts.join(' · ')
  }, [openCount, unexplained])

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
    // Math
    adjBank,
    adjLedger,
    unexplained,
    outstandingTotal,
    reconcileState,
    // Progress
    totalItems,
    resolvedCount,
    // Actions
    resolve,
    undo,
    rejectSuggestion,
    setSearch,
    setView,
    finish,
    addToast,
    dismissToast,
    canFinish,
    finishBlockReason,
  }
}
