import { sha512 } from '@noble/hashes/sha512'
import { decode, encode } from 'bs58'
import { Connection } from './connection'
import { DEFAULT_CLUSTER_URL } from './constants'
import { Keypair } from './keypair'
import { MultisigEntity } from './multisig'
import { SignerEntiry } from './signer'
import { getTSS } from './utils'

export type SignatureEntity = {
  id: number
  signature: string
  randomness: string
  signer: SignerEntiry
  createdAt: Date
  updatedAt: Date
}

export type TransactionEntity = {
  id: string
  multisig: MultisigEntity
  signatures: SignatureEntity[]
  msg: string
  R: string
  createdAt: Date
  updatedAt: Date
}

export class Transaction extends Connection {
  constructor(keypair: Keypair, cluster: string = DEFAULT_CLUSTER_URL) {
    super(keypair, cluster)
  }

  /**
   * Derive the transaction id by its content
   * @param msg Transaction's content (Or message)
   * @returns The transaction id
   */
  static deriveTxId = (msg: Uint8Array): string => encode(sha512(msg))

  /**
   * Fetch transaction data. Note that it's only about multisig info.
   * @param id Transaction id
   * @returns Transaction data
   */
  fetch = async (id: string): Promise<TransactionEntity> => {
    const { data } = await this.connection.get<TransactionEntity>(
      `/transaction/${id}`,
    )
    return data
  }

  /**
   * Submit a transaction to desig cluster
   * @param message Mesage buffer
   * @returns Transaction data
   */
  initialize = async ({
    message,
  }: {
    message: Uint8Array
  }): Promise<TransactionEntity> => {
    const multisigId = encode(this.keypair.masterkey)
    const msg = encode(message)
    const authorization = await this.getAuthorization()
    const { data } = await this.connection.post<TransactionEntity>(
      '/transaction',
      {
        multisigId,
        msg,
      },
      { headers: { authorization } },
    )
    return data
  }

  /**
   * Approve the transaction.
   * You will need to submit the commitment in the 1st round to be able to join the 2nd round of signing.
   * @param id Transaction id
   * @returns Transaction data
   */
  approve = async (id: string): Promise<TransactionEntity> => {
    const { msg, signatures, R } = await this.fetch(id)
    const { randomness } = signatures.find(
      ({ signer: { id } }) => id === encode(this.keypair.pubkey),
    )
    const tss = getTSS(this.keypair.cryptosys)
    const signature = tss.sign(
      decode(msg),
      decode(R),
      this.keypair.masterkey,
      decode(randomness).subarray(32),
      this.keypair.privkey,
    )
    const authorization = await this.getAuthorization()
    const { data } = await this.connection.patch<TransactionEntity>(
      `/transaction/${id}`,
      { signature: encode(signature) },
      { headers: { authorization } },
    )
    return data
  }
}
