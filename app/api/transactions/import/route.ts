import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { importBatches, mappingRules, transactions } from '@/db/schema'
import { isNotNull, eq } from 'drizzle-orm'
import { parseRevolutCSV, computeDedupHash } from '@/lib/csv-parser'
import { applyMappingRules } from '@/lib/category-mapper'
import { v4 as uuidv4 } from 'uuid'
import type { MappingRule } from '@/db/schema'

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 })
  }

  const csvText = await file.text()
  const { valid, skipped, errors } = parseRevolutCSV(csvText)

  const rules = await db.select().from(mappingRules) as MappingRule[]

  const now = new Date().toISOString()
  let imported = 0
  let dupes = 0

  // Load existing hashes for fast dedup check
  const existingHashRows = await db
    .select({ dedupHash: transactions.dedupHash })
    .from(transactions)
    .where(isNotNull(transactions.dedupHash))
  const existingHashes = new Set(existingHashRows.map(r => r.dedupHash!))

  const batchId = uuidv4()
  const rowsToInsert: typeof transactions.$inferInsert[] = []

  for (const row of valid) {
    const hash = computeDedupHash(row)

    if (existingHashes.has(hash)) {
      dupes++
      skipped.push({ row: row as unknown as Record<string, string>, reason: 'Duplicado' })
      continue
    }

    existingHashes.add(hash)

    const categoryId = applyMappingRules(row.descripcion, rules)
    const categorySource = categoryId ? 'auto_rule' : null

    rowsToInsert.push({
      id:            uuidv4(),
      importBatchId: batchId,
      dedupHash:     hash,
      tipo:          row.tipo,
      producto:      row.producto,
      fechaInicio:   row.fechaInicio,
      fechaFin:      row.fechaFin || null,
      descripcion:   row.descripcion,
      importe:       row.importe,
      comision:      row.comision,
      divisa:        row.divisa,
      state:         row.state,
      saldo:         row.saldo,
      categoryId,
      categorySource,
      isManual:          false,
      excludeFromBudget: false,
      createdAt:     now,
      updatedAt:     now,
    })
  }

  await db.insert(importBatches).values({
    id:           batchId,
    fileName:     file.name,
    importedAt:   now,
    rowsTotal:    valid.length + skipped.length + errors.length,
    rowsImported: 0,
    rowsSkipped:  skipped.length,
    rowsErrored:  errors.length,
  })

  if (rowsToInsert.length > 0) {
    await db.insert(transactions).values(rowsToInsert)
    imported = rowsToInsert.length
  }

  await db.update(importBatches)
    .set({ rowsImported: imported })
    .where(eq(importBatches.id, batchId))

  return NextResponse.json({
    batchId,
    imported,
    skipped: skipped.length - dupes,
    dupes,
    errors: errors.length,
    errorDetails: errors.slice(0, 10),
  })
}
