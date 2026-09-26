import type { EvmOnEventContext } from 'envio';
import { readOwnerUrnsEffect } from './contractCalls';
import { ZERO_ADDRESS } from './constants';

export function urnOwnerIndexId(
  chainId: number,
  engine: string,
  owner: string,
  index: bigint,
): string {
  return `${chainId}-${engine}-${owner}-${index.toString()}`;
}

/**
 * Persist the (engine, owner, index) -> urn mapping. Called from the Open
 * handlers, which always fire before any other event for the urn.
 */
export function saveUrnOwnerIndex(
  event: {
    chainId: number;
    srcAddress: string;
    params: { owner: string; index: bigint; urn: string };
  },
  context: EvmOnEventContext,
): void {
  context.UrnOwnerIndex.set({
    id: urnOwnerIndexId(event.chainId, event.srcAddress, event.params.owner, event.params.index),
    chainId: event.chainId,
    engine: event.srcAddress,
    owner: event.params.owner,
    index: event.params.index,
    urn: event.params.urn,
  });
}

/**
 * Resolve the urn address for an (owner, index) event.
 *
 * Primary source is the UrnOwnerIndex entity written by the Open handler, so
 * no RPC is involved and the answer is exact for the block being processed.
 * Only if the mapping is missing (e.g. the indexer started after the urn was
 * opened) do we fall back to an RPC read pinned to the event's block.
 * Never returns the zero address.
 */
export async function resolveUrnAddress(
  event: {
    chainId: number;
    srcAddress: string;
    block: { number: number };
    params: { owner: string; index: bigint };
  },
  context: EvmOnEventContext,
): Promise<string> {
  const lookup = await context.UrnOwnerIndex.get(
    urnOwnerIndexId(event.chainId, event.srcAddress, event.params.owner, event.params.index),
  );
  if (lookup && lookup.urn !== ZERO_ADDRESS) {
    return lookup.urn;
  }

  // During the preload pass an Open in the same batch has not been applied
  // yet, so a missing lookup is expected. Throwing here is silently ignored
  // by Envio and the handler re-runs in the sequential pass, where the lookup
  // exists. This avoids a pointless RPC round-trip per event.
  if (context.isPreload) {
    throw new Error('urn lookup not available during preload');
  }

  const urn = await context.effect(readOwnerUrnsEffect, {
    chainId: event.chainId,
    engineAddress: event.srcAddress,
    owner: event.params.owner,
    index: event.params.index,
    blockNumber: BigInt(event.block.number),
  });
  if (urn === ZERO_ADDRESS) {
    throw new Error(
      `Could not resolve urn for owner ${event.params.owner} index ${event.params.index.toString()} on chain ${event.chainId}`,
    );
  }
  return urn;
}
