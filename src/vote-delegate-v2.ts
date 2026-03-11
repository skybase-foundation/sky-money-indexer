import { VoteDelegateV2 } from 'generated';
import { shouldIgnoreDelegator } from './helpers/constants';

VoteDelegateV2.Lock.handler(async ({ event, context }) => {
  const sender = event.params.usr;
  const delegateAddress = event.srcAddress;
  const amount = event.params.wad;

  const delegate = await context.Delegate.get(
    `${event.chainId}-${delegateAddress}`,
  );
  if (!delegate) return;

  // Lockstake engine delegations are already handled in the lockstake engine handlers
  if (shouldIgnoreDelegator(sender)) return;

  // Get or create delegation
  const delegationId = `${delegate.id}-${sender}`;
  let delegation = await context.Delegation.get(delegationId);

  let updatedDelegate = { ...delegate };

  if (!delegation) {
    delegation = {
      id: delegationId,
      chainId: event.chainId,
      delegator: sender,
      amount: 0n,
      timestamp: BigInt(event.block.timestamp),
      delegate_id: delegate.id,
    };
  }

  // If previous delegation amount was 0, increment the delegators count
  if (delegation.amount === 0n) {
    updatedDelegate = {
      ...updatedDelegate,
      delegators: updatedDelegate.delegators + 1,
    };
  }

  // Increase the total amount delegated
  const newAmount = delegation.amount + amount;
  context.Delegation.set({
    ...delegation,
    amount: newAmount,
    timestamp: BigInt(event.block.timestamp),
  });

  // Create delegation history
  const historyId = `${delegationId}-${event.block.number}-${event.logIndex}`;
  context.DelegationHistory.set({
    id: historyId,
    delegator: sender,
    amount: amount,
    accumulatedAmount: newAmount,
    timestamp: BigInt(event.block.timestamp),
    blockNumber: BigInt(event.block.number),
    txnHash: event.transaction.hash,
    delegate_id: delegate.id,
    isLockstake: false,
    isStakingEngine: false,
    chainId: event.chainId,
  });

  context.Delegate.set({
    ...updatedDelegate,
    totalDelegated: updatedDelegate.totalDelegated + amount,
  });
});

VoteDelegateV2.Free.handler(async ({ event, context }) => {
  const sender = event.params.usr;
  const delegateAddress = event.srcAddress;
  const amount = event.params.wad;

  const delegate = await context.Delegate.get(
    `${event.chainId}-${delegateAddress}`,
  );
  if (!delegate) return;

  // Lockstake engine delegations are already handled in the lockstake engine handlers
  if (shouldIgnoreDelegator(sender)) return;

  // Get or create delegation
  const delegationId = `${delegate.id}-${sender}`;
  let delegation = await context.Delegation.get(delegationId);

  let updatedDelegate = { ...delegate };

  if (!delegation) {
    delegation = {
      id: delegationId,
      chainId: event.chainId,
      delegator: sender,
      amount: 0n,
      timestamp: BigInt(event.block.timestamp),
      delegate_id: delegate.id,
    };
  }

  // Decrease the total amount delegated
  const newAmount = delegation.amount - amount;

  // If the delegation amount is 0, decrement the delegators count
  if (newAmount === 0n) {
    updatedDelegate = {
      ...updatedDelegate,
      delegators: updatedDelegate.delegators - 1,
    };
  }

  context.Delegation.set({
    ...delegation,
    amount: newAmount,
    timestamp: BigInt(event.block.timestamp),
  });

  // Create delegation history (amount is negative for free events)
  const historyId = `${delegationId}-${event.block.number}-${event.logIndex}`;
  context.DelegationHistory.set({
    id: historyId,
    delegator: sender,
    amount: -amount,
    accumulatedAmount: newAmount,
    timestamp: BigInt(event.block.timestamp),
    blockNumber: BigInt(event.block.number),
    txnHash: event.transaction.hash,
    delegate_id: delegate.id,
    isLockstake: false,
    isStakingEngine: false,
    chainId: event.chainId,
  });

  context.Delegate.set({
    ...updatedDelegate,
    totalDelegated: updatedDelegate.totalDelegated - amount,
  });
});

// ReserveHatch handler - placeholder, no logic needed
VoteDelegateV2.ReserveHatch.handler(async ({ event, context }) => {
  // No-op: placeholder for the ReserveHatch event
});
