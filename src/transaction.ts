import { EdUtil } from '@desig/core'
import { utils } from '@noble/ed25519'
import { sha512 } from '@noble/hashes/sha512'
import { decode, encode } from 'bs58'
import { Connection } from './connection'
import { DEFAULT_CLUSTER_URL } from './constants'
import { Keypair } from './keypair'
import { getCurve } from './utils'

export type SignerEntiry = {
  id: string
  nonce: string
  activated: boolean
}

export type RandomnessEntity = {
  id: string
  signer: SignerEntiry
}

export type TransactionEntity = {
  id: string
  msg: string
  signature: string
  randomnesses: RandomnessEntity[]
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
   * Generate a deterministic randomness for the digital signature algorithm based on message and and derived key
   * @param msg Transaction's content (Or message)
   * @returns The randomness
   */
  determineRandomness = (msg: Uint8Array): DeterministicRandomness => {
    const derikey = EdUtil.getDerivedKey(this.keypair.privkey)
    const seed = sha512(utils.concatBytes(derikey, msg))
    const curve = getCurve(this.keypair.cryptosys)
    const r = curve.mod(seed)
    const R = curve.baseMul(r)
    return { r, R }
  }

  /**
   * Fetch the transaction data. Note that it's only about multisig info.
   * @param id The transaction id
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

  approve = async (
    id: string,
  ): Promise<{ transaction: TransactionEntity; r: Uint8Array }> => {
    const { msg } = await this.fetch(id)
    const { r, R } = this.determineRandomness(decode(msg))
    const authorization = await this.getAuthorization()
    const { data } = await this.connection.patch(
      `/transaction/${id}`,
      { R: encode(R) },
      { headers: { authorization } },
    )
    return { transaction: data, r }
  }
}
