import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseSearchParams, withApiErrors } from '@/lib/api'
import { getMonthSummaries } from '@/lib/budget-data'

const querySchema = z.object({ year: z.coerce.number().int().min(1900).max(9999) })

/** GET /api/reports/year?year=YYYY — budgeted vs actual totals for each month. */
export const GET = withApiErrors(async (request: NextRequest) => {
  const { year } = parseSearchParams(request, querySchema)
  const summaries = await getMonthSummaries(year, 1, 12)

  return NextResponse.json({
    year,
    months: summaries.map(s => ({
      month: s.month,
      budgeted: s.totals.budgeted,
      actual: s.totals.actual,
    })),
  })
})
