'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { Category } from '@/db/schema'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: Category[]
  onSaved: () => void
}

export function AddTransactionDialog({ open, onOpenChange, categories, onSaved }: Props) {
  const [descripcion, setDescripcion] = useState('')
  const [importe, setImporte]         = useState('')
  const [fecha, setFecha]             = useState(new Date().toISOString().slice(0, 10))
  const [categoryId, setCategoryId]   = useState('')
  const [notes, setNotes]             = useState('')
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')

  const handleSubmit = async () => {
    if (!descripcion || !importe || !fecha) {
      setError('Description, amount, and date are required.')
      return
    }
    const amount = parseFloat(importe.replace(',', '.'))
    if (isNaN(amount)) {
      setError('Invalid amount.')
      return
    }

    setSaving(true)
    setError('')

    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          descripcion,
          importe: -Math.abs(amount), // always expense for manual entry
          fechaInicio: `${fecha} 12:00:00`,
          categoryId: categoryId || null,
          notes: notes || null,
        }),
      })

      if (!res.ok) {
        const d = await res.json()
        setError(d.error ?? 'Unable to save transaction.')
      } else {
        setDescripcion('')
        setImporte('')
        setFecha(new Date().toISOString().slice(0, 10))
        setCategoryId('')
        setNotes('')
        onOpenChange(false)
        onSaved()
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add manual expense</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input
              placeholder="Example: Grocery run"
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Amount</Label>
              <Input
                placeholder="25.50"
                value={importe}
                onChange={e => setImporte(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input
                type="date"
                value={fecha}
                onChange={e => setFecha(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a category..." />
              </SelectTrigger>
              <SelectContent>
                {categories.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                      {c.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Textarea
              placeholder="Any extra context..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
