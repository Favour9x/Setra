import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase-server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("beneficiaries")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ success: true, beneficiaries: data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { recipient_tag, recipient_address, recipient_avatar } = body;

    if (!recipient_address) {
      return NextResponse.json({ success: false, error: "recipient_address is required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("beneficiaries")
      .insert({
        user_id: user.id,
        recipient_tag,
        recipient_address,
        recipient_avatar,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, beneficiary: data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
