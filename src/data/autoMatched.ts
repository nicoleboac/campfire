import type { Source, Item } from './seed'

export interface AutoMatchedPair {
  id: string
  source: Source
  sourceItem: Item
  ledgerItem: Item
}

// ── Seeded PRNG (LCG) ─────────────────────────────────────────────────────────

function makePrng(seed: number) {
  let s = seed >>> 0
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 0x100000000 }
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function randDate(rng: () => number, startDay: number, endDay: number, year = 2026, month = 9): string {
  const day = startDay + Math.floor(rng() * (endDay - startDay + 1))
  return isoDate(year, month, Math.min(day, 30))
}

// Returns a date in Aug or Sep 2026 spanning the full 61-day range
function randDateAugSep(rng: () => number): string {
  const totalDays = 61 // Aug 1 (day 0) through Sep 30 (day 60)
  const offset = Math.floor(rng() * totalDays)
  if (offset < 31) {
    return isoDate(2026, 8, offset + 1)
  } else {
    return isoDate(2026, 9, offset - 30)
  }
}

// ── Required specific pairs (hardcoded) ───────────────────────────────────────

const HARDCODED_PAIRS: AutoMatchedPair[] = [
  {
    id: 'am-bank-northwind',
    source: 'bank',
    sourceItem: {
      key: 'am-bank-northwind-src',
      source: 'bank',
      side: 'bank',
      date: '2026-09-03',
      description: 'Northwind Software Inc. license',
      amount: -4860.00,
      reference: 'BILL-0903',
    },
    ledgerItem: {
      key: 'am-bank-northwind-led',
      source: 'bank',
      side: 'ledger',
      date: '2026-09-03',
      description: 'Northwind Software Inc. bill payment BILL-0903',
      amount: -4860.00,
      reference: 'BILL-0903',
    },
  },
  {
    id: 'am-ar-initech-aug',
    source: 'receivables',
    sourceItem: {
      key: 'am-ar-initech-aug-src',
      source: 'receivables',
      side: 'payment',
      date: '2026-08-12',
      description: 'ACH from Initech, memo INV 2266',
      amount: 7400.00,
    },
    ledgerItem: {
      key: 'am-ar-initech-aug-led',
      source: 'receivables',
      side: 'invoice',
      date: '2026-08-12',
      description: 'Initech, INV-2266',
      amount: 7400.00,
      reference: 'INV-2266',
    },
  },
  {
    id: 'am-card-priya-aug',
    source: 'cards',
    sourceItem: {
      key: 'am-card-priya-aug-src',
      source: 'cards',
      side: 'card',
      date: '2026-08-14',
      description: 'SQ *BLUE BOTTLE COFFEE',
      amount: -72.10,
      meta: { cardholder: 'Priya Shah', cardLast4: '2290' },
    },
    ledgerItem: {
      key: 'am-card-priya-aug-led',
      source: 'cards',
      side: 'ledger',
      date: '2026-08-14',
      description: 'Blue Bottle Coffee — Priya Shah',
      amount: -72.10,
      reference: 'EXP-3201',
    },
  },
  {
    id: 'am-card-priya-sep2',
    source: 'cards',
    sourceItem: {
      key: 'am-card-priya-sep2-src',
      source: 'cards',
      side: 'card',
      date: '2026-09-02',
      description: 'SQ *BLUE BOTTLE COFFEE',
      amount: -91.25,
      meta: { cardholder: 'Priya Shah', cardLast4: '2290' },
    },
    ledgerItem: {
      key: 'am-card-priya-sep2-led',
      source: 'cards',
      side: 'ledger',
      date: '2026-09-02',
      description: 'Blue Bottle Coffee — Priya Shah',
      amount: -91.25,
      reference: 'EXP-3341',
    },
  },
]

// ── Generator ─────────────────────────────────────────────────────────────────

function generatePairs(): AutoMatchedPair[] {
  const rng = makePrng(42)

  // Counters for references
  let billCounter = 800
  let chkCounter = 1000
  let invCounter = 2200
  let expCounter = 3100

  function nextBill() { return `BILL-${String(billCounter++).padStart(4, '0')}` }
  function nextChk() { return `CHK-${String(chkCounter++).padStart(4, '0')}` }
  function nextInv() { return `INV-${String(invCounter++).padStart(4, '0')}` }
  function nextExp() { return `EXP-${String(expCounter++).padStart(4, '0')}` }

  // ── Bank pairs (412 total, 4 hardcoded = 408 generated) ────────────────────

  const bankVendors = [
    { name: 'Gusto', desc: 'Gusto payroll', ledgerDesc: 'Payroll — Gusto', amtMin: 67000, amtMax: 68000, ref: 'bill' },
    { name: 'AWS', desc: 'AMAZON WEB SERVICES', ledgerDesc: 'AWS cloud services', amtMin: 2000, amtMax: 8000, ref: 'bill' },
    { name: 'Google Workspace', desc: 'GOOGLE WORKSPACE', ledgerDesc: 'Google Workspace licenses', amtMin: 500, amtMax: 1500, ref: 'bill' },
    { name: 'Slack', desc: 'SLACK TECHNOLOGIES', ledgerDesc: 'Slack subscription', amtMin: 600, amtMax: 1200, ref: 'bill' },
    { name: 'WeWork', desc: 'WEWORK RENT', ledgerDesc: 'WeWork office rent', amtMin: 12000, amtMax: 15000, ref: 'chk' },
    { name: 'Office Depot', desc: 'OFFICE DEPOT', ledgerDesc: 'Office supplies — Office Depot', amtMin: 300, amtMax: 800, ref: 'bill' },
    { name: 'Hartford Insurance', desc: 'HARTFORD INSURANCE', ledgerDesc: 'Hartford business insurance premium', amtMin: 2200, amtMax: 3500, ref: 'bill' },
    { name: 'Equipment Lease', desc: 'DELL FINANCIAL SVCS', ledgerDesc: 'Equipment lease — Dell', amtMin: 1800, amtMax: 2400, ref: 'chk' },
  ]

  const bankCustomers = [
    { name: 'Acme Corp', desc: 'ACH ACME CORP', ledgerDesc: 'Customer payment — Acme Corp', amtMin: 5000, amtMax: 30000 },
    { name: 'Delta Systems', desc: 'WIRE DELTA SYSTEMS', ledgerDesc: 'Customer payment — Delta Systems', amtMin: 8000, amtMax: 45000 },
    { name: 'Helix Health', desc: 'ACH HELIX HEALTH', ledgerDesc: 'Customer payment — Helix Health', amtMin: 10000, amtMax: 80000 },
    { name: 'Nexus Labs', desc: 'WIRE NEXUS LABS', ledgerDesc: 'Customer payment — Nexus Labs', amtMin: 7000, amtMax: 35000 },
    { name: 'Apex Ventures', desc: 'ACH APEX VENTURES', ledgerDesc: 'Customer payment — Apex Ventures', amtMin: 5000, amtMax: 25000 },
    { name: 'Meridian Co', desc: 'WIRE MERIDIAN CO', ledgerDesc: 'Customer payment — Meridian Co', amtMin: 12000, amtMax: 60000 },
    { name: 'Vertex Inc', desc: 'ACH VERTEX INC', ledgerDesc: 'Customer payment — Vertex Inc', amtMin: 6000, amtMax: 40000 },
  ]

  const bankPairs: AutoMatchedPair[] = []

  // Start bill counter at 800 but skip forward a bit so hardcoded BILL-0903 isn't duplicated
  billCounter = 800

  for (let i = 0; i < 411; i++) {
    const idx = `${i + 1}`
    const isCustomer = rng() < 0.4
    const date = randDateAugSep(rng)

    if (isCustomer) {
      const c = bankCustomers[Math.floor(rng() * bankCustomers.length)]
      const rawAmt = c.amtMin + Math.floor(rng() * (c.amtMax - c.amtMin + 1))
      const amt = Math.round(rawAmt * 100) / 100
      const ref = `REF-${String(Math.floor(rng() * 90000) + 10000)}`
      bankPairs.push({
        id: `am-bank-${idx}`,
        source: 'bank',
        sourceItem: {
          key: `am-bank-${idx}-src`,
          source: 'bank', side: 'bank', date,
          description: c.desc,
          amount: amt,
          reference: ref,
        },
        ledgerItem: {
          key: `am-bank-${idx}-led`,
          source: 'bank', side: 'ledger', date,
          description: c.ledgerDesc,
          amount: amt,
          reference: ref,
        },
      })
    } else {
      const v = bankVendors[Math.floor(rng() * bankVendors.length)]
      const rawAmt = v.amtMin + Math.floor(rng() * (v.amtMax - v.amtMin + 1))
      const amt = -Math.round(rawAmt * 100) / 100
      const ref = v.ref === 'bill' ? nextBill() : nextChk()
      bankPairs.push({
        id: `am-bank-${idx}`,
        source: 'bank',
        sourceItem: {
          key: `am-bank-${idx}-src`,
          source: 'bank', side: 'bank', date,
          description: v.desc,
          amount: amt,
        },
        ledgerItem: {
          key: `am-bank-${idx}-led`,
          source: 'bank', side: 'ledger', date,
          description: v.ledgerDesc,
          amount: amt,
          reference: ref,
        },
      })
    }
  }

  // ── Stripe pairs (520 total, 0 hardcoded = 520 generated) ─────────────────

  const stripeDescs = [
    { src: 'Stripe charge — SaaS subscription', led: 'Stripe revenue — SaaS', amtMin: 20, amtMax: 500, isCharge: true },
    { src: 'Stripe charge — platform fee', led: 'Stripe revenue — platform', amtMin: 50, amtMax: 2000, isCharge: true },
    { src: 'Stripe payout to bank', led: 'Stripe payout transferred', amtMin: 5000, amtMax: 50000, isCharge: false },
    { src: 'Stripe charge — annual plan', led: 'Stripe revenue — annual plan', amtMin: 200, amtMax: 1500, isCharge: true },
    { src: 'Stripe charge — usage', led: 'Stripe revenue — usage-based', amtMin: 20, amtMax: 800, isCharge: true },
  ]

  const stripePairs: AutoMatchedPair[] = []
  for (let i = 0; i < 520; i++) {
    const d = stripeDescs[Math.floor(rng() * stripeDescs.length)]
    const rawAmt = d.amtMin + Math.floor(rng() * (d.amtMax - d.amtMin + 1)) + Math.round(rng() * 100) / 100
    const amt = Math.round(rawAmt * 100) / 100
    const signedAmt = d.isCharge ? amt : -amt
    const date = randDateAugSep(rng)
    const stripeRef = `pi_${Math.random().toString(36).slice(2, 12)}`
    stripePairs.push({
      id: `am-stripe-${i + 1}`,
      source: 'stripe',
      sourceItem: {
        key: `am-stripe-${i + 1}-src`,
        source: 'stripe', side: 'stripe', date,
        description: d.src,
        amount: signedAmt,
        reference: stripeRef,
      },
      ledgerItem: {
        key: `am-stripe-${i + 1}-led`,
        source: 'stripe', side: 'ledger', date,
        description: d.led,
        amount: signedAmt,
        reference: stripeRef,
      },
    })
  }

  // ── Receivables pairs (180 total, 1 hardcoded = 179 generated) ────────────

  const arCustomers = [
    { name: 'Acme Corp', inv: 'Acme Corp', pay: 'ACH from Acme Corp' },
    { name: 'Globex Ltd', inv: 'Globex Ltd', pay: 'Wire from Globex Ltd' },
    { name: 'Initech', inv: 'Initech', pay: 'ACH from Initech' },
    { name: 'Helix Health', inv: 'Helix Health', pay: 'Wire from Helix Health' },
    { name: 'Nexus Labs', inv: 'Nexus Labs', pay: 'ACH from Nexus Labs' },
    { name: 'Delta Systems', inv: 'Delta Systems', pay: 'Wire from Delta Systems' },
    { name: 'Apex Ventures', inv: 'Apex Ventures', pay: 'ACH from Apex Ventures' },
    { name: 'Meridian Co', inv: 'Meridian Co', pay: 'Wire from Meridian Co' },
  ]

  const arPairs: AutoMatchedPair[] = []
  for (let i = 0; i < 179; i++) {
    const c = arCustomers[Math.floor(rng() * arCustomers.length)]
    const rawAmt = 3000 + Math.floor(rng() * 42000) + Math.round(rng() * 100) / 100
    const amt = Math.round(rawAmt * 100) / 100
    // Invoice date can be older (Aug), payment in Sep
    const invMonth = rng() < 0.6 ? 8 : 9
    const invDay = invMonth === 8 ? (1 + Math.floor(rng() * 31)) : (1 + Math.floor(rng() * 20))
    const invDate = isoDate(2026, invMonth, Math.min(invDay, invMonth === 8 ? 31 : 30))
    const payDate = randDate(rng, 1, 30)
    const invRef = nextInv()
    const memo = `memo ${invRef.replace('INV-', 'INV ')}`
    arPairs.push({
      id: `am-ar-${i + 1}`,
      source: 'receivables',
      sourceItem: {
        key: `am-ar-${i + 1}-src`,
        source: 'receivables', side: 'payment', date: payDate,
        description: `${c.pay}, ${memo}`,
        amount: amt,
      },
      ledgerItem: {
        key: `am-ar-${i + 1}-led`,
        source: 'receivables', side: 'invoice', date: invDate,
        description: `${c.inv}, ${invRef}`,
        amount: amt,
        reference: invRef,
      },
    })
  }

  // ── Cards pairs (174 total, 2 hardcoded = 172 generated) ─────────────────

  const cardholders = [
    { name: 'Priya Shah', last4: '2290' },
    { name: 'Dev Patel', last4: '7731' },
    { name: 'Alex Chen', last4: '4412' },
    { name: 'Jordan Lee', last4: '8821' },
    { name: 'Sam Rivera', last4: '3305' },
  ]

  type CardCategory = {
    srcDescs: string[]
    ledDesc: (cardholder: string) => string
    amtMin: number
    amtMax: number
  }

  const cardCategories: CardCategory[] = [
    {
      srcDescs: ['SQ *BLUE BOTTLE COFFEE', 'STARBUCKS #4829', 'PHILZ COFFEE', 'SWEETGREEN', 'CHIPOTLE ONLINE'],
      ledDesc: (ch) => `Team meal — ${ch}`,
      amtMin: 15, amtMax: 150,
    },
    {
      srcDescs: ['FIGMA INC', 'GITHUB INC', 'NOTION LABS', 'ZOOM VIDEO', 'LOOM INC', 'MIRO', 'LINEAR APP'],
      ledDesc: (ch) => `SaaS subscription — ${ch}`,
      amtMin: 20, amtMax: 500,
    },
    {
      srcDescs: ['UNITED AIRLINES', 'DELTA AIR LINES', 'LYFT', 'UBER', 'MARRIOTT HOTELS', 'HILTON HONORS'],
      ledDesc: (ch) => `Travel — ${ch}`,
      amtMin: 100, amtMax: 800,
    },
    {
      srcDescs: ['STAPLES', 'AMAZON.COM', 'BEST BUY', 'OFFICE DEPOT', 'B&H PHOTO'],
      ledDesc: (ch) => `Office supplies — ${ch}`,
      amtMin: 30, amtMax: 300,
    },
  ]

  const cardPairs: AutoMatchedPair[] = []
  for (let i = 0; i < 172; i++) {
    const ch = cardholders[Math.floor(rng() * cardholders.length)]
    const cat = cardCategories[Math.floor(rng() * cardCategories.length)]
    const srcDesc = cat.srcDescs[Math.floor(rng() * cat.srcDescs.length)]
    const rawAmt = cat.amtMin + Math.floor(rng() * (cat.amtMax - cat.amtMin + 1)) + Math.round(rng() * 100) / 100
    const amt = -Math.round(rawAmt * 100) / 100
    const date = randDateAugSep(rng)
    const expRef = nextExp()
    cardPairs.push({
      id: `am-card-${i + 1}`,
      source: 'cards',
      sourceItem: {
        key: `am-card-${i + 1}-src`,
        source: 'cards', side: 'card', date,
        description: srcDesc,
        amount: amt,
        meta: { cardholder: ch.name, cardLast4: ch.last4 },
      },
      ledgerItem: {
        key: `am-card-${i + 1}-led`,
        source: 'cards', side: 'ledger', date,
        description: `${cat.ledDesc(ch.name)}`,
        amount: amt,
        reference: expRef,
      },
    })
  }

  return [
    ...HARDCODED_PAIRS,
    ...bankPairs,
    ...stripePairs,
    ...arPairs,
    ...cardPairs,
  ]
}

export const AUTO_MATCHED_PAIRS: AutoMatchedPair[] = generatePairs()

export const AUTO_MATCHED_COUNT_BY_SOURCE: Record<Source, number> = {
  bank: 412,
  stripe: 520,
  receivables: 180,
  cards: 174,
}
