import { Connection } from './connection'
import { SignerEntiry } from './signer'
import { isEmailAddress } from './utils'

export type MultisigEntity = {
  id: string
  t: number
  n: number
  name: string
  sqrpriv?: string
  signers: SignerEntiry[]
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
    emails,
  }: {
    t: number
    n: number
    name?: string
    emails: string[]
  }): Promise<MultisigEntity> => {
    if (t < 1 || n < 1 || t > n)
      throw new Error(`Invalid threshold. Current (t,n)=(${t},${n}).`)
    if (emails.length !== n)
      throw new Error(`Insufficient number of emails. Should be equal to ${n}.`)
    const { data } = await this.connection.post<MultisigEntity>('multisig', {
      t,
      n,
      name,
      emails,
    })
    for (const email of emails)
      if (!isEmailAddress(email))
        throw new Error(`Invalid email address: ${email}.`)
    return data
  }
}
