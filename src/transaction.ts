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
  SignerEntity,
  TransactionEntity,
  TransactionParams,
  TransactionType,
} from './types'
import {
  ECCurve,
  EdCurve,
  ElGamal,
  ExtendedElGamal,
  SecretSharing,
} from '@desig/core'
import { Signer } from './signer'

export class Selector {
  private selectors: Record<TransactionType, Uint8Array> = {
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
   * @param msg Transaction's content (Or message)
   * @returns The transaction id
   */
  static deriveTransactionId = (msg: string) =>
    encode(decode(msg).subarray(0, 8))

  /**
   * Get transactions data. Note that it's only about multisig info.
   * @param pagination.limit Limit
   * @param pagination.offset Offset
   * @returns Transaction data
   */
  getTransactions = async (
    { approved }: Partial<{ approved: boolean }>,
    { offset = 0, limit = 500 }: Partial<PaginationParams>,
  ): Promise<TransactionEntity[]> => {
    const Authorization = await this.getNonceAuthorization()
    let url = `/transaction?limit=${limit}&offset=${offset}`
    if (typeof approved === 'boolean') url = `${url}&approved=${approved}`
    const { data } = await this.connection.get<TransactionEntity[]>(url, {
      headers: { Authorization },
    })
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
    // Curve
    let curve: typeof EdCurve | typeof ECCurve
    if (this.cryptosys === CryptoSys.EdDSA) curve = EdCurve
    else if (this.cryptosys === CryptoSys.ECDSA) curve = ECCurve
    else throw new Error('Invalid crypto system')
    // Heroes
    const selector = new Selector()
    const elgamal = new ElGamal(curve)
    const secretSharing = new SecretSharing(curve.ff)
    const { msg, raw } = await this.getTransaction(id)
    // Auth signature
    let sig = this.sign(decode(msg))
    sig = concatBytes(new Uint8Array([sig.length]), sig)
    // Handle transaction
    const txData = decode(raw)
    const txType = selector.getType(txData.subarray(0, 8))
    // n-Extension
    if (txType === 'nExtension') {
      const offset = txData
        .subarray(64)
        .findIndex(
          (_, i, o) =>
            i % 136 === 0 &&
            Buffer.compare(o.subarray(i, i + 8), this.keypair.index) === 0,
        )
      const r = txData
        .subarray(64) // multisig info
        .subarray(offset) // my offset
        .subarray(8) // my index
        .subarray(32, 64)
      const z = curve.ff.add(this.keypair.share, r)
      sig = concatBytes(sig, z)
    }
    // n-Reduction
    else if (txType === 'nReduction') {
      const offset = txData
        .subarray(64)
        .findIndex(
          (_, i, o) =>
            i % 136 === 0 &&
            Buffer.compare(o.subarray(i, i + 8), this.keypair.index) === 0,
        )
      const r = txData
        .subarray(64) // multisig info
        .subarray(offset) // my offset
        .subarray(8) // my index
        .subarray(32, 64)
      const z = curve.ff.add(this.keypair.share, r)
      sig = concatBytes(sig, z)
    }
    // Invalid transaction type
    else throw new Error('Invalid transaction type')
    // Submit result
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

  /**
   * Sync transactions to a signer
   * @param signer Signer id
   * @returns Signer data
   */
  syncTransaction = async (): Promise<
    SignerEntity & { multisig: MultisigEntity }
  > => {
    // Curve
    let curve: typeof EdCurve | typeof ECCurve
    if (this.cryptosys === CryptoSys.EdDSA) curve = EdCurve
    else if (this.cryptosys === CryptoSys.ECDSA) curve = ECCurve
    else throw new Error('Invalid crypto system')
    const selector = new Selector()
    const signer = new Signer(this.cluster, this.cryptosys, this.privkey)

    const txs = await this.getTransactions({ approved: true }, {})
    const currentId = encode(this.keypair.id)
    const currentIndex = txs.findIndex(
      ({ raw }) => encode(decode(raw).subarray(8, 16)) === currentId,
    )
    console.log(currentId, currentIndex)
    const waitingTxs = txs.slice(0, currentIndex + 1)
    while (waitingTxs.length) {
      const { id, raw } = waitingTxs.pop()
      const tx = decode(raw)
      const txType = selector.getType(tx.subarray(0, 8))
      const txGid = encode(tx.subarray(8, 16))
      const txData = tx.subarray(64)
      if (txType === 'nExtension') {
        const offset = txData.findIndex(
          (_, i, o) =>
            i % 136 === 0 &&
            Buffer.compare(o.subarray(i, i + 8), this.keypair.index) === 0,
        )
        const zero = txData.subarray(offset).subarray(8).subarray(64, 128)
        this.keypair.proactivate(
          concatBytes(zero.subarray(0, 24), decode(id), zero.subarray(32, 64)),
        )
      } else if (txType === 'nReduction') {
      } else if (txType === 'tExtension') {
      } else if (txType === 'tReduction') {
      } else throw new Error('Invalid Desig transaction type')
      console.log(id, txType, txGid, txData.length)
    }

    const elgamal = new ExtendedElGamal()
    const encryptedShare = encode(
      elgamal.encrypt(
        new TextEncoder().encode(this.keypair.getSecret()),
        decode(this.owner),
      ),
    )
    const Authorization = await this.getTimestampAuthorization()
    const { data } = await this.connection.patch<
      SignerEntity & { multisig: MultisigEntity }
    >(
      `/signer/${this.index}`,
      {
        activated: true,
        encryptedShare,
      },
      { headers: { Authorization } },
    )
    return data
  }
}
