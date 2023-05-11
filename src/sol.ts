import { PublicKey, Transaction } from '@solana/web3.js'

/**
 * Validate Solana address
 * @param address Solana address
 * @returns true/false
 */
export const isSolanaAddress = (
  address: string | undefined,
): address is string => {
  if (!address) return false
  try {
    const publicKey = new PublicKey(address)
    if (!publicKey) throw new Error('Invalid public key')
    return true
  } catch (er) {
    return false
  }
}

/**
 * Convert a pubkey to a solana address
 * @param pubkey Pubkey
 * @returns Solana address
 */
export { toSolanaAddress } from '@desig/supported-chains'

/**
 * Add signture to a Solana transaction
 * @param transaction The Solana transaction (Ref: https://solana-labs.github.io/solana-web3.js/classes/Transaction.html)
 * @param {sig, addr} signature The product of `Proposal.finalizaSignature` extended the signer address
 * @returns
 */
export const addSolTransaction = (
  transaction: Transaction,
  { sig, addr }: { sig: Uint8Array; addr: string },
) => {
  const pubkey = new PublicKey(addr)
  transaction.addSignature(pubkey, Buffer.from(sig))
  return transaction
}
