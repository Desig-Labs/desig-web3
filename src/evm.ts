import { hexlify, getAddress, isAddress, Transaction, toBigInt } from 'ethers'
import { keccak_256 } from '@noble/hashes/sha3'
import { Point } from '@noble/secp256k1'

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
export const toEvmAddress = (pubkey: Uint8Array) => {
  const point = Point.fromHex(pubkey)
  const pub = point.toRawBytes().subarray(1)
  const hash = hexlify(keccak_256(pub).slice(-20))
  const address = getAddress(hash)
  return address
}

/**
 * Add signture to an EVM (i.e. Ethereum) transaction
 * @param transaction The serialize transaction
 * @param {sig, recv} signature The product of `Proposal.finalizeSignature`
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
