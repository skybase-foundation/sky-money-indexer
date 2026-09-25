import {
  createPublicClient,
  http,
  type PublicClient,
  type Address,
} from 'viem';
import { mainnet } from 'viem/chains';
import type { Chain } from 'viem';
import { createEffect, S } from 'envio';

// ABI fragments for the contract calls we need
const mkrSkyRateAbi = [
  {
    name: 'rate',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

const ownerUrnsAbi = [
  {
    name: 'ownerUrns',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'index', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;

const curveCoinsAbi = [
  {
    name: 'coins',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'index', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;

// RPC URLs per chain. A chain without one gets no client: viem's http() would
// otherwise fall back to the chain's rate-limited public RPC.
const RPC_URLS: Record<number, string | undefined> = {
  1: process.env.ENVIO_MAINNET_RPC_URL,
  314310: process.env.ENVIO_TENDERLY_TESTNET_PATH
    ? `https://virtual.mainnet.eu.rpc.tenderly.co/${process.env.ENVIO_TENDERLY_TESTNET_PATH}`
    : undefined,
};

// Tenderly fork inherits mainnet config but with its own chain ID
const tenderly: Chain = {
  ...mainnet,
  id: 314310,
  name: 'Tenderly Testnet',
};

// Chain configs per chain ID
const CHAINS: Record<number, Chain> = {
  1: mainnet,
  314310: tenderly,
};

// Pre-create public clients per chain at module level
const clients: Record<number, PublicClient> = {};
for (const [chainId, rpcUrl] of Object.entries(RPC_URLS)) {
  if (!rpcUrl) continue;
  const id = Number(chainId);
  clients[id] = createPublicClient({
    chain: CHAINS[id] || mainnet,
    batch: { multicall: true },
    transport: http(rpcUrl, { batch: true }),
  });
}

function getClient(chainId: number): PublicClient {
  const client = clients[chainId];
  if (!client) {
    throw new Error(
      `No RPC URL configured for chain ${chainId} (ENVIO_MAINNET_RPC_URL / ENVIO_TENDERLY_TESTNET_PATH)`,
    );
  }
  return client;
}

// === Effects ===

export const readOwnerUrnsEffect = createEffect(
  {
    name: 'readOwnerUrns',
    input: {
      chainId: S.int32,
      engineAddress: S.string,
      owner: S.string,
      index: S.bigint,
    },
    output: S.string,
    rateLimit: { calls: 10, per: 'second' as const },
    cache: true,
  },
  async ({ input, context }) => {
    try {
      const client = getClient(input.chainId);
      const result = await client.readContract({
        address: input.engineAddress as Address,
        abi: ownerUrnsAbi,
        functionName: 'ownerUrns',
        args: [input.owner as Address, input.index],
      });
      return (result as string).toLowerCase();
    } catch (error) {
      context.log.error('Failed to read ownerUrns', {
        engineAddress: input.engineAddress,
        owner: input.owner,
        index: input.index.toString(),
        chainId: input.chainId.toString(),
        err: error,
      });
      throw error;
    }
  },
);

export const readMkrSkyRateEffect = createEffect(
  {
    name: 'readMkrSkyRate',
    input: { chainId: S.int32, mkrSkyAddress: S.string },
    output: S.bigint,
    rateLimit: { calls: 5, per: 'second' as const },
    cache: true,
  },
  async ({ input, context }) => {
    try {
      const client = getClient(input.chainId);
      const result = await client.readContract({
        address: input.mkrSkyAddress as Address,
        abi: mkrSkyRateAbi,
        functionName: 'rate',
      });
      return result as bigint;
    } catch (error) {
      context.log.error('Failed to read MkrSky rate', {
        mkrSkyAddress: input.mkrSkyAddress,
        chainId: input.chainId.toString(),
        err: error,
      });
      throw error;
    }
  },
);

export const readCurvePoolCoinEffect = createEffect(
  {
    name: 'readCurvePoolCoin',
    input: { chainId: S.int32, poolAddress: S.string, index: S.bigint },
    output: S.string,
    rateLimit: { calls: 5, per: 'second' as const },
    cache: true,
  },
  async ({ input }) => {
    const client = getClient(input.chainId);
    const result = await client.readContract({
      address: input.poolAddress as Address,
      abi: curveCoinsAbi,
      functionName: 'coins',
      args: [input.index],
    });
    // No fallback: the pool is a fixed contract and the index comes from its
    // own TokenExchange event, so a failed read is never a valid answer and
    // must not be cached as the zero address
    return (result as string).toLowerCase();
  },
);
