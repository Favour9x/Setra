import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Track cookies set during getUser() refresh so they survive redirects
  const pendingCookies: Array<{ name: string; value: string; options: CookieOptions }> = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          pendingCookies.push({ name, value, options })
          supabaseResponse = NextResponse.next({
            request: { headers: request.headers },
          })
          supabaseResponse.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          pendingCookies.push({ name, value: '', options })
          supabaseResponse = NextResponse.next({
            request: { headers: request.headers },
          })
          supabaseResponse.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  let user = null;
  let username = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data?.user ?? null;

    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .maybeSingle();

      username = profile?.username ?? null;
    }
  } catch (err) {
    console.error("Middleware auth retrieval failed:", err);
  }

  const isPublicPage = request.nextUrl.pathname.startsWith('/pay/') || request.nextUrl.pathname.startsWith('/diag')
  const isAuthPage = request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/signup')
  const isSetupUsernamePage = request.nextUrl.pathname.startsWith('/setup-username')
  const isApiRoute = request.nextUrl.pathname.startsWith('/api')

  // Helper: create a redirect that carries forward auth cookies set during getUser()
  function redirectTo(path: string): NextResponse {
    const res = NextResponse.redirect(new URL(path, request.url))
    for (const c of pendingCookies) {
      res.cookies.set(c.name, c.value, c.options)
    }
    return res
  }

  if (!user && !isAuthPage && !isPublicPage && !isApiRoute) {
    return redirectTo('/login')
  }

  if (user && isAuthPage) {
    return redirectTo('/')
  }

  if (user && !username && !isSetupUsernamePage && !isAuthPage && !isPublicPage && !isApiRoute) {
    return redirectTo('/setup-username')
  }

  if (user && username && isSetupUsernamePage) {
    return redirectTo('/')
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
