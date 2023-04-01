import { EdUtil } from '@desig/core'
import { sign } from '@noble/ed25519'
import axios, { AxiosInstance } from 'axios'
import { decode, encode } from 'bs58'
import { DesigECDSAKeypair, DesigEdDSAKeypair } from './keypair'

export class Connection {
  protected readonly connection: AxiosInstance
  public readonly privkey?: Uint8Array
  public readonly keypair?: DesigEdDSAKeypair | DesigECDSAKeypair

  constructor(
    public readonly cluster: string,
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
  }

  get owner() {
    if (!this.privkey)
      throw new Error('Cannot run this function with a read-only keypair')
    const pubkey = EdUtil.getPublicKey(this.privkey)
    return encode(pubkey)
  }

  get address() {
    if (!this.keypair?.pubkey)
      throw new Error('Cannot run this function with a read-only keypair')
    return encode(this.keypair.pubkey)
  }

  /**
   * Get current nonce of the keypair
   * @param address Keypair's address
   * @returns The most current nonce
   */
  private _nonce = async (address: string): Promise<string> => {
    const { data: nonce } = await this.connection.get(
      `/signer/${address}/nonce`,
    )
    if (!nonce)
      throw new Error(`Cannot get nonce of ${address} from ${this.cluster}`)
    return nonce
  }

  /**
   * Get current nonce of the keypair
   * Nonce is the incremental hash (SHA512) of the pubkey
   * @returns The most current nonce
   */
  protected getNonce = async () => {
    return this._nonce(this.address)
  }

  /**
   * Get the most valid authorization on current nonce
   * @returns The Basic authorization header
   */
  protected getNonceAuthorization = async () => {
    if (!this.keypair?.sign)
      throw new Error('Cannot run this function with a read-only keypair')
    const nonce = await this.getNonce()
    const sig = await this.keypair.sign(decode(nonce))
    const credential = `${this.address}/${encode(sig)}`
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
    const sig = await sign(msg, this.privkey)
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
