import { Ed25519PublicKey, TransactionBlock } from '@mysten/sui.js'
import { getBytes } from 'ethers'

/**
 * Validate EVM address
 * @param address EVM address
 * @returns true/false
 */
export const isSuiAddress = (
  address: string | undefined,
): address is string => {
  if (!address) return false
  try {
    const publicKey = new Ed25519PublicKey(getBytes(address))
    if (!publicKey) throw new Error('Invalid public key')
    return true
  } catch (er) {
    return false
  }
}

/**
 * Convert a compressed pubkey to a Sui address
 * @param pubkey Compressed pubkey
 * @returns EVM address with checksum
 */
export { toSuiAddress } from '@desig/supported-chains'

/**
 * Add signture to a Sui transaction
 * @param transaction The Sui transaction
 * @param {sig, addr} signature The product of `Proposal.finalizaSignature` extended the signer address
 * @returns
 */
export const addSuiSignature = (
  transaction: TransactionBlock,
  { sig, addr }: { sig: Uint8Array; addr: string },
) => {
  console.warn(
    'There is no available signature adding action in Sui. Read more: https://github.com/MystenLabs/sui/blob/main/sdk/typescript/src/providers/json-rpc-provider.ts#L480',
  )
  return transaction
}
