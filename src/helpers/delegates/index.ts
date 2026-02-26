import type { delegate as Delegate, delegation as Delegation } from 'generated';

function getLseAddresses(): string[] {
  return [
    '0x2b16C07D5fD5cC701a0a871eae2aad6DA5fc8f12', // Tenderly LSE address
    '0x2b16C07D5fD5cC701a0a871eae2aad6DA5fc8f12', // Mainnet LSE address
  ];
}

function getStakingEngineAddresses(): string[] {
  return [
    '0xCe01C90dE7FD1bcFa39e237FE6D8D9F569e8A6a3', // Tenderly Staking Engine address
    '0xCe01C90dE7FD1bcFa39e237FE6D8D9F569e8A6a3', // Mainnet Staking Engine address
  ];
}

function isAddressInList(address: string, addresses: string[]): boolean {
  for (let i = 0; i < addresses.length; i++) {
    if (addresses[i].toLowerCase() === address.toLowerCase()) {
      return true;
    }
  }
  return false;
}

export async function delegationLockHandler(
  delegate: any,
  address: string,
  amount: bigint,
  blockTimestamp: bigint,
  blockNumber: bigint,
  txnHash: string,
  isLockstake: boolean,
  isStakingEngine: boolean,
  logIndex: string,
  chainId: number,
  context: any,
): Promise<void> {
  const { delegation, updatedDelegate: delegateWithDelegation } =
    await getDelegation(delegate, address, blockTimestamp, chainId, context);

  const lseAddresses = getLseAddresses();
  const stakingEngineAddresses = getStakingEngineAddresses();

  // Check if the delegator matches any of the LSE or Staking Engine addresses
  const delegatorAddress = delegation.delegator.toLowerCase();
  const shouldIgnore =
    isAddressInList(delegatorAddress, lseAddresses) ||
    isAddressInList(delegatorAddress, stakingEngineAddresses);

  if (shouldIgnore) {
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
  delegate: any,
  address: string,
  amount: bigint,
  blockTimestamp: bigint,
  blockNumber: bigint,
  txnHash: string,
  isLockstake: boolean,
  isStakingEngine: boolean,
  logIndex: string,
  chainId: number,
  context: any,
): Promise<void> {
  const { delegation, updatedDelegate: delegateWithDelegation } =
    await getDelegation(delegate, address, blockTimestamp, chainId, context);

  const lseAddresses = getLseAddresses();
  const stakingEngineAddresses = getStakingEngineAddresses();

  // Check if the delegator matches any of the LSE or Staking Engine addresses
  const delegatorAddress = delegation.delegator.toLowerCase();
  const shouldIgnore =
    isAddressInList(delegatorAddress, lseAddresses) ||
    isAddressInList(delegatorAddress, stakingEngineAddresses);

  if (shouldIgnore) {
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
  context: any,
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
  context: any,
): Promise<any | null> {
  if (!delegateAddress) {
    return null;
  }
  const delegate = await context.Delegate.get(`${chainId}-${delegateAddress.toLowerCase()}`);
  if (!delegate) {
    return null;
  }
  return delegate;
}
