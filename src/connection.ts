import { sync } from '@noble/ed25519'
import { EdCurve } from '@desig/core'
import { CryptoSys } from '@desig/supported-chains'
import axios, { AxiosInstance } from 'axios'
import { decode, encode } from 'bs58'
import { DesigECDSAKeypair, DesigEdDSAKeypair } from './keypair'
import type { MultisigEntity } from './types'
import { concatBytes } from '@noble/hashes/utils'

export class Connection {
  protected readonly connection: AxiosInstance
  public readonly privkey?: Uint8Array
  public readonly keypair?: DesigEdDSAKeypair | DesigECDSAKeypair

  constructor(
    public readonly cluster: string,
    public readonly cryptosys: CryptoSys,
    {
      privkey,
      keypair,
    }: Partial<{
      privkey: Uint8Array
      keypair: DesigEdDSAKeypair | DesigECDSAKeypair
    }> = {},
  ) {
    this.connection = axios.create({ baseURL: this.cluster })
    this.privkey = privkey
    this.keypair = keypair
    if (this.keypair && this.keypair.cryptosys !== this.cryptosys)
      throw new Error('Invalid crypto system')
  }

  get owner() {
    if (!this.privkey)
      throw new Error('Cannot run this function without private key')
    const pubkey = EdCurve.getPublicKey(this.privkey)
    return encode(pubkey)
  }

  get index() {
    if (!this.keypair)
      throw new Error('Cannot run this function without keypair')
    const { index } = this.keypair.getThreshold()
    return index
  }

  /**
   * Get current nonce of the keypair
   * @param address Keypair's address
   * @returns The most current nonce
   */
  private _nonce = async (address: string): Promise<number> => {
    const multisigId = encode(this.keypair.masterkey)
    const {
      data: { nonce },
    } = await this.connection.get<MultisigEntity>(`/multisig/${multisigId}`)
    if (typeof nonce !== 'number')
      throw new Error(`Cannot get nonce of ${address} from ${this.cluster}`)
    return nonce
  }

  /**
   * Get current nonce of the keypair
   * Nonce is the incremental hash (SHA512) of the pubkey
   * @returns The most current nonce
   */
  protected getNonce = async () => {
    return this._nonce(this.index)
  }

  /**
   * Sign the index-appended message
   * (The signed message always is appended  by his/her index to prevent unintended transactions)
   * @param message The signed message
   * @returns Signature
   */
  protected sign = (message: Uint8Array) => {
    const msg = concatBytes(decode(this.index), message)
    const sig = sync.sign(msg, this.privkey)
    return sig
  }

  /**
   * Get the most valid authorization on current nonce
   * @returns The Basic authorization header
   */
  protected getNonceAuthorization = async () => {
    if (!this.privkey)
      throw new Error('Cannot run this function with a read-only keypair')
    const nonce = await this.getNonce()
    const sig = this.sign(new TextEncoder().encode(String(nonce)))
    const credential = `${this.index}/${encode(sig)}`
    return `Bearer ${credential}`
  }

  protected getTimestampAuthorization = async () => {
    if (!this.owner)
      throw new Error('Cannot run this function with a read-only keypair')
    const token = JSON.stringify({
      from: this.owner,
      to: this.cluster,
      expiredAt: Date.now() + 3000, // 3s
    })
    const msg = new TextEncoder().encode(token)
    const sig = sync.sign(msg, this.privkey)
    const credential = `${encode(msg)}/${encode(sig)}`
    return `Bearer ${credential}`
  }

  /**
   * Health check
   * @returns true/false
   */
  protected health = async () => {
    try {
      await axios.get(`${this.cluster}/health`)
      return true
    } catch (er: any) {
      return false
    }
  }
}
