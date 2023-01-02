import {
  CryptoScheme,
  CryptoSys,
  ECCurve,
  ECUtil,
  EdCurve,
  EdTSS,
  EdUtil,
} from '@desig/core'

export const parseScheme = (scheme: CryptoScheme | string): CryptoSys => {
  switch (scheme) {
    case 'eddsa':
      return CryptoSys.EdDSA
    case 'ecdsa':
      return CryptoSys.ECDSA
    default:
      throw new Error('Invalid desig secret format')
  }
}

export const parseCryptoSys = (cryptosys: CryptoSys | number): CryptoScheme => {
  switch (cryptosys) {
    case CryptoSys.EdDSA:
      return 'eddsa'
    case CryptoSys.ECDSA:
      return 'ecdsa'
    default:
      throw new Error('Invalid desig secret format')
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
      throw new Error('Unsuppported crypto system')
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
      throw new Error('Unsuppported crypto system')
  }
}

export type TSS = typeof EdTSS
export const getTSS = (cryptosys: CryptoSys): TSS => {
  switch (cryptosys) {
    case CryptoSys.EdDSA:
      return EdTSS
    default:
      throw new Error('Unsuppported crypto system')
  }
}
