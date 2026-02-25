import { DSChief } from 'generated';
import { SpellState } from './helpers/constants';
import {
  addWeightToSpells,
  createExecutiveVotingPowerChange,
  createSlate,
  getVoter,
  hexToNumberString,
  removeWeightFromSpells,
  toDecimal,
} from './helpers/helpers';

DSChief.LogNote.handler(async ({ event, context }) => {
  const sig = event.params.sig;
  // sig is bytes4 - compare first 4 bytes (8 hex chars after 0x)
  const sigHex = typeof sig === 'string' ? sig.slice(0, 10) : sig;

  if (sigHex === '0xdd467064') {
    // lock(uint256)
    await handleLock(event, context);
  } else if (sigHex === '0xd8ccd0f3') {
    // free(uint256)
    await handleFree(event, context);
  } else if (sigHex === '0xa69beaba') {
    // vote(bytes32)
    await handleVote(event, context);
  } else if (sigHex === '0x3c278bd5') {
    // lift(address)
    await handleLift(event, context);
  }
});

async function handleLock(event: any, context: any): Promise<void> {
  const sender = event.params.guy; // guy is the sender
  const amount = hexToNumberString(event.params.foo); // foo is the amount being locked

  const voter = await getVoter(sender, context);

  // Track the change of MKR locked in chief for the user
  const votingPowerChange = createExecutiveVotingPowerChange(
    event,
    amount,
    voter.mkrLockedInChiefRaw,
    voter.mkrLockedInChiefRaw + amount,
    voter.id,
  );

  context.ExecutiveVotingPowerChange.set(votingPowerChange);

  // Update the amount of MKR locked in chief for the voter
  const updatedVoter = {
    ...voter,
    mkrLockedInChiefRaw: voter.mkrLockedInChiefRaw + amount,
    mkrLockedInChief: toDecimal(voter.mkrLockedInChiefRaw + amount),
  };
  context.Voter.set(updatedVoter);

  // Update the weight in all the executives supported
  await addWeightToSpells(voter.currentSpells, amount, context);
}

async function handleFree(event: any, context: any): Promise<void> {
  const sender = event.params.guy; // guy is the sender
  const amount = hexToNumberString(event.params.foo); // foo is the amount being freed

  const voter = await getVoter(sender, context);

  // Track the change of MKR locked in chief for the user
  const votingPowerChange = createExecutiveVotingPowerChange(
    event,
    amount,
    voter.mkrLockedInChiefRaw,
    voter.mkrLockedInChiefRaw - amount,
    voter.id,
  );

  context.ExecutiveVotingPowerChange.set(votingPowerChange);

  // Update the amount of MKR locked in chief for the voter
  const updatedVoter = {
    ...voter,
    mkrLockedInChiefRaw: voter.mkrLockedInChiefRaw - amount,
    mkrLockedInChief: toDecimal(voter.mkrLockedInChiefRaw - amount),
  };
  context.Voter.set(updatedVoter);

  // Update the weight in all the executives supported
  await removeWeightFromSpells(voter.currentSpells, amount, context);
}

async function handleVote(event: any, context: any): Promise<void> {
  const sender = event.params.guy; // guy is the sender
  const slateId = event.params.foo; // foo is slate id
  await _handleSlateVote(sender, slateId, event, context);
}

async function _handleSlateVote(
  sender: string,
  slateId: string,
  event: any,
  context: any,
): Promise<void> {
  const voter = await getVoter(sender, context);
  let slate = await context.Slate.get(slateId);
  if (!slate) {
    slate = await createSlate(slateId, event, context);
  }

  // Remove votes from previous spells
  await removeWeightFromSpells(
    voter.currentSpells,
    voter.mkrLockedInChiefRaw,
    context,
  );

  for (let i = 0; i < slate.yays.length; i++) {
    const spellId = slate.yays[i];
    const spell = await context.Spell.get(spellId);
    if (spell) {
      const voteId = `${spellId}-${sender}`;
      context.ExecutiveVote.set({
        id: voteId,
        weight: voter.mkrLockedInChiefRaw,
        reason: '',
        voter_id: sender,
        spell_id: spellId,
        block: BigInt(event.block.number),
        blockTime: BigInt(event.block.timestamp),
        txnHash: event.transaction.hash,
        logIndex: BigInt(event.logIndex),
      });
      context.Spell.set({
        ...spell,
        totalVotes: spell.totalVotes + 1n,
        totalWeightedVotes:
          spell.totalWeightedVotes + voter.mkrLockedInChiefRaw,
      });
    }
  }

  context.Voter.set({
    ...voter,
    currentSpells: slate.yays,
    numberExecutiveVotes: voter.numberExecutiveVotes + 1,
    lastVotedTimestamp: BigInt(event.block.timestamp),
  });
}

async function handleLift(event: any, context: any): Promise<void> {
  // foo is the spellId in bytes, we trim and convert to address
  // In the original: Address.fromString(event.params.foo.toHexString().slice(26))
  // The foo param is a bytes32, with the address in the last 20 bytes
  // In hex: 0x + 24 zeros + 40 hex chars of address = 66 chars total, slice(26) gives last 40 chars
  const fooHex =
    typeof event.params.foo === 'string' ? event.params.foo : event.params.foo;
  const spellId = '0x' + fooHex.slice(26);

  const spell = await context.Spell.get(spellId);
  if (!spell) return;

  context.Spell.set({
    ...spell,
    state: SpellState.LIFTED,
    liftedTxnHash: event.transaction.hash,
    liftedBlock: BigInt(event.block.number),
    liftedTime: BigInt(event.block.timestamp),
    liftedWith: spell.totalWeightedVotes,
  });
}
