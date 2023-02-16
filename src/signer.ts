import { decode, encode } from 'bs58'
import { Connection } from './connection'
import { DesigECDSAKeypair, DesigEdDSAKeypair } from './keypair'
import { MultisigEntity } from './multisig'

export type SignerEntiry = {
  id: string
  index: number
  nonce: string
  activated: boolean
  multisig: MultisigEntity
}

export class Signer extends Connection {
  public readonly id: string

  constructor(
    cluster: string,
    keypair?: DesigEdDSAKeypair | DesigECDSAKeypair,
  ) {
    super(cluster, keypair)

    this.id = encode(this.keypair.pubkey)
  }

  /**
   * Build the nonce authorization header
   * @returns Authorization header
   */
  authorize = async () => {
    const { nonce } = await this.fetch()
    if (!nonce) return ''
    const sig = await this.keypair.sign(decode(nonce))
    const credentials = Buffer.from(`${this.id}:${encode(sig)}`).toString(
      'base64',
    )
    return `Basic ${credentials}`
  }

  /**
   * Fetch signer data
   * @returns Signer data
   */
  fetch = async (): Promise<SignerEntiry> => {
    const { data } = await this.connection.get<SignerEntiry>(
      `/signer/${this.id}`,
    )
    return data
  }

  /**
   * Activate the signer
   * @returns Signer data
   */
  activate = async (): Promise<SignerEntiry> => {
    const { data } = await this.connection.get<SignerEntiry>('/signer/activate')
    return data
  }
}
