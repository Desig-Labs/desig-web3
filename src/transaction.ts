import { Socket } from 'socket.io-client'
import { Connection } from './connection'
import { CryptoSys } from '@desig/supported-chains'
import { DesigECDSAKeypair, DesigEdDSAKeypair } from './keypair'
import { concatBytes } from '@noble/hashes/utils'
import { decode, encode } from 'bs58'
import { keccak_256 } from '@noble/hashes/sha3'
import {
  PaginationParams,
  TransactionEntity,
  TransactionParams,
  TransactionType,
} from './types'

export class Transaction extends Connection {
  private socket: Socket

  constructor(
    cluster: string,
    cryptosys: CryptoSys,
    keypair: DesigEdDSAKeypair | DesigECDSAKeypair,
  ) {
    super(cluster, cryptosys, { keypair })
  }

  /**
   * Derive the transaction id by its content
   * @param multisigId Multisig id
   * @param msg Transaction's content (Or message)
   * @returns The transaction id
   */
  static deriveTransactionId = (
    multisigId: string,
    msg: Uint8Array,
  ): string => {
    const seed = concatBytes(decode(multisigId), msg)
    return encode(keccak_256(seed))
  }

  /**
   * Get transactions data. Note that it's only about multisig info.
   * @param pagination.limit Limit
   * @param pagination.offset Offset
   * @returns Transaction data
   */
  getTransactions = async ({
    offset = 0,
    limit = 500,
  }: Partial<PaginationParams>): Promise<TransactionEntity[]> => {
    const Authorization = await this.getNonceAuthorization()
    const { data } = await this.connection.get<TransactionEntity[]>(
      `/transaction?limit=${limit}&offset=${offset}`,
      { headers: { Authorization } },
    )
    return data
  }

  /**
   * Submit a transaction to desig cluster
   * @param raw Raw message
   * @param msg Message buffer (The sign data)
   * @returns Transaction data
   */
  initializeTransaction = async ({
    type,
    params,
  }: {
    type: TransactionType
    params: TransactionParams
  }): Promise<TransactionEntity> => {
    const Authorization = await this.getNonceAuthorization()
    const { data } = await this.connection.post<TransactionEntity>(
      '/transaction',
      {
        type,
        params,
      },
      { headers: { Authorization } },
    )
    return data
  }
}
