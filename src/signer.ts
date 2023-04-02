import { ElGamal } from '@desig/core'
import { decode } from 'bs58'
import { Connection } from './connection'
import { DesigECDSAKeypair, DesigEdDSAKeypair } from './keypair'
import { MultisigEntity } from './multisig'

export type SignerEntity = {
  id: string
  index: number
  nonce: string
  activated: boolean
  owner: string
  encryptedShare: string
  multisig: MultisigEntity
}

export class Signer extends Connection {
  constructor(cluster: string, privkey: Uint8Array) {
    super(cluster, { privkey })
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
    const buf = await ElGamal.decrypt(decode(encryptedShare), this.privkey)
    const secret = new TextDecoder().decode(buf)
    if (secret.startsWith('eddsa')) return new DesigEdDSAKeypair(secret)
    if (secret.startsWith('ecdsa')) return new DesigECDSAKeypair(secret)
    throw new Error('Invalid crypto scheme')
  }
}
