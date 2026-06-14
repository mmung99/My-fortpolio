// Google Sheets integration via Service Account
// Reads/writes to the portfolio spreadsheet

const SHEET_ID = import.meta.env.VITE_SHEET_ID
const CLIENT_EMAIL = import.meta.env.VITE_CLIENT_EMAIL
const PRIVATE_KEY = import.meta.env.VITE_PRIVATE_KEY?.replace(/\\n/g, '\n')

// Sheet names
const SHEETS = {
  holdings: 'Holdings',
  transactions: 'Transactions',
}

// ── JWT / OAuth2 helpers ──────────────────────────────────────────────────────

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: CLIENT_EMAIL,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }

  const encode = obj => btoa(JSON.stringify(obj)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const headerB64 = encode(header)
  const payloadB64 = encode(payload)
  const signingInput = `${headerB64}.${payloadB64}`

  // Import private key
  const pemBody = PRIVATE_KEY
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '')
  const keyData = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0))
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', keyData.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  )

  // Sign
  const enc = new TextEncoder()
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, enc.encode(signingInput))
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const jwt = `${signingInput}.${sigB64}`

  // Exchange for access token
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  })
  const data = await res.json()
  return data.access_token
}

// ── Sheets API helpers ────────────────────────────────────────────────────────

async function sheetsGet(range, token) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  return res.json()
}

async function sheetsUpdate(range, values, token) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=RAW`
  await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ range, majorDimension: 'ROWS', values }),
  })
}

async function sheetsClear(range, token) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}:clear`
  await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
}

// ── Ensure sheets exist ───────────────────────────────────────────────────────

async function ensureSheets(token) {
  const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}`
  const res = await fetch(metaUrl, { headers: { Authorization: `Bearer ${token}` } })
  const meta = await res.json()
  const existing = meta.sheets?.map(s => s.properties.title) ?? []

  const toAdd = Object.values(SHEETS).filter(name => !existing.includes(name))
  if (toAdd.length === 0) return

  await fetch(`${metaUrl}:batchUpdate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: toAdd.map(title => ({ addSheet: { properties: { title } } })),
    }),
  })
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function loadFromSheets() {
  if (!SHEET_ID || !CLIENT_EMAIL || !PRIVATE_KEY) return null
  try {
    const token = await getAccessToken()
    await ensureSheets(token)

    const [holdingsRes, txRes] = await Promise.all([
      sheetsGet(`${SHEETS.holdings}!A:J`, token),
      sheetsGet(`${SHEETS.transactions}!A:J`, token),
    ])

    const hRows = holdingsRes.values ?? []
    const tRows = txRes.values ?? []

    // Skip header row
    const holdings = hRows.slice(1).filter(r => r[0]).map(r => ({
      ticker: r[0],
      name: r[1],
      avgCost: parseFloat(r[2]) || 0,
      qty: parseFloat(r[3]) || 0,
      totalInvested: parseFloat(r[4]) || 0,
      totalInvestedThb: parseFloat(r[5]) || 0,
      color: r[6] || '#2563EB',
    }))

    const transactions = tRows.slice(1).filter(r => r[0]).map(r => ({
      id: parseInt(r[0]) || Date.now(),
      date: r[1],
      ticker: r[2],
      type: r[3],
      qty: parseFloat(r[4]) || 0,
      price: parseFloat(r[5]) || 0,
      thbAmount: r[6] ? parseFloat(r[6]) : null,
      note: r[7] || '',
      realizedPnl: r[8] ? parseFloat(r[8]) : null,
    }))

    return { holdings, transactions }
  } catch (e) {
    console.error('Sheets load error:', e)
    return null
  }
}

export async function saveToSheets(state) {
  if (!SHEET_ID || !CLIENT_EMAIL || !PRIVATE_KEY) return
  try {
    const token = await getAccessToken()
    await ensureSheets(token)

    // Save holdings
    const holdingRows = [
      ['Ticker', 'Name', 'AvgCost', 'Qty', 'TotalInvested', 'TotalInvestedThb', 'Color'],
      ...state.holdings.map(h => [h.ticker, h.name, h.avgCost, h.qty, h.totalInvested, h.totalInvestedThb, h.color]),
    ]
    await sheetsClear(`${SHEETS.holdings}!A:J`, token)
    await sheetsUpdate(`${SHEETS.holdings}!A1`, holdingRows, token)

    // Save transactions
    const txRows = [
      ['ID', 'Date', 'Ticker', 'Type', 'Qty', 'Price', 'ThbAmount', 'Note', 'RealizedPnl'],
      ...state.transactions.map(t => [t.id, t.date, t.ticker, t.type, t.qty, t.price, t.thbAmount ?? '', t.note ?? '', t.realizedPnl ?? '']),
    ]
    await sheetsClear(`${SHEETS.transactions}!A:J`, token)
    await sheetsUpdate(`${SHEETS.transactions}!A1`, txRows, token)
  } catch (e) {
    console.error('Sheets save error:', e)
  }
}
