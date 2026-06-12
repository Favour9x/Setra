import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockExecutePayment } = vi.hoisted(() => ({
  mockExecutePayment: vi.fn(),
}));

vi.mock("@/lib/agents/circle-agent", () => ({
  PaymentExecutorAgent: vi.fn().mockImplementation(function () {
    return { executePayment: mockExecutePayment };
  }),
}));

import { routePayment } from "../payment-router";

describe("routePayment", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockExecutePayment.mockReset();
  });

  it("routes payment through onchain", async () => {
    mockExecutePayment.mockResolvedValue({
      success: true,
      transactionId: "tx-onchain-1",
    });

    const result = await routePayment("user-1", "wallet-1", "0xrecipient", 0.5, "test payment");

    expect(mockExecutePayment).toHaveBeenCalledWith("wallet-1", "0xrecipient", 0.5, "test payment");
    expect(result.success).toBe(true);
    expect(result.method).toBe("onchain");
    expect(result.transactionId).toBe("tx-onchain-1");
  });

  it("propagates onchain execution failure", async () => {
    mockExecutePayment.mockResolvedValue({
      success: false,
      transactionId: undefined,
      error: "Insufficient funds",
    });

    const result = await routePayment("user-1", "wallet-1", "0xrecipient", 100);

    expect(result.success).toBe(false);
    expect(result.method).toBe("onchain");
    expect(result.error).toBe("Insufficient funds");
  });
});
