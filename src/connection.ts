import { sync } from '@noble/ed25519'
import { EdCurve } from '@desig/core'
import { CryptoSys } from '@desig/supported-chains'
import axios, { AxiosInstance } from 'axios'
import { decode, encode } from 'bs58'
import { DesigECDSAKeypair, DesigEdDSAKeypair } from './keypair'
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
   * Nonce is the incremental number of proposals & transactions
   * @param signerId Signer if
   * @returns The most current nonce
   */
  protected getNonce = async (signerId: string) => {
    const Authorization = await this.getTimestampAuthorization()
    const { data: nonce } = await this.connection.get<number>(
      `/signer/nonce/${signerId}`,
      { headers: { Authorization } },
    )
    return nonce
  }

  /**
   * Sign the index-appended message
   * (The signed message always is appended  by his/her index to prevent unintended transactions)
   * @param message The signed message
   * @param signerId The signer id
   * @returns Signature
   */
  protected sign = (message: Uint8Array, signerId: Uint8Array) => {
    const msg = concatBytes(signerId, message)
    const sig = sync.sign(msg, this.privkey)
    return sig
  }

  /**
   * Get the most valid authorization on current nonce
   * @returns The Basic authorization header
   */
  protected getNonceAuthorization = async () => {
    if (!this.privkey)
      throw new Error('Cannot run this function with a read-only mode')
    const nonce = await this.getNonce(this.index)
    const sig = this.sign(
      new TextEncoder().encode(String(nonce)),
      decode(this.index),
    )
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
