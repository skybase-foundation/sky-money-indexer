import { indexer } from 'envio';
import { shouldIgnoreDelegator } from './helpers/constants';

indexer.onEvent({ contract: 'VoteDelegateV3', event: 'Lock' }, async ({ event, context }) => {
  const sender = event.params.usr;
  const delegateAddress = event.srcAddress;
  const amount = event.params.wad;

  // a zero-wad lock leaves the delegation unchanged, so it must not move the count
  if (amount === 0n) return;

  const delegate = await context.Delegate.get(
    `${event.chainId}-${delegateAddress}`,
  );
  if (!delegate) return;

  // Staking engine delegations are already handled in the lockstake engine handlers
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

  const previousAmount = delegation.amount;
  const newAmount = previousAmount + amount;

  if (previousAmount <= 0n && newAmount > 0n) {
    updatedDelegate = {
      ...updatedDelegate,
      delegators: updatedDelegate.delegators + 1,
    };
  }
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

indexer.onEvent({ contract: 'VoteDelegateV3', event: 'Free' }, async ({ event, context }) => {
  const sender = event.params.usr;
  const delegateAddress = event.srcAddress;
  const amount = event.params.wad;

  // a zero-wad free leaves the delegation unchanged, so it must not move the count
  if (amount === 0n) return;

  const delegate = await context.Delegate.get(
    `${event.chainId}-${delegateAddress}`,
  );
  if (!delegate) return;

  // Staking engine delegations are already handled in the lockstake engine handlers
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

  const previousAmount = delegation.amount;
  const newAmount = previousAmount - amount;

  if (previousAmount > 0n && newAmount <= 0n) {
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
