import { ECUtil, EdUtil } from '@desig/core'
import { Chain, CryptoSys } from '@desig/supported-chains'
import { Common } from '@ethereumjs/common'
import { keccak_256 } from '@noble/hashes/sha3'
import { Point } from '@noble/secp256k1'
import { PublicKey } from '@solana/web3.js'
import { encode } from 'bs58'
import Web3 from 'web3'

export const getPubkey = (
  cryptosys: CryptoSys,
  privkey: Uint8Array,
): Uint8Array => {
  switch (cryptosys) {
    case CryptoSys.EdDSA:
      return EdUtil.getPublicKey(privkey)
    case CryptoSys.ECDSA:
      return ECUtil.getPublicKey(privkey)
    default:
      throw new Error('Unsuppported crypto system.')
  }
}

/**
 * Validate email address
 * @param email
 * @returns
 */
export const isEmailAddress = (email: string) =>
  email.match(
    /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
  )

/**
 * Validate Ethereum address
 * @param address Ethereum address
 * @returns true/false
 */
export const isEthereumAddress = (
  address: string | undefined,
): address is string => {
  if (!address) return false
  return Web3.utils.isAddress(address)
}

/**
 * Convert a compressed pubkey to an ethereum address
 * @param pubkey Compressed pubkey
 * @returns Ethereum address with checksum
 */
export const toEthereumAddress = (pubkey: Uint8Array) => {
  const point = Point.fromHex(pubkey)
  const pub = point.toRawBytes().subarray(1)
  const hash = Web3.utils.bytesToHex([...keccak_256(pub).slice(-20)])
  const address = Web3.utils.toChecksumAddress(hash)
  return address
}

export const getEVMCommon = (chain: Chain) => {
  if (chain.cryptoSystem === CryptoSys.EdDSA)
    throw new Error('The chain may be not an EVM-based chain')
  return Common.custom({
    name: chain.name,
    chainId: BigInt(chain.chainId),
    networkId: BigInt(chain.networkId),
  })
}

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
export const toSolanaAddress = (pubkey: Uint8Array) => {
  return encode(pubkey)
}
