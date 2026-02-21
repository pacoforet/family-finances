import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { pin } = await request.json()
  const expected = process.env.APP_PIN

  if (!expected || pin === expected) {
    const response = NextResponse.json({ success: true })
    if (expected) {
      response.cookies.set('auth', pin, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: '/',
      })
    }
    return response
  }

  return NextResponse.json({ error: 'PIN incorrecto' }, { status: 401 })
}
