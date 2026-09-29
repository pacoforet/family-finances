import { NextRequest, NextResponse } from 'next/server'
import type { z } from 'zod'

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

function describeIssues(error: z.ZodError): string {
  const issue = error.issues[0]
  const path = issue?.path.join('.')
  return path ? `${path}: ${issue.message}` : issue?.message ?? 'Invalid request.'
}

/** Parses and validates a JSON body, throwing a 400 HttpError when it does not match. */
export async function parseJsonBody<T extends z.ZodType>(request: NextRequest, schema: T): Promise<z.output<T>> {
  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    throw new HttpError(400, 'Request body must be valid JSON.')
  }
  const result = schema.safeParse(raw)
  if (!result.success) throw new HttpError(400, describeIssues(result.error))
  return result.data
}

/** Validates query-string parameters (missing ones arrive as undefined). */
export function parseSearchParams<T extends z.ZodType>(request: NextRequest, schema: T): z.output<T> {
  const params = Object.fromEntries(request.nextUrl.searchParams.entries())
  const result = schema.safeParse(params)
  if (!result.success) throw new HttpError(400, describeIssues(result.error))
  return result.data
}

function postgresErrorCode(error: unknown): string | undefined {
  // Drizzle wraps driver errors; the Postgres error sits in `cause`.
  const candidates = [error, (error as { cause?: unknown })?.cause]
  for (const candidate of candidates) {
    const code = (candidate as { code?: unknown })?.code
    if (typeof code === 'string') return code
  }
  return undefined
}

/**
 * Wraps a route handler so validation failures and common database
 * constraint errors become proper 4xx responses instead of generic 500s.
 */
export function withApiErrors<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    try {
      return await handler(...args)
    } catch (error) {
      if (error instanceof HttpError) {
        return NextResponse.json({ error: error.message }, { status: error.status })
      }
      switch (postgresErrorCode(error)) {
        case '23503': // foreign_key_violation
          return NextResponse.json({ error: 'A referenced record does not exist.' }, { status: 400 })
        case '23505': // unique_violation
          return NextResponse.json({ error: 'A record with these values already exists.' }, { status: 409 })
      }
      console.error(error)
      return NextResponse.json({ error: 'Internal server error.' }, { status: 500 })
    }
  }
}
