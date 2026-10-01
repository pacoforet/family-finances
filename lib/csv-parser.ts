import Papa from 'papaparse'
import { createHash } from 'crypto'

export interface RevolutRow {
  tipo:        string
  producto:    string
  fechaInicio: string
  fechaFin:    string
  descripcion: string
  importe:     number
  comision:    number
  divisa:      string
  state:       string
  saldo:       number | null
}

export interface SkippedRow {
  row: Record<string, string>
  reason: string
}

export interface ParseResult {
  valid:   RevolutRow[]
  skipped: SkippedRow[]
  errors:  Array<{ row: Record<string, string>; error: string }>
}

// Map Revolut CSV headers (Spanish and English exports) → internal field names.
// Keys are lowercase; headers are matched case-insensitively.
const COLUMN_MAP: Record<string, keyof RevolutRow> = {
  'tipo':                  'tipo',
  'type':                  'tipo',
  'producto':              'producto',
  'product':               'producto',
  'fecha de inicio':       'fechaInicio',
  'started date':          'fechaInicio',
  'fecha de finalización': 'fechaFin',
  'completed date':        'fechaFin',
  'descripción':           'descripcion',
  'description':           'descripcion',
  'importe':               'importe',
  'amount':                'importe',
  'comisión':              'comision',
  'fee':                   'comision',
  'divisa':                'divisa',
  'currency':              'divisa',
  'state':                 'state',
  'estado':                'state',
  'saldo':                 'saldo',
  'balance':               'saldo',
}

// Spanish exports call a reverted charge DEVUELTO
const REVERTED_STATES = new Set(['REVERTED', 'REVERTIDO', 'DEVUELTO'])
const PENDING_STATES = new Set(['PENDING', 'PENDIENTE'])
const SAVINGS_PRODUCTS = new Set(['depósito', 'deposito', 'deposit', 'savings'])
const INTEREST_TYPES = new Set(['intereses', 'interest'])

/**
 * Parses an amount that may use either `.` or `,` as decimal separator and
 * either of them as thousands separator ("1.234,56", "1,234.56", "-12,5").
 * Returns NaN for anything that is not a plain number.
 */
export function parseAmount(value: string): number {
  if (!value || value.trim() === '') return 0
  let v = value.replace(/[\s\u00A0']/g, '')

  const lastDot = v.lastIndexOf('.')
  const lastComma = v.lastIndexOf(',')

  if (lastDot !== -1 && lastComma !== -1) {
    // Both present: whichever comes last is the decimal separator.
    const thousands = lastComma > lastDot ? '.' : ','
    v = v.split(thousands).join('')
  } else {
    const sep = lastComma !== -1 ? ',' : lastDot !== -1 ? '.' : null
    // A separator that appears more than once can only be a thousands separator.
    if (sep && v.split(sep).length > 2) v = v.split(sep).join('')
  }

  v = v.replace(',', '.')
  if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(v)) return NaN
  return Number(v)
}

export function parseRevolutCSV(csvText: string): ParseResult {
  // Strip BOM if present
  const cleaned = csvText.replace(/^\uFEFF/, '')

  const result = Papa.parse<Record<string, string>>(cleaned, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => COLUMN_MAP[h.trim().toLowerCase()] ?? h.trim(),
  })

  const valid: RevolutRow[] = []
  const skipped: SkippedRow[] = []
  const errors: Array<{ row: Record<string, string>; error: string }> = []

  for (const rawRow of result.data) {
    const row = rawRow as Record<string, string>

    const state = (row['state'] ?? '').trim().toUpperCase()

    // Skip REVERTED — cancelled transactions
    if (REVERTED_STATES.has(state)) {
      skipped.push({ row, reason: 'Transacción revertida (REVERTED)' })
      continue
    }

    // Skip PENDING — not settled, will appear next month
    if (PENDING_STATES.has(state)) {
      skipped.push({ row, reason: 'Transacción pendiente (PENDING)' })
      continue
    }

    // Skip savings account rows (Producto: Depósito) — interest and internal
    // transfers to/from the Cuenta Remunerada savings pocket are not real spending
    if (SAVINGS_PRODUCTS.has((row['producto'] ?? '').trim().toLowerCase())) {
      skipped.push({ row, reason: 'Cuenta Remunerada (ahorro)' })
      continue
    }

    // Skip interest income rows regardless of product
    if (INTEREST_TYPES.has((row['tipo'] ?? '').trim().toLowerCase())) {
      skipped.push({ row, reason: 'Intereses (no es un gasto)' })
      continue
    }

    // Validate required fields
    if (!row['fechaInicio'] || row['fechaInicio'].trim() === '') {
      errors.push({ row, error: 'Fecha de inicio vacía' })
      continue
    }

    const importe = parseAmount(row['importe'] ?? '')
    if (isNaN(importe)) {
      errors.push({ row, error: `Importe inválido: "${row['importe']}"` })
      continue
    }

    const comision = parseAmount(row['comision'] ?? '0')
    if (isNaN(comision)) {
      errors.push({ row, error: `Comisión inválida: "${row['comision']}"` })
      continue
    }

    const saldoRaw = row['saldo']
    const saldoParsed = saldoRaw && saldoRaw.trim() !== '' ? parseAmount(saldoRaw) : null
    const saldo = saldoParsed === null || isNaN(saldoParsed) ? null : saldoParsed

    valid.push({
      tipo:        row['tipo']        ?? '',
      producto:    row['producto']    ?? '',
      fechaInicio: row['fechaInicio'] ?? '',
      fechaFin:    row['fechaFin']    ?? '',
      descripcion: (row['descripcion'] ?? '').trim(),
      importe,
      comision,
      divisa:      row['divisa']      ?? 'EUR',
      state,
      saldo,
    })
  }

  return { valid, skipped, errors }
}

/**
 * SHA-256 fingerprint — used for deduplication.
 * Revolut CSVs don't have a unique transaction ID field, so the running
 * balance (saldo) is included: it tells apart two otherwise identical charges
 * (same date, description and amount) that are both legitimate.
 */
export function computeDedupHash(row: RevolutRow): string {
  const content = [
    row.fechaInicio,
    row.descripcion,
    String(row.importe),
    row.tipo,
    row.saldo === null ? '' : String(row.saldo),
  ].join('|')
  return createHash('sha256').update(content).digest('hex')
}

/**
 * Hash format used before the balance was part of the fingerprint. Rows
 * imported back then are stored with this hash, so imports check it too to
 * avoid re-importing them.
 */
export function computeLegacyDedupHash(row: RevolutRow): string {
  const content = [
    row.fechaInicio,
    row.descripcion,
    String(row.importe),
    row.tipo,
  ].join('|')
  return createHash('sha256').update(content).digest('hex')
}

/**
 * Identity of a bank movement that survives merchant renames: Revolut may
 * export the same charge as "Suma Alella" one month and "Suma" the next, which
 * changes the description-based hash. Start time, amount and running balance
 * still pin down the movement.
 */
export function movementKey(fechaInicio: string, importe: number, saldo: number | null): string {
  return `${fechaInicio.slice(0, 19)}|${importe.toFixed(2)}|${saldo === null ? '' : saldo.toFixed(2)}`
}

