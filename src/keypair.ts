import { CryptoSys, ECUtil, EdUtil, SecretSharing } from '@desig/core'
import { decode, encode } from 'bs58'
import { getPubkey, parseCryptoSys, parseScheme } from './utils'

export class Keypair {
  public cryptosys: CryptoSys
  public masterkey: Uint8Array
  public pubkey: Uint8Array
  public privkey: Uint8Array
  public id: Uint8Array
  public index: Uint8Array
  public t: Uint8Array
  public n: Uint8Array

  constructor(secret: string) {
    const [scheme, masterkey, share] = secret.split('/')
    this.cryptosys = parseScheme(scheme)
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
    this.pubkey = getPubkey(this.cryptosys, this.privkey)
  }

  static fromSecret = (secret: string): Keypair => {
    return new Keypair(secret)
  }

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
