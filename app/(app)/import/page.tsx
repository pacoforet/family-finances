'use client'

import { useState, useCallback } from 'react'
import { Upload, FileText, CheckCircle, AlertCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/format'
import { parseRevolutCSV } from '@/lib/csv-parser'
import type { RevolutRow } from '@/lib/csv-parser'
import { useUiCopy } from '@/lib/ui-copy'
import { PageHeader } from '@/components/kit'

interface ImportResult {
  imported: number
  skipped: number
  dupes: number
  errors: number
  autoCategorized?: number
  suggested?: number
}

export default function ImportarPage() {
  const copy = useUiCopy()
  const [dragging, setDragging] = useState(false)
  const [file, setFile]         = useState<File | null>(null)
  const [preview, setPreview]   = useState<RevolutRow[]>([])
  const [previewSkipped, setPreviewSkipped] = useState(0)
  const [importing, setImporting] = useState(false)
  const [result, setResult]     = useState<ImportResult | null>(null)
  const [error, setError]       = useState<string | null>(null)

  const handleFile = useCallback(async (f: File) => {
    setFile(f)
    setResult(null)
    setError(null)

    const text = await f.text()
    const { valid, skipped } = parseRevolutCSV(text)
    setPreview(valid.slice(0, 20))
    setPreviewSkipped(skipped.length)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped?.name.endsWith('.csv')) handleFile(dropped)
  }, [handleFile])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) handleFile(f)
  }

  const handleImport = async () => {
    if (!file) return
    setImporting(true)
    setError(null)

    try {
      const form = new FormData()
      form.append('file', file)

      const res = await fetch('/api/transactions/import', {
        method: 'POST',
        body: form,
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? copy.import.importFailed)
      } else {
        setResult(data)
        setFile(null)
        setPreview([])
      }
    } catch {
      setError(copy.import.networkError)
    } finally {
      setImporting(false)
    }
  }

  const reset = () => {
    setFile(null)
    setPreview([])
    setResult(null)
    setError(null)
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-7 px-4 py-8 md:px-8 md:py-10">
      <PageHeader title={copy.import.title} subtitle={copy.import.subtitle} />

      {result ? (
        <Card className="animate-rise">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="size-5 text-positive" />
              {copy.import.completed}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-xl bg-positive/10 p-4 text-center">
                <div className="font-display figures text-3xl text-positive">{result.imported}</div>
                <div className="text-sm text-muted-foreground">{copy.import.imported}</div>
              </div>
              <div className="rounded-xl bg-muted p-4 text-center">
                <div className="font-display figures text-3xl">{result.dupes}</div>
                <div className="text-sm text-muted-foreground">{copy.import.duplicates}</div>
              </div>
              <div className={`rounded-xl p-4 text-center ${result.errors > 0 ? 'bg-negative/10' : 'bg-muted'}`}>
                <div className={`font-display figures text-3xl ${result.errors > 0 ? 'text-negative' : ''}`}>{result.errors}</div>
                <div className="text-sm text-muted-foreground">{copy.import.errors}</div>
              </div>
            </div>
            {result.imported > 0 && result.autoCategorized !== undefined && (
              <p className="text-sm text-muted-foreground">
                <span className="figures font-semibold text-foreground">{result.autoCategorized}</span> {copy.import.autoCategorized}
                {' · '}
                <span className="figures font-semibold text-foreground">{result.suggested ?? 0}</span> {copy.import.suggestedForReview}
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <Button onClick={reset} variant="outline">{copy.import.importAnother}</Button>
              {(result.suggested ?? 0) > 0 && (
                <Button asChild variant="outline">
                  <a href="/transactions?review=1">{copy.import.reviewSuggestions}</a>
                </Button>
              )}
              <Button asChild>
                <a href="/transactions">{copy.import.viewTransactions}</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Drop zone */}
          {!file ? (
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              className={`
                animate-rise cursor-pointer rounded-2xl border-2 border-dashed bg-card/60 p-14 text-center transition-colors
                ${dragging
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50 hover:bg-card'
                }
              `}
              onClick={() => document.getElementById('csv-input')?.click()}
            >
              <span className="mx-auto mb-5 grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
                <Upload className="size-6" strokeWidth={1.75} />
              </span>
              <p className="font-display text-xl">{copy.import.dropCsv}</p>
              <p className="text-sm text-muted-foreground mt-1">{copy.import.clickBrowse}</p>
            <input
                id="csv-input"
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileInput}
              />
            </div>
          ) : (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <CardTitle>{file.name}</CardTitle>
                      <CardDescription>
                        {preview.length} {copy.import.validRows} · {previewSkipped} {copy.import.skipped}
                      </CardDescription>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={reset}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Preview table — desktop */}
                <div className="hidden md:block rounded-lg border overflow-auto max-h-96">
                  <table className="w-full text-sm">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">{copy.import.date}</th>
                        <th className="text-left px-3 py-2 font-medium">{copy.import.description}</th>
                        <th className="text-left px-3 py-2 font-medium">{copy.import.type}</th>
                        <th className="text-right px-3 py-2 font-medium">{copy.import.amount}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((row, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                            {formatDate(row.fechaInicio)}
                          </td>
                          <td className="px-3 py-2 max-w-xs truncate">{row.descripcion}</td>
                          <td className="px-3 py-2">
                            <Badge variant="outline" className="text-xs font-normal">
                              {row.tipo}
                            </Badge>
                          </td>
                          <td className={`figures px-3 py-2 text-right ${row.importe < 0 ? '' : 'text-positive'}`}>
                            {formatCurrency(row.importe)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Preview card list — mobile */}
                <div className="md:hidden rounded-lg border divide-y max-h-96 overflow-auto">
                  {preview.map((row, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-3 gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(row.fechaInicio)}</span>
                          <Badge variant="outline" className="text-[10px] font-normal py-0">{row.tipo}</Badge>
                        </div>
                        <p className="text-sm truncate">{row.descripcion}</p>
                      </div>
                      <span className={`figures text-sm font-semibold shrink-0 ${row.importe < 0 ? '' : 'text-positive'}`}>
                        {formatCurrency(row.importe)}
                      </span>
                    </div>
                  ))}
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-sm text-negative">
                    <AlertCircle className="h-4 w-4" />
                    {error}
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    onClick={handleImport}
                    disabled={importing || preview.length === 0}
                  >
                    {importing
                      ? copy.import.importing
                      : `${copy.import.importCount} ${preview.length}`
                    }
                  </Button>
                  <Button variant="outline" onClick={reset}>{copy.import.cancel}</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>{copy.import.howToExport}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm space-y-2 text-muted-foreground">
            {copy.import.steps.map((step) => (
              <p key={step}>{step}</p>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
