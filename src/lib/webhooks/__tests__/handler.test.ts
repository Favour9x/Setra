import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCreateNotification } = vi.hoisted(() => ({
  mockCreateNotification: vi.fn(),
}));

vi.mock("@/lib/services/notification", () => ({
  createNotification: mockCreateNotification,
}));

const baseChain = Promise.resolve({ data: null, error: null });

function makeChain(): any {
  const chain = {
    from: vi.fn(() => chain),
    select: vi.fn(() => chain),
    filter: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    order: vi.fn(() => chain),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    then: baseChain.then.bind(baseChain),
    catch: baseChain.catch.bind(baseChain),
    finally: baseChain.finally.bind(baseChain),
    [Symbol.toStringTag]: "Promise",
  };
  return chain;
}

let db: { from: ReturnType<typeof vi.fn>; _chain: any };

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => db),
}));

import { handleCircleWebhook } from "../handler";

function makePayload(
  notificationOverrides: Record<string, any> = {},
  payloadOverrides: Record<string, any> = {}
): any {
  return {
    subscriptionId: "sub-1",
    notificationId: "notif-1",
    notificationType: "transactions.inbound",
    notification: {
      id: "circle-tx-123",
      state: "COMPLETED",
      amounts: ["50.00"],
      blockchain: "ARC-TESTNET",
      createDate: "2026-05-28T00:00:00Z",
      destinationAddress: "0xdest",
      sourceAddress: "0xsource",
      transactionHash: "0xhash123",
      walletId: "wallet-1",
      tokenId: "token-usdc",
      ...notificationOverrides,
    },
    timestamp: "2026-05-28T00:00:00Z",
    version: 1,
    ...payloadOverrides,
  };
}

function createDb() {
  const chain = makeChain();
  return { from: vi.fn(() => chain), _chain: chain };
}

describe("handleCircleWebhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
    db = createDb();
  });

  describe("state filtering", () => {
    it("skips PENDING state", async () => {
      const payload = makePayload({ state: "PENDING", id: "tx-1", amounts: [], transactionHash: undefined });
      await handleCircleWebhook(payload);
      expect(db.from).not.toHaveBeenCalled();
    });

    it("skips ACTION_REQUIRED state", async () => {
      const payload = makePayload({ state: "ACTION_REQUIRED", id: "tx-1", amounts: [], transactionHash: undefined });
      await handleCircleWebhook(payload);
      expect(db.from).not.toHaveBeenCalled();
    });
  });

  describe("outbound transactions", () => {
    it("updates pending transaction and sends payment_sent notification on COMPLETED", async () => {
      const payload = makePayload(
        {
          id: "circle-tx-1",
          state: "COMPLETED",
          amounts: ["25.00"],
          destinationAddress: "0xdest",
          transactionHash: "0xhash-out",
          walletId: "wallet-1",
        },
        { notificationType: "transactions.outbound" }
      );

      const local = createDb();
      local._chain.maybeSingle = vi.fn().mockResolvedValue({
        data: { id: "db-tx-1", user_id: "user-1", status: "processing", metadata: { transactionId: "circle-tx-1" } },
        error: null,
      });
      db = local;

      await handleCircleWebhook(payload);

      expect(mockCreateNotification).toHaveBeenCalledTimes(1);
      expect(mockCreateNotification.mock.calls[0][0]).toBe("user-1");
      expect(mockCreateNotification.mock.calls[0][1]).toBe("payment_sent");
      expect(mockCreateNotification.mock.calls[0][3]).toContain("25");
    });

    it("marks as failed on FAILED state without notification", async () => {
      const payload = makePayload(
        {
          id: "circle-tx-2",
          state: "FAILED",
          amounts: ["25.00"],
          destinationAddress: "0xdest",
          transactionHash: "0xhash-fail",
        },
        { notificationType: "transactions.outbound" }
      );

      const local = createDb();
      local._chain.maybeSingle = vi.fn().mockResolvedValue({
        data: { id: "db-tx-2", user_id: "user-2", status: "processing", metadata: { transactionId: "circle-tx-2" } },
        error: null,
      });
      db = local;

      await handleCircleWebhook(payload);
      expect(mockCreateNotification).not.toHaveBeenCalled();
    });

    it("recovers missing transaction by walletId", async () => {
      const payload = makePayload(
        {
          id: "circle-tx-recover",
          state: "COMPLETED",
          amounts: ["10.00"],
          destinationAddress: "0xdest",
          walletId: "wallet-1",
          transactionHash: "0xhash-recover",
        },
        { notificationType: "transactions.outbound" }
      );

      const local = createDb();
      local._chain.maybeSingle = vi
        .fn()
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: { id: "user-recover" }, error: null });
      db = local;

      await handleCircleWebhook(payload);

      expect(local._chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: "user-recover",
          amount: 10,
          type: "expense",
          status: "confirmed",
        })
      );
    });

    it("skips when no pending transaction found and no walletId to recover", async () => {
      const payload = makePayload(
        {
          id: "circle-tx-3",
          state: "COMPLETED",
          amounts: ["10.00"],
          destinationAddress: "0xdest",
          walletId: undefined,
        },
        { notificationType: "transactions.outbound" }
      );

      const local = createDb();
      local._chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      db = local;

      await handleCircleWebhook(payload);
      expect(mockCreateNotification).not.toHaveBeenCalled();
    });
  });

  describe("inbound transactions", () => {
    it("skips inbound without txHash", async () => {
      const payload = makePayload({
        id: "circle-tx-4",
        state: "COMPLETED",
        amounts: ["50.00"],
        transactionHash: undefined,
      });

      await handleCircleWebhook(payload);
      expect(db.from).not.toHaveBeenCalled();
    });

    it("skips already-recorded transaction by tx_hash", async () => {
      const payload = makePayload({
        id: "circle-tx-5",
        state: "COMPLETED",
        amounts: ["50.00"],
        transactionHash: "0xexisting",
      });

      const local = createDb();
      local._chain.maybeSingle = vi.fn().mockResolvedValue({ data: { id: "existing-tx" }, error: null });
      db = local;

      await handleCircleWebhook(payload);
      expect(mockCreateNotification).not.toHaveBeenCalled();
    });

    it("skips non-complete inbound", async () => {
      const payload = makePayload({
        id: "circle-tx-6",
        state: "PENDING",
        amounts: ["50.00"],
        transactionHash: "0xhash6",
      });

      const local = createDb();
      local._chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      db = local;

      await handleCircleWebhook(payload);
      expect(mockCreateNotification).not.toHaveBeenCalled();
    });

    it("skips inbound to non-Setra destination", async () => {
      const payload = makePayload({
        id: "circle-tx-7",
        state: "COMPLETED",
        amounts: ["50.00"],
        transactionHash: "0xhash7",
        destinationAddress: "0xunknown",
      });

      const local = createDb();
      local._chain.maybeSingle = vi
        .fn()
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: null, error: null });
      db = local;

      await handleCircleWebhook(payload);
      expect(mockCreateNotification).not.toHaveBeenCalled();
    });

    it("creates transaction and sends payment_received notification for valid inbound", async () => {
      const payload = makePayload({
        id: "circle-tx-8",
        state: "COMPLETED",
        amounts: ["100.00"],
        transactionHash: "0xhash8",
        destinationAddress: "0xdest-user",
        sourceAddress: "0xsource-user",
        walletId: "wallet-1",
      });

      const local = createDb();
      local._chain.maybeSingle = vi
        .fn()
        .mockResolvedValueOnce({ data: null, error: null })
        .mockResolvedValueOnce({ data: { id: "user-42", username: "alice" }, error: null })
        .mockResolvedValueOnce({ data: { id: "user-42" }, error: null });
      db = local;

      await handleCircleWebhook(payload);

      expect(local._chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: "user-42", amount: 100 })
      );
      expect(mockCreateNotification).toHaveBeenCalledWith(
        "user-42",
        "payment_received",
        "Payment Received",
        expect.any(String),
        expect.any(Object)
      );
    });
  });
});
