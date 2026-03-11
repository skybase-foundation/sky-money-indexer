import type {
  delegate as Delegate,
  delegation as Delegation,
  handlerContext,
} from 'generated';
import { shouldIgnoreDelegator } from '../constants';

export async function delegationLockHandler(
  delegate: Delegate,
  address: string,
  amount: bigint,
  blockTimestamp: bigint,
  blockNumber: bigint,
  txnHash: string,
  isLockstake: boolean,
  isStakingEngine: boolean,
  logIndex: string,
  chainId: number,
  context: handlerContext,
): Promise<void> {
  const { delegation, updatedDelegate: delegateWithDelegation } =
    await getDelegation(delegate, address, blockTimestamp, chainId, context);

  if (shouldIgnoreDelegator(delegation.delegator)) {
    return;
  }

  // If previous delegation amount was 0, increment the delegators count
  let updatedDelegate = { ...delegateWithDelegation };
  if (delegation.amount === 0n) {
    updatedDelegate = {
      ...updatedDelegate,
      delegators: updatedDelegate.delegators + 1,
    };
  }

  // Increase the total amount delegated to the delegate
  const newAmount = delegation.amount + amount;

  // Create a new delegation history entity
  const delegationHistoryId =
    delegation.id + '-' + blockNumber.toString() + '-' + logIndex;
  const delegationHistory = {
    id: delegationHistoryId,
    chainId,
    delegator: delegation.delegator,
    delegate_id: delegation.delegate_id,
    amount,
    accumulatedAmount: newAmount,
    blockNumber,
    txnHash,
    timestamp: blockTimestamp,
    isLockstake,
    isStakingEngine,
  };

  // Increase total delegated on the delegate
  updatedDelegate = {
    ...updatedDelegate,
    totalDelegated: updatedDelegate.totalDelegated + amount,
  };

  context.Delegate.set(updatedDelegate);
  context.Delegation.set({
    ...delegation,
    amount: newAmount,
    timestamp: blockTimestamp,
  });
  context.DelegationHistory.set(delegationHistory);
}

export async function delegationFreeHandler(
  delegate: Delegate,
  address: string,
  amount: bigint,
  blockTimestamp: bigint,
  blockNumber: bigint,
  txnHash: string,
  isLockstake: boolean,
  isStakingEngine: boolean,
  logIndex: string,
  chainId: number,
  context: handlerContext,
): Promise<void> {
  const { delegation, updatedDelegate: delegateWithDelegation } =
    await getDelegation(delegate, address, blockTimestamp, chainId, context);

  if (shouldIgnoreDelegator(delegation.delegator)) {
    return;
  }

  // Decrease the total amount delegated to the delegate
  const newAmount = delegation.amount - amount;

  let updatedDelegate = { ...delegateWithDelegation };

  // If the delegation amount is 0, decrement the delegators count
  if (newAmount === 0n) {
    updatedDelegate = {
      ...updatedDelegate,
      delegators: updatedDelegate.delegators - 1,
    };
  }

  // Create a new delegation history entity
  const delegationHistoryId =
    delegation.id + '-' + blockNumber.toString() + '-' + logIndex;
  const delegationHistory = {
    id: delegationHistoryId,
    chainId,
    delegator: delegation.delegator,
    delegate_id: delegation.delegate_id,
    // Amount is negative because it is a free event
    amount: -amount,
    accumulatedAmount: newAmount,
    blockNumber,
    txnHash,
    timestamp: blockTimestamp,
    isLockstake,
    isStakingEngine,
  };

  // Decrease total delegated on the delegate
  updatedDelegate = {
    ...updatedDelegate,
    totalDelegated: updatedDelegate.totalDelegated - amount,
  };

  context.Delegation.set({
    ...delegation,
    amount: newAmount,
    timestamp: blockTimestamp,
  });
  context.Delegate.set(updatedDelegate);
  context.DelegationHistory.set(delegationHistory);
}

export async function getDelegation(
  delegate: Delegate,
  address: string,
  blockTimestamp: bigint,
  chainId: number,
  context: handlerContext,
): Promise<{ delegation: Delegation; updatedDelegate: Delegate }> {
  const delegationId = delegate.id + '-' + address;
  let delegation = await context.Delegation.get(delegationId);
  let updatedDelegate = delegate;
  if (!delegation) {
    delegation = {
      id: delegationId,
      chainId,
      delegator: address,
      delegate_id: delegate.id,
      amount: 0n,
      timestamp: blockTimestamp,
    };
  }
  return { delegation, updatedDelegate };
}

export async function getDelegate(
  delegateAddress: string | null | undefined,
  chainId: number,
  context: handlerContext,
): Promise<Delegate | null> {
  if (!delegateAddress) {
    return null;
  }
  const delegate = await context.Delegate.get(
    `${chainId}-${delegateAddress}`,
  );
  if (!delegate) {
    return null;
  }
  return delegate;
}
