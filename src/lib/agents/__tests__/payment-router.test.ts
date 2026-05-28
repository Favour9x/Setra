import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockExecutePayment, mockWithdrawFromGateway, mockGetGatewayBalances } = vi.hoisted(() => ({
  mockExecutePayment: vi.fn(),
  mockWithdrawFromGateway: vi.fn(),
  mockGetGatewayBalances: vi.fn(),
}));

vi.mock("@/lib/agents/circle-agent", () => ({
  PaymentExecutorAgent: vi.fn().mockImplementation(function () {
    return { executePayment: mockExecutePayment };
  }),
}));

vi.mock("@/lib/gateway/client", () => ({
  withdrawFromGateway: mockWithdrawFromGateway,
  getGatewayBalances: mockGetGatewayBalances,
}));

import { routePayment } from "../payment-router";

describe("routePayment", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockExecutePayment.mockReset();
    mockWithdrawFromGateway.mockReset();
    mockGetGatewayBalances.mockReset();
  });

  it("routes sub-$1 amounts through Gateway when balance sufficient", async () => {
    mockGetGatewayBalances.mockResolvedValue({ gatewayAvailable: "2.5" });
    mockWithdrawFromGateway.mockResolvedValue({ mintTxHash: "0x-gateway-tx" });

    const result = await routePayment("user-1", "wallet-1", "0xrecipient", 0.5, "test nanopayment");

    expect(mockGetGatewayBalances).toHaveBeenCalled();
    expect(mockWithdrawFromGateway).toHaveBeenCalledWith("0.5", { recipient: "0xrecipient" });
    expect(mockExecutePayment).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.method).toBe("gateway");
    expect(result.txHash).toBe("0x-gateway-tx");
  });

  it("falls back to onchain when Gateway balance insufficient", async () => {
    mockGetGatewayBalances.mockResolvedValue({ gatewayAvailable: "0.1" });
    mockExecutePayment.mockResolvedValue({
      success: true,
      transactionId: "tx-onchain-1",
    });

    const result = await routePayment("user-1", "wallet-1", "0xrecipient", 0.5, "test fallback");

    expect(mockGetGatewayBalances).toHaveBeenCalled();
    expect(mockWithdrawFromGateway).not.toHaveBeenCalled();
    expect(mockExecutePayment).toHaveBeenCalledWith("wallet-1", "0xrecipient", 0.5, "test fallback");
    expect(result.success).toBe(true);
    expect(result.method).toBe("onchain");
    expect(result.transactionId).toBe("tx-onchain-1");
  });

  it("falls back to onchain when Gateway throws", async () => {
    mockGetGatewayBalances.mockRejectedValue(new Error("Gateway unavailable"));
    mockExecutePayment.mockResolvedValue({
      success: true,
      transactionId: "tx-onchain-2",
    });

    const result = await routePayment("user-1", "wallet-1", "0xrecipient", 0.5);

    expect(mockGetGatewayBalances).toHaveBeenCalled();
    expect(mockWithdrawFromGateway).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.method).toBe("onchain");
  });

  it("routes $1+ amounts directly through onchain", async () => {
    mockExecutePayment.mockResolvedValue({
      success: true,
      transactionId: "tx-onchain-3",
    });

    const result = await routePayment("user-1", "wallet-1", "0xrecipient", 5);

    expect(mockGetGatewayBalances).not.toHaveBeenCalled();
    expect(mockWithdrawFromGateway).not.toHaveBeenCalled();
    expect(mockExecutePayment).toHaveBeenCalledWith("wallet-1", "0xrecipient", 5, "Routed Payment");
    expect(result.success).toBe(true);
    expect(result.method).toBe("onchain");
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
