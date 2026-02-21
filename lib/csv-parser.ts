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

// Map Spanish CSV headers → internal field names
const COLUMN_MAP: Record<string, string> = {
  'Tipo':                  'tipo',
  'Producto':              'producto',
  'Fecha de inicio':       'fechaInicio',
  'Fecha de finalización': 'fechaFin',
  'Descripción':           'descripcion',
  'Importe':               'importe',
  'Comisión':              'comision',
  'Divisa':                'divisa',
  'State':                 'state',
  'Saldo':                 'saldo',
}

function parseAmount(value: string): number {
  if (!value || value.trim() === '') return 0
  // Handle both comma and period as decimal separators
  return parseFloat(value.replace(/\s/g, '').replace(',', '.'))
}

export function parseRevolutCSV(csvText: string): ParseResult {
  // Strip BOM if present
  const cleaned = csvText.replace(/^\uFEFF/, '')

  const result = Papa.parse<Record<string, string>>(cleaned, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => COLUMN_MAP[h.trim()] ?? h.trim(),
  })

  const valid: RevolutRow[] = []
  const skipped: SkippedRow[] = []
  const errors: Array<{ row: Record<string, string>; error: string }> = []

  for (const rawRow of result.data) {
    const row = rawRow as Record<string, string>

    // Skip REVERTED — cancelled transactions
    if (row['state'] === 'REVERTED') {
      skipped.push({ row, reason: 'Transacción revertida (REVERTED)' })
      continue
    }

    // Skip PENDING — not settled, will appear next month
    if (row['state'] === 'PENDING') {
      skipped.push({ row, reason: 'Transacción pendiente (PENDING)' })
      continue
    }

    // Skip savings account rows (Producto: Depósito) — interest and internal
    // transfers to/from the Cuenta Remunerada savings pocket are not real spending
    if (row['producto'] === 'Depósito') {
      skipped.push({ row, reason: 'Cuenta Remunerada (ahorro)' })
      continue
    }

    // Skip interest income rows regardless of product
    if (row['tipo'] === 'Intereses') {
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

    const saldoRaw = row['saldo']
    const saldo = saldoRaw && saldoRaw.trim() !== '' ? parseAmount(saldoRaw) : null

    valid.push({
      tipo:        row['tipo']        ?? '',
      producto:    row['producto']    ?? '',
      fechaInicio: row['fechaInicio'] ?? '',
      fechaFin:    row['fechaFin']    ?? '',
      descripcion: (row['descripcion'] ?? '').trim(),
      importe,
      comision:    parseAmount(row['comision'] ?? '0'),
      divisa:      row['divisa']      ?? 'EUR',
      state:       row['state']       ?? '',
      saldo,
    })
  }

  return { valid, skipped, errors }
}

/**
 * SHA-256 fingerprint — used for deduplication.
 * Combines fecha_inicio + descripcion + importe + tipo.
 * Revolut CSVs don't have a unique transaction ID field.
 */
export function computeDedupHash(row: RevolutRow): string {
  const content = [
    row.fechaInicio,
    row.descripcion,
    String(row.importe),
    row.tipo,
  ].join('|')
  return createHash('sha256').update(content).digest('hex')
}
