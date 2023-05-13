import { sync } from '@noble/ed25519'
import { EdCurve } from '@desig/core'
import axios, { AxiosInstance } from 'axios'
import { encode } from 'bs58'
import { DesigKeypair } from './keypair'
import { concatBytes } from '@noble/hashes/utils'
import { keccak_256 } from '@noble/hashes/sha3'
import WebSocket from 'isomorphic-ws'

export enum EventStreaming {
  signer = 'signer',
  approval = 'approval',
  signature = 'signature',
}

export class Connection {
  protected readonly connection: AxiosInstance
  private sockets: Record<string, WebSocket> = {}

  constructor(
    public readonly cluster: string,
    public readonly privkey: Uint8Array,
    public readonly keypair?: DesigKeypair,
  ) {
    this.connection = axios.create({ baseURL: this.cluster })
  }

  get owner() {
    const pubkey = EdCurve.getPublicKey(this.privkey)
    return encode(pubkey)
  }

  get index() {
    if (!this.keypair)
      throw new Error('Cannot run this function without the keypair')
    const { index } = this.keypair.getThreshold()
    return index
  }

  /**
   * Sign the index-appended message
   * (The signed message always is appended  by his/her index to prevent unintended transactions)
   * @param signerId The signer id
   * @param message The signed message
   * @returns Signature
   */
  protected sign = (signerId: Uint8Array, message: Uint8Array) => {
    const msg = concatBytes(signerId, message)
    const sig = sync.sign(msg, this.privkey)
    return sig
  }

  /**
   * Get the most valid signature-based authorization
   * @returns The Bearer authorization header
   */
  protected getAuthorization = async (data: object) => {
    const hash = keccak_256(
      JSON.stringify({ signer: this.owner, verifier: this.cluster, data }),
    )
    const sig = sync.sign(hash, this.privkey)
    const credential = `${this.owner}/${encode(sig)}`
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

  /**
   * Get a websocket client
   * @param event Event
   * @param param owner / signerId
   * @returns
   */
  private io = (event: EventStreaming, param: string) => {
    const route = `${event}/${param}`
    if (!this.sockets[route])
      this.sockets[route] = new WebSocket(
        `${this.connection.getUri()}/ws/${route}`.replace('http', 'ws'),
      )
    return this.sockets[route]
  }

  /**
   * Event streaming
   * @param event Event
   * @param param owner / signerId
   */
  public on = (
    event: EventStreaming,
    param: string,
    callback: (id: string) => void = () => {},
  ) => {
    const socket = this.io(event, param)
    socket.onmessage = ({ data }) => callback(data.toString())
    return () => socket.terminate()
  }
}
