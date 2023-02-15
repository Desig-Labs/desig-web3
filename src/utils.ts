import {
  CryptoScheme,
  CryptoSys,
  ECCurve,
  ECTSS,
  ECUtil,
  EdCurve,
  EdTSS,
  EdUtil,
} from '@desig/core'
import { PublicKey } from '@solana/web3.js'
import web3 from 'web3'

export const parseScheme = (scheme: CryptoScheme | string): CryptoSys => {
  switch (scheme) {
    case 'eddsa':
      return CryptoSys.EdDSA
    case 'ecdsa':
      return CryptoSys.ECDSA
    default:
      throw new Error('Invalid desig secret format.')
  }
}

export const parseCryptoSys = (cryptosys: CryptoSys | number): CryptoScheme => {
  switch (cryptosys) {
    case CryptoSys.EdDSA:
      return 'eddsa'
    case CryptoSys.ECDSA:
      return 'ecdsa'
    default:
      throw new Error('Invalid desig secret format.')
  }
}

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

export type Curve = typeof ECCurve | typeof EdCurve
export const getCurve = (cryptosys: CryptoSys): Curve => {
  switch (cryptosys) {
    case CryptoSys.EdDSA:
      return EdCurve
    case CryptoSys.ECDSA:
      return ECCurve
    default:
      throw new Error('Unsuppported crypto system.')
  }
}

export type TSS = typeof EdTSS | typeof ECTSS
export const getTSS = (cryptosys: CryptoSys): TSS => {
  switch (cryptosys) {
    case CryptoSys.EdDSA:
      return EdTSS
    case CryptoSys.ECDSA:
      return ECTSS
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
  return web3.utils.isAddress(address)
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
