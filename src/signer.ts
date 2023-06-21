import { ElGamal, ExtendedElGamal, SecretSharing } from '@desig/core'
import { decode, encode } from 'bs58'
import { Connection, EventStreaming } from './connection'
import type {
  MultisigEntity,
  SignatureEntity,
  SignerEntity,
  TransactionEntity,
} from './types'
import { concatBytes } from '@noble/hashes/utils'
import { DesigKeypair } from './keypair'
import { ec } from './utils'
import { TransactionParser } from './transaction/transaction.parser'

export class Signer extends Connection {
  constructor(cluster: string, privkey: string) {
    super(cluster, decode(privkey))
  }

  /**
   * Watch new signer
   * @param callback
   * @returns Close function
   */
  watch = (callback: (signerId: string, er?: string) => void) => {
    const unwatch = this.on(EventStreaming.signer, this.owner, callback)
    return unwatch
  }

  /**
   * Get all signers data
   * @returns Signer data
   */
  getAllSigners = async (filter: Partial<{ multisigId: string }> = {}) => {
    const { data } = await this.connection.get<
      Array<SignerEntity & { multisig: MultisigEntity }>
    >('/signer', {
      params: { owner: this.owner },
    })
    return data
  }

  /**
   * Get signer data
   * @param signer Signer id
   * @returns Signer data
   */
  getSigner = async (signerId: string) => {
    const { data } = await this.connection.get<
      SignerEntity & { multisig: MultisigEntity }
    >(`/signer/${signerId}`)
    return data
  }

  /**
   * Activate the signer
   * @param signerId Signer id
   * @returns Signer data
   */
  activateSigner = async (signerId: string) => {
    let {
      encryptedShare,
      genesis,
      multisig: { id: multisigId, curve },
    } = await this.getSigner(signerId)
    if (!encryptedShare) {
      const txParser = new TransactionParser()
      const extendedElgamal = new ExtendedElGamal()
      const elgamal = new ElGamal()
      const ff = ec[curve].ff
      const sss = new SecretSharing(ff)
      const {
        data: { raw, signatures },
      } = await this.connection.get<
        TransactionEntity & {
          signatures: Array<SignatureEntity & { signer: SignerEntity }>
        }
      >(`/transaction/${genesis}`)
      // Compute the share
      const tx = decode(raw)
      const { refgid, t, n, kr } = txParser.nExtension.decode(tx)
      const _t = ff.decode(ff.numberToRedBN(Number(t)), 8)
      const _n = ff.decode(ff.numberToRedBN(Number(n)), 8)
      const z = sss.interpolate(
        decode(signerId),
        signatures
          .filter(({ signature }) => !!signature)
          .map(({ signature, signer: { id } }) => [
            decode(id),
            decode(signature),
          ])
          .map(([index, signature]) => {
            const commitment = signature.subarray(64)
            return concatBytes(index, _t, _n, refgid, commitment)
          }),
      )
      const r = elgamal.decrypt(kr, this.privkey)
      const s = sss.ff.sub(z, r)
      const share = concatBytes(decode(signerId), _t, _n, refgid, s)
      const secret = `${curve}/${multisigId}/${encode(share)}`
      // Encrypt the share
      encryptedShare = encode(
        extendedElgamal.encrypt(
          new TextEncoder().encode(secret),
          decode(this.owner),
        ),
      )
    }
    // Activate the signer
    const payload = { activated: true, encryptedShare }
    const Authorization = await this.getAuthorization(payload)
    const { data } = await this.connection.patch<
      SignerEntity & { multisig: MultisigEntity }
    >(`/signer/${signerId}`, payload, {
      headers: {
        Authorization,
      },
    })
    return data
  }

  getSignerKeypair = async (signerId: string) => {
    const { encryptedShare } = await this.getSigner(signerId)
    const elgamal = new ExtendedElGamal()
    const buf = elgamal.decrypt(decode(encryptedShare), this.privkey)
    const secretKey = new TextDecoder().decode(buf)
    return new DesigKeypair(secretKey)
  }
}
