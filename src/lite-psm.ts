import { DssLitePsm } from 'generated';

// Mainnet token addresses
const USDC_MAINNET = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const USDS_MAINNET = '0xdC035D45d973E3EC169d2276DDab16f1e407384F';

// Conversion factor from USDC (6 decimals) to USDS (18 decimals)
const TO_18_CONVERSION_FACTOR = BigInt(1e12);

// SellGem: user sells USDC, receives USDS (USDC → USDS)
// Note: when routed through the usdsPsmWrapper (0xA188...), event.params.owner
// is the wrapper address, not the user. We use transaction.from for the real user.
DssLitePsm.SellGem.handler(async ({ event, context }) => {
  const id = `${event.chainId}-${event.transaction.hash}-${event.logIndex}`;
  const sender = event.transaction.from ?? '';
  const usdcAmount = event.params.value;
  const usdsAmount = usdcAmount * TO_18_CONVERSION_FACTOR;

  context.Swap.set({
    id,
    chainId: event.chainId,
    assetIn: USDC_MAINNET,
    assetOut: USDS_MAINNET,
    sender,
    receiver: sender,
    amountIn: usdcAmount,
    amountOut: usdsAmount,
    referralCode: 0n,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash,
  });
});

// BuyGem: user sells USDS, receives USDC (USDS → USDC)
// Note: event.params.owner is always the real user here (wrapper passes usr through).
DssLitePsm.BuyGem.handler(async ({ event, context }) => {
  const id = `${event.chainId}-${event.transaction.hash}-${event.logIndex}`;
  const sender = event.transaction.from ?? event.params.owner;
  const usdcAmount = event.params.value;
  const usdsAmount = usdcAmount * TO_18_CONVERSION_FACTOR;

  context.Swap.set({
    id,
    chainId: event.chainId,
    assetIn: USDS_MAINNET,
    assetOut: USDC_MAINNET,
    sender,
    receiver: sender,
    amountIn: usdsAmount,
    amountOut: usdcAmount,
    referralCode: 0n,
    blockNumber: BigInt(event.block.number),
    blockTimestamp: BigInt(event.block.timestamp),
    transactionHash: event.transaction.hash,
  });
});
