import { BridgeKit } from "@circle-fin/bridge-kit";
import { createViemAdapterFromPrivateKey } from "@circle-fin/adapter-viem-v2";
import { privateKeyToAccount } from "viem/accounts";
import type { ChainDefinition, BridgeChainIdentifier } from "@circle-fin/bridge-kit";
import type { Hex } from "viem";

let kitInstance: BridgeKit | null = null;
let adapterInstance: ReturnType<typeof createViemAdapterFromPrivateKey> | null = null;
let chainsCache: ChainDefinition[] | null = null;

function getPrivateKey(): Hex {
  const pk =
    process.env.BRIDGE_PRIVATE_KEY ||
    process.env.CIRCLE_AGENT_PRIVATE_KEY ||
    process.env.GATEWAY_PRIVATE_KEY;
  if (!pk) throw new Error("Bridge private key not configured");
  return (pk.startsWith("0x") ? pk : `0x${pk}`) as Hex;
}

function ensureKit() {
  if (kitInstance && adapterInstance) return { kit: kitInstance, adapter: adapterInstance };
  const privateKey = getPrivateKey();
  const adapter = createViemAdapterFromPrivateKey({ privateKey });
  const kit = new BridgeKit();
  kitInstance = kit;
  adapterInstance = adapter;
  return { kit, adapter };
}

export function getBridgeWalletAddress(): string {
  const pk = getPrivateKey();
  const account = privateKeyToAccount(pk);
  return account.address;
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

export function getChainById(chainId: string): ChainDefinition | undefined {
  return ensureChains().find((c) => c.chain === chainId);
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
  const fromChain = getChainById(params.fromChain);
  const toChain = getChainById(params.toChain);
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
  const fromChain = getChainById(params.fromChain);
  const toChain = getChainById(params.toChain);
  if (!fromChain || !toChain) {
    throw new Error(`Chain not found: ${!fromChain ? params.fromChain : params.toChain}`);
  }
  const to = params.recipientAddress
    ? { adapter, chain: toChain as BridgeChainIdentifier, recipientAddress: params.recipientAddress }
    : { adapter, chain: toChain as BridgeChainIdentifier };
  return kit.bridge({
    from: { adapter, chain: fromChain as BridgeChainIdentifier },
    to,
    amount: params.amount,
  });
}
