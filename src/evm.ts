import { hexlify, isAddress, Transaction, toBigInt } from 'ethers'

/**
 * Validate EVM address
 * @param address EVM address
 * @returns true/false
 */
export const isEvmAddress = (
  address: string | undefined,
): address is string => {
  if (!address) return false
  return isAddress(address)
}

/**
 * Convert a compressed pubkey to an EVM address
 * @param pubkey Compressed pubkey
 * @returns EVM address with checksum
 */
export { toEvmAddress } from '@desig/supported-chains'

/**
 * Add signture to an EVM (i.e. Ethereum) transaction
 * @param transaction The serialize transaction
 * @param { sig, recv } signature The product of `Proposal.finalizeSignature`
 * @param chainId Chain id in hex (Ref: https://chainlist.desig.io/)
 * @returns The serialized signed transaction
 */
export const addEvmSignature = (
  transaction: Uint8Array,
  { sig, recv }: { sig: Uint8Array; recv: number },
  chainId: string,
) => {
  const tx = Transaction.from(hexlify(transaction))
  const r = sig.slice(0, 32)
  const s = sig.slice(32, 64)
  const v = BigInt(recv + 35) + BigInt(chainId) * BigInt(2)
  const signedTx = Transaction.from({
    ...tx.toJSON(),
    signature: {
      r: toBigInt(r),
      s: toBigInt(s),
      v,
    },
  })
  return signedTx.serialized
}
