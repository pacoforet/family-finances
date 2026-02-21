'use client'

import { useState, useCallback } from 'react'
import { Upload, FileText, CheckCircle, AlertCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/format'
import { parseRevolutCSV } from '@/lib/csv-parser'
import type { RevolutRow } from '@/lib/csv-parser'

interface ImportResult {
  imported: number
  skipped: number
  dupes: number
  errors: number
}

export default function ImportarPage() {
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
        setError(data.error ?? 'Error al importar')
      } else {
        setResult(data)
        setFile(null)
        setPreview([])
      }
    } catch {
      setError('Error de red al importar')
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
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Importar extracto</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Sube el CSV de Revolut para importar tus transacciones del mes
        </p>
      </div>

      {result ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Importación completada
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{result.imported}</div>
                <div className="text-sm text-muted-foreground">Importadas</div>
              </div>
              <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600">{result.dupes}</div>
                <div className="text-sm text-muted-foreground">Duplicadas</div>
              </div>
              <div className="text-center p-4 bg-red-50 dark:bg-red-950 rounded-lg">
                <div className="text-2xl font-bold text-red-600">{result.errors}</div>
                <div className="text-sm text-muted-foreground">Errores</div>
              </div>
            </div>
            <div className="flex gap-3">
              <Button onClick={reset} variant="outline">Importar otro archivo</Button>
              <Button asChild>
                <a href="/transacciones">Ver transacciones</a>
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
                border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer
                ${dragging
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
                }
              `}
              onClick={() => document.getElementById('csv-input')?.click()}
            >
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
              <p className="text-base font-medium">Arrastra el CSV de Revolut aquí</p>
              <p className="text-sm text-muted-foreground mt-1">o haz clic para seleccionar</p>
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
                      <CardTitle className="text-base">{file.name}</CardTitle>
                      <CardDescription>
                        {preview.length} transacciones válidas · {previewSkipped} omitidas
                      </CardDescription>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={reset}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Preview table */}
                <div className="rounded-lg border overflow-auto max-h-96">
                  <table className="w-full text-sm">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Fecha</th>
                        <th className="text-left px-3 py-2 font-medium">Descripción</th>
                        <th className="text-left px-3 py-2 font-medium">Tipo</th>
                        <th className="text-right px-3 py-2 font-medium">Importe</th>
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
                          <td className={`px-3 py-2 text-right font-mono ${row.importe < 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {formatCurrency(row.importe)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-red-600 text-sm">
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
                      ? 'Importando...'
                      : `Importar ${preview.length} transacciones`
                    }
                  </Button>
                  <Button variant="outline" onClick={reset}>Cancelar</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cómo exportar desde Revolut</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="text-sm space-y-1.5 text-muted-foreground list-decimal list-inside">
            <li>Abre Revolut y ve a la cuenta compartida</li>
            <li>Toca el icono de descarga o ve a Declaraciones</li>
            <li>Selecciona el período del mes (ej. 1 ene – 31 ene)</li>
            <li>Elige formato CSV</li>
            <li>Descarga y sube el archivo aquí</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}
