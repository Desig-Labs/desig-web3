import { ECCurve, EdCurve, ElGamal, SecretSharing } from '@desig/core'
import { CryptoSys } from '@desig/supported-chains'
import { decode, encode } from 'bs58'
import { Connection } from './connection'
import { DesigECDSAKeypair, DesigEdDSAKeypair } from './keypair'
import type { MultisigEntity, SignerEntity } from './types'

export class Signer extends Connection {
  constructor(cluster: string, cryptosys: CryptoSys, privkey: Uint8Array) {
    super(cluster, cryptosys, { privkey })
  }

  /**
   * Get all signers data
   * @returns Signer data
   */
  getAllSigners = async (): Promise<SignerEntity[]> => {
    const Authorization = await this.getTimestampAuthorization()
    const { data } = await this.connection.get<SignerEntity[]>(`/signer`, {
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
    const Authorization = await this.getTimestampAuthorization()
    const { data } = await this.connection.patch<
      SignerEntity & { multisig: MultisigEntity }
    >(
      `/signer/${signerId}`,
      {},
      {
        headers: {
          Authorization,
        },
      },
    )
    return data
  }

  getSignerKeypair = async (signerId: string) => {
    const {
      index,
      encryptedShare,
      multisig: { t, n, gid, id },
    } = await this.getSigner(signerId)
    const elgamal = new ElGamal(
      this.cryptosys === CryptoSys.ECDSA ? ECCurve : EdCurve,
    )
    const share = elgamal.decrypt(decode(encryptedShare), this.privkey)
    const ff = elgamal.curve.ff
    const secret = SecretSharing.compress({
      index: ff.decode(ff.numberToRedBN(index), 8),
      t: ff.decode(ff.numberToRedBN(t), 8),
      n: ff.decode(ff.numberToRedBN(n), 8),
      id: decode(gid),
      share,
    })
    if (this.cryptosys === CryptoSys.ECDSA)
      return new DesigECDSAKeypair(`ecdsa/${id}/${encode(secret)}`)
    if (this.cryptosys === CryptoSys.EdDSA)
      return new DesigEdDSAKeypair(`eddsa/${id}/${encode(secret)}`)
    throw new Error('Invalid crypto scheme')
  }
}
