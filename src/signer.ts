import { ExtendedElGamal } from '@desig/core'
import { CryptoSys } from '@desig/supported-chains'
import { decode } from 'bs58'
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
    const { encryptedShare } = await this.getSigner(signerId)
    const elgamal = new ExtendedElGamal()
    const buf = elgamal.decrypt(decode(encryptedShare), this.privkey)
    const share = new TextDecoder().decode(buf)
    if (share.startsWith('ecdsa')) return new DesigECDSAKeypair(share)
    if (share.startsWith('eddsa')) return new DesigEdDSAKeypair(share)
    throw new Error('Invalid crypto scheme')
  }
}
