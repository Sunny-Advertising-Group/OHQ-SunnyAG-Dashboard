import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_MAX_MS } from "@/lib/constants";

const PUBLIC_PATHS = ["/login", "/invite"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // getUser() asks the auth server, so a removed user is locked out immediately.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
  const redirect = (to: string, params?: Record<string, string>) => {
    const url = request.nextUrl.clone();
    url.pathname = to;
    url.search = params ? new URLSearchParams(params).toString() : "";
    const res = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => res.cookies.set(c));
    return res;
  };

  // Sessions last 8 hours from sign-in, then the person signs in again.
  // (/invite is exempt: the person is mid-way through setting a password.)
  if (user && !path.startsWith("/invite")) {
    // The token's amr claim records when the person actually authenticated and
    // survives token refreshes; fall back to last_sign_in_at.
    const { data: claims } = await supabase.auth.getClaims();
    const amr = (claims?.claims?.amr ?? []) as { timestamp?: number }[];
    const authAt = Math.max(0, ...amr.map((a) => (a.timestamp ?? 0) * 1000));
    const signedIn = authAt || (user.last_sign_in_at ? Date.parse(user.last_sign_in_at) : 0);
    if (!signedIn || Date.now() - signedIn > SESSION_MAX_MS) {
      await supabase.auth.signOut();
      return redirect("/login", { expired: "1" });
    }
  }

  if (!user && !isPublic) return redirect("/login");
  if (user && path === "/login") return redirect("/");

  // /admin is Sunny only. RLS enforces the same rule on every write; this stops
  // viewers from even loading the pages.
  if (user && path.startsWith("/admin")) {
    const { data: editor } = await supabase.rpc("is_editor");
    if (!editor) return redirect("/");
    if (path.startsWith("/admin/users")) {
      const { data: admin } = await supabase.rpc("is_admin");
      if (!admin) return redirect("/admin");
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
