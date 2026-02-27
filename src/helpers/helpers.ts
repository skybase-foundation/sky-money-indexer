import { BigDecimal } from 'generated';
import type {
  handlerContext,
  Voter,
  Slate,
  SlateV2,
  DSChief_LogNote_event,
  DSChiefV2_Lock_event,
  DSChiefV2_Free_event,
  DSChiefV2_Vote_event,
} from 'generated';
import {
  readDSChiefSlateEffect,
  readSpellDescriptionEffect,
  readSpellExpirationEffect,
} from './contractCalls';
import { SpellState, ZERO_ADDRESS } from './constants';

export function hexToBigInt(hex: string): bigint {
  return BigInt(hex);
}

export function toDecimal(value: bigint, decimals: number = 18): BigDecimal {
  const divisor = new BigDecimal(10).pow(decimals);
  return new BigDecimal(value.toString()).div(divisor);
}

export async function getVoter(
  address: string,
  chainId: number,
  context: handlerContext,
): Promise<Voter> {
  const id = `${chainId}-${address.toLowerCase()}`;
  let voter = await context.Voter.get(id);
  if (!voter) {
    voter = {
      id,
      chainId,
      address: address.toLowerCase(),
      isVoteDelegate: false,
      isVoteProxy: undefined,
      delegateContract_id: undefined,
      proxyContract_id: undefined,
      mkrLockedInChiefRaw: 0n,
      mkrLockedInChief: new BigDecimal('0'),
      skyLockedInChiefRaw: 0n,
      skyLockedInChief: new BigDecimal('0'),
      currentSpells: [] as string[],
      currentSpellsV2: [] as string[],
      numberExecutiveVotes: 0,
      numberExecutiveVotesV2: 0,
      numberPollVotes: 0,
      lastVotedTimestamp: 0n,
    };
  }
  return voter;
}

export function createExecutiveVotingPowerChange(
  event: DSChief_LogNote_event,
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

export function createExecutiveVotingPowerChangeV2(
  event: DSChiefV2_Lock_event | DSChiefV2_Free_event,
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

export async function createSlate(
  slateID: string,
  event: DSChief_LogNote_event,
  context: handlerContext,
): Promise<Slate> {
  const yays: string[] = [];
  const chiefAddress = event.srcAddress;
  const chainId = event.chainId;

  // Read slate contents by iterating until empty string is returned (index out of bounds)
  for (let i = 0n; ; i++) {
    const spellAddress = await context.effect(readDSChiefSlateEffect, {
      chainId,
      chiefAddress,
      slateId: slateID,
      index: i,
    });
    if (!spellAddress) break;

    const spellAddress_ = spellAddress.toLowerCase();
    if (spellAddress_ !== ZERO_ADDRESS) {
      const spellId = `${chainId}-${spellAddress_}`;
      let spell = await context.Spell.get(spellId);
      if (!spell) {
        const [description, expiryTime] = await Promise.all([
          context.effect(readSpellDescriptionEffect, {
            chainId,
            spellAddress: spellAddress_,
          }),
          context.effect(readSpellExpirationEffect, {
            chainId,
            spellAddress: spellAddress_,
          }),
        ]);
        // Only save the spell if expiration() didn't revert
        // (matches original subgraph behavior)
        if (expiryTime !== undefined) {
          spell = {
            id: spellId,
            chainId,
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
          context.Spell.set(spell);
        }
      }
      yays.push(spellId);
    }
  }

  const slate = {
    id: `${chainId}-${slateID}`,
    chainId,
    yays,
    txnHash: event.transaction.hash,
    creationBlock: BigInt(event.block.number),
    creationTime: BigInt(event.block.timestamp),
  };

  context.Slate.set(slate);
  return slate;
}

export async function createSlateV2(
  slateID: string,
  event: DSChiefV2_Vote_event,
  context: handlerContext,
): Promise<SlateV2> {
  const yays: string[] = [];
  const chiefAddress = event.srcAddress;
  const chainId = event.chainId;

  // Read slate contents by iterating until empty string is returned (index out of bounds)
  for (let i = 0n; ; i++) {
    const spellAddress = await context.effect(readDSChiefSlateEffect, {
      chainId,
      chiefAddress,
      slateId: slateID,
      index: i,
    });
    if (!spellAddress) break;

    const spellAddress_ = spellAddress.toLowerCase();
    if (spellAddress_ !== ZERO_ADDRESS) {
      const spellId = `${chainId}-${spellAddress_}`;
      let spell = await context.SpellV2.get(spellId);
      if (!spell) {
        const [description, expiryTime] = await Promise.all([
          context.effect(readSpellDescriptionEffect, {
            chainId,
            spellAddress: spellAddress_,
          }),
          context.effect(readSpellExpirationEffect, {
            chainId,
            spellAddress: spellAddress_,
          }),
        ]);
        // Only save the spell if expiration() didn't revert
        // (matches original subgraph behavior)
        if (expiryTime !== undefined) {
          spell = {
            id: spellId,
            chainId,
            address: spellAddress_,
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
    id: `${chainId}-${slateID}`,
    chainId,
    yays,
    txnHash: event.transaction.hash,
    creationBlock: BigInt(event.block.number),
    creationTime: BigInt(event.block.timestamp),
  };

  context.SlateV2.set(slate);
  return slate;
}

export async function addWeightToSpells(
  spellIDs: string[],
  weight: bigint,
  context: handlerContext,
): Promise<void> {
  for (let i = 0; i < spellIDs.length; i++) {
    const spell = await context.Spell.get(spellIDs[i]);
    if (spell) {
      context.Spell.set({
        ...spell,
        totalWeightedVotes: spell.totalWeightedVotes + weight,
      });
    }
  }
}

export async function addWeightToSpellsV2(
  spellIDs: string[],
  weight: bigint,
  context: handlerContext,
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

export async function removeWeightFromSpells(
  spellIDs: string[],
  weight: bigint,
  context: handlerContext,
): Promise<void> {
  for (let i = 0; i < spellIDs.length; i++) {
    const spell = await context.Spell.get(spellIDs[i]);
    if (spell) {
      context.Spell.set({
        ...spell,
        totalWeightedVotes: spell.totalWeightedVotes - weight,
      });
    }
  }
}

export async function removeWeightFromSpellsV2(
  spellIDs: string[],
  weight: bigint,
  context: handlerContext,
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
