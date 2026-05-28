import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";
import { checkRateLimit } from "@/lib/rate-limiter";
import { normalizeEmail } from "@/lib/normalize-email";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  const rateLimit = checkRateLimit(ip);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: `Too many login attempts. Try again in ${Math.ceil(rateLimit.resetIn / 1000)} seconds.` },
      { status: 429 }
    );
  }
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }
    const normalizedEmail = normalizeEmail(email);
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json({ user: data.user, session: data.session });
  } catch {
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
