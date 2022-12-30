import { CryptoScheme } from '@desig/core'
import axios, { AxiosInstance } from 'axios'
import { decode, encode } from 'bs58'
import { DEFAULT_CLUSTER_URL } from './constants'
import { Keypair } from './keypair'
import { parseCryptoSys } from './utils'

export class Connection {
  private scheme: CryptoScheme
  protected connection: AxiosInstance

  constructor(
    public readonly keypair: Keypair,
    public readonly cluster: string = DEFAULT_CLUSTER_URL,
  ) {
    this.scheme = parseCryptoSys(this.keypair.cryptosys)
    this.connection = axios.create({
      baseURL: `${this.cluster}/${this.scheme}`,
    })
  }

  get address() {
    return encode(this.keypair.pubkey)
  }

  /**
   * Get current nonce of the keypair
   * @param address Keypair's address
   * @returns The most current nonce
   */
  private _nonce = async (address: string) => {
    const {
      data: { nonce },
    } = await axios.get(`/eddsa/signer/${address}`)
    return nonce
  }

  /**
   * Get the most valid authorization on current nonce
   * @param address Keypair's address
   * @param signMessage Keypair's sign function
   * @returns The Basic authorization header
   */
  private _authorization = async (
    address: string,
    signMessage: (msg: Uint8Array) => Promise<Uint8Array>,
  ) => {
    if (!address || !signMessage) return ''
    const nonce = await this._nonce(address)
    if (!nonce) return ''
    const sig = await signMessage(decode(nonce))
    const credentials = Buffer.from(`${address}:${encode(sig)}`).toString(
      'base64',
    )
    return `Basic ${credentials}`
  }

  /**
   * Get current nonce of the keypair
   * Nonce is the incremental hash (SHA512) of the pubkey
   * @returns The most current nonce
   */
  getNonce = async () => {
    return this._nonce(this.address)
  }

  /**
   * Get the most valid authorization on current nonce
   * @returns The Basic authorization header
   */
  getAuthorization = async () => {
    return this._authorization(this.address, this.keypair.sign)
  }

  /**
   * Health check
   * @returns true/false
   */
  health = async () => {
    try {
      await axios.get(`${this.cluster}/health`)
      return true
    } catch (er: any) {
      return false
    }
  }
}
