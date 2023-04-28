import { ECCurve, EdCurve, ExtendedElGamal, SecretSharing } from '@desig/core'
import { CryptoSys, toScheme } from '@desig/supported-chains'
import { decode, encode } from 'bs58'
import { Connection } from './connection'
import { DesigECDSAKeypair, DesigEdDSAKeypair } from './keypair'
import type { MultisigEntity, SignerEntity, TransactionEntity } from './types'
import { concatBytes } from '@noble/hashes/utils'

export class Signer extends Connection {
  public sss: SecretSharing

  constructor(cluster: string, cryptosys: CryptoSys, privkey: Uint8Array) {
    super(cluster, cryptosys, { privkey })
    let curve: typeof EdCurve | typeof ECCurve
    if (this.cryptosys === CryptoSys.EdDSA) curve = EdCurve
    else if (this.cryptosys === CryptoSys.ECDSA) curve = ECCurve
    else throw new Error('Invalid crypto system')
    this.sss = new SecretSharing(curve.ff)
  }

  /**
   * Get all signers data
   * @returns Signer data
   */
  getAllSigners = async (
    filter: Partial<{ multisigId: string }> = {},
  ): Promise<SignerEntity[]> => {
    const Authorization = await this.getTimestampAuthorization()
    const { data } = await this.connection.get<SignerEntity[]>(`/signer`, {
      params: filter,
      headers: {
        Authorization,
      },
    })
    return data
  }

  /**
   * Get signer data
   * @param signer Signer id
   * @returns Signer data
   */
  getSigner = async (
    signerId: string,
  ): Promise<SignerEntity & { multisig: MultisigEntity }> => {
    const Authorization = await this.getTimestampAuthorization()
    const { data } = await this.connection.get<
      SignerEntity & { multisig: MultisigEntity }
    >(`/signer/${signerId}`, {
      headers: {
        Authorization,
      },
    })
    return data
  }

  /**
   * Activate the signer
   * @param signer Signer id
   * @returns Signer data
   */
  activateSigner = async (
    signerId: string,
  ): Promise<SignerEntity & { multisig: MultisigEntity }> => {
    let { encryptedShare, generic } = await this.getSigner(signerId)
    if (!encryptedShare) {
      const elgamal = new ExtendedElGamal()
      // Get boarding transaction
      const nonce = await this.getNonce(signerId)
      const sig = this.sign(
        new TextEncoder().encode(String(nonce)),
        decode(signerId),
      )
      const credential = `${signerId}/${encode(sig)}`
      const Authorization = `Bearer ${credential}`
      const {
        data: {
          raw,
          signatures,
          multisig: { id: multisigId },
        },
      } = await this.connection.get<TransactionEntity>(
        `/transaction/${generic}`,
        { headers: { Authorization } },
      )
      // Compute the share
      const txData = decode(raw)
      const k = txData.subarray(txData.length - 136).subarray(0, 8)
      const gid = txData.subarray(8, 16)
      const t = txData.subarray(16, 24)
      const n = this.sss.ff.decode(
        this.sss.ff.encode(txData.subarray(24, 32)).redSub(this.sss.ff.ONE),
        8,
      )
      const z = this.sss.interpolate(
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
      const r = txData
        .subarray(txData.length - 136)
        .subarray(8)
        .subarray(32, 64) // Replace elgamal dycryption here
      const s = this.sss.ff.sub(z, r)
      const share = concatBytes(k, t, n, gid, s)
      const secret = `${toScheme(this.cryptosys)}/${multisigId}/${encode(
        share,
      )}`
      // Encrypt the share
      encryptedShare = encode(
        elgamal.encrypt(new TextEncoder().encode(secret), decode(this.owner)),
      )
    }
    // Activate the signer
    const Authorization = await this.getTimestampAuthorization()
    const { data } = await this.connection.patch<
      SignerEntity & { multisig: MultisigEntity }
    >(
      `/signer/${signerId}`,
      { activated: true, encryptedShare },
      {
        headers: {
          Authorization,
        },
      },
    )
    return data
  }

  getSignerKeypair = async (signerId: string) => {
    const { encryptedShare } = await this.getSigner(signerId)
    const elgamal = new ExtendedElGamal()
    const buf = elgamal.decrypt(decode(encryptedShare), this.privkey)
    const share = new TextDecoder().decode(buf)
    if (share.startsWith('ecdsa')) return new DesigECDSAKeypair(share)
    if (share.startsWith('eddsa')) return new DesigEdDSAKeypair(share)
    throw new Error('Invalid crypto scheme')
  }
}
