import { encode } from 'bs58'
import { Connection } from './connection'
import { DEFAULT_CLUSTER_URL } from './constants'
import { Keypair } from './keypair'

export type TransactionProps = {
  id: string
  msg: string
  signature: string
  createdAt: Date
  updatedAt: Date
}

export class Transaction extends Connection {
  constructor(keypair: Keypair, cluster: string = DEFAULT_CLUSTER_URL) {
    super(keypair, cluster)
  }

  /**
   * Submit the transaction to desig cluster
   * @param message
   * @returns
   */
  initTransaction = async (message: Uint8Array): Promise<TransactionProps> => {
    const multisigId = encode(this.keypair.masterkey)
    const msg = encode(message)
    const authorization = await this.getAuthorization()
    const { data } = await this.connection.post(
      '/transaction',
      {
        multisigId,
        msg,
      },
      { headers: { authorization } },
    )
    return data
  }
}
