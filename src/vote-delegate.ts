import { VoteDelegate } from 'generated';

// LSE and Staking Engine addresses to filter out
const LSE_ADDRESSES = ['0x2b16c07d5fd5cc701a0a871eae2aad6da5fc8f12'];

const STAKING_ENGINE_ADDRESSES = ['0xce01c90de7fd1bcfa39e237fe6d8d9f569e8a6a3'];

function shouldIgnoreAddress(address: string): boolean {
  const lower = address.toLowerCase();
  return (
    LSE_ADDRESSES.includes(lower) || STAKING_ENGINE_ADDRESSES.includes(lower)
  );
}

VoteDelegate.Lock.handler(async ({ event, context }) => {
  const sender = event.params.usr;
  const delegateAddress = event.srcAddress;
  const amount = event.params.wad;

  const delegate = await context.Delegate.get(delegateAddress);
  if (!delegate) return;

  // Check if the delegator should be ignored (LSE or Staking Engine)
  if (shouldIgnoreAddress(sender)) return;

  // Get or create delegation
  const delegationId = `${delegate.id}-${sender}`;
  let delegation = await context.Delegation.get(delegationId);

  let updatedDelegate = { ...delegate };

  if (!delegation) {
    delegation = {
      id: delegationId,
      delegator: sender,
      amount: 0n,
      timestamp: BigInt(event.block.timestamp),
      delegate_id: delegate.id,
    };
    updatedDelegate = {
      ...updatedDelegate,
      delegations: [...updatedDelegate.delegations, delegationId],
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
  });

  context.Delegate.set({
    ...updatedDelegate,
    delegationHistory: [...updatedDelegate.delegationHistory, historyId],
    totalDelegated: updatedDelegate.totalDelegated + amount,
  });
});

VoteDelegate.Free.handler(async ({ event, context }) => {
  const sender = event.params.usr;
  const delegateAddress = event.srcAddress;
  const amount = event.params.wad;

  const delegate = await context.Delegate.get(delegateAddress);
  if (!delegate) return;

  // Check if the delegator should be ignored (LSE or Staking Engine)
  if (shouldIgnoreAddress(sender)) return;

  // Get or create delegation
  const delegationId = `${delegate.id}-${sender}`;
  let delegation = await context.Delegation.get(delegationId);

  let updatedDelegate = { ...delegate };

  if (!delegation) {
    delegation = {
      id: delegationId,
      delegator: sender,
      amount: 0n,
      timestamp: BigInt(event.block.timestamp),
      delegate_id: delegate.id,
    };
    updatedDelegate = {
      ...updatedDelegate,
      delegations: [...updatedDelegate.delegations, delegationId],
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
  });

  context.Delegate.set({
    ...updatedDelegate,
    delegationHistory: [...updatedDelegate.delegationHistory, historyId],
    totalDelegated: updatedDelegate.totalDelegated - amount,
  });
});
