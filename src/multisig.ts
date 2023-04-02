import { Connection } from './connection'
import { SignerEntity } from './signer'
import { isEmailAddress } from './utils'

export type MultisigEntity = {
  id: string
  t: number
  n: number
  name: string
  sqrpriv?: string
  signers: SignerEntity[]
  createdAt: Date
  updatedAt: Date
}

export class Multisig extends Connection {
  constructor(cluster: string) {
    super(cluster)
  }

  /**
   * Fetch multisig data including signer data
   * @param id Multisig id
   * @returns Multisig data
   */
  getMultisig = async (id: string): Promise<MultisigEntity> => {
    const { data } = await this.connection.get<MultisigEntity>(
      `/multisig/${id}`,
    )
    return data
  }

  /**
   * Initialize a new multig
   * @param opt.t The t-out-of-n threshold
   * @param opt.n The t-out-of-n threshold
   * @param opt.name The multisig's name
   * @param opt.emails The list of member emails
   * @returns Multisig data
   */
  initializeMultisig = async ({
    t,
    n,
    name = '',
    pubkeys,
  }: {
    t: number
    n: number
    name?: string
    pubkeys: string[]
  }): Promise<MultisigEntity> => {
    if (t < 1 || n < 1 || t > n)
      throw new Error(`Invalid threshold. Current (t,n)=(${t},${n}).`)
    if (pubkeys.length !== n)
      throw new Error(
        `Insufficient number of pubkeys. Should be equal to ${n}.`,
      )
    const { data } = await this.connection.post<MultisigEntity>('multisig', {
      t,
      n,
      name,
      pubkeys,
    })
    return data
  }
}
