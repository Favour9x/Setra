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
     * - _next/data (RSC data requests — middleware redirects here cause
     *   Next.js client router to trigger full page navigations, which
     *   can create redirect loops; client-side LayoutWrapper handles
     *   auth enforcement for client navigations)
     * - _next/image (image optimization files)
     * - favicon.ico, images
     */
    '/((?!_next/static|_next/data|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
