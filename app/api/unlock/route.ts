import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    { error: 'Endpoint deprecated. Use /login with Supabase Auth.' },
    { status: 410 }
  )
}
