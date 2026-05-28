import { BridgeKit, type BridgeChainIdentifier } from "@circle-fin/bridge-kit";
import { createAdapterFromPrivateKey } from "@circle-fin/adapter-viem-v2";
import type { ChainDefinition } from "@circle-fin/bridge-kit";
import type { Hex } from "viem";

let kitInstance: BridgeKit | null = null;
let adapterInstance: ReturnType<typeof createAdapterFromPrivateKey> | null = null;
let chainsCache: ChainDefinition[] | null = null;

function getPrivateKey(): Hex {
  const pk = process.env.BRIDGE_PRIVATE_KEY;
  if (!pk) throw new Error("BRIDGE_PRIVATE_KEY not configured");
  return (pk.startsWith("0x") ? pk : `0x${pk}`) as Hex;
}

function ensureKit() {
  if (kitInstance && adapterInstance) return { kit: kitInstance, adapter: adapterInstance };
  const privateKey = getPrivateKey();
  const adapter = createAdapterFromPrivateKey({ privateKey });
  const kit = new BridgeKit();
  kitInstance = kit;
  adapterInstance = adapter;
  return { kit, adapter };
}

function ensureChains(): ChainDefinition[] {
  if (chainsCache) return chainsCache;
  const { kit } = ensureKit();
  chainsCache = kit.getSupportedChains();
  return chainsCache;
}

export function getSupportedChains(options?: { isTestnet?: boolean }) {
  const all = ensureChains();
  if (options?.isTestnet !== undefined) {
    return all.filter((c) => c.isTestnet === options.isTestnet);
  }
  return all;
}

export function getChainByEnum(chainEnum: string): ChainDefinition | undefined {
  return ensureChains().find((c) => c.chain === chainEnum);
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
  const { kit, adapter } = ensureKit();
  const fromChain = getChainByEnum(params.fromChain);
  const toChain = getChainByEnum(params.toChain);
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
  const { kit, adapter } = ensureKit();
  const fromChain = getChainByEnum(params.fromChain);
  const toChain = getChainByEnum(params.toChain);
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
  const { privateKeyToAddress } = require("viem/accounts");
  const pk = getPrivateKey();
  return privateKeyToAddress(pk);
}
