import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user;

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch profile" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, profile });
  } catch (error: any) {
    console.error("Profile fetch error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch profile" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user;

    // Use service role key to bypass RLS and perform database writes
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await adminSupabase
      .from("profiles")
      .update({ is_pro: true })
      .eq("id", user.id);

    if (error) {
      console.warn("⚠️ Database error updating is_pro (column might be missing):", error.message);
      // Return success with warning to allow frontend fallback to continue smoothly
      return NextResponse.json({ 
        success: true, 
        warning: "Database column is_pro missing. Falling back to local storage state." 
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Profile upgrade error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to upgrade profile" },
      { status: 500 }
    );
  }
}
