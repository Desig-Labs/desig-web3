import { Socket } from 'socket.io-client'
import { Connection } from './connection'
import { CryptoSys } from '@desig/supported-chains'
import { DesigECDSAKeypair, DesigEdDSAKeypair } from './keypair'
import { concatBytes } from '@noble/hashes/utils'
import { keccak_256 } from '@noble/hashes/sha3'
import { decode, encode } from 'bs58'
import {
  MultisigEntity,
  PaginationParams,
  TransactionEntity,
  TransactionParams,
  TransactionType,
} from './types'
import { ECCurve, EdCurve, ElGamal, SecretSharing } from '@desig/core'

export class Selector {
  private selectors: Record<TransactionType, Uint8Array> = {
    changeName: keccak_256('changeName').subarray(0, 8),
    tExtension: keccak_256('tExtension').subarray(0, 8),
    tReduction: keccak_256('tReduction').subarray(0, 8),
    nExtension: keccak_256('nExtension').subarray(0, 8),
    nReduction: keccak_256('nReduction').subarray(0, 8),
  }

  getType = (selector: Uint8Array) => {
    const type = Object.keys(this.selectors).find(
      (key: TransactionType) =>
        Buffer.compare(this.selectors[key], selector) === 0,
    ) as TransactionType | undefined
    if (!type) throw new Error('Invalid transaction type')
    return type
  }

  getSelector = (type: TransactionType) => this.selectors[type]
}

export class Transaction extends Connection {
  private socket: Socket

  constructor(
    cluster: string,
    cryptosys: CryptoSys,
    privkey: Uint8Array,
    keypair: DesigEdDSAKeypair | DesigECDSAKeypair,
  ) {
    super(cluster, cryptosys, { privkey, keypair })
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
   * Get a transaction data. Note that it's only about multisig info.
   * @param id Transaction id
   * @returns Transaction data
   */
  getTransaction = async (id: string): Promise<TransactionEntity> => {
    const Authorization = await this.getNonceAuthorization()
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

  /**
   * Sign a transaction.
   * @param id Transaciton id
   * @param executable Execute the transaction btw
   * @returns Transaciton data
   */
  signTransaction = async (id: string): Promise<TransactionEntity> => {
    if (this.keypair.cryptosys === CryptoSys.EdDSA)
      return this.signEdTransaction(id)
    if (this.keypair.cryptosys === CryptoSys.ECDSA)
      return this.signEcTransaction(id)
    throw new Error('Invalid crypto system')
  }
  private signEdTransaction = async (id: string) => {
    const selector = new Selector()
    const elgamal = new ElGamal(EdCurve)
    const secretSharing = new SecretSharing(EdCurve.ff)
    const { msg, raw } = await this.getTransaction(id)
    let sig = this.sign(decode(msg))
    sig = concatBytes(new Uint8Array([sig.length]), sig)

    const txData = decode(raw)
    const txType = selector.getType(txData.subarray(0, 8))
    const publen = txData[40]
    if (txType === 'changeName') {
      // Nothing
    } else if (txType === 'nExtension') {
      const offset = txData
        .subarray(41 + publen)
        .findIndex(
          (_, i, o) =>
            i % 136 === 0 &&
            Buffer.compare(o.subarray(i, i + 8), this.keypair.index) === 0,
        )
      const r = txData
        .subarray(72) // multisig info
        .subarray(offset) // my offset
        .subarray(8) // my index
        .subarray(32) // my pubkey
        .subarray(32, 64)
      const z = EdCurve.ff.add(this.keypair.share, r)
      sig = concatBytes(sig, z)
    } else if (txType === 'nReduction') {
      const offset = txData
        .subarray(41 + publen)
        .findIndex(
          (_, i, o) =>
            i % 136 === 0 &&
            Buffer.compare(o.subarray(i, i + 8), this.keypair.index) === 0,
        )
      const r = txData
        .subarray(72) // multisig info
        .subarray(offset) // my offset
        .subarray(8) // my index
        .subarray(32) // my pubkey
        .subarray(32, 64)
      const z = EdCurve.ff.add(this.keypair.share, r)
      sig = concatBytes(sig, z)
    } else throw new Error('Invalid transaction type')

    const Authorization = await this.getNonceAuthorization()
    const { data } = await this.connection.patch<TransactionEntity>(
      `/transaction/${id}`,
      { signature: encode(sig) },
      { headers: { Authorization } },
    )
    return data
  }
  private signEcTransaction = async (id: string) => {
    const selector = new Selector()
    const elgamal = new ElGamal(ECCurve)
    const secretSharing = new SecretSharing(ECCurve.ff)
    const { msg, raw } = await this.getTransaction(id)
    let sig = this.sign(decode(msg))
    sig = concatBytes(new Uint8Array([sig.length]), sig)

    const txData = decode(raw)
    const txType = selector.getType(txData.subarray(0, 8))
    const publen = txData[40]
    if (txType === 'changeName') {
      // Nothing
    } else if (txType === 'nExtension') {
      const offset = txData
        .subarray(41 + publen)
        .findIndex(
          (_, i, o) =>
            i % 136 === 0 &&
            Buffer.compare(o.subarray(i, i + 8), this.keypair.index) === 0,
        )
      const r = txData
        .subarray(72) // multisig info
        .subarray(offset) // my offset
        .subarray(8) // my index
        .subarray(32) // my pubkey
        .subarray(32, 64)
      const z = ECCurve.ff.add(this.keypair.share, r)
      sig = concatBytes(sig, z)
    } else if (txType === 'nReduction') {
      const offset = txData
        .subarray(41 + publen)
        .findIndex(
          (_, i, o) =>
            i % 136 === 0 &&
            Buffer.compare(o.subarray(i, i + 8), this.keypair.index) === 0,
        )
      const r = txData
        .subarray(72) // multisig info
        .subarray(offset) // my offset
        .subarray(8) // my index
        .subarray(32) // my pubkey
        .subarray(32, 64)
      const z = ECCurve.ff.add(this.keypair.share, r)
      sig = concatBytes(sig, z)
    } else throw new Error('Invalid transaction type')

    const Authorization = await this.getNonceAuthorization()
    const { data } = await this.connection.patch<TransactionEntity>(
      `/transaction/${id}`,
      { signature: encode(sig) },
      { headers: { Authorization } },
    )
    return data
  }

  /**
   * Execute a transaction.
   * @param id Transaciton id
   * @param executable Execute the transaction btw
   * @returns Transaciton data
   */
  execTransaction = async (id: string): Promise<MultisigEntity> => {
    const Authorization = await this.getNonceAuthorization()
    const { data } = await this.connection.get<MultisigEntity>(
      `/transaction/exec/${id}`,
      { headers: { Authorization } },
    )
    return data
  }
}
