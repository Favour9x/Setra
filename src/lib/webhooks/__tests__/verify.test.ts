import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import crypto from "crypto";

const mockFetch = vi.fn();
const originalFetch = globalThis.fetch;

import { verifyCircleSignature } from "../verify";

describe("verifyCircleSignature", () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", {
    namedCurve: "P-256",
  });
  const publicKeyPem = publicKey.export({ type: "spki", format: "pem" });
  const keyId = "test-key-id-1";

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.CIRCLE_API_KEY = "test-circle-api-key";
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  async function createTestSignature(body: string): Promise<string> {
    const signer = crypto.createSign("SHA256");
    signer.update(body, "utf8");
    signer.end();
    return signer.sign(privateKey, "base64");
  }

  it("returns true for a valid signature", async () => {
    globalThis.fetch = mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { publicKey: publicKeyPem } }),
    });

    const body = JSON.stringify({ notificationType: "transactions.inbound" });
    const signature = await createTestSignature(body);

    const result = await verifyCircleSignature(body, signature, keyId);
    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      `https://api.circle.com/v2/notifications/publicKey/${keyId}`,
      expect.objectContaining({
        headers: { Authorization: "Bearer test-circle-api-key" },
      })
    );
  });

  it("returns false for an invalid signature", async () => {
    globalThis.fetch = mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { publicKey: publicKeyPem } }),
    });

    const body = JSON.stringify({ notificationType: "transactions.inbound" });
    const result = await verifyCircleSignature(body, "aW52YWxpZFNpZ25hdHVyZQ==", keyId);
    expect(result).toBe(false);
  });

  it("returns false when Circle API returns non-ok", async () => {
    globalThis.fetch = mockFetch.mockResolvedValue({
      ok: false,
      text: () => Promise.resolve("Not found"),
    });

    const result = await verifyCircleSignature("{}", "dGVzdA==", keyId);
    expect(result).toBe(false);
  });

  it("returns false when Circle API returns no publicKey", async () => {
    globalThis.fetch = mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: {} }),
    });

    const result = await verifyCircleSignature("{}", "dGVzdA==", keyId);
    expect(result).toBe(false);
  });

  it("returns false when fetch throws an error", async () => {
    globalThis.fetch = mockFetch.mockRejectedValue(new Error("Network error"));

    const result = await verifyCircleSignature("{}", "dGVzdA==", keyId);
    expect(result).toBe(false);
  });
});
