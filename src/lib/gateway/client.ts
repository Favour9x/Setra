import type { Hex } from "viem";
import type { SupportedChainName } from "@circle-fin/x402-batching/client";

export interface GatewayBalanceInfo {
  walletBalance: string;
  gatewayAvailable: string;
  gatewayTotal: string;
}

let gatewayClientInstance: any = null;

function getGatewayPrivateKey(): Hex | null {
  const pk = process.env.GATEWAY_PRIVATE_KEY || process.env.CIRCLE_AGENT_PRIVATE_KEY || process.env.BRIDGE_PRIVATE_KEY;
  if (!pk) return null;
  return (pk.startsWith("0x") ? pk : `0x${pk}`) as Hex;
}

async function getClient(): Promise<any> {
  if (gatewayClientInstance) return gatewayClientInstance;

  const pk = getGatewayPrivateKey();
  if (!pk) throw new Error("Gateway private key not configured (GATEWAY_PRIVATE_KEY)");

  const { GatewayClient } = await import("@circle-fin/x402-batching/client");

  gatewayClientInstance = new GatewayClient({
    chain: "arcTestnet" as SupportedChainName,
    privateKey: pk,
  });

  return gatewayClientInstance;
}

export async function depositToGateway(amount: string): Promise<{ depositTxHash: string; amount: string }> {
  const client = await getClient();
  const result = await client.deposit(amount);
  return {
    depositTxHash: result.depositTxHash,
    amount: result.formattedAmount,
  };
}

export async function getGatewayBalances(): Promise<GatewayBalanceInfo> {
  const client = await getClient();
  const balances = await client.getBalances();
  return {
    walletBalance: balances.wallet.formatted,
    gatewayAvailable: balances.gateway.formattedAvailable,
    gatewayTotal: balances.gateway.formattedTotal,
  };
}

export async function payViaGateway(
  url: string,
  options?: { method?: string; body?: unknown; headers?: Record<string, string> }
): Promise<{ data: any; amount: string; transaction: string }> {
  const client = await getClient();
  const result = await client.pay(url, options);
  return {
    data: result.data,
    amount: result.formattedAmount,
    transaction: result.transaction,
  };
}

export async function withdrawFromGateway(
  amount: string,
  options?: { chain?: string; recipient?: string }
): Promise<{ mintTxHash: string; amount: string }> {
  const client = await getClient();
  const result = await client.withdraw(amount, options as any);
  return {
    mintTxHash: result.mintTxHash,
    amount: result.formattedAmount,
  };
}

export async function checkGatewaySupport(url: string): Promise<{ supported: boolean; requirements?: any }> {
  const client = await getClient();
  const result = await client.supports(url);
  return {
    supported: result.supported,
    requirements: result.requirements,
  };
}
