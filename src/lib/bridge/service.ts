import { BridgeKit } from "@circle-fin/bridge-kit";
import { createCircleWalletsAdapter } from "@circle-fin/adapter-circle-wallets";
import type { ChainDefinition, BridgeChainIdentifier } from "@circle-fin/bridge-kit";

let kitInstance: BridgeKit | null = null;
let adapterInstance: ReturnType<typeof createCircleWalletsAdapter> | null = null;
let chainsCache: ChainDefinition[] | null = null;

function ensureCredentials() {
  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;
  if (!apiKey || !entitySecret) {
    throw new Error("Circle API credentials not configured (CIRCLE_API_KEY, CIRCLE_ENTITY_SECRET)");
  }
  return { apiKey, entitySecret };
}

function ensureKit() {
  if (kitInstance && adapterInstance) return { kit: kitInstance, adapter: adapterInstance };
  const { apiKey, entitySecret } = ensureCredentials();
  const adapter = createCircleWalletsAdapter({ apiKey, entitySecret });
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

export function getChainById(chainId: string): ChainDefinition | undefined {
  return ensureChains().find((c) => c.chain === chainId);
}

export interface BridgeEstimateParams {
  fromChain: string;
  toChain: string;
  amount: string;
  fromAddress: string;
  toAddress?: string;
}

export interface BridgeExecuteParams {
  fromChain: string;
  toChain: string;
  amount: string;
  fromAddress: string;
  toAddress?: string;
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
    from: {
      adapter,
      chain: fromChain as BridgeChainIdentifier,
      address: params.fromAddress,
    },
    to: {
      adapter,
      chain: toChain as BridgeChainIdentifier,
      address: params.toAddress || params.fromAddress,
    },
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
  return kit.bridge({
    from: {
      adapter,
      chain: fromChain as BridgeChainIdentifier,
      address: params.fromAddress,
    },
    to: {
      adapter,
      chain: toChain as BridgeChainIdentifier,
      address: params.toAddress || params.fromAddress,
      ...(params.recipientAddress ? { recipientAddress: params.recipientAddress } : {}),
    },
    amount: params.amount,
  });
}
