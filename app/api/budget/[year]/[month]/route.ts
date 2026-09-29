import { NextRequest, NextResponse } from 'next/server'
import { withApiErrors } from '@/lib/api'
import { getMonthSummaries } from '@/lib/budget-data'
import { yearMonthParamsSchema } from '@/lib/validation'

export const GET = withApiErrors(async (
  _request: NextRequest,
  { params }: { params: Promise<{ year: string; month: string }> },
) => {
  const parsed = yearMonthParamsSchema.safeParse(await params)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid year or month.' }, { status: 400 })
  }

  const [summary] = await getMonthSummaries(parsed.data.year, parsed.data.month, 1)
  return NextResponse.json({ summary })
})
