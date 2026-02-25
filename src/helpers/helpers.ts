import { BigDecimal } from 'generated';
import {
  readDSChiefSlateEffect,
  readSpellDescriptionEffect,
  readSpellExpirationEffect,
} from './contractCalls';
import { SpellState, ZERO_ADDRESS } from './constants';

export function hexToNumberString(hex: string): bigint {
  return BigInt(hex);
}

export function toDecimal(value: bigint, decimals: number = 18): BigDecimal {
  const divisor = new BigDecimal(10).pow(decimals);
  return new BigDecimal(value.toString()).div(divisor);
}

export async function getVoter(address: string, context: any) {
  let voter = await context.Voter.get(address);
  if (!voter) {
    voter = {
      id: address,
      isVoteDelegate: undefined,
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
  event: any,
  amount: bigint,
  previousBalance: bigint,
  newBalance: bigint,
  voter: string,
) {
  const id = `${event.block.timestamp}-${event.logIndex}`;
  return {
    id,
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
  event: any,
  amount: bigint,
  previousBalance: bigint,
  newBalance: bigint,
  voter: string,
) {
  const id = `${event.block.timestamp}-${event.logIndex}`;
  return {
    id,
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
  event: any,
  context: any,
): Promise<any> {
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

    const spellId = spellAddress.toLowerCase();
    if (spellId !== ZERO_ADDRESS) {
      let spell = await context.Spell.get(spellId);
      if (!spell) {
        const [description, expiryTime] = await Promise.all([
          context.effect(readSpellDescriptionEffect, {
            chainId,
            spellAddress: spellId,
          }),
          context.effect(readSpellExpirationEffect, {
            chainId,
            spellAddress: spellId,
          }),
        ]);
        // Only save the spell if expiration() didn't revert
        if (expiryTime !== undefined) {
          spell = {
            id: spellId,
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
    id: slateID,
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
  event: any,
  context: any,
): Promise<any> {
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

    const spellId = spellAddress.toLowerCase();
    if (spellId !== ZERO_ADDRESS) {
      let spell = await context.SpellV2.get(spellId);
      if (!spell) {
        const [description, expiryTime] = await Promise.all([
          context.effect(readSpellDescriptionEffect, {
            chainId,
            spellAddress: spellId,
          }),
          context.effect(readSpellExpirationEffect, {
            chainId,
            spellAddress: spellId,
          }),
        ]);
        // Only save the spell if expiration() didn't revert
        if (expiryTime !== undefined) {
          spell = {
            id: spellId,
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
    id: slateID,
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
  context: any,
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
  context: any,
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
  context: any,
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
  context: any,
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
