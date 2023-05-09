import { ECCurve, EdCurve } from '@desig/core'
import { Curve } from '@desig/supported-chains'
import { Point } from '@noble/ed25519'
import BN, { Endianness } from 'bn.js'
import { decode, encode } from 'bs58'

/**
 * Convert "small" number
 * @param a Uint8Array
 * @param en The endian
 * @returns Number
 */
export const toSmallNumber = (a: Uint8Array, en: Endianness = 'le') => {
  return new BN(a, 16, en).toNumber()
}

/**
 * Threshold Signature Scheme mapping
 */
export const ec: Record<Curve, typeof EdCurve | typeof ECCurve> = {
  [Curve.ed25519]: EdCurve,
  [Curve.secp256k1]: ECCurve,
}

/**
 * Validate base58 format
 * @param str Base58 string
 * @returns
 */
export const isBase58 = (str: string) => {
  try {
    return str === encode(decode(str))
  } catch (er) {
    return false
  }
}

/**
 * Validate Desig address
 * @param pubkey Address
 * @returns
 */
export const isAddress = (pubkey: string) => {
  try {
    Point.fromHex(decode(pubkey))
    return true
  } catch (er) {
    return false
  }
}
