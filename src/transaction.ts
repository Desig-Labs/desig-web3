import { CryptoSys } from '@desig/core'
import { sha512 } from '@noble/hashes/sha512'
import { decode, encode } from 'bs58'
import { Connection } from './connection'
import { DEFAULT_CLUSTER_URL } from './constants'
import { Keypair } from './keypair'
import { getTSS } from './utils'

export type SignerEntiry = {
  id: string
  index: number
  nonce: string
  activated: boolean
}

export type MultisigEntity = {
  id: string
  t: number
  n: number
  cryptosys: CryptoSys
  name: string
  signers: SignerEntiry[]
  createdAt: Date
  updatedAt: Date
}

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

export type DeterministicRandomness = {
  r: Uint8Array
  R: Uint8Array
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
   * Fetch the transaction data. Note that it's only about multisig info.
   * @param id Transaction id
   * @returns Transaction data
   */
  fetch = async (id: string): Promise<TransactionEntity> => {
    const { data } = await this.connection.get(`/transaction/${id}`)
    return data
  }

  /**
   * Submit the transaction to desig cluster
   * @param message Mesage buffer
   * @returns Transaction data
   */
  initialize = async (message: Uint8Array): Promise<TransactionEntity> => {
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
    const { data } = await this.connection.patch(
      `/transaction/${id}`,
      { signature: encode(signature) },
      { headers: { authorization } },
    )
    return data
  }
}
