import { DSChiefV2 } from 'generated';
import type { handlerContext, DSChiefV2_Vote_event } from 'generated';
import { SpellState } from './helpers/constants';
import {
  addWeightToSpellsV2,
  createExecutiveVotingPowerChangeV2,
  createSlateV2,
  getVoter,
  removeWeightFromSpellsV2,
  toDecimal,
} from './helpers/helpers';

DSChiefV2.Lock.handler(async ({ event, context }) => {
  const sender = event.params.usr;
  const amount = event.params.wad;

  const voter = await getVoter(sender, event.chainId, context);

  // Track the change of SKY locked in chief for the user
  const votingPowerChange = createExecutiveVotingPowerChangeV2(
    event,
    amount,
    voter.skyLockedInChiefRaw,
    voter.skyLockedInChiefRaw + amount,
    voter.id,
  );

  context.ExecutiveVotingPowerChangeV2.set(votingPowerChange);

  // Update the amount of SKY locked in chief for the voter
  context.Voter.set({
    ...voter,
    skyLockedInChiefRaw: voter.skyLockedInChiefRaw + amount,
    skyLockedInChief: toDecimal(voter.skyLockedInChiefRaw + amount),
  });

  // Update the weight in all the executives supported
  await addWeightToSpellsV2(voter.currentSpellsV2, amount, context);
});

DSChiefV2.Free.handler(async ({ event, context }) => {
  const sender = event.params.usr;
  const amount = event.params.wad;

  const voter = await getVoter(sender, event.chainId, context);

  // Track the change of SKY locked in chief for the user
  const votingPowerChange = createExecutiveVotingPowerChangeV2(
    event,
    amount,
    voter.skyLockedInChiefRaw,
    voter.skyLockedInChiefRaw - amount,
    voter.id,
  );

  context.ExecutiveVotingPowerChangeV2.set(votingPowerChange);

  // Update the amount of SKY locked in chief for the voter
  context.Voter.set({
    ...voter,
    skyLockedInChiefRaw: voter.skyLockedInChiefRaw - amount,
    skyLockedInChief: toDecimal(voter.skyLockedInChiefRaw - amount),
  });

  // Update the weight in all the executives supported
  await removeWeightFromSpellsV2(voter.currentSpellsV2, amount, context);
});

DSChiefV2.Vote.handler(async ({ event, context }) => {
  const sender = event.params.usr;
  const slateId = event.params.slate;
  await _handleSlateVote(sender, slateId, event, context);
});

async function _handleSlateVote(
  sender: string,
  slateId: string,
  event: DSChiefV2_Vote_event,
  context: handlerContext,
): Promise<void> {
  const voter = await getVoter(sender, event.chainId, context);
  let slate = await context.SlateV2.get(`${event.chainId}-${slateId}`);
  if (!slate) {
    slate = await createSlateV2(slateId, event, context);
  }

  // Remove votes from previous spells
  await removeWeightFromSpellsV2(
    voter.currentSpellsV2,
    voter.skyLockedInChiefRaw,
    context,
  );

  for (let i = 0; i < slate.yays.length; i++) {
    const spellId = slate.yays[i];
    const spell = await context.SpellV2.get(spellId);
    if (spell) {
      const voteId = `${event.chainId}-${spellId}-${sender}`;
      context.ExecutiveVoteV2.set({
        id: voteId,
        chainId: event.chainId,
        weight: voter.skyLockedInChiefRaw,
        reason: '',
        voter_id: voter.id,
        spell_id: spellId,
        block: BigInt(event.block.number),
        blockTime: BigInt(event.block.timestamp),
        txnHash: event.transaction.hash,
        logIndex: BigInt(event.logIndex),
      });
      context.SpellV2.set({
        ...spell,
        totalVotes: spell.totalVotes + 1n,
        totalWeightedVotes:
          spell.totalWeightedVotes + voter.skyLockedInChiefRaw,
      });
    }
  }

  context.Voter.set({
    ...voter,
    currentSpellsV2: slate.yays,
    numberExecutiveVotesV2: voter.numberExecutiveVotesV2 + 1,
    lastVotedTimestamp: BigInt(event.block.timestamp),
  });
}

DSChiefV2.Lift.handler(async ({ event, context }) => {
  const spellId = `${event.chainId}-${event.params.whom}`;

  const spell = await context.SpellV2.get(spellId);
  if (!spell) return;

  context.SpellV2.set({
    ...spell,
    state: SpellState.LIFTED,
    liftedTxnHash: event.transaction.hash,
    liftedBlock: BigInt(event.block.number),
    liftedTime: BigInt(event.block.timestamp),
    liftedWith: spell.totalWeightedVotes,
  });
});
