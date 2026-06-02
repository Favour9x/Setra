import { getUSDCBalance } from "@/lib/payments";

interface ThresholdResult {
  evaluated: number;
  triggered: number;
  errors: number;
}

export async function evaluateUserThresholdWorkflows(
  supabase: any,
  userId: string,
  walletId: string
): Promise<ThresholdResult> {
  let evaluated = 0;
  let triggered = 0;
  let errors = 0;

  try {
    const { data: workflows } = await supabase
      .from("automation_workflows")
      .select("*")
      .eq("user_id", userId)
      .eq("workflow_type", "threshold_transfer")
      .eq("active", true)
      .filter("config->trigger->>trigger_type", "eq", "on_balance_threshold");

    if (!workflows?.length) return { evaluated, triggered, errors };

    const balanceStr = await getUSDCBalance(walletId).catch(() => "0");
    const balance = parseFloat(balanceStr);

    for (const wf of workflows) {
      evaluated++;
      try {
        const config = wf.config || {};
        const trigger = config.trigger || {};
        const conditions = trigger.conditions || {};
        const thresholdVal = conditions.threshold_value || config.threshold_value;
        const comparison = conditions.comparison || "greater_than";

        if (!thresholdVal) continue;

        let conditionMet = false;
        if (comparison === "greater_than" && balance >= thresholdVal) conditionMet = true;
        else if (comparison === "less_than" && balance < thresholdVal) conditionMet = true;

        if (conditionMet) {
          const { executeIntentWorkflow } = await import("@/lib/workflows/intent-engine");
          await executeIntentWorkflow(wf, "on_balance_threshold", {
            amount: config.amount,
            currentBalance: balance,
            walletId,
          });
          triggered++;
        }
      } catch (err) {
        errors++;
        console.error(`Threshold workflow ${wf.id} execution failed:`, err);
      }
    }
  } catch (err) {
    console.error("Threshold evaluation failed:", err);
    errors++;
  }

  return { evaluated, triggered, errors };
}

export async function evaluateAllThresholdWorkflows(
  supabase: any
): Promise<ThresholdResult> {
  let total = { evaluated: 0, triggered: 0, errors: 0 };

  try {
    const { data: workflows } = await supabase
      .from("automation_workflows")
      .select("user_id")
      .eq("workflow_type", "threshold_transfer")
      .eq("active", true)
      .filter("config->trigger->>trigger_type", "eq", "on_balance_threshold");

    if (!workflows?.length) return total;

    const uniqueUserIds = [...new Set(workflows.map((w: any) => w.user_id))] as string[];

    for (const userId of uniqueUserIds) {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("wallet_id")
          .eq("id", userId)
          .maybeSingle();

        if (!profile?.wallet_id) continue;

        const result = await evaluateUserThresholdWorkflows(supabase, userId, profile.wallet_id);
        total.evaluated += result.evaluated;
        total.triggered += result.triggered;
        total.errors += result.errors;
      } catch (err) {
        total.errors++;
        console.error(`Threshold evaluation for user ${userId} failed:`, err);
      }
    }
  } catch (err) {
    console.error("Global threshold evaluation failed:", err);
    total.errors++;
  }

  return total;
}
