import { ElGamal, ExtendedElGamal, SecretSharing } from '@desig/core'
import { decode, encode } from 'bs58'
import { Connection } from './connection'
import type {
  MultisigEntity,
  SignatureEntity,
  SignerEntity,
  TransactionEntity,
} from './types'
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
      multisig: { id: multisigId, curve },
    } = await this.getSigner(signerId)
    if (!encryptedShare) {
      const extendedElgamal = new ExtendedElGamal()
      const elgamal = new ElGamal()
      const sss = new SecretSharing(ec[curve].ff)
      const {
        data: { raw, signatures },
      } = await this.connection.get<
        TransactionEntity & {
          signatures: SignatureEntity[]
        }
      >(`/transaction/${genesis}`)
      // Compute the share
      const txData = decode(raw)
      const gid = txData.subarray(8, 16)
      const t = txData.subarray(16, 24)
      const n = sss.ff.decode(
        sss.ff.encode(txData.subarray(24, 32)).redSub(sss.ff.ONE),
        8,
      )
      const z = sss.interpolate(
        decode(signerId),
        signatures
          .filter(({ signature }) => !!signature)
          .map(({ signature, index }) => [decode(index), decode(signature)])
          .map(([index, signature]) => {
            const commitment = signature.subarray(64)
            return concatBytes(index, t, n, gid, commitment)
          }),
      )
      const r = elgamal.decrypt(txData.subarray(72, 136), this.privkey)
      const s = sss.ff.sub(z, r)
      const share = concatBytes(decode(signerId), t, n, gid, s)
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
