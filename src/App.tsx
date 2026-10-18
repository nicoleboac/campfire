import { useState, useEffect } from 'react'
import { useReconcile } from './hooks/useReconcile'
import { AppHeader } from './components/AppHeader'
import { LedgerView } from './components/LedgerView'
import { IssuesPanel } from './components/IssuesPanel'
import './index.css'

function App() {
  const rec = useReconcile()
  const [selectedItemKey, setSelectedItemKey] = useState<string | null>(null)

  // Clear selectedItemKey after 2 seconds of highlight
  useEffect(() => {
    if (!selectedItemKey) return
    const timer = setTimeout(() => setSelectedItemKey(null), 2000)
    return () => clearTimeout(timer)
  }, [selectedItemKey])

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Combined header */}
      <AppHeader
        perSource={rec.perSource}
        sourceFilter={rec.state.sourceFilter}
        onSourceFilterChange={rec.setSourceFilter}
        resolvedCount={rec.resolvedCount}
        totalItems={rec.totalItems}
        canFinish={rec.canFinish}
        finishBlockReason={rec.finishBlockReason}
        onFinish={rec.finish}
        isLocked={rec.state.isLocked}
        sentForReview={rec.state.sentForReview}
        resolutions={rec.resolutions}
        items={rec.items}
        onUndo={rec.undo}
      />

      {/* Two-pane layout — always visible */}
      <div className="flex flex-1 min-h-0 gap-4 px-6 py-4 bg-gray-50">
        {/* LEFT: Full Ledger */}
        <div className="w-[38%] rounded-xl border border-gray-200 overflow-hidden flex flex-col bg-white shadow-sm">
          <LedgerView
            items={rec.unresolvedItems}
            resolutions={rec.resolutions}
            resolvedItemIds={rec.resolvedItemIds}
            sourceFilter={rec.state.sourceFilter}
            onSourceFilterChange={rec.setSourceFilter}
            searchQuery={rec.state.searchQuery}
            onUnmatch={rec.unmatchPair}
            onResolve={rec.resolve}
            activeSuggestions={[]}
            scrollToItemKey={selectedItemKey ?? undefined}
            getRelatedItems={rec.getRelatedItems}
            unmatchedPairIds={rec.state.unmatchedPairIds}
            allItems={rec.items}
            onRowClick={(key) => {
              if (key) setSelectedItemKey(key)
              else setSelectedItemKey(null)
            }}
          />
        </div>

        {/* RIGHT: Issues workspace */}
        <div className="flex-1 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <IssuesPanel
            activeSuggestions={rec.activeSuggestions}
            itemsWithoutSuggestion={rec.itemsWithoutSuggestion}
            allItems={rec.items}
            sourceFilter={rec.state.sourceFilter}
            onSourceFilterChange={rec.setSourceFilter}
            onResolve={rec.resolve}
            onReject={rec.rejectSuggestion}
            getRelatedItems={rec.getRelatedItems}
            searchQuery={rec.state.searchQuery}
            onSearch={rec.setSearch}
            onSelectItem={setSelectedItemKey}
            selectedItemKey={selectedItemKey}
            resolvedCount={rec.resolvedCount}
            totalItems={rec.totalItems}
          />
        </div>
      </div>

      {/* Toasts */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm">
        {rec.state.toasts.map(toast => (
          <div key={toast.id} className="bg-gray-900 text-white text-sm rounded-lg px-4 py-3 flex items-center gap-3 shadow-lg">
            <span className="flex-1">{toast.text}</span>
            <button
              onClick={() => { rec.undo(toast.undoKey); rec.dismissToast(toast.id) }}
              className="text-blue-300 hover:text-blue-200 font-medium text-sm"
            >
              Undo
            </button>
            <button
              onClick={() => rec.dismissToast(toast.id)}
              className="text-gray-400 hover:text-gray-200"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default App
