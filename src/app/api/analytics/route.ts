import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase-server";
import { fetchInvoices } from "@/lib/services/invoice";
import { fetchSubscriptions } from "@/lib/services/subscription";
import { fetchTipsAnalytics } from "@/lib/services/tips";

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

    // 1. Fetch transactions
    let transactions: any[] = [];
    try {
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id);
      
      if (!error && data) {
        transactions = data;
      }
    } catch (e) {
      console.warn("⚠️ Failed to load transactions for analytics from DB, using fallback");
    }

    // 2. Fetch invoices
    const invoices = await fetchInvoices(user.id, supabase);

    // 3. Fetch subscriptions
    const subscriptions = await fetchSubscriptions(user.id, supabase);

    // 4. Fetch tips analytics
    const tipsAnalytics = await fetchTipsAnalytics(user.id);

    // 5. Calculate core financial metrics
    const totalVolume = transactions.reduce((acc, tx) => acc + Number(tx.amount || 0), 0);
    const invoicesPaid = invoices.filter(inv => inv.status === "paid").length;
    const activeSubs = subscriptions.filter(sub => sub.status === "active");
    const activeSubscriptions = activeSubs.length;
    
    // Monthly Recurring Revenue: sum of amounts from active subscriptions in Supabase
    const recurringRevenue = activeSubs.reduce((acc, sub) => acc + Number(sub.amount || 0), 0);

    // Income vs Expense breakdown: sum transactions by type
    const incomeSum = transactions
      .filter(tx => tx.type === "income" || tx.type === "received")
      .reduce((acc, tx) => acc + Number(tx.amount || 0), 0);
    const expenseSum = transactions
      .filter(tx => tx.type === "expense" || tx.type === "sent")
      .reduce((acc, tx) => acc + Number(tx.amount || 0), 0);

    // 6. Generate Payment Activity Graph (Recharts data)
    // Group transactions by date
    const dateMap: { [key: string]: { income: number; expense: number } } = {};
    
    // Seed last 7 days to ensure graph always has data structure
    for (let i = 6; i >= 0; i--) {
      const dateStr = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toLocaleDateString([], { month: "short", day: "numeric" });
      dateMap[dateStr] = { income: 0, expense: 0 };
    }

    transactions.forEach(tx => {
      const dateStr = new Date(tx.created_at || tx.timestamp).toLocaleDateString([], { month: "short", day: "numeric" });
      if (dateMap[dateStr] === undefined) {
        dateMap[dateStr] = { income: 0, expense: 0 };
      }
      if (tx.type === "income" || tx.type === "received") {
        dateMap[dateStr].income += Number(tx.amount || 0);
      } else if (tx.type === "expense" || tx.type === "sent") {
        dateMap[dateStr].expense += Number(tx.amount || 0);
      }
    });

    const graphData = Object.keys(dateMap).map(key => ({
      name: key,
      income: dateMap[key].income,
      expense: dateMap[key].expense
    }));

    return NextResponse.json({
      success: true,
      metrics: {
        totalVolume,
        invoicesPaid,
        activeSubscriptions,
        recurringRevenue,
        totalInvoices: invoices.length,
        totalSubscriptions: subscriptions.length,
        incomeSum,
        expenseSum,
        tipsThisWeek: tipsAnalytics.thisWeekTotal,
        tipsLastWeek: tipsAnalytics.lastWeekTotal,
        bestTipper: tipsAnalytics.bestTipper,
        bestDay: tipsAnalytics.bestDay,
      },
      graphData
    });
  } catch (error: any) {
    console.error("Fetch analytics API error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch analytics" }, { status: 500 });
  }
}
