import { useState } from 'react'
import type { Item } from '../data/seed'
import { cls } from '../theme/tokens'

interface Props {
  item: Item
  defaultAccount?: string
  defaultAccountCode?: string
  defaultVendor?: string
  defaultMemo?: string
  onSave: (entry: { account: string; accountCode: string; vendor: string; memo: string }) => void
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

export function CreateEntryForm({ item, defaultAccount = '', defaultAccountCode = '', defaultVendor = '', defaultMemo = '', onSave, onCancel }: Props) {
  const [account, setAccount] = useState(defaultAccount)
  const [accountCode, setAccountCode] = useState(defaultAccountCode)
  const [vendor, setVendor] = useState(defaultVendor)
  const [memo, setMemo] = useState(defaultMemo)

  function handleSave() {
    onSave({ account, accountCode, vendor, memo })
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-gray-800 mb-3">Create Ledger Entry</h3>

      {/* Source line reference */}
      <div className="bg-blue-50 border border-blue-100 rounded p-2.5 mb-4">
        <div className="flex justify-between items-start">
          <div>
            <div className="text-xs text-blue-500 font-medium mb-0.5">
              {item.side} · {item.reference || item.description}
            </div>
            <div className="text-sm text-gray-800">{item.description}</div>
            {item.reference && <div className="text-xs text-gray-500 mt-0.5">{item.reference}</div>}
            {item.meta?.cardholder && (
              <div className="text-xs text-gray-400 mt-0.5">{item.meta.cardholder} ···{item.meta.cardLast4}</div>
            )}
          </div>
          <div className="text-right">
            <div className={`text-sm font-semibold ${item.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {fmt(item.amount)}
            </div>
            <div className="text-xs text-gray-500">{fmtDate(item.date)}</div>
          </div>
        </div>
      </div>

      {/* Locked fields */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <label className={cls.label}>Date (locked)</label>
          <div className="text-sm text-gray-600 bg-gray-50 rounded-md px-3 py-1.5 border border-gray-200">
            {fmtDate(item.date)}
          </div>
        </div>
        <div>
          <label className={cls.label}>Amount (locked)</label>
          <div className={`text-sm font-medium bg-gray-50 rounded-md px-3 py-1.5 border border-gray-200 ${
            item.amount >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {fmt(item.amount)}
          </div>
        </div>
      </div>

      {/* Editable fields */}
      <div className="grid grid-cols-2 gap-3 mb-3">
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
        <div>
          <label className={cls.label}>Vendor</label>
          <input
            className={cls.input}
            value={vendor}
            onChange={e => setVendor(e.target.value)}
            placeholder="Vendor name"
          />
        </div>
        <div>
          <label className={cls.label}>Memo</label>
          <input
            className={cls.input}
            value={memo}
            onChange={e => setMemo(e.target.value)}
            placeholder="Description"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={!account.trim()}
          className={cls.btnPrimary}
        >
          Create Entry & Match
        </button>
        <button onClick={onCancel} className={cls.btnSecondary}>
          Cancel
        </button>
      </div>
    </div>
  )
}
