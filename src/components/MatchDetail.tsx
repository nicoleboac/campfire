import { useState } from 'react'
import type { Suggestion, Item } from '../data/seed'
import { SOURCES } from '../data/seed'
import { cls } from '../theme/tokens'

interface Props {
  suggestion: Suggestion
  items: Item[]
  onConfirm: (adjustment: { amount: number; account: string; accountCode: string; description: string }) => void
  onCancel: () => void
}

function fmt(n: number) {
  const abs = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return n < 0 ? `(${abs})` : `$${abs}`
}

function fmtDate(d: string) {
  const dt = new Date(d + 'T00:00:00')
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const sideBadgeCls: Record<string, string> = {
  bank:        'bg-blue-50 text-blue-600',
  ledger:      'bg-purple-50 text-purple-700',
  stripe:      'bg-violet-50 text-violet-700',
  payment:     'bg-teal-50 text-teal-700',
  invoice:     'bg-indigo-50 text-indigo-700',
  card:        'bg-orange-50 text-orange-700',
}

export function MatchDetail({ suggestion, items, onConfirm, onCancel }: Props) {
  const allItems = suggestion.itemKeys.map(key => items.find(i => i.key === key)!).filter(Boolean)

  // Split by side: source-side vs ledger-side
  const sourceSides = new Set(['bank', 'stripe', 'payment', 'card'])
  const sourceItems = allItems.filter(i => sourceSides.has(i.side))
  const ledgerItems = allItems.filter(i => !sourceSides.has(i.side))

  const sourceSum = sourceItems.reduce((s, i) => s + i.amount, 0)
  const ledgerSum = ledgerItems.reduce((s, i) => s + i.amount, 0)
  const gap = sourceSum - ledgerSum

  const defaultAdj = suggestion.adjustment || {
    amount: gap,
    account: '',
    accountCode: '',
    description: '',
  }

  const [account, setAccount] = useState(defaultAdj.account)
  const [accountCode, setAccountCode] = useState(defaultAdj.accountCode)
  const [description, setDescription] = useState(defaultAdj.description)

  const adjAmount = defaultAdj.amount

  function handleConfirm() {
    onConfirm({ amount: adjAmount, account, accountCode, description })
  }

  // For create-entry / create-credit-memo / code-expense: show simplified form
  const isCreateAction = suggestion.action === 'create-entry' ||
    suggestion.action === 'create-credit-memo' ||
    suggestion.action === 'code-expense'

  if (isCreateAction) {
    const refItem = allItems[0]
    return (
      <div className="border-t border-gray-100 p-4 bg-gray-50 rounded-b-lg">
        <h3 className="text-sm font-semibold text-gray-800 mb-3">
          {suggestion.action === 'create-credit-memo' ? 'Create Credit Memo' :
           suggestion.action === 'code-expense' ? 'Code Expense' :
           'Create Ledger Entry'}
        </h3>
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className={cls.label}>Date (locked)</label>
            <div className="text-sm text-gray-700 bg-gray-100 rounded-md px-3 py-1.5 border border-gray-200">
              {fmtDate(refItem?.date || '')}
            </div>
          </div>
          <div>
            <label className={cls.label}>Amount (locked)</label>
            <div className={`text-sm font-medium bg-gray-100 rounded-md px-3 py-1.5 border border-gray-200 ${
              (refItem?.amount || 0) >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {fmt(refItem?.amount || 0)}
            </div>
          </div>
          <div>
            <label className={cls.label}>Account *</label>
            <input
              className={cls.input}
              value={account}
              onChange={e => setAccount(e.target.value)}
              placeholder="e.g. Merchant Fees"
            />
          </div>
          <div>
            <label className={cls.label}>Account Code</label>
            <input
              className={cls.input}
              value={accountCode}
              onChange={e => setAccountCode(e.target.value)}
              placeholder="e.g. 6815"
            />
          </div>
          <div className="col-span-2">
            <label className={cls.label}>Memo</label>
            <input
              className={cls.input}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Description"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleConfirm}
            disabled={!account.trim()}
            className={cls.btnPrimary}
          >
            {suggestion.action === 'create-credit-memo' ? 'Create Credit Memo' :
             suggestion.action === 'code-expense' ? 'Code Expense' :
             'Create Entry & Match'}
          </button>
          <button onClick={onCancel} className={cls.btnSecondary}>Cancel</button>
        </div>
      </div>
    )
  }

  // match-with-adjustment / apply-payment with adjustment
  const srcLabel = SOURCES[suggestion.source].sourceSideLabel
  const ldgLabel = SOURCES[suggestion.source].ledgerSideLabel

  return (
    <div className="border-t border-gray-100 p-4 bg-gray-50 rounded-b-lg">
      <h3 className="text-sm font-semibold text-gray-800 mb-3">Review Difference</h3>

      {/* Side by side comparison */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <div className="text-xs font-medium text-blue-600 mb-1.5">{srcLabel}</div>
          {sourceItems.map(item => (
            <div key={item.key} className="bg-white border border-blue-100 rounded p-2.5 mb-1">
              <div className="flex items-center gap-1 mb-0.5">
                <span className={`text-xs px-1 py-0.5 rounded ${sideBadgeCls[item.side] || ''}`}>{item.side}</span>
                <span className="text-xs text-gray-400">{fmtDate(item.date)}</span>
              </div>
              <div className="text-sm text-gray-800 mt-0.5">{item.description}</div>
              {item.reference && <div className="text-xs text-gray-400 mt-0.5">{item.reference}</div>}
              {item.meta?.cardholder && (
                <div className="text-xs text-gray-400 mt-0.5">{item.meta.cardholder} ···{item.meta.cardLast4}</div>
              )}
              <div className={`text-sm font-semibold mt-0.5 ${item.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {fmt(item.amount)}
              </div>
            </div>
          ))}
          {sourceItems.length > 1 && (
            <div className="text-xs font-medium text-gray-600 text-right">Sum: {fmt(sourceSum)}</div>
          )}
        </div>
        <div>
          <div className="text-xs font-medium text-purple-600 mb-1.5">{ldgLabel}</div>
          {ledgerItems.map(item => (
            <div key={item.key} className="bg-white border border-purple-100 rounded p-2.5 mb-1">
              <div className="flex items-center gap-1 mb-0.5">
                <span className={`text-xs px-1 py-0.5 rounded ${sideBadgeCls[item.side] || ''}`}>{item.side}</span>
                <span className="text-xs text-gray-400">{fmtDate(item.date)}</span>
              </div>
              <div className="text-sm text-gray-800 mt-0.5">{item.description}</div>
              {item.reference && <div className="text-xs text-gray-400 mt-0.5">{item.reference}</div>}
              <div className={`text-sm font-semibold mt-0.5 ${item.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {fmt(item.amount)}
              </div>
            </div>
          ))}
          {ledgerItems.length > 1 && (
            <div className="text-xs font-medium text-gray-600 text-right">Sum: {fmt(ledgerSum)}</div>
          )}
        </div>
      </div>

      {/* Gap explanation */}
      <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-yellow-800">
            Gap: {fmt(Math.abs(gap))} — must be explained
          </span>
        </div>
        <div className="text-xs text-yellow-700 mt-1">{suggestion.reason}</div>
      </div>

      {/* Treatment form */}
      <div className="text-xs font-medium text-gray-700 mb-2">Book difference to:</div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div>
          <label className={cls.label}>Account</label>
          <input
            className={cls.input}
            value={account}
            onChange={e => setAccount(e.target.value)}
          />
        </div>
        <div>
          <label className={cls.label}>Code</label>
          <input
            className={cls.input}
            value={accountCode}
            onChange={e => setAccountCode(e.target.value)}
          />
        </div>
        <div>
          <label className={cls.label}>Amount</label>
          <div className="text-sm font-medium text-gray-700 bg-gray-100 rounded-md px-3 py-1.5 border border-gray-200">
            {fmt(adjAmount)}
          </div>
        </div>
        <div className="col-span-3">
          <label className={cls.label}>Memo</label>
          <input
            className={cls.input}
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>
      </div>

      {/* What will be posted preview */}
      <div className="bg-white border border-gray-200 rounded p-2 mb-3 text-xs text-gray-600">
        <div className="font-medium text-gray-700 mb-1">Entries to be created:</div>
        <div>• Match {suggestion.itemKeys.length} item(s)</div>
        <div>• Book {fmt(adjAmount)} to {account || '(account required)'} {accountCode ? `(${accountCode})` : ''}</div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleConfirm}
          disabled={!account.trim()}
          className={cls.btnPrimary}
        >
          Confirm
        </button>
        <button onClick={onCancel} className={cls.btnSecondary}>Cancel</button>
      </div>
    </div>
  )
}
