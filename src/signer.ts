import { encode } from 'bs58'
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
    const Authorization = await this.getAuthorization()
    const { data } = await this.connection.get<SignerEntiry>(
      '/signer/activate',
      {
        headers: {
          Authorization,
        },
      },
    )
    return data
  }
}
