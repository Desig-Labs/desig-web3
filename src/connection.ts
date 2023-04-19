import * as ed from '@noble/ed25519'
import * as ec from '@noble/secp256k1'
import { ECCurve, EdCurve } from '@desig/core'
import { CryptoSys } from '@desig/supported-chains'
import axios, { AxiosInstance } from 'axios'
import { encode } from 'bs58'
import { DesigECDSAKeypair, DesigEdDSAKeypair } from './keypair'
import type { MultisigEntity } from './types'

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
    const getPublicKey =
      this.cryptosys === CryptoSys.ECDSA
        ? ECCurve.getPublicKey
        : EdCurve.getPublicKey
    const pubkey = getPublicKey(this.privkey)
    return encode(pubkey)
  }

  get address() {
    if (!this.keypair?.pubkey)
      throw new Error('Cannot run this function without keypair')
    return encode(this.keypair.pubkey)
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
    const sig = this.keypair.sign(new TextEncoder().encode(String(nonce)))
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
    const sign = this.cryptosys === CryptoSys.ECDSA ? ec.signSync : ed.sync.sign
    const sig = sign(msg, this.privkey)
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
