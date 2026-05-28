import { BridgeKit } from "@circle-fin/bridge-kit";
import { createViemAdapterFromPrivateKey } from "@circle-fin/adapter-viem-v2";
import type { BridgeChainIdentifier } from "@circle-fin/bridge-kit";
import type { Hex } from "viem";

let kitInstance: BridgeKit | null = null;
let adapterInstance: ReturnType<typeof createViemAdapterFromPrivateKey> | null = null;

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

export function getSupportedChains() {
  const { kit } = ensureKit();
  return kit.getSupportedChains();
}

export async function estimateBridge(params: BridgeEstimateParams) {
  const { kit, adapter } = ensureKit();
  return kit.estimate({
    from: { adapter, chain: params.fromChain as BridgeChainIdentifier },
    to: { adapter, chain: params.toChain as BridgeChainIdentifier },
    amount: params.amount,
  });
}

export async function executeBridge(params: BridgeExecuteParams) {
  const { kit, adapter } = ensureKit();
  const to = params.recipientAddress
    ? { adapter, chain: params.toChain as BridgeChainIdentifier, recipientAddress: params.recipientAddress }
    : { adapter, chain: params.toChain as BridgeChainIdentifier };
  return kit.bridge({
    from: { adapter, chain: params.fromChain as BridgeChainIdentifier },
    to,
    amount: params.amount,
  });
}
