import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { importBatches, mappingRules, transactions } from '@/db/schema'
import { isNotNull, eq } from 'drizzle-orm'
import { parseRevolutCSV, computeDedupHash, computeLegacyDedupHash } from '@/lib/csv-parser'
import { applyMappingRules } from '@/lib/category-mapper'
import { v4 as uuidv4 } from 'uuid'
import type { MappingRule } from '@/db/schema'

export async function POST(request: NextRequest) {
  const formData = await request.formData().catch(() => null)
  const file = formData?.get('file')

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file was uploaded.' }, { status: 400 })
  }

  const csvText = await file.text()
  const { valid, skipped, errors } = parseRevolutCSV(csvText)

  const rules = await db.select().from(mappingRules) as MappingRule[]

  const now = new Date().toISOString()
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

    // Rows imported before the balance joined the fingerprint carry the legacy hash.
    if (existingHashes.has(hash) || existingHashes.has(computeLegacyDedupHash(row))) {
      dupes++
      skipped.push({ row: row as unknown as Record<string, string>, reason: 'Duplicate row' })
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

  const imported = await db.transaction(async (tx) => {
    await tx.insert(importBatches).values({
      id:           batchId,
      fileName:     file.name,
      importedAt:   now,
      // Duplicates are counted in both `valid` and `skipped`.
      rowsTotal:    valid.length + skipped.length - dupes + errors.length,
      rowsImported: 0,
      rowsSkipped:  skipped.length,
      rowsErrored:  errors.length,
    })

    // A concurrent import may have inserted the same rows since the hashes were
    // loaded; the unique dedup_hash constraint makes those no-ops instead of errors.
    const inserted = rowsToInsert.length > 0
      ? await tx.insert(transactions)
          .values(rowsToInsert)
          .onConflictDoNothing({ target: transactions.dedupHash })
          .returning({ id: transactions.id })
      : []

    await tx.update(importBatches)
      .set({ rowsImported: inserted.length })
      .where(eq(importBatches.id, batchId))

    return inserted.length
  })

  // Rows that lost the race to a concurrent import are duplicates too.
  const conflictDupes = rowsToInsert.length - imported

  return NextResponse.json({
    batchId,
    imported,
    skipped: skipped.length - dupes,
    dupes: dupes + conflictDupes,
    errors: errors.length,
    errorDetails: errors.slice(0, 10),
  })
}
