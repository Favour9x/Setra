import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  let user = null;
  let username = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data?.user ?? null;
    
    // Check if user has username set
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

  // Protected routes logic
  const isPublicPage = request.nextUrl.pathname.startsWith('/pay/') || request.nextUrl.pathname.startsWith('/diag')
  const isAuthPage = request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/signup')
  const isSetupUsernamePage = request.nextUrl.pathname.startsWith('/setup-username')
  const isApiRoute = request.nextUrl.pathname.startsWith('/api')
  
  if (!user && !isAuthPage && !isPublicPage && !isApiRoute) {
    // Redirect non-logged in users to login page
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user && isAuthPage) {
    // Redirect logged in users away from auth pages
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Username check - redirect to setup if username is not set
  if (user && !username && !isSetupUsernamePage && !isAuthPage && !isPublicPage && !isApiRoute) {
    return NextResponse.redirect(new URL('/setup-username', request.url))
  }

  // If user has username and is on setup page, redirect to dashboard
  if (user && username && isSetupUsernamePage) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return response
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
