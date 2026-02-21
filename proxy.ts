import { NextRequest, NextResponse } from 'next/server'

export function proxy(request: NextRequest) {
  const pin = process.env.APP_PIN
  if (!pin) return NextResponse.next()

  // Skip unlock page and static assets
  const { pathname } = request.nextUrl
  if (pathname === '/unlock' || pathname.startsWith('/_next') || pathname === '/favicon.ico') {
    return NextResponse.next()
  }

  // Skip API routes for health and unlock
  if (pathname === '/api/health' || pathname === '/api/unlock') return NextResponse.next()

  // Check cookie
  const auth = request.cookies.get('auth')
  if (auth?.value === pin) return NextResponse.next()

  // Redirect to unlock page
  return NextResponse.redirect(new URL('/unlock', request.url))
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
