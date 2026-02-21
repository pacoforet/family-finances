import { NextRequest, NextResponse } from 'next/server'
import { db, sqlite } from '@/db'
import { importBatches, mappingRules } from '@/db/schema'
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

  // Load all active mapping rules
  const rules = await db.select().from(mappingRules).all() as MappingRule[]

  const now = new Date().toISOString()
  let imported = 0
  let dupes = 0

  // Load existing hashes for fast dedup check
  const existingHashes = new Set(
    sqlite.prepare('SELECT dedup_hash FROM transactions WHERE dedup_hash IS NOT NULL')
      .all()
      .map((r: unknown) => (r as { dedup_hash: string }).dedup_hash)
  )

  interface InsertRow {
    id: string; importBatchId: string; dedupHash: string; tipo: string; producto: string;
    fechaInicio: string; fechaFin: string | null; descripcion: string; importe: number;
    comision: number; divisa: string; state: string; saldo: number | null;
    categoryId: string | null; categorySource: string | null;
    isManual: boolean; excludeFromBudget: boolean; createdAt: string; updatedAt: string;
  }

  const batchId = uuidv4()
  const rowsToInsert: InsertRow[] = []

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
      isManual:       false,
      excludeFromBudget: false,
      createdAt:     now,
      updatedAt:     now,
    })
  }

  // Insert the batch record FIRST — transactions FK reference it
  await db.insert(importBatches).values({
    id:           batchId,
    fileName:     file.name,
    importedAt:   now,
    rowsTotal:    valid.length + skipped.length + errors.length,
    rowsImported: 0, // updated below after insert
    rowsSkipped:  skipped.length,
    rowsErrored:  errors.length,
  })

  // Bulk insert transactions inside a SQLite transaction for performance
  if (rowsToInsert.length > 0) {
    const insertMany = sqlite.transaction(() => {
      for (const row of rowsToInsert) {
        sqlite.prepare(`
          INSERT INTO transactions (
            id, import_batch_id, dedup_hash, tipo, producto, fecha_inicio, fecha_fin,
            descripcion, importe, comision, divisa, state, saldo,
            category_id, category_source, is_manual, exclude_from_budget,
            created_at, updated_at
          ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
          )
        `).run(
          row.id, row.importBatchId, row.dedupHash, row.tipo, row.producto,
          row.fechaInicio, row.fechaFin, row.descripcion, row.importe,
          row.comision, row.divisa, row.state, row.saldo,
          row.categoryId, row.categorySource, row.isManual ? 1 : 0,
          row.excludeFromBudget ? 1 : 0, row.createdAt, row.updatedAt
        )
      }
    })
    insertMany()
    imported = rowsToInsert.length
  }

  // Update batch with final imported count
  sqlite.prepare('UPDATE import_batches SET rows_imported = ? WHERE id = ?').run(imported, batchId)

  return NextResponse.json({
    batchId,
    imported,
    skipped: skipped.length - dupes, // excluding dupes in skipped count for UI
    dupes,
    errors: errors.length,
    errorDetails: errors.slice(0, 10), // first 10 errors max
  })
}
