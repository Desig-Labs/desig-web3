import { ECTSS, EdTSS, SecretSharing } from '@desig/core'
import { CryptoSys, toSys } from '@desig/supported-chains'
import { decode, encode } from 'bs58'
import BN, { Endianness } from 'bn.js'

export type WalletThreshold = {
  t: number
  n: number
  index: string
}

export interface WalletAdapter {
  readonly cryptosys: CryptoSys
  share: Uint8Array

  getThreshold: () => WalletThreshold
  getSecret: () => string
  getShare: () => Uint8Array
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
  public share: Uint8Array
  public id: Uint8Array
  public index: Uint8Array
  public t: Uint8Array
  public n: Uint8Array

  constructor(secret: string) {
    const [scheme, masterkey, shareString] = secret.split('/')
    if (this.cryptosys !== toSys(scheme))
      throw new Error('Invalid desig eddsa keypair')

    this.masterkey = decode(masterkey)
    const { share, id, index, t, n } = SecretSharing.extract(
      decode(shareString),
    )
    this.id = id
    this.index = index
    this.t = t
    this.n = n
    this.share = share
  }

  getThreshold = () => ({
    index: encode(this.index),
    t: toNumber(this.t, 'le'),
    n: toNumber(this.n, 'le'),
  })

  getShare = () =>
    SecretSharing.compress({
      index: this.index,
      t: this.t,
      n: this.n,
      id: this.id,
      share: this.share,
    })

  getSecret = () => `eddsa/${encode(this.masterkey)}/${encode(this.getShare())}`

  private preapprove = async (): Promise<{ R: Uint8Array; r: Uint8Array }> => {
    return { R: Uint8Array.from([]), r: Uint8Array.from([]) }
  }

  approve = async (msg: Uint8Array): Promise<Uint8Array> => {
    const { R, r } = await this.preapprove()
    return EdTSS.sign(msg, R, this.masterkey, r, this.share)
  }
}

export class DesigECDSAKeypair implements MultisigWalletAdapter {
  public cryptosys: CryptoSys = CryptoSys.ECDSA
  public masterkey: Uint8Array
  public share: Uint8Array
  public id: Uint8Array
  public index: Uint8Array
  public t: Uint8Array
  public n: Uint8Array

  constructor(secret: string) {
    const [scheme, masterkey, shareString] = secret.split('/')
    if (this.cryptosys !== toSys(scheme))
      throw new Error('Invalid desig ecdsa keypair')

    this.masterkey = decode(masterkey)
    const { share, id, index, t, n } = SecretSharing.extract(
      decode(shareString),
    )
    this.id = id
    this.index = index
    this.t = t
    this.n = n
    this.share = share
  }

  getThreshold = () => ({
    index: encode(this.index),
    t: toNumber(this.t, 'be'),
    n: toNumber(this.n, 'be'),
  })

  getShare = () =>
    SecretSharing.compress({
      index: this.index,
      t: this.t,
      n: this.n,
      id: this.id,
      share: this.share,
    })

  getSecret = () => `ecdsa/${encode(this.masterkey)}/${encode(this.getShare())}`

  private preapprove = async (): Promise<{ R: Uint8Array; z: Uint8Array }> => {
    return { R: Uint8Array.from([]), z: Uint8Array.from([]) }
  }

  approve = async (msg: Uint8Array): Promise<Uint8Array> => {
    const { R, z } = await this.preapprove()
    return ECTSS.sign(R, z, this.share)
  }
}
