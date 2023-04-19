import { ECCurve, ECTSS, EdCurve, EdTSS, SecretSharing } from '@desig/core'
import { CryptoSys, toSys } from '@desig/supported-chains'
import { decode, encode } from 'bs58'
import BN, { Endianness } from 'bn.js'
import * as ec from '@noble/secp256k1'
import * as ed from '@noble/ed25519'

export type WalletThreshold = {
  t: number
  n: number
  index: number
}

export interface WalletAdapter {
  readonly cryptosys: CryptoSys
  pubkey: Uint8Array
  privkey: Uint8Array

  getThreshold: () => WalletThreshold
  getAddress: () => string
  getPublicKey: () => Uint8Array
  getPrivateKey: () => string
  sign: (msg: Uint8Array) => Uint8Array
  approve: (msg: Uint8Array) => Promise<Uint8Array>
}

export interface MultisigWalletAdapter extends WalletAdapter {
  masterkey: Uint8Array
  id: Uint8Array
  index: Uint8Array
  t: Uint8Array
  n: Uint8Array
}

/**
 * Convert "small" number
 * @param a Uint8Array
 * @param en The endian
 * @returns Number
 */
const toNumber = (a: Uint8Array, en: Endianness = 'le') => {
  return new BN(a, 16, en).toNumber()
}

export class DesigEdDSAKeypair implements MultisigWalletAdapter {
  public readonly cryptosys: CryptoSys = CryptoSys.EdDSA
  public masterkey: Uint8Array
  public pubkey: Uint8Array
  public privkey: Uint8Array
  public id: Uint8Array
  public index: Uint8Array
  public t: Uint8Array
  public n: Uint8Array

  constructor(secret: string) {
    const [scheme, masterkey, share] = secret.split('/')
    if (this.cryptosys !== toSys(scheme))
      throw new Error('Invalid desig eddsa keypair')

    this.masterkey = decode(masterkey)
    const {
      share: privkey,
      id,
      index,
      t,
      n,
    } = SecretSharing.extract(decode(share))
    this.id = id
    this.index = index
    this.t = t
    this.n = n
    this.privkey = privkey
    this.pubkey = EdCurve.getPublicKey(this.privkey)
  }

  getThreshold = () => ({
    index: toNumber(this.index, 'le'),
    t: toNumber(this.t, 'le'),
    n: toNumber(this.n, 'le'),
  })

  getAddress = () => {
    return encode(this.pubkey)
  }

  getPublicKey = () => {
    return this.pubkey
  }

  getPrivateKey = () =>
    `eddsa/${encode(this.pubkey)}/${encode(
      SecretSharing.compress({
        index: this.index,
        t: this.t,
        n: this.n,
        id: this.id,
        share: this.privkey,
      }),
    )}`

  sign = (msg: Uint8Array): Uint8Array => {
    return ed.sync.sign(msg, this.privkey)
  }

  private preapprove = async (): Promise<{ R: Uint8Array; r: Uint8Array }> => {
    return { R: Uint8Array.from([]), r: Uint8Array.from([]) }
  }

  approve = async (msg: Uint8Array): Promise<Uint8Array> => {
    const { R, r } = await this.preapprove()
    return EdTSS.sign(msg, R, this.masterkey, r, this.privkey)
  }
}

export class DesigECDSAKeypair implements MultisigWalletAdapter {
  public cryptosys: CryptoSys = CryptoSys.ECDSA
  public masterkey: Uint8Array
  public pubkey: Uint8Array
  public privkey: Uint8Array
  public id: Uint8Array
  public index: Uint8Array
  public t: Uint8Array
  public n: Uint8Array

  constructor(secret: string) {
    const [scheme, masterkey, share] = secret.split('/')
    if (this.cryptosys !== toSys(scheme))
      throw new Error('Invalid desig ecdsa keypair')

    this.masterkey = decode(masterkey)
    const {
      share: privkey,
      id,
      index,
      t,
      n,
    } = SecretSharing.extract(decode(share))
    this.id = id
    this.index = index
    this.t = t
    this.n = n
    this.privkey = privkey
    this.pubkey = ECCurve.getPublicKey(this.privkey)
  }

  getThreshold = () => ({
    index: toNumber(this.index, 'be'),
    t: toNumber(this.t, 'be'),
    n: toNumber(this.n, 'be'),
  })

  getAddress = () => {
    return encode(this.pubkey)
  }

  getPublicKey = () => {
    return this.pubkey
  }

  getPrivateKey = () =>
    `ecdsa/${encode(this.pubkey)}/${encode(
      SecretSharing.compress({
        index: this.index,
        t: this.t,
        n: this.n,
        id: this.id,
        share: this.privkey,
      }),
    )}`

  sign = (msg: Uint8Array): Uint8Array => {
    return ec.signSync(msg, this.privkey)
  }

  private preapprove = async (): Promise<{ R: Uint8Array; z: Uint8Array }> => {
    return { R: Uint8Array.from([]), z: Uint8Array.from([]) }
  }

  approve = async (msg: Uint8Array): Promise<Uint8Array> => {
    const { R, z } = await this.preapprove()
    return ECTSS.sign(R, z, this.privkey)
  }
}
