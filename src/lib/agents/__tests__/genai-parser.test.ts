import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGenerateContent } = vi.hoisted(() => ({
  mockGenerateContent: vi.fn(),
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn().mockImplementation(function () {
    return { models: { generateContent: mockGenerateContent } };
  }),
}));

vi.mock("@/lib/resolve-username", () => ({
  resolveRecipientAddress: vi.fn((addr: string) => Promise.resolve(addr)),
}));

vi.mock("@/lib/services/intent-workflow-db", () => ({
  saveIntentWorkflow: vi.fn((_userId: string, data: any) =>
    Promise.resolve({ id: "wf-1", ...data })
  ),
}));

const { mockGroqChatCreate } = vi.hoisted(() => ({
  mockGroqChatCreate: vi.fn(),
}));

vi.mock("groq-sdk", () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      chat: {
        completions: {
          create: mockGroqChatCreate,
        },
      },
    };
  }),
}));

import { parseWithGenAI, parseWithGroq } from "../genai-parser";

describe("parseWithGenAI", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.GOOGLE_API_KEY;
    delete process.env.GEMINI_API_KEY;
  });

  it("returns null when no API key is set", async () => {
    const result = await parseWithGenAI("user-1", "send $5 to @alice");
    expect(result).toBeNull();
  });

  it("returns null when API key is empty string", async () => {
    process.env.GOOGLE_API_KEY = "";
    const result = await parseWithGenAI("user-1", "send $5 to @alice");
    expect(result).toBeNull();
  });

  it("returns parsed result when Gemini succeeds", async () => {
    process.env.GOOGLE_API_KEY = "test-key";

    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        workflow_type: "scheduled_payment",
        name: "Send $5 to Alice",
        config: {
          amount: 5,
          recipient_address: "0x123",
          recipient_name: "Alice",
          percentage: null,
          token: "USDC",
          splits: [],
          schedule: {
            frequency: "one_time",
            next_execution_at: "2026-06-01T00:00:00Z",
          },
          trigger: null,
          description: "Send $5 USDC to Alice",
        },
        confidence: 0.95,
        plain_english: "Send $5 USDC to Alice",
      }),
    });

    const result = await parseWithGenAI("user-1", "send $5 to @alice");
    expect(result).not.toBeNull();
    expect(result!.success).toBe(true);
    expect(result!.actionTaken).toBe("create_payroll_workflow");
    expect(result!.message).toContain("Send $5 USDC to Alice");
    expect(result!.data).toBeDefined();
    expect(result!.data!.workflow_type).toBe("scheduled_payment");
  });

  it("returns null when Gemini returns invalid JSON", async () => {
    process.env.GOOGLE_API_KEY = "test-key";

    mockGenerateContent.mockResolvedValue({
      text: "not valid json at all",
    });

    const result = await parseWithGenAI("user-1", "send $5 to @alice");
    expect(result).toBeNull();
  });

  it("returns null when Gemini response has zero confidence", async () => {
    process.env.GOOGLE_API_KEY = "test-key";

    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        workflow_type: "custom_intent",
        name: "",
        config: { description: "" },
        confidence: 0,
        plain_english: "",
      }),
    });

    const result = await parseWithGenAI("user-1", "send $5 to @alice");
    expect(result).toBeNull();
  });

  it("returns null when Gemini throws", async () => {
    process.env.GOOGLE_API_KEY = "test-key";

    mockGenerateContent.mockRejectedValue(new Error("API error"));

    const result = await parseWithGenAI("user-1", "send $5 to @alice");
    expect(result).toBeNull();
  });
});

describe("parseWithGroq", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.GROQ_API_KEY;
  });

  it("returns null when no API key is set", async () => {
    const result = await parseWithGroq("user-1", "send $5 to @alice");
    expect(result).toBeNull();
  });

  it("returns parsed result when Groq succeeds", async () => {
    process.env.GROQ_API_KEY = "test-key";

    mockGroqChatCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              workflow_type: "scheduled_payment",
              name: "Send $5 to Alice",
              config: {
                amount: 5,
                recipient_address: "0x123",
                recipient_name: "Alice",
                percentage: null,
                token: "USDC",
                splits: [],
                schedule: {
                  frequency: "one_time",
                  next_execution_at: "2026-06-01T00:00:00Z",
                },
                trigger: null,
                description: "Send $5 USDC to Alice",
              },
              confidence: 0.95,
              plain_english: "Send $5 USDC to Alice",
            }),
          },
        },
      ],
    });

    const result = await parseWithGroq("user-1", "send $5 to @alice");
    expect(result).not.toBeNull();
    expect(result!.success).toBe(true);
    expect(result!.actionTaken).toBe("create_payroll_workflow");
    expect(result!.message).toContain("Send $5 USDC to Alice");
  });

  it("returns null when Groq returns empty content", async () => {
    process.env.GROQ_API_KEY = "test-key";

    mockGroqChatCreate.mockResolvedValue({
      choices: [{ message: { content: "" } }],
    });

    const result = await parseWithGroq("user-1", "send $5 to @alice");
    expect(result).toBeNull();
  });

  it("returns null when Groq returns invalid JSON", async () => {
    process.env.GROQ_API_KEY = "test-key";

    mockGroqChatCreate.mockResolvedValue({
      choices: [{ message: { content: "not valid json" } }],
    });

    const result = await parseWithGroq("user-1", "send $5 to @alice");
    expect(result).toBeNull();
  });

  it("returns null when Groq throws", async () => {
    process.env.GROQ_API_KEY = "test-key";

    mockGroqChatCreate.mockRejectedValue(new Error("API error"));

    const result = await parseWithGroq("user-1", "send $5 to @alice");
    expect(result).toBeNull();
  });
});
