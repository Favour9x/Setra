import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase-server";
import { fetchInvoices, createInvoice } from "@/lib/services/invoice";
import { resolveRecipientAddress } from "@/lib/resolve-username";
import { createNotification, getUserHandle, supabaseAdmin } from "@/lib/services/notification";
import { sendInvoiceEmail } from "@/lib/services/email";
import { Resend } from "resend";

// 1. GET - Fetch user's invoices
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

    // Auto-expire invoices whose due date has passed
    const now = new Date().toISOString();
    await supabase
      .from("invoices")
      .update({ status: "expired" })
      .in("status", ["pending", "awaiting_confirmation"])
      .lt("due_date", now);

    const invoices = await fetchInvoices(user.id, supabase);
    return NextResponse.json({ success: true, invoices });
  } catch (error: any) {
    console.error("Fetch invoices API error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch invoices" }, { status: 500 });
  }
}

// 2. POST - Create a new invoice
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user;

    const body = await request.json();
    const { title, amount, currency, recipient_address, due_date } = body;
    const requestUserId = body.userId || body.user_id;

    if (requestUserId && requestUserId !== user.id) {
      return NextResponse.json({ error: "Wrong user" }, { status: 403 });
    }

    if (!title || !amount || !recipient_address || !due_date) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    let resolvedRecipientAddress;
    try {
      resolvedRecipientAddress = await resolveRecipientAddress(recipient_address);
    } catch (err: any) {
      return NextResponse.json({ error: err.message || "Recipient not found on Setra" }, { status: 400 });
    }

    const invoice = await createInvoice(user.id, {
      title,
      amount: Number(amount),
      currency: currency || "USDC",
      recipient_address: resolvedRecipientAddress,
      recipient_email: body.recipient_email || null,
      due_date
    }, supabase);

    // 3. Resolve usernames, trigger notifications & deliver email
    let emailStatus: "sent" | "mocked" | "failed" | "pending" = "pending";
    try {
      const { data: senderProfile } = await supabaseAdmin
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .maybeSingle();
      const senderUsername = senderProfile?.username || user.email?.split("@")[0] || "User";
      const senderDisplay = `@${senderUsername}`;

      const { data: recipientProfile } = await supabaseAdmin
        .from("profiles")
        .select("id, email, username")
        .eq("wallet_address", resolvedRecipientAddress)
        .maybeSingle();

      if (recipientProfile) {
        // Option A: Recipient is a registered Setra user
        // 1. Dispatch in-app system notification
        try {
          await createNotification(
            recipientProfile.id,
            "payment_request",
            `New Invoice from ${senderDisplay}`,
            `You have a new invoice for ${amount} USDC from ${senderDisplay}. Due ${new Date(due_date).toLocaleDateString()}`,
            { 
              invoice_id: invoice.id, 
              amount: Number(amount), 
              sender_username: senderUsername, 
              due_date,
              link: `/invoices/${invoice.id}`
            }
          );
        } catch (notifErr) {
          console.error("⚠️ Failed to dispatch in-app notification:", notifErr);
        }
      }

      // Collect recipient email(s)
      const emailsToSend: string[] = [];
      if (body.recipient_email) {
        emailsToSend.push(body.recipient_email);
      }
      if (recipientProfile?.email && !emailsToSend.includes(recipientProfile.email)) {
        emailsToSend.push(recipientProfile.email);
      }

      // Dispatch invoice emails
      for (const email of emailsToSend) {
        try {
          // Use Resend for email delivery
          if (process.env.RESEND_API_KEY) {
            const resend = new Resend(process.env.RESEND_API_KEY);
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
            
            await resend.emails.send({
              from: 'Setra <invoices@setra.app>',
              to: email,
              subject: `New Invoice: ${title} - ${amount} USDC`,
              html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2 style="color: #2563eb;">New invoice from ${senderDisplay}</h2>
                <p><strong>Title:</strong> ${title}</p>
                <p><strong>Amount:</strong> ${amount} USDC</p>
                <p><strong>Due Date:</strong> ${new Date(due_date).toLocaleDateString()}</p>
                <a href="${appUrl}/invoices/${invoice.id}" 
                   style="background:#2563eb; color:white; padding:12px 24px; text-decoration:none; border-radius:6px; display:inline-block; margin-top:16px;">
                  View and Pay Invoice
                </a>
              </div>`
            });
            emailStatus = "sent";
          } else {
            // Fallback to existing email service
            const emailRes = await sendInvoiceEmail(invoice, senderDisplay, email);
            if (emailStatus === "pending" || emailRes.status === "sent") {
              emailStatus = emailRes.status;
            }
          }
        } catch (emailErr) {
          console.error(`⚠️ Failed to send invoice email to ${email}:`, emailErr);
          emailStatus = "failed";
        }
      }

      // Update the email sending status in the database invoice record
      if (emailStatus !== "pending") {
        await supabase
          .from("invoices")
          .update({ email_status: emailStatus })
          .eq("id", invoice.id);
        invoice.email_status = emailStatus;
      }
    } catch (deliveryErr) {
      console.error("⚠️ Invoice delivery system failure:", deliveryErr);
    }

    return NextResponse.json({ success: true, invoice });
  } catch (error: any) {
    console.error("Create invoice API error:", error);
    return NextResponse.json({ error: error.message || "Failed to create invoice" }, { status: 500 });
  }
}
