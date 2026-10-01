'use client'

import { useEffect, useState } from 'react'
import { fetchJson } from '@/lib/fetch-json'
import { fromMonthKey, parseDateParts } from '@/lib/format'

export interface InitialMonth {
  year: number
  month: number
  /** The current month had no transactions yet, so the latest month with data is shown */
  fellBack: boolean
}

/**
 * Month a page opens on: the `?month=` param if given, otherwise the current
 * month - unless it has no transactions yet (e.g. on the 1st), in which case
 * the most recent month with transactions. `null` while that is being checked.
 */
export function useInitialMonth(monthParam: string | null): InitialMonth | null {
  const [initial, setInitial] = useState<InitialMonth | null>(() => {
    if (!monthParam) return null
    const { year, month } = fromMonthKey(monthParam)
    return { year, month, fellBack: false }
  })

  useEffect(() => {
    if (initial) return
    const now = new Date()
    const current = { year: now.getFullYear(), month: now.getMonth() + 1, fellBack: false }
    fetchJson<{ transactions: Array<{ fechaInicio: string }> }>('/api/transactions?page=1&limit=1')
      .then(({ transactions }) => {
        const latest = transactions[0] ? parseDateParts(String(transactions[0].fechaInicio)) : null
        const behind = latest && latest.year * 12 + latest.month < current.year * 12 + current.month
        setInitial(behind ? { year: latest.year, month: latest.month, fellBack: true } : current)
      })
      .catch(() => setInitial(current))
  }, [initial])

  return initial
}
