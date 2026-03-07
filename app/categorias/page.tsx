'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, TestTube, CheckCircle, XCircle, Pencil, Check, X, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import type { Category, MappingRule } from '@/db/schema'
import { useUiCopy } from '@/lib/ui-copy'

const PRESET_COLORS = [
  '#3B82F6', '#14B8A6', '#8B5CF6', '#22C55E', '#F97316',
  '#EF4444', '#EC4899', '#6B7280', '#EAB308', '#06B6D4',
  '#F43F5E', '#0EA5E9', '#84CC16', '#A855F7', '#FB923C',
]

interface TestResult {
  matched: boolean
  rule?: MappingRule
  category?: Category
}

export default function CategoriasPage() {
  const copy = useUiCopy()
  const [categories, setCategories]   = useState<Category[]>([])
  const [selectedCat, setSelectedCat] = useState<string | null>(null)
  const [rules, setRules]             = useState<MappingRule[]>([])

  // --- Category add form ---
  const [showAddCat, setShowAddCat]   = useState(false)
  const [newCatName, setNewCatName]   = useState('')
  const [newCatColor, setNewCatColor] = useState(PRESET_COLORS[0])
  const [savingCat, setSavingCat]     = useState(false)
  const [catError, setCatError]       = useState<string | null>(null)

  // --- Category edit ---
  const [editingCatId, setEditingCatId]     = useState<string | null>(null)
  const [editCatName, setEditCatName]       = useState('')
  const [editCatColor, setEditCatColor]     = useState('')
  const [editCatIsIncome, setEditCatIsIncome] = useState(false)
  const [savingEditCat, setSavingEditCat]   = useState(false)

  // --- New rule form ---
  const [newMatchType,  setNewMatchType]  = useState('contains')
  const [newMatchValue, setNewMatchValue] = useState('')
  const [newPriority,   setNewPriority]   = useState('100')
  const [newNotes,      setNewNotes]      = useState('')
  const [saving, setSaving]               = useState(false)

  // --- Test ---
  const [testInput, setTestInput]   = useState('')
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [testing, setTesting]       = useState(false)

  useEffect(() => {
    fetch('/api/categories')
      .then(r => r.json())
      .then(d => {
        setCategories(d.categories)
        if (d.categories.length > 0) setSelectedCat(d.categories[0].id)
      })
  }, [])

  useEffect(() => {
    if (!selectedCat) return
    fetch(`/api/mapping-rules?categoryId=${selectedCat}`)
      .then(r => r.json())
      .then(d => setRules(d.rules))
  }, [selectedCat])

  // ---- Category CRUD ----

  const addCategory = async () => {
    if (!newCatName.trim()) return
    setSavingCat(true)
    setCatError(null)
    const res = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newCatName.trim(), color: newCatColor }),
    })
    const data = await res.json()
    setSavingCat(false)
    if (!res.ok) {
      setCatError(data.error ?? copy.categories.create)
      return
    }
    setCategories(prev => [...prev, data.category])
    setSelectedCat(data.category.id)
    setNewCatName('')
    setNewCatColor(PRESET_COLORS[0])
    setShowAddCat(false)
  }

  const startEditCat = (cat: Category) => {
    setEditingCatId(cat.id)
    setEditCatName(cat.name)
    setEditCatColor(cat.color)
    setEditCatIsIncome(cat.isIncome)
  }

  const cancelEditCat = () => {
    setEditingCatId(null)
  }

  const saveEditCat = async (cat: Category) => {
    if (!editCatName.trim()) return
    setSavingEditCat(true)
    const res = await fetch(`/api/categories/${cat.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editCatName.trim(), color: editCatColor, isIncome: editCatIsIncome }),
    })
    const data = await res.json()
    setSavingEditCat(false)
    if (res.ok) {
      setCategories(prev => prev.map(c => c.id === cat.id ? data.category : c))
      setEditingCatId(null)
    }
  }

  const toggleIsIncome = async (cat: Category) => {
    const res = await fetch(`/api/categories/${cat.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isIncome: !cat.isIncome }),
    })
    const data = await res.json()
    if (res.ok) {
      setCategories(prev => prev.map(c => c.id === cat.id ? data.category : c))
    }
  }

  const deleteCategory = async (cat: Category) => {
    if (!confirm(`${copy.categories.deleteConfirmPrefix} "${cat.name}"? ${copy.categories.deleteConfirmSuffix}`)) return
    const res = await fetch(`/api/categories/${cat.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      alert(data.error ?? copy.categories.deleteError)
      return
    }
    setCategories(prev => prev.filter(c => c.id !== cat.id))
    if (selectedCat === cat.id) {
      const remaining = categories.filter(c => c.id !== cat.id)
      setSelectedCat(remaining[0]?.id ?? null)
    }
  }

  // ---- Rule CRUD ----

  const addRule = async () => {
    if (!newMatchValue.trim() || !selectedCat) return
    setSaving(true)
    const res = await fetch('/api/mapping-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        categoryId: selectedCat,
        matchType: newMatchType,
        matchValue: newMatchValue.trim(),
        priority: parseInt(newPriority) || 100,
        notes: newNotes || null,
      }),
    })
    const data = await res.json()
    setSaving(false)
    if (res.ok) {
      setRules(prev => [...prev, data.rule].sort((a, b) => a.priority - b.priority))
      setNewMatchValue('')
      setNewNotes('')
    }
  }

  const deleteRule = async (ruleId: string) => {
    await fetch(`/api/mapping-rules/${ruleId}`, { method: 'DELETE' })
    setRules(prev => prev.filter(r => r.id !== ruleId))
  }

  const toggleRule = async (rule: MappingRule) => {
    const res = await fetch(`/api/mapping-rules/${rule.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !rule.isActive }),
    })
    const data = await res.json()
    setRules(prev => prev.map(r => r.id === rule.id ? data.rule : r))
  }

  const testRule = async () => {
    if (!testInput.trim()) return
    setTesting(true)
    const res = await fetch('/api/mapping-rules/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: testInput }),
    })
    const data = await res.json()
    setTestResult(data)
    setTesting(false)
  }

  const selectedCategory = categories.find(c => c.id === selectedCat)

  const MATCH_TYPE_LABELS: Record<string, string> = {
    contains:    copy.categories.contains,
    exact:       copy.categories.exact,
    starts_with: copy.categories.startsWith,
    regex:       'Regex',
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{copy.categories.title}</h1>
        <p className="text-muted-foreground text-sm">{copy.categories.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Category list */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              {copy.categories.categories}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => { setShowAddCat(v => !v); setCatError(null) }}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                {copy.categories.new}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 p-3">
            {/* Add new category inline form */}
            {showAddCat && (
              <div className="mb-3 p-3 rounded-lg border bg-muted/40 space-y-2">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nombre</Label>
                  <Input
                    autoFocus
                    placeholder="Ej: Transporte"
                    value={newCatName}
                    onChange={e => setNewCatName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addCategory()}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Color</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_COLORS.map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setNewCatColor(color)}
                        className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                        style={{
                          backgroundColor: color,
                          borderColor: newCatColor === color ? '#000' : 'transparent',
                        }}
                      />
                    ))}
                  </div>
                </div>
                {catError && (
                  <p className="text-xs text-red-600">{catError}</p>
                )}
                <div className="flex gap-1.5">
                  <Button size="sm" className="h-7 text-xs" onClick={addCategory} disabled={savingCat || !newCatName.trim()}>
                    {savingCat ? 'Saving...' : 'Create'}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setShowAddCat(false); setCatError(null) }}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {categories.map(cat => (
              <div key={cat.id}>
                {editingCatId === cat.id ? (
                  /* Inline edit form */
                  <div className="p-2 rounded-md border bg-muted/40 space-y-2">
                    <Input
                      autoFocus
                      value={editCatName}
                      onChange={e => setEditCatName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveEditCat(cat); if (e.key === 'Escape') cancelEditCat() }}
                      className="h-7 text-sm"
                    />
                    <div className="flex flex-wrap gap-1">
                      {PRESET_COLORS.map(color => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setEditCatColor(color)}
                          className="w-5 h-5 rounded-full border-2 transition-transform hover:scale-110"
                          style={{
                            backgroundColor: color,
                            borderColor: editCatColor === color ? '#000' : 'transparent',
                          }}
                        />
                      ))}
                    </div>
                    {/* isIncome toggle */}
                    <button
                      type="button"
                      onClick={() => setEditCatIsIncome(v => !v)}
                      className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border transition-colors ${
                        editCatIsIncome
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-950 dark:border-emerald-700 dark:text-emerald-400'
                          : 'bg-muted border-border text-muted-foreground'
                      }`}
                    >
                      <TrendingUp className="h-3 w-3" />
                      {editCatIsIncome ? copy.categories.income : copy.categories.expense}
                    </button>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => saveEditCat(cat)}
                        disabled={savingEditCat || !editCatName.trim()}
                      >
                        <Check className="h-3 w-3 mr-1" />
                        {savingEditCat ? '...' : 'OK'}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={cancelEditCat}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* Normal category row */
                  <div className={`group flex items-center gap-1 rounded-md transition-colors ${
                    selectedCat === cat.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                  }`}>
                    <button
                      onClick={() => setSelectedCat(cat.id)}
                      className="flex items-center gap-2.5 flex-1 px-3 py-2 text-sm text-left min-w-0"
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="flex-1 truncate">{cat.name}</span>
                      {cat.isIncome && (
                        <span className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                          selectedCat === cat.id
                            ? 'bg-white/20 text-white'
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                        }`}>
                          {copy.categories.income}
                        </span>
                      )}
                    </button>
                    {/* Edit / delete / income-toggle buttons — visible on hover */}
                    <div className={`flex gap-0.5 pr-1 opacity-0 group-hover:opacity-100 transition-opacity ${
                      selectedCat === cat.id ? 'text-primary-foreground' : ''
                    }`}>
                      <button
                        onClick={e => { e.stopPropagation(); toggleIsIncome(cat) }}
                        className={`p-1 rounded hover:bg-black/10 ${cat.isIncome ? 'text-emerald-500' : ''}`}
                        title={cat.isIncome ? copy.categories.markExpense : copy.categories.markIncome}
                      >
                        <TrendingUp className="h-3 w-3" />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); startEditCat(cat) }}
                        className="p-1 rounded hover:bg-black/10"
                        title={copy.categories.edit}
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); deleteCategory(cat) }}
                        className="p-1 rounded hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900"
                        title={copy.categories.delete}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Right: Rules for selected category */}
        <div className="lg:col-span-2 space-y-4">
          {selectedCategory && (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: selectedCategory.color }}
                    />
                    {copy.categories.rulesFor} {selectedCategory.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {rules.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      {copy.categories.noRules}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {rules.map(rule => (
                        <div
                          key={rule.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border text-sm ${
                            !rule.isActive ? 'opacity-50 bg-muted' : ''
                          }`}
                        >
                          <Badge variant="outline" className="text-xs shrink-0">
                            {MATCH_TYPE_LABELS[rule.matchType]}
                          </Badge>
                          <span className="font-mono flex-1 truncate">{rule.matchValue}</span>
                          <span className="text-muted-foreground text-xs shrink-0">P:{rule.priority}</span>
                          {rule.notes && (
                            <span className="text-muted-foreground text-xs truncate max-w-24">{rule.notes}</span>
                          )}
                          <div className="flex gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => toggleRule(rule)}
                              title={rule.isActive ? copy.categories.disable : copy.categories.enable}
                            >
                              {rule.isActive
                                ? <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                                : <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                              }
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-red-500 hover:text-red-700"
                              onClick={() => deleteRule(rule.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Add rule form */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{copy.categories.addRule}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label>{copy.categories.type}</Label>
                      <Select value={newMatchType} onValueChange={setNewMatchType}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="contains">{copy.categories.contains}</SelectItem>
                          <SelectItem value="exact">{copy.categories.exact}</SelectItem>
                          <SelectItem value="starts_with">{copy.categories.startsWith}</SelectItem>
                          <SelectItem value="regex">Regex</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5 col-span-2">
                      <Label>{copy.categories.value}</Label>
                      <Input
                        placeholder={copy.categories.exampleMerchant}
                        value={newMatchValue}
                        onChange={e => setNewMatchValue(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addRule()}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label>{copy.categories.priority}</Label>
                      <Input
                        type="number"
                        value={newPriority}
                        onChange={e => setNewPriority(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5 col-span-2">
                      <Label>{copy.categories.notesOptional}</Label>
                      <Input
                        placeholder={copy.categories.optionalDescription}
                        value={newNotes}
                        onChange={e => setNewNotes(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button onClick={addRule} disabled={saving || !newMatchValue.trim()} size="sm">
                    <Plus className="h-4 w-4 mr-1.5" />
                    {saving ? copy.categories.saving : copy.categories.addRule}
                  </Button>
                </CardContent>
              </Card>

              {/* Test rules */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{copy.categories.testRules}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex gap-2">
                    <Input
                      placeholder={copy.categories.typeMerchantDescription}
                      value={testInput}
                      onChange={e => { setTestInput(e.target.value); setTestResult(null) }}
                      onKeyDown={e => e.key === 'Enter' && testRule()}
                    />
                    <Button onClick={testRule} disabled={testing || !testInput.trim()} variant="outline">
                      <TestTube className="h-4 w-4 mr-1.5" />
                      {copy.categories.test}
                    </Button>
                  </div>

                  {testResult && (
                    <div className={`p-3 rounded-lg text-sm ${
                      testResult.matched
                        ? 'bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800'
                        : 'bg-muted border'
                    }`}>
                      {testResult.matched ? (
                        <div className="space-y-1">
                          <p className="font-medium text-green-700 dark:text-green-400">
                            {copy.categories.matchesCategory} {testResult.category?.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {copy.categories.rule} {MATCH_TYPE_LABELS[testResult.rule?.matchType ?? '']} &quot;{testResult.rule?.matchValue}&quot;
                            ({copy.categories.priorityLabel} {testResult.rule?.priority})
                          </p>
                        </div>
                      ) : (
                        <p className="text-muted-foreground">{copy.categories.noRuleMatched}</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
