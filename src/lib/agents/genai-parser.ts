import { resolveRecipientAddress } from "../resolve-username";
import { saveIntentWorkflow } from "../services/intent-workflow-db";
import type { AgentActionResult } from "./index";

const SYSTEM_PROMPT = `You are a financial intent parser for Setra, a USDC payment platform. You MUST respond with ONLY valid JSON. Do not include markdown code blocks, backticks, or any text outside the JSON object.

Given a natural language user prompt, extract the structured intent for an automated workflow.
Given a natural language user prompt, extract the structured intent for an automated workflow.

Rules:
- Amounts are always in USDC unless specified otherwise.
- @username refers to a Setra user (resolve via internal lookup).
- 0x... addresses are blockchain wallet addresses.
- Percentages are for revenue splitting.
- Dates can be relative ("next Friday", "every month") or absolute ("May 19th 2026 at 5PM").

Return ONLY valid JSON with this exact shape:
{
  "workflow_type": "split_revenue" | "savings_sweep" | "threshold_transfer" | "auto_invoice_pay" | "scheduled_payment" | "recurring_payment" | "custom_intent",
  "name": "concise human-readable name",
  "config": {
    "amount": number | null,
    "recipient_address": string | null,
    "recipient_name": string | null,
    "percentage": number | null,
    "token": "USDC",
    "splits": [{"address": string, "percentage": number, "name": string}],
    "schedule": {"frequency": "one_time" | "daily" | "weekly" | "monthly", "next_execution_at": string (ISO 8601)} | null,
    "trigger": {"trigger_type": string, "conditions": object} | null,
    "description": "plain English explanation"
  },
  "confidence": 0.0 to 1.0,
  "plain_english": "simple sentence explaining what this workflow does"
}

If the intent cannot be parsed, return {"workflow_type": "custom_intent", "name": "", "config": {"description": ""}, "confidence": 0, "plain_english": ""}`;

export async function parseWithGenAI(
  userId: string,
  prompt: string
): Promise<AgentActionResult | null> {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const { GoogleGenAI } = await import("@google/genai");

    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: [
        { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
        { role: "user", parts: [{ text: `Parse this intent: ${prompt}` }] },
      ],
    });

    const text = String((response as any).text || "");
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.workflow_type || parsed.confidence === 0) {
      return null;
    }

    const config = parsed.config || {};
    const resolvedAddress = config.recipient_address
      ? await resolveRecipientAddress(config.recipient_address).catch(() => config.recipient_address)
      : null;

    const splits = config.splits || [];
    const resolvedSplits = await Promise.all(
      splits.map(async (s: any) => ({
        ...s,
        address: await resolveRecipientAddress(s.address).catch(() => s.address),
      }))
    );

    const workflow = await saveIntentWorkflow(userId, {
      name: parsed.name || `AI: ${prompt.slice(0, 50)}`,
      intent_prompt: prompt,
      workflow_type: parsed.workflow_type,
      config: {
        ...config,
        amount: config.amount || null,
        recipient_address: resolvedAddress || config.recipient_address,
        splits: resolvedSplits.length > 0 ? resolvedSplits : undefined,
        description: config.description || parsed.plain_english || prompt,
      },
    });

    return {
      success: true,
      actionTaken:
        parsed.workflow_type === "split_revenue" || parsed.workflow_type === "savings_sweep"
          ? "create_split_workflow"
          : "create_payroll_workflow",
      message: `✅ AI parsed intent: ${parsed.plain_english || parsed.name}`,
      data: workflow,
    };
  } catch (err) {
    console.error("GenAI parsing failed, will fall back to regex:", err);
    return null;
  }
}

export async function parseWithGroq(
  userId: string,
  prompt: string
): Promise<AgentActionResult | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  try {
    const { default: Groq } = await import("groq-sdk");
    const groq = new Groq({ apiKey });

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Parse this intent: ${prompt}` },
      ],
    });

    const text = response.choices?.[0]?.message?.content || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.workflow_type || parsed.confidence === 0) {
      return null;
    }

    const config = parsed.config || {};
    const resolvedAddress = config.recipient_address
      ? await resolveRecipientAddress(config.recipient_address).catch(() => config.recipient_address)
      : null;

    const splits = config.splits || [];
    const resolvedSplits = await Promise.all(
      splits.map(async (s: any) => ({
        ...s,
        address: await resolveRecipientAddress(s.address).catch(() => s.address),
      }))
    );

    const workflow = await saveIntentWorkflow(userId, {
      name: parsed.name || `AI: ${prompt.slice(0, 50)}`,
      intent_prompt: prompt,
      workflow_type: parsed.workflow_type,
      config: {
        ...config,
        amount: config.amount || null,
        recipient_address: resolvedAddress || config.recipient_address,
        splits: resolvedSplits.length > 0 ? resolvedSplits : undefined,
        description: config.description || parsed.plain_english || prompt,
      },
    });

    return {
      success: true,
      actionTaken:
        parsed.workflow_type === "split_revenue" || parsed.workflow_type === "savings_sweep"
          ? "create_split_workflow"
          : "create_payroll_workflow",
      message: `✅ Groq parsed intent: ${parsed.plain_english || parsed.name}`,
      data: workflow,
    };
  } catch (err) {
    console.error("Groq parsing failed, will fall back to regex:", err);
    return null;
  }
}
