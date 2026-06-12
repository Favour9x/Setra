import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Accumulate ALL cookie mutations so they can be applied atomically
  // to the final response — whether it's a redirect or a passthrough.
  const pendingCookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];

  function applyPendingCookies(res: NextResponse) {
    for (const c of pendingCookies) {
      res.cookies.set(c.name, c.value, c.options)
    }
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            request.cookies.set(name, value)
            pendingCookies.push({ name, value, options })
          }
          // Create ONE response that carries ALL cookies from this batch,
          // instead of creating a new response per cookie (which drops previous ones).
          supabaseResponse = NextResponse.next({
            request: { headers: request.headers },
          })
          applyPendingCookies(supabaseResponse)
        },
      },
    }
  )

  let user = null;
  let username = null;
  let authFailed = false;
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
    authFailed = true;
  }

  const isPublicPage = request.nextUrl.pathname.startsWith('/pay/') || request.nextUrl.pathname.startsWith('/diag')
  const isAuthPage = request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/signup')
  const isSetupUsernamePage = request.nextUrl.pathname.startsWith('/setup-username')
  const isApiRoute = request.nextUrl.pathname.startsWith('/api')

  // If auth API call failed (transient issue) but session cookies exist,
  // skip all middleware redirects and let the request through. The
  // client-side AuthContext/LayoutWrapper will handle auth enforcement.
  // This prevents transient Supabase API failures from causing redirect loops.
  if (!user && authFailed) {
    const hasSessionCookie = request.cookies.getAll().some(c =>
      c.name.startsWith('sb-') || c.name.includes('supabase')
    );
    if (hasSessionCookie) {
      applyPendingCookies(supabaseResponse)
      return supabaseResponse
    }
  }

  function redirectTo(path: string): NextResponse {
    const res = NextResponse.redirect(new URL(path, request.url))
    applyPendingCookies(res)
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

  // Ensure the passthrough response carries the full set of auth cookies
  applyPendingCookies(supabaseResponse)
  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/data (RSC data requests)
     * - _next/image (image optimization files)
     * - favicon.ico, images, sw.js
     */
    '/((?!_next/static|_next/data|_next/image|favicon.ico|sw.js|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
