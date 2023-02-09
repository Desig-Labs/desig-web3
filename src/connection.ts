import axios, { AxiosInstance } from 'axios'
import { decode, encode } from 'bs58'
import { Keypair } from './keypair'

export class Connection {
  protected connection: AxiosInstance

  constructor(
    public readonly keypair: Keypair,
    public readonly cluster: string,
  ) {
    this.connection = axios.create({
      baseURL: this.cluster,
    })
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
    const {
      data: { nonce },
    } = await this.connection.get(`/signer/${address}`)
    if (!nonce)
      throw new Error(`Cannot get nonce of ${address} from ${this.cluster}`)
    return nonce
  }

  /**
   * Get the most valid authorization on current nonce
   * @param address Keypair's address
   * @param sign Keypair's sign function
   * @returns The Basic authorization header
   */
  private _authorization = async (
    address: string,
    sign: (msg: Uint8Array) => Promise<Uint8Array>,
  ) => {
    if (!address) throw new Error('Please provide address')
    if (!sign) throw new Error('Please provide sign function')
    const nonce = await this._nonce(address)
    const sig = await sign(decode(nonce))
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
  protected getNonce = async () => {
    return this._nonce(this.address)
  }

  /**
   * Get the most valid authorization on current nonce
   * @returns The Basic authorization header
   */
  protected getAuthorization = async () => {
    if (!this.keypair?.sign)
      throw new Error('Cannot run this function with a read-only keypair')
    return this._authorization(this.address, this.keypair.sign)
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
