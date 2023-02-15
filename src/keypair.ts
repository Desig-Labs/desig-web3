import { CryptoSys, ECUtil, EdUtil, SecretSharing } from '@desig/core'
import { decode, encode } from 'bs58'
import { getPubkey, parseCryptoSys, parseScheme } from './utils'

export type KeypairProps = {
  cryptosys: CryptoSys
  masterkey?: Uint8Array
  pubkey?: Uint8Array
  privkey?: Uint8Array
  id?: Uint8Array
  index?: Uint8Array
  t?: Uint8Array
  n?: Uint8Array
}

export class Keypair {
  public cryptosys: CryptoSys
  public masterkey: Uint8Array
  public pubkey: Uint8Array
  public privkey: Uint8Array
  public id: Uint8Array
  public index: Uint8Array
  public t: Uint8Array
  public n: Uint8Array

  constructor({
    cryptosys,
    masterkey,
    pubkey,
    privkey,
    id,
    index,
    t,
    n,
  }: KeypairProps) {
    this.cryptosys = cryptosys
    this.masterkey = masterkey
    this.pubkey = pubkey
    this.privkey = privkey
    this.id = id
    this.index = index
    this.t = t
    this.n = n
  }

  /**
   * Instantiate a keypair
   * @param secret User's secret
   * @returns A keypair instant
   */
  static fromSecret = (secret: string): Keypair => {
    const [scheme, masterkey, share] = secret.split('/')
    const cryptosys = parseScheme(scheme)
    const {
      share: privkey,
      id,
      index,
      t,
      n,
    } = SecretSharing.extract(decode(share))
    return new Keypair({
      cryptosys,
      masterkey: decode(masterkey),
      privkey,
      pubkey: getPubkey(cryptosys, privkey),
      id,
      index,
      t,
      n,
    })
  }

  /**
   * Construct the secret string
   * @returns Secret string
   */
  toSecret = (): string => {
    const scheme = parseCryptoSys(this.cryptosys)
    const share = SecretSharing.compress({
      index: this.index,
      t: this.t,
      n: this.n,
      id: this.id,
      share: this.privkey,
    })
    return `${scheme}/${encode(this.masterkey)}/${encode(share)}`
  }

  /**
   * Partially sign a message
   * @param msg Message to be signed
   * @returns Signature
   */
  sign = async (msg: Uint8Array): Promise<Uint8Array> => {
    switch (this.cryptosys) {
      case CryptoSys.EdDSA:
        return EdUtil.sign(msg, this.privkey)
      case CryptoSys.ECDSA:
        return ECUtil.sign(msg, this.privkey)
      default:
        throw new Error('Invalid desig secret format')
    }
  }
}
