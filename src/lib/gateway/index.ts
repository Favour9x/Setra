import { randomBytes } from "node:crypto";
import { BLOCKCHAINS } from "@/lib/circle/client";

export const GATEWAY_API_BASE = "https://gateway-api-testnet.circle.com";
export const GATEWAY_WALLET_ADDRESS = "0x0077777d7EBA4688BDeF3E311b846F25870A19B9";
export const GATEWAY_MINTER_ADDRESS = "0x0022222ABE238Cc2C7Bb1f21003F0a260052475B";

export const CHAIN_DOMAINS: Record<string, number> = {
  "ARC-TESTNET": 26,
  "ETH-SEPOLIA": 0,
  "ARB-SEPOLIA": 3,
  "BASE-SEPOLIA": 6,
  "MATIC-AMOY": 7,
};

export function getDomain(blockchain: string): number {
  const domain = CHAIN_DOMAINS[blockchain];
  if (domain === undefined) throw new Error(`Unsupported blockchain: ${blockchain}`);
  return domain;
}

export function blockchainFromDomain(domain: number): string | undefined {
  return Object.entries(CHAIN_DOMAINS).find(([, d]) => d === domain)?.[0];
}

export function isEVMAddress(address: string): boolean {
  return address.startsWith("0x") && address.length === 42;
}

export function parseBalance(value: string | number | null | undefined): bigint {
  const str = String(value ?? "0");
  const [whole, decimal = ""] = str.split(".");
  const decimal6 = (decimal + "000000").slice(0, 6);
  return BigInt((whole || "0") + decimal6);
}

export function addressToBytes32(address: string): `0x${string}` {
  return ("0x" + address.toLowerCase().replace(/^0x/, "").padStart(64, "0")) as `0x${string}`;
}

export function getUSDCAddress(blockchain: string): string {
  const chain = BLOCKCHAINS.find((c) => c.id === blockchain);
  if (!chain) throw new Error(`Unknown blockchain: ${blockchain}`);
  return chain.usdcAddress;
}

export interface GatewayBalance {
  domain: number;
  chainName: string;
  balance: string;
}

export async function getUnifiedBalances(depositorAddress: string): Promise<GatewayBalance[]> {
  const activeDomains = isEVMAddress(depositorAddress)
    ? Object.values(CHAIN_DOMAINS)
    : [5];

  const body = {
    token: "USDC",
    sources: activeDomains.map((domain) => ({
      domain,
      depositor: depositorAddress,
    })),
  };

  const res = await fetch(`${GATEWAY_API_BASE}/v1/balances`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gateway balances API error: ${res.status} ${text}`);
  }

  const result = await res.json();
  const balances: GatewayBalance[] = (result.balances || []).map((b: any) => ({
    domain: b.domain,
    chainName: blockchainFromDomain(b.domain) || `Domain ${b.domain}`,
    balance: b.balance,
  }));

  return balances;
}

export async function getTotalUnifiedBalance(depositorAddress: string): Promise<number> {
  const balances = await getUnifiedBalances(depositorAddress);
  return balances.reduce((sum, b) => sum + parseFloat(b.balance), 0);
}

export interface GatewayEstimateResult {
  maxFee: string;
  maxBlockHeight: string;
  forwardingFee?: string;
  token: string;
}

export async function estimateTransfer(params: {
  sourceChain: string;
  destChain: string;
  amount: string;
  depositorAddress: string;
  recipientAddress: string;
  enableForwarder?: boolean;
}): Promise<GatewayEstimateResult> {
  const sourceDomain = getDomain(params.sourceChain);
  const destDomain = getDomain(params.destChain);

  const spec = createTransferSpec({
    sourceDomain,
    destDomain,
    sourceChain: params.sourceChain,
    destChain: params.destChain,
    depositorAddress: params.depositorAddress,
    recipientAddress: params.recipientAddress,
    amount: params.amount,
  });

  const qs = params.enableForwarder ? "?enableForwarder=true" : "";
  const res = await fetch(`${GATEWAY_API_BASE}/v1/estimate${qs}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify([{ spec }]),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gateway estimate API error: ${res.status} ${text}`);
  }

  const result = await res.json();
  const estimated = result.body?.[0]?.burnIntent;
  if (!estimated) throw new Error("Missing burnIntent estimate");

  return {
    maxFee: estimated.maxFee,
    maxBlockHeight: estimated.maxBlockHeight,
    forwardingFee: result.fees?.forwardingFee,
    token: result.fees?.token || "USDC",
  };
}

function createTransferSpec(params: {
  sourceDomain: number;
  destDomain: number;
  sourceChain: string;
  destChain: string;
  depositorAddress: string;
  recipientAddress: string;
  amount: string;
}) {
  return {
    version: 1,
    sourceDomain: params.sourceDomain,
    destinationDomain: params.destDomain,
    sourceContract: addressToBytes32(GATEWAY_WALLET_ADDRESS),
    destinationContract: addressToBytes32(GATEWAY_MINTER_ADDRESS),
    sourceToken: addressToBytes32(getUSDCAddress(params.sourceChain)),
    destinationToken: addressToBytes32(getUSDCAddress(params.destChain)),
    sourceDepositor: addressToBytes32(params.depositorAddress),
    destinationRecipient: addressToBytes32(params.recipientAddress),
    sourceSigner: addressToBytes32(params.depositorAddress),
    destinationCaller: addressToBytes32("0x0000000000000000000000000000000000000000"),
    value: parseBalance(params.amount),
    salt: `0x${randomBytes(32).toString("hex")}` as `0x${string}`,
    hookData: "0x" as `0x${string}`,
  };
}

export async function createBurnIntent(params: {
  sourceChain: string;
  destChain: string;
  amount: string;
  depositorAddress: string;
  recipientAddress: string;
  maxFee?: string;
  maxBlockHeight?: string;
}) {
  const sourceDomain = getDomain(params.sourceChain);
  const destDomain = getDomain(params.destChain);

  const spec = createTransferSpec({
    sourceDomain,
    destDomain,
    sourceChain: params.sourceChain,
    destChain: params.destChain,
    depositorAddress: params.depositorAddress,
    recipientAddress: params.recipientAddress,
    amount: params.amount,
  });

  const maxBlockHeight = params.maxBlockHeight || ((1n << 256n) - 1n).toString();
  const maxFee = params.maxFee || "2010000";

  return {
    maxBlockHeight,
    maxFee,
    spec,
  };
}

export function buildTypedData(burnIntent: {
  maxBlockHeight: string;
  maxFee: string;
  spec: any;
}) {
  const EIP712Domain = [
    { name: "name", type: "string" },
    { name: "version", type: "string" },
  ];

  const TransferSpec = [
    { name: "version", type: "uint32" },
    { name: "sourceDomain", type: "uint32" },
    { name: "destinationDomain", type: "uint32" },
    { name: "sourceContract", type: "bytes32" },
    { name: "destinationContract", type: "bytes32" },
    { name: "sourceToken", type: "bytes32" },
    { name: "destinationToken", type: "bytes32" },
    { name: "sourceDepositor", type: "bytes32" },
    { name: "destinationRecipient", type: "bytes32" },
    { name: "sourceSigner", type: "bytes32" },
    { name: "destinationCaller", type: "bytes32" },
    { name: "value", type: "uint256" },
    { name: "salt", type: "bytes32" },
    { name: "hookData", type: "bytes" },
  ];

  const BurnIntent = [
    { name: "maxBlockHeight", type: "uint256" },
    { name: "maxFee", type: "uint256" },
    { name: "spec", type: "TransferSpec" },
  ];

  return {
    types: { EIP712Domain, TransferSpec, BurnIntent },
    domain: { name: "GatewayWallet", version: "1" },
    primaryType: "BurnIntent" as const,
    message: burnIntent,
  };
}

export interface GatewayTransferResult {
  transferId?: string;
  attestation?: string;
  signature?: string;
}

const TERMINAL_STATES = new Set(["COMPLETE", "CONFIRMED", "FAILED", "DENIED", "CANCELLED"]);

export async function waitForTxCompletion(
  client: { getTransaction: (params: { id: string }) => Promise<any> },
  txId: string,
  label: string = "transaction",
  pollInterval: number = 3000
) {
  process.stdout.write(`Waiting for ${label} (txId=${txId})`);

  while (true) {
    const { data } = await client.getTransaction({ id: txId });
    const state = data?.transaction?.state;

    process.stdout.write(".");

    if (state && TERMINAL_STATES.has(state)) {
      process.stdout.write("\n");
      console.log(`${label} final state: ${state}`);

      if (state !== "COMPLETE" && state !== "CONFIRMED") {
        throw new Error(`${label} did not complete successfully (state=${state})`);
      }
      return data.transaction;
    }

    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }
}

export async function submitTransfer(
  requests: Array<{ burnIntent: any; signature: string }>,
  enableForwarder?: boolean
): Promise<GatewayTransferResult> {
  const qs = enableForwarder ? "?enableForwarder=true" : "";
  const res = await fetch(`${GATEWAY_API_BASE}/v1/transfer${qs}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requests),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gateway transfer API error: ${res.status} ${text}`);
  }

  return res.json();
}
