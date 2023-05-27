import { hexToBytes } from '@noble/hashes/utils'

/**
 * Validate Aptos address
 * @param address Aptos address
 * @returns true/false
 */
export const isAptosAddress = (
  address: string | undefined,
): address is string => {
  if (!address) return false
  try {
    const buf = hexToBytes(address.replace('0x', ''))
    return buf.length === 32
  } catch (er) {
    return false
  }
}

/**
 * Convert a compressed pubkey to an Aptos address
 * @param pubkey Compressed pubkey
 * @returns Aptos address
 */
export { toAptosAddress } from '@desig/supported-chains'

/**
 * Add signture to an Aptos transaction
 * @param transaction The Aptos transaction
 * @param { sig, addr } signature The product of `Proposal.finalizaSignature` extended the signer address
 * @returns
 */
export const addAptosSignature = (
  transaction: any,
  { sig, addr }: { sig: Uint8Array; addr: string },
) => {
  console.warn(
    'There is no available signature adding action in Aptos. Read more: TBD',
  )
  return transaction
}
