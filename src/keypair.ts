import { SecretSharing } from '@desig/core'
import { Curve } from '@desig/supported-chains'
import { decode, encode } from 'bs58'
import { z } from 'zod'
import { toSmallNumber, ec } from './utils'

export type WalletThreshold = {
  t: number
  n: number
  index: string
}

export interface WalletAdapter {
  readonly curve: Curve
  readonly ec: (typeof ec)[Curve]
  share: Uint8Array

  getThreshold: () => WalletThreshold
  getSecretKey: () => string
  getShare: () => Uint8Array
}

export interface MultisigWalletAdapter extends WalletAdapter {
  masterkey: Uint8Array
  id: Uint8Array
  index: Uint8Array
  t: Uint8Array
  n: Uint8Array
}

export class DesigKeypair implements MultisigWalletAdapter {
  public readonly curve: Curve
  public readonly ec: (typeof ec)[Curve]
  public masterkey: Uint8Array
  public share: Uint8Array
  public id: Uint8Array
  public index: Uint8Array
  public t: Uint8Array
  public n: Uint8Array

  constructor(secretKey: string) {
    if (!secretKey) throw new Error('Invalid secret key.')
    const [curve, masterkey, shareString] = secretKey.split('/')
    const result = z.nativeEnum(Curve).safeParse(curve)
    if (!result.success) throw new Error('Unsupported elliptic curve.')
    this.curve = result.data
    this.ec = ec[this.curve]
    this.masterkey = decode(masterkey)
    this._parseShareString(shareString)
  }

  private _parseShareString = (shareString: string) => {
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
    t: toSmallNumber(this.t, this.ec.ff.en),
    n: toSmallNumber(this.n, this.ec.ff.en),
  })

  getShare = () =>
    SecretSharing.compress({
      index: this.index,
      t: this.t,
      n: this.n,
      id: this.id,
      share: this.share,
    })

  getSecretKey = () =>
    `${this.curve}/${encode(this.masterkey)}/${encode(this.getShare())}`

  proactivate = (zero: Uint8Array) => {
    const sss = new SecretSharing(this.ec.ff)
    const share = sss.merge(this.getShare(), zero)
    this._parseShareString(encode(share))
    return this.getShare()
  }
}
