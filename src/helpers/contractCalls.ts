import {
  createPublicClient,
  http,
  type PublicClient,
  type Address,
} from 'viem';
import { mainnet } from 'viem/chains';
import { createEffect, S } from 'envio';

// ABI fragments for the contract calls we need
const dsChiefSlatesAbi = [
  {
    name: 'slates',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'id', type: 'bytes32' },
      { name: 'index', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;

const dsSpellAbi = [
  {
    name: 'description',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    name: 'expiration',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
] as const;

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

// RPC URLs per chain
const RPC_URLS: Record<number, string> = {
  1: process.env.MAINNET_RPC_URL || '',
  314310:
    'https://virtual.rpc.tenderly.co/jetstreamgg/jetstream/public/jetstream-testnet',
  8453: process.env.BASE_RPC_URL || '',
  10: process.env.OPTIMISM_RPC_URL || '',
  42161: process.env.ARBITRUM_RPC_URL || '',
  130: process.env.UNICHAIN_RPC_URL || '',
};

// Pre-create public clients per chain at module level
const clients: Record<number, PublicClient> = {};
for (const [chainId, rpcUrl] of Object.entries(RPC_URLS)) {
  clients[Number(chainId)] = createPublicClient({
    chain: mainnet,
    batch: { multicall: true },
    transport: http(rpcUrl, { batch: true }),
  });
}

function getClient(chainId: number): PublicClient {
  const client = clients[chainId];
  if (!client) {
    throw new Error(`No RPC client configured for chain ${chainId}`);
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
  async ({ input, context }) => {
    try {
      const client = getClient(input.chainId);
      const result = await client.readContract({
        address: input.poolAddress as Address,
        abi: curveCoinsAbi,
        functionName: 'coins',
        args: [input.index],
      });
      return (result as string).toLowerCase();
    } catch (error) {
      context.log.error('Failed to read Curve pool coin', {
        poolAddress: input.poolAddress,
        index: input.index.toString(),
        chainId: input.chainId.toString(),
        err: error,
      });
      throw error;
    }
  },
);

// readDSChiefSlateEffect: returning '' on index out-of-bounds is the expected
// loop termination signal used by createSlate/createSlateV2
export const readDSChiefSlateEffect = createEffect(
  {
    name: 'readDSChiefSlate',
    input: {
      chainId: S.int32,
      chiefAddress: S.string,
      slateId: S.string,
      index: S.bigint,
    },
    output: S.string,
    rateLimit: { calls: 10, per: 'second' as const },
    cache: true,
  },
  async ({ input }) => {
    try {
      const client = getClient(input.chainId);
      const result = await client.readContract({
        address: input.chiefAddress as Address,
        abi: dsChiefSlatesAbi,
        functionName: 'slates',
        args: [input.slateId as `0x${string}`, input.index],
      });
      return result as string;
    } catch {
      // Index out of bounds = end of slate
      return '';
    }
  },
);

export const readSpellDescriptionEffect = createEffect(
  {
    name: 'readSpellDescription',
    input: { chainId: S.int32, spellAddress: S.string },
    output: S.string,
    rateLimit: { calls: 5, per: 'second' as const },
    cache: true,
  },
  async ({ input }) => {
    try {
      const client = getClient(input.chainId);
      const result = await client.readContract({
        address: input.spellAddress as Address,
        abi: dsSpellAbi,
        functionName: 'description',
      });
      return result as string;
    } catch {
      return '';
    }
  },
);

export const readSpellExpirationEffect = createEffect(
  {
    name: 'readSpellExpiration',
    input: { chainId: S.int32, spellAddress: S.string },
    output: S.nullable(S.bigint),
    rateLimit: { calls: 5, per: 'second' as const },
    cache: true,
  },
  async ({ input }) => {
    try {
      const client = getClient(input.chainId);
      const result = await client.readContract({
        address: input.spellAddress as Address,
        abi: dsSpellAbi,
        functionName: 'expiration',
      });
      return result as bigint;
    } catch {
      return undefined;
    }
  },
);
