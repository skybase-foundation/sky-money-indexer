export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

// Addresses to filter out from delegation handlers (LSE and Staking Engine)
const IGNORED_DELEGATOR_ADDRESSES = [
  '0x2b16c07d5fd5cc701a0a871eae2aad6da5fc8f12', // LockstakeEngine (LSE)
  '0xce01c90de7fd1bcfa39e237fe6d8d9f569e8a6a3', // StakingEngine
];

export function shouldIgnoreDelegator(address: string): boolean {
  const lower = address.toLowerCase();
  return IGNORED_DELEGATOR_ADDRESSES.includes(lower);
}

export const SpellState = {
  ACTIVE: 'ACTIVE',
  LIFTED: 'LIFTED',
  SCHEDULED: 'SCHEDULED',
  CAST: 'CAST',
} as const;
