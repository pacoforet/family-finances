import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { parseJsonBody, withApiErrors } from '@/lib/api'
import { categorizePending } from '@/lib/auto-categorize'
import { isLlmCategorizationEnabled } from '@/lib/llm-categorizer'

const bodySchema = z.object({ llm: z.boolean().default(false) })

/** GET: whether Claude suggestions are available. POST: run auto-categorization on pending transactions. */
export const GET = withApiErrors(async () =>
  NextResponse.json({ llmEnabled: isLlmCategorizationEnabled() }))

export const POST = withApiErrors(async (request: NextRequest) => {
  const { llm } = await parseJsonBody(request, bodySchema)
  const result = await categorizePending({ useLlm: llm })
  return NextResponse.json(result)
})
