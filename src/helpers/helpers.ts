import { BigDecimal } from 'envio';
import type { Entity, EvmEvent, EvmOnEventContext } from 'envio';
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
// and creates a SpellV2 for every address on it without reading the contract.
// Chief accepts any address in a slate, and no on-chain check tells a spell from
// another contract, so the portal picks the official spells from the governance
// list instead. Contract reads here could be failed, or made to fail, by any
// address anyone etches.
export async function createSlateV2(
  event: EvmEvent<'DSChiefV2', 'Etch'>,
  context: EvmOnEventContext,
): Promise<SlateV2> {
  const yays: string[] = [];
  const chainId = event.chainId;

  for (const spellAddress of event.params.yays) {
    if (spellAddress !== ZERO_ADDRESS) {
      const spellId = `${chainId}-${spellAddress}`;
      const spell = await context.SpellV2.get(spellId);
      if (!spell) {
        context.SpellV2.set({
          id: spellId,
          chainId,
          address: spellAddress,
          description: undefined,
          state: SpellState.ACTIVE,
          creationBlock: BigInt(event.block.number),
          creationTime: BigInt(event.block.timestamp),
          expiryTime: undefined,
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
        });
      }
      yays.push(spellId);
    }
  }

  return saveSlateV2(event.params.slate, yays, event, context);
}

export function saveSlateV2(
  slateHash: string,
  yays: string[],
  event: EvmEvent<'DSChiefV2', 'Etch'> | EvmEvent<'DSChiefV2', 'Vote'>,
  context: EvmOnEventContext,
): SlateV2 {
  const slate = {
    id: `${event.chainId}-${slateHash}`,
    chainId: event.chainId,
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
