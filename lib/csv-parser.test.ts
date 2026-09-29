import { createHash } from 'crypto'
import { describe, expect, it } from 'vitest'
import { computeDedupHash, computeLegacyDedupHash, parseAmount, parseRevolutCSV } from './csv-parser'

describe('parseAmount', () => {
  it.each([
    ['-12.34', -12.34],
    ['12,5', 12.5],
    ['1.234,56', 1234.56],
    ['1,234.56', 1234.56],
    ['-1.234.567,89', -1234567.89],
    ['1,234,567', 1234567],
    ['', 0],
    [' 7 ', 7],
    ['1 234,50', 1234.5],
    ['+3', 3],
    ['.5', 0.5],
  ])('parses %j as %d', (input, expected) => {
    expect(parseAmount(input)).toBe(expected)
  })

  it.each(['abc', '12abc', '1-2', '--1'])('rejects %j', (input) => {
    expect(parseAmount(input)).toBeNaN()
  })
})

const EN_CSV = `Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance
CARD_PAYMENT,Current,2025-01-15 10:23:11,2025-01-16 09:00:00,Coffee,-3.50,0.00,EUR,COMPLETED,100.00
CARD_PAYMENT,Current,2025-01-15 10:23:11,2025-01-16 09:00:00,Coffee,-3.50,0.00,EUR,COMPLETED,96.50
CARD_PAYMENT,Current,2025-01-16 10:00:00,,Pending,-1.00,0.00,EUR,PENDING,
TRANSFER,Savings,2025-01-17 10:00:00,2025-01-17 10:00:00,To pocket,-50.00,0.00,EUR,COMPLETED,46.50
INTEREST,Current,2025-01-18 10:00:00,2025-01-18 10:00:00,Interest,0.10,0.00,EUR,COMPLETED,46.60
CARD_PAYMENT,Current,2025-01-19 10:00:00,2025-01-19 10:00:00,Bad,oops,0.00,EUR,COMPLETED,46.60`

const ES_CSV = '﻿Tipo,Producto,Fecha de inicio,Fecha de finalización,Descripción,Importe,Comisión,Divisa,State,Saldo\n' +
  'Pago con tarjeta,Actual,2025-01-15 10:23:11,2025-01-16 09:00:00,Mercadona,-45.20,0.00,EUR,COMPLETADO,1000.00\n' +
  'Intereses,Actual,2025-01-15 10:23:11,,Int,0.01,0,EUR,COMPLETADO,1000.01\n' +
  'Transferencia,Depósito,2025-01-15 10:23:11,,x,-10,0,EUR,COMPLETADO,990\n'

describe('parseRevolutCSV', () => {
  it('reads English exports and skips pending, savings and interest rows', () => {
    const result = parseRevolutCSV(EN_CSV)
    expect(result.valid).toHaveLength(2)
    expect(result.skipped).toHaveLength(3)
    expect(result.errors).toHaveLength(1)
    expect(result.valid[0]).toMatchObject({
      fechaInicio: '2025-01-15 10:23:11',
      descripcion: 'Coffee',
      importe: -3.5,
      state: 'COMPLETED',
      saldo: 100,
    })
  })

  it('reads Spanish exports with a BOM', () => {
    const result = parseRevolutCSV(ES_CSV)
    expect(result.valid).toHaveLength(1)
    expect(result.skipped).toHaveLength(2)
    expect(result.valid[0]).toMatchObject({ descripcion: 'Mercadona', importe: -45.2, state: 'COMPLETADO' })
  })
})

describe('dedup hashes', () => {
  it('tells identical same-second charges apart by balance', () => {
    const [a, b] = parseRevolutCSV(EN_CSV).valid
    expect(computeDedupHash(a)).not.toBe(computeDedupHash(b))
    expect(computeLegacyDedupHash(a)).toBe(computeLegacyDedupHash(b))
  })

  it('keeps the legacy hash identical to the original formula', () => {
    const [row] = parseRevolutCSV(ES_CSV).valid
    const original = createHash('sha256')
      .update([row.fechaInicio, row.descripcion, String(row.importe), row.tipo].join('|'))
      .digest('hex')
    expect(computeLegacyDedupHash(row)).toBe(original)
  })
})
