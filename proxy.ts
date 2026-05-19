import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function getProxySupabaseEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL for admin route proxy.");
  }

  if (!supabaseAnonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_ANON_KEY for admin route proxy."
    );
  }

  return { supabaseUrl, supabaseAnonKey };
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/admin/login") {
    return NextResponse.next();
  }

  const { supabaseUrl, supabaseAnonKey } = getProxySupabaseEnv();
  const response = NextResponse.next();
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headersToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });

        Object.entries(headersToSet).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
      },
    },
  });

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    console.error("[admin-proxy] Failed to read Supabase session.", {
      pathname,
      message: error.message,
      status: error.status,
      name: error.name,
    });
  }

  if (!session) {
    console.info("[admin-proxy] No session found. Redirecting to login.", {
      pathname,
    });

    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("next", pathname);

    return NextResponse.redirect(loginUrl);
  }

  console.info("[admin-proxy] Session found for admin route.", {
    pathname,
    userId: session.user.id,
    email: session.user.email,
  });

  return response;
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
