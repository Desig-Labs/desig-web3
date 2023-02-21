import { SecretSharing } from '@desig/core'
import { utils } from '@noble/ed25519'
import { sha512 } from '@noble/hashes/sha512'
import { BN } from 'bn.js'
import { decode, encode } from 'bs58'
import { io, Socket } from 'socket.io-client'
import { Connection } from './connection'
import { DesigECDSAKeypair, DesigEdDSAKeypair } from './keypair'
import { MultisigEntity } from './multisig'
import { SignerEntiry } from './signer'
import { PaginationParams } from './types'
import { getCurve, getTSS } from './utils'

export type SignatureEntity = {
  id: number
  signature: string
  randomness: string
  signer: Omit<SignerEntiry, 'multisig'>
  createdAt: Date
  updatedAt: Date
}

export type TransactionEntity = {
  id: string
  multisig: Pick<MultisigEntity, 'id'>
  signatures: SignatureEntity[]
  msg: string
  raw: string
  R: string
  createdAt: Date
  updatedAt: Date
}

export type SignatureEvents = 'insertSignature' | 'updateSignature'
export type SignatureEventResponse = SignatureEntity & {
  transaction: Omit<TransactionEntity, 'signatures'>
}

export const SIGNATURE_EVENTS: SignatureEvents[] = [
  'insertSignature',
  'updateSignature',
]

export class Transaction extends Connection {
  private socket: Socket

  constructor(cluster: string, keypair: DesigEdDSAKeypair | DesigECDSAKeypair) {
    super(cluster, keypair)
  }

  /**
   * Derive the transaction id by its content
   * @param msg Transaction's content (Or message)
   * @returns The transaction id
   */
  static deriveTxId = (msg: Uint8Array): string => encode(sha512(msg))

  /**
   * Initialize a socket
   */
  private initSocket = () => {
    if (this.keypair) {
      if (!this.socket)
        this.socket = io(this.cluster, {
          auth: async (cb) => {
            const Authorization = await this.getAuthorization()
            return cb({ Authorization })
          },
        })
      this.socket.emit('transaction')
    } else this.socket = undefined
    return this.socket
  }

  /**
   * Watch signature changes
   * @param callback Callback event
   */
  watch = (
    callback: (event: SignatureEvents, data: SignatureEventResponse) => void,
  ) => {
    const socket = this.initSocket()
    SIGNATURE_EVENTS.forEach((event) =>
      socket.on(event, (res: SignatureEventResponse) => callback(event, res)),
    )
  }

  /**
   * Unwatch signature changes
   */
  unwatch = () => {
    this.socket.disconnect()
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
    const Authorization = await this.getAuthorization()
    const { data } = await this.connection.get<TransactionEntity[]>(
      `/transaction?limit=${limit}&offset=${offset}`,
      { headers: { Authorization } },
    )
    return data
  }

  /**
   * Get a transaction data. Note that it's only about multisig info.
   * @param id Transaction id
   * @returns Transaction data
   */
  getTransaction = async (id: string): Promise<TransactionEntity> => {
    const Authorization = await this.getAuthorization()
    const { data } = await this.connection.get<TransactionEntity>(
      `/transaction/${id}`,
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
    raw,
    msg,
  }: {
    raw: Uint8Array
    msg: Uint8Array
  }): Promise<TransactionEntity> => {
    const multisigId = encode(this.keypair.masterkey)
    const Authorization = await this.getAuthorization()
    const { data } = await this.connection.post<TransactionEntity>(
      '/transaction',
      {
        multisigId,
        msg: encode(msg),
        raw: encode(raw),
      },
      { headers: { Authorization } },
    )
    return data
  }

  /**
   * Approve the transaction.
   * You will need to submit the commitment in the 1st round to be able to join the 2nd round of signing.
   * @param id Transaction id
   * @returns Transaction data
   */
  approveTransaction = async (id: string): Promise<TransactionEntity> => {
    const { msg, signatures, R } = await this.getTransaction(id)
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
    const Authorization = await this.getAuthorization()
    const { data } = await this.connection.patch<TransactionEntity>(
      `/transaction/${id}`,
      { signature: encode(signature) },
      { headers: { Authorization } },
    )
    return data
  }

  /**
   * Finalize the partial signatures. The function will combine the partial signatures and construct the valid master signature.
   * @param id Transaction id
   * @returns Master signature
   */
  finalizeSignature = async (id: string): Promise<string> => {
    const curve = getCurve(this.keypair.cryptosys)
    const tss = getTSS(this.keypair.cryptosys)
    const secretSharing = new SecretSharing(curve.ff.r)
    const { t } = this.keypair.getThreshold()
    let { signatures } = await this.getTransaction(id)
    signatures = signatures.filter(({ signature }) => !!signature)
    if (signatures.length < t)
      throw new Error(
        `Insufficient number of signatures. Require ${t} but got ${signatures.length}.`,
      )
    const indice = signatures.map(({ signer: { index } }) =>
      new BN(index).toArrayLike(Buffer, 'le', 8),
    )
    const pi = secretSharing.pi(indice)
    const sigs = signatures.map(({ signature }, i) => {
      const sig = decode(signature)
      const R = curve.mulScalar(sig.subarray(0, 32), pi[i])
      const S = secretSharing.yl(sig.subarray(32), pi[i])
      return utils.concatBytes(R, S)
    })
    return encode(
      tss.addSig(
        sigs,
        new Uint8Array([]),
        new Uint8Array([]),
        new Uint8Array([]),
        new Uint8Array([]),
      ),
    )
  }

  /**
   * Verify a master signature
   * @param id Transaction id
   * @param signature Master signature
   * @returns true/false
   */
  verifySignature = async (id: string, signature: string) => {
    const { msg } = await this.getTransaction(id)
    const tss = getTSS(this.keypair.cryptosys)
    return tss.verify(decode(msg), decode(signature), this.keypair.masterkey)
  }
}
