import { ElGamal, ExtendedElGamal, SecretSharing } from '@desig/core'
import { decode, encode } from 'bs58'
import { Connection } from './connection'
import type { MultisigEntity, SignerEntity, TransactionEntity } from './types'
import { concatBytes } from '@noble/hashes/utils'
import { DesigKeypair } from './keypair'
import { ec } from './utils'

export class Signer extends Connection {
  constructor(cluster: string, privkey: string) {
    super(cluster, decode(privkey))
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
      multisig: { curve },
    } = await this.getSigner(signerId)
    if (!encryptedShare) {
      const extendedElgamal = new ExtendedElGamal()
      const elgamal = new ElGamal()
      const sss = new SecretSharing(ec[curve].ff)
      const {
        data: {
          raw,
          signatures,
          multisig: { id: multisigId },
        },
      } = await this.connection.get<TransactionEntity>(
        `/transaction/${genesis}`,
      )
      // Compute the share
      const txData = decode(raw)
      const k = txData.subarray(txData.length - 136).subarray(0, 8)
      const gid = txData.subarray(8, 16)
      const t = txData.subarray(16, 24)
      const n = sss.ff.decode(
        sss.ff.encode(txData.subarray(24, 32)).redSub(sss.ff.ONE),
        8,
      )
      const z = sss.interpolate(
        k,
        signatures
          .filter(({ signature }) => !!signature)
          .map(({ signature, signer: { id } }) => [
            decode(id),
            decode(signature),
          ])
          .map(([index, commitment]) => {
            const siglen = commitment[0]
            const c = commitment.subarray(1).subarray(siglen)
            return concatBytes(index, t, n, gid, c)
          }),
      )
      const r = elgamal.decrypt(
        txData
          .subarray(txData.length - 136)
          .subarray(8)
          .subarray(0, 64),
        this.privkey,
      )
      const s = sss.ff.sub(z, r)
      const share = concatBytes(k, t, n, gid, s)
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
