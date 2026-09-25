import { BigDecimal } from 'envio';
import type { Entity, EvmEvent, EvmOnEventContext } from 'envio';
import {
  readSpellDescriptionEffect,
  readSpellExpirationEffect,
} from './contractCalls';
import { SpellState, ZERO_ADDRESS } from './constants';

type Voter = Entity<'Voter'>;
type SlateV2 = Entity<'SlateV2'>;

export function toDecimal(value: bigint, decimals: number = 18): BigDecimal {
  const divisor = new BigDecimal(10).pow(decimals);
  return new BigDecimal(value.toString()).div(divisor);
}

export async function getVoter(
  address: string,
  chainId: number,
  context: EvmOnEventContext,
): Promise<Voter> {
  const id = `${chainId}-${address}`;
  let voter = await context.Voter.get(id);
  if (!voter) {
    voter = {
      id,
      chainId,
      address,
      isVoteDelegate: false,
      isVoteProxy: undefined,
      delegateContract_id: undefined,
      proxyContract_id: undefined,
      skyLockedInChiefRaw: 0n,
      skyLockedInChief: new BigDecimal('0'),
      currentSpellsV2: [] as string[],
      numberExecutiveVotesV2: 0,
      numberPollVotes: 0,
      lastVotedTimestamp: 0n,
    };
  }
  return voter;
}

export function createExecutiveVotingPowerChangeV2(
  event: EvmEvent<'DSChiefV2', 'Lock'> | EvmEvent<'DSChiefV2', 'Free'>,
  amount: bigint,
  previousBalance: bigint,
  newBalance: bigint,
  voter: string,
) {
  const id = `${event.chainId}-${event.transaction.hash}-${event.logIndex}`;
  return {
    id,
    chainId: event.chainId,
    amount,
    previousBalance,
    newBalance,
    voter_id: voter,
    tokenAddress: event.srcAddress,
    txnHash: event.transaction.hash,
    blockTimestamp: BigInt(event.block.timestamp),
    logIndex: BigInt(event.logIndex),
    blockNumber: BigInt(event.block.number),
  };
}

// Builds the slate from the Etch event, which carries the full list of yays,
// so no chief.slates() reads are needed
export async function createSlateV2(
  event: EvmEvent<'DSChiefV2', 'Etch'>,
  context: EvmOnEventContext,
): Promise<SlateV2> {
  const yays: string[] = [];
  const chainId = event.chainId;

  for (const spellAddress of event.params.yays) {
    if (spellAddress !== ZERO_ADDRESS) {
      const spellId = `${chainId}-${spellAddress}`;
      let spell = await context.SpellV2.get(spellId);
      if (!spell) {
        const [description, expiryTime] = await Promise.all([
          context.effect(readSpellDescriptionEffect, {
            chainId,
            spellAddress,
          }),
          context.effect(readSpellExpirationEffect, {
            chainId,
            spellAddress,
          }),
        ]);
        // Only save the spell if expiration() didn't revert
        // (matches original subgraph behavior)
        if (expiryTime !== null) {
          spell = {
            id: spellId,
            chainId,
            address: spellAddress,
            description,
            state: SpellState.ACTIVE,
            creationBlock: BigInt(event.block.number),
            creationTime: BigInt(event.block.timestamp),
            expiryTime,
            totalVotes: 0n,
            totalWeightedVotes: 0n,
            castBlock: undefined,
            castTime: undefined,
            castTxnHash: undefined,
            castWith: undefined,
            liftedBlock: undefined,
            liftedTime: undefined,
            liftedTxnHash: undefined,
            liftedWith: undefined,
            scheduledBlock: undefined,
            scheduledTime: undefined,
            scheduledTxnHash: undefined,
          };
          context.SpellV2.set(spell);
        }
      }
      yays.push(spellId);
    }
  }

  const slate = {
    id: `${chainId}-${event.params.slate}`,
    chainId,
    yays,
    txnHash: event.transaction.hash,
    creationBlock: BigInt(event.block.number),
    creationTime: BigInt(event.block.timestamp),
  };

  context.SlateV2.set(slate);
  return slate;
}

export async function addWeightToSpellsV2(
  spellIDs: readonly string[],
  weight: bigint,
  context: EvmOnEventContext,
): Promise<void> {
  for (let i = 0; i < spellIDs.length; i++) {
    const spell = await context.SpellV2.get(spellIDs[i]);
    if (spell) {
      context.SpellV2.set({
        ...spell,
        totalWeightedVotes: spell.totalWeightedVotes + weight,
      });
    }
  }
}

export async function removeWeightFromSpellsV2(
  spellIDs: readonly string[],
  weight: bigint,
  context: EvmOnEventContext,
): Promise<void> {
  for (let i = 0; i < spellIDs.length; i++) {
    const spell = await context.SpellV2.get(spellIDs[i]);
    if (spell) {
      context.SpellV2.set({
        ...spell,
        totalWeightedVotes: spell.totalWeightedVotes - weight,
      });
    }
  }
}
