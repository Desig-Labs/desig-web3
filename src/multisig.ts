import { CryptoSys } from '@desig/core'
import { Connection } from './connection'
import { DEFAULT_CLUSTER_URL } from './constants'
import { Keypair } from './keypair'
import { SignerEntiry } from './signer'
import { isEmailAddress } from './utils'

export type MultisigEntity = {
  id: string
  t: number
  n: number
  cryptosys: CryptoSys
  name: string
  signers: SignerEntiry[]
  createdAt: Date
  updatedAt: Date
}

export class Multisig extends Connection {
  constructor(keypair: Keypair, cluster: string = DEFAULT_CLUSTER_URL) {
    super(keypair, cluster)
  }

  /**
   * Fetch multisig data including signer data
   * @param id Multisig id
   * @returns Multisig data
   */
  fetch = async (id: string): Promise<MultisigEntity> => {
    const { data } = await this.connection.get<MultisigEntity>(
      `/multisig/${id}`,
    )
    return data
  }

  initialize = async ({
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
    if (t < 2 || n < 2 || t > n)
      throw new Error(`Invalid threshold. Current (t,n)=(${t},${n}).`)
    if (emails.length !== t)
      throw new Error(`Insufficient number of emails. Should be equal to ${t}.`)
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
