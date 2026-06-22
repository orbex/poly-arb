import { privateKeyToAccount } from 'viem/accounts';
import { Hex } from 'viem';

export const CLOB_DOMAIN = {
  name: 'ClobExchange',
  version: '1',
  chainId: 137,
  verifyingContract: '0x4bFb41d5B3570Cf5bD3E1e2F0A8e9d9Ff1c0E3e' as const,
};

export const ORDER_TYPES = {
  Order: [
    { name: 'salt', type: 'uint256' },
    { name: 'signer', type: 'address' },
    { name: 'maker', type: 'address' },
    { name: 'taker', type: 'address' },
    { name: 'tokenId', type: 'uint256' },
    { name: 'makerAmount', type: 'uint256' },
    { name: 'takerAmount', type: 'uint256' },
    { name: 'expiration', type: 'uint256' },
    { name: 'nonce', type: 'uint256' },
    { name: 'feeRateBps', type: 'uint256' },
    { name: 'side', type: 'uint8' },
  ],
} as const;

export interface ClobOrder {
  salt: bigint;
  signer: `0x${string}`;
  maker: `0x${string}`;
  taker: `0x${string}`;
  tokenId: bigint;
  makerAmount: bigint;
  takerAmount: bigint;
  expiration: bigint;
  nonce: bigint;
  feeRateBps: bigint;
  side: number; // 0 = BUY, 1 = SELL
}

/**
 * Sign a CLOB order using EIP-712 structured data signing
 * @param privateKey The Polygon wallet private key of the signer
 * @param order The CLOB order message payload
 * @returns The Hex-encoded signature string
 */
export async function signClobOrder(privateKey: Hex, order: ClobOrder): Promise<Hex> {
  const account = privateKeyToAccount(privateKey);
  const signature = await account.signTypedData({
    domain: CLOB_DOMAIN,
    types: ORDER_TYPES,
    primaryType: 'Order',
    message: {
      salt: order.salt,
      signer: order.signer,
      maker: order.maker,
      taker: order.taker,
      tokenId: order.tokenId,
      makerAmount: order.makerAmount,
      takerAmount: order.takerAmount,
      expiration: order.expiration,
      nonce: order.nonce,
      feeRateBps: order.feeRateBps,
      side: order.side,
    },
  });
  return signature;
}
