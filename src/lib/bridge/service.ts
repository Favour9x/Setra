import { BridgeKit, type BridgeChainIdentifier } from "@circle-fin/bridge-kit";
import { createAdapterFromPrivateKey } from "@circle-fin/adapter-viem-v2";
import type { ChainDefinition } from "@circle-fin/bridge-kit";
import { privateKeyToAddress } from "viem/accounts";
import type { Hex } from "viem";

function getPrivateKey(): Hex {
  const pk = process.env.BRIDGE_PRIVATE_KEY;
  if (!pk) throw new Error("BRIDGE_PRIVATE_KEY not configured");
  return (pk.startsWith("0x") ? pk : `0x${pk}`) as Hex;
}

function createKit() {
  const privateKey = getPrivateKey();
  const adapter = createAdapterFromPrivateKey({ privateKey });
  const kit = new BridgeKit();
  const chains = kit.getSupportedChains();
  return { kit, adapter, chains };
}

export function getSupportedChains(options?: { isTestnet?: boolean }) {
  const { chains } = createKit();
  if (options?.isTestnet !== undefined) {
    return chains.filter((c) => c.isTestnet === options.isTestnet);
  }
  return chains;
}

export interface BridgeEstimateParams {
  fromChain: string;
  toChain: string;
  amount: string;
}

export interface BridgeExecuteParams {
  fromChain: string;
  toChain: string;
  amount: string;
  recipientAddress?: string;
}

export async function estimateBridge(params: BridgeEstimateParams) {
  const { kit, adapter, chains } = createKit();
  const fromChain = chains.find((c) => c.chain === params.fromChain) as ChainDefinition | undefined;
  const toChain = chains.find((c) => c.chain === params.toChain) as ChainDefinition | undefined;
  if (!fromChain || !toChain) {
    throw new Error(`Chain not found: ${!fromChain ? params.fromChain : params.toChain}`);
  }
  return kit.estimate({
    from: { adapter, chain: fromChain as BridgeChainIdentifier },
    to: { adapter, chain: toChain as BridgeChainIdentifier },
    amount: params.amount,
  });
}

export async function executeBridge(params: BridgeExecuteParams) {
  const { kit, adapter, chains } = createKit();
  const fromChain = chains.find((c) => c.chain === params.fromChain) as ChainDefinition | undefined;
  const toChain = chains.find((c) => c.chain === params.toChain) as ChainDefinition | undefined;
  if (!fromChain || !toChain) {
    throw new Error(`Chain not found: ${!fromChain ? params.fromChain : params.toChain}`);
  }
  return kit.bridge({
    from: { adapter, chain: fromChain as BridgeChainIdentifier },
    to: {
      adapter,
      chain: toChain as BridgeChainIdentifier,
      ...(params.recipientAddress ? { recipientAddress: params.recipientAddress } : {}),
    },
    amount: params.amount,
  });
}

export async function sendToBridgeEOA(
  fromWalletId: string,
  amount: string,
  blockchain: string
): Promise<{ transactionId: string; txHash?: string }> {
  const { sendToken } = await import("../circle/client");
  const bridgeAddress = getBridgeAddress();
  const result = await sendToken(fromWalletId, bridgeAddress, amount, "USDC", blockchain);
  return { transactionId: result.transactionId, txHash: result.txHash };
}

export function getBridgeAddress(): string {
  const pk = getPrivateKey();
  return privateKeyToAddress(pk);
}
