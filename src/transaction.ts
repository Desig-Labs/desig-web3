import {
  ECCurve,
  EdCurve,
  ElGamal,
  ExtendedElGamal,
  SecretSharing,
} from '@desig/core'
import { Connection } from './connection'
import { DesigKeypair } from './keypair'
import { bytesToHex, concatBytes } from '@noble/hashes/utils'
import { keccak_256 } from '@noble/hashes/sha3'
import { decode, encode } from 'bs58'
import {
  MultisigEntity,
  PaginationParams,
  SignatureEntity,
  SignerEntity,
  TransactionEntity,
  TransactionParams,
  TransactionType,
} from './types'
import { compare } from './utils'
import { Curve } from '@desig/supported-chains'

export class Selector {
  private selectors: Record<TransactionType, Uint8Array> = {
    nExtension: keccak_256(TransactionType.nExtension).subarray(0, 8),
    nReduction: keccak_256(TransactionType.nReduction).subarray(0, 8),
    tExtension: keccak_256(TransactionType.tExtension).subarray(0, 8),
    tReduction: keccak_256(TransactionType.tReduction).subarray(0, 8),
  }

  getType = (selector: Uint8Array) => {
    const type = Object.keys(this.selectors).find((key: TransactionType) =>
      compare(this.selectors[key], selector),
    ) as TransactionType
    if (!type) throw new Error('Invalid transaction type')
    return type
  }

  getSelector = (type: TransactionType) => this.selectors[type]
}

export class Transaction extends Connection {
  public sss: SecretSharing

  constructor(cluster: string, privkey: string, keypair: DesigKeypair) {
    super(cluster, decode(privkey), keypair)
    this.sss = (() => {
      switch (this.keypair.curve) {
        case Curve.ed25519:
          return new SecretSharing(EdCurve.ff)
        case Curve.secp256k1:
          return new SecretSharing(ECCurve.ff)
        default:
          throw new Error('Unsupported elliptic curve.')
      }
    })()
  }

  /**
   * Derive the transaction id by its content
   * @param msg Transaction's content (Or message)
   * @returns The transaction id
   */
  static deriveTransactionId = (msg: string) =>
    encode(decode(msg).subarray(0, 8))

  /**
   * Get transactions data.
   * @param filter.approved Approved
   * @param pagination.limit Limit
   * @param pagination.offset Offset
   * @returns Transaction data
   */
  getTransactions = async (
    { approved }: Partial<{ approved: boolean }> = {},
    { offset = 0, limit = 500 }: Partial<PaginationParams> = {},
  ) => {
    const params: PaginationParams & any = { limit, offset }
    if (typeof approved === 'boolean') params.approved = approved
    const { data } = await this.connection.get<TransactionEntity[]>(
      '/transaction',
      {
        params,
      },
    )
    return data
  }

  /**
   * Get a transaction data.
   * @param transactionId Transaction id
   * @returns Transaction data
   */
  getTransaction = async (transactionId: string) => {
    const { data } = await this.connection.get<
      TransactionEntity & {
        signatures: Array<SignatureEntity & { signer: SignerEntity }>
      }
    >(`/transaction/${transactionId}`)
    return data
  }

  /**
   * Get a signature data.
   * @param signatureId Signature id
   * @returns Signature data
   */
  getSignature = async (signatureId: string) => {
    const { data } = await this.connection.get<
      SignatureEntity & { transaction: TransactionEntity; signer: SignerEntity }
    >(`/signature/${signatureId}`)
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
  }) => {
    const payload = {
      multisig: encode(this.keypair.masterkey),
      type,
      params,
    }
    const Authorization = await this.getAuthorization(payload)
    const { data } = await this.connection.post<
      Awaited<ReturnType<typeof this.getTransaction>>
    >('/transaction', payload, { headers: { Authorization } })
    return data
  }

  /**
   * Sign a transaction.
   * @param transactionId Transaciton id
   * @param executable Execute the transaction btw
   * @returns Signature data
   */
  signTransaction = async (transactionId: string) => {
    // Heroes
    const selector = new Selector()
    const elgamal = new ElGamal()
    const { msg, raw, signatures } = await this.getTransaction(transactionId)
    const { pullrequest } = signatures.find(
      ({ signer: { id } }) => id === this.index,
    )
    // Auth signature
    let sig = this.sign(decode(msg), decode(this.index))
    // Handle transaction
    const tx = decode(raw)
    const txType = selector.getType(tx.subarray(0, 8))
    // n-Extension: Publish z = s + r
    if (txType === TransactionType.nExtension) {
      const r = elgamal.decrypt(
        decode(pullrequest).subarray(0, 64),
        this.privkey,
      )
      const z = this.sss.ff.add(this.keypair.share, r)
      sig = concatBytes(sig, z)
    }
    // n-Reduction: Do nothing
    else if (txType === TransactionType.nReduction) {
    }
    // t-Extension: Do nothing
    else if (txType === TransactionType.tExtension) {
    }
    // t-Reduction
    else if (txType === TransactionType.tReduction) {
      const r = elgamal.decrypt(
        decode(pullrequest).subarray(0, 64),
        this.privkey,
      )
      const z = this.sss.ff.add(this.keypair.share, r)
      sig = concatBytes(sig, z)
    }
    // Invalid transaction type
    else throw new Error('Invalid transaction type')
    // Submit result
    const payload = { signature: encode(sig) }
    const Authorization = await this.getAuthorization(payload)
    const { data } = await this.connection.patch<
      Awaited<ReturnType<typeof this.getSignature>>
    >(`/transaction/${transactionId}`, payload, { headers: { Authorization } })
    return data
  }

  /**
   * Execute a transaction.
   * @param transactionId Transaciton id
   * @param executable Execute the transaction btw
   * @returns Transaciton data
   */
  execTransaction = async (transactionId: string) => {
    const { data } = await this.connection.get<
      Awaited<ReturnType<typeof this.getTransaction>>
    >(`/transaction/exec/${transactionId}`)
    return data
  }

  /**
   * Sync transactions to a signer
   * @param signer Signer id
   * @returns Signer data
   */
  syncTransaction = async () => {
    const selector = new Selector()
    const extendedElgamal = new ExtendedElGamal()
    const elgamal = new ElGamal()
    const txs = await this.getTransactions({ approved: true })
    const currentPos = txs.findIndex(
      ({ raw }) => encode(decode(raw).subarray(8, 16)) === this.index,
    )
    const waitingTxs = txs.slice(0, currentPos + 1)
    while (waitingTxs.length) {
      const { id: transactionId, raw } = waitingTxs.pop()
      const { signatures } = await this.getTransaction(transactionId)
      const { pullrequest } = signatures.find(
        ({ signer: { id } }) => id === this.index,
      )
      const tx = decode(raw)
      const txType = selector.getType(tx.subarray(0, 8))
      const gid = tx.subarray(8, 16)
      const t = tx.subarray(16, 24)
      const n = tx.subarray(24, 32)
      // n-Extension
      if (txType === TransactionType.nExtension) {
        const zero = elgamal.decrypt(
          decode(pullrequest).subarray(64, 128),
          this.privkey,
        )
        this.keypair.proactivate(
          concatBytes(this.keypair.index, t, n, decode(transactionId), zero),
        )
      }
      // n-Reduction
      else if (txType === TransactionType.nReduction) {
        const zero = elgamal.decrypt(decode(pullrequest), this.privkey)
        this.keypair.proactivate(
          concatBytes(this.keypair.index, t, n, decode(transactionId), zero),
        )
      }
      // t-Extension
      else if (txType === TransactionType.tExtension) {
        const zero = elgamal.decrypt(decode(pullrequest), this.privkey)
        this.keypair.proactivate(
          concatBytes(this.keypair.index, t, n, decode(transactionId), zero),
        )
      }
      // t-Reduction
      else if (txType === TransactionType.tReduction) {
        const zero = elgamal.decrypt(
          decode(pullrequest).subarray(64, 128),
          this.privkey,
        )
        const shares = signatures
          .filter(({ signature }) => !!signature)
          .map(({ signature, signer: { id } }) => [
            decode(id),
            decode(signature),
          ])
          .map(([id, signature]) => {
            const commitment = signature.subarray(64)
            return concatBytes(id, t, n, gid, commitment)
          })
        const z = this.sss.ff.neg(
          this.sss.ff.mul(
            this.sss.ft1(shares),
            this.sss.ff.pow(
              this.keypair.index,
              this.sss.ff.encode(t).toNumber(),
            ),
          ),
        )
        this.keypair.proactivate(
          concatBytes(this.keypair.index, t, n, decode(transactionId), z),
        )
        this.keypair.proactivate(
          concatBytes(this.keypair.index, t, n, decode(transactionId), zero),
        )
      } else throw new Error('Invalid Desig transaction type')
    }

    const encryptedShare = encode(
      extendedElgamal.encrypt(
        new TextEncoder().encode(this.keypair.getSecretKey()),
        decode(this.owner),
      ),
    )
    const payload = { activated: true, encryptedShare }
    const Authorization = await this.getAuthorization(payload)
    const { data } = await this.connection.patch<
      SignerEntity & { multisig: MultisigEntity }
    >(`/signer/${this.index}`, payload, { headers: { Authorization } })
    return data
  }
}
