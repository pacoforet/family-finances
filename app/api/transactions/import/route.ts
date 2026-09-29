import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { importBatches, mappingRules, transactions } from '@/db/schema'
import { eq, inArray } from 'drizzle-orm'
import { parseRevolutCSV, computeDedupHash, computeLegacyDedupHash } from '@/lib/csv-parser'
import { createRuleMatcher } from '@/lib/category-mapper'
import { v4 as uuidv4 } from 'uuid'
import { withApiErrors } from '@/lib/api'

// A year of bank statements is well under 1 MB; anything bigger is a mistake.
const MAX_FILE_BYTES = 5 * 1024 * 1024
const HASH_LOOKUP_CHUNK = 1000

/** Returns which of the given hashes are already stored. */
async function findExistingHashes(hashes: string[]): Promise<Set<string>> {
  const existing = new Set<string>()
  for (let i = 0; i < hashes.length; i += HASH_LOOKUP_CHUNK) {
    const rows = await db
      .select({ dedupHash: transactions.dedupHash })
      .from(transactions)
      .where(inArray(transactions.dedupHash, hashes.slice(i, i + HASH_LOOKUP_CHUNK)))
    for (const row of rows) existing.add(row.dedupHash!)
  }
  return existing
}

export const POST = withApiErrors(async (request: NextRequest) => {
  const formData = await request.formData().catch(() => null)
  const file = formData?.get('file')

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file was uploaded.' }, { status: 400 })
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: 'The file is too large (max 5 MB).' }, { status: 413 })
  }

  const csvText = await file.text()
  const { valid, skipped, errors } = parseRevolutCSV(csvText)

  const match = createRuleMatcher(await db.select().from(mappingRules))

  const now = new Date().toISOString()
  let dupes = 0

  // Only look up the hashes this file could collide with. Rows imported before
  // the balance joined the fingerprint are stored with the legacy hash.
  const hashed = valid.map(row => ({ row, hash: computeDedupHash(row), legacyHash: computeLegacyDedupHash(row) }))
  const existingHashes = await findExistingHashes([
    ...new Set(hashed.flatMap(h => [h.hash, h.legacyHash])),
  ])

  const batchId = uuidv4()
  const rowsToInsert: typeof transactions.$inferInsert[] = []

  for (const { row, hash, legacyHash } of hashed) {
    if (existingHashes.has(hash) || existingHashes.has(legacyHash)) {
      dupes++
      skipped.push({ row: row as unknown as Record<string, string>, reason: 'Duplicate row' })
      continue
    }

    existingHashes.add(hash)

    const categoryId = match(row.descripcion)?.categoryId ?? null

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
      categorySource: categoryId ? 'auto_rule' : null,
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
})
