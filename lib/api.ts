import { NextRequest, NextResponse } from 'next/server'

// Request bodies are untyped JSON; routes validate the fields they use.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type JsonBody = Record<string, any>

/** Parses a JSON object body, or returns null when it is missing or malformed. */
export async function readJsonBody(request: NextRequest): Promise<JsonBody | null> {
  try {
    const body = await request.json()
    return body && typeof body === 'object' && !Array.isArray(body) ? body : null
  } catch {
    return null
  }
}

export function invalidJsonResponse() {
  return NextResponse.json({ error: 'Request body must be a JSON object.' }, { status: 400 })
}

export function isValidYearMonth(year: unknown, month: unknown): year is number {
  return Number.isInteger(year) && Number.isInteger(month)
    && (year as number) >= 1900 && (year as number) <= 9999
    && (month as number) >= 1 && (month as number) <= 12
}
