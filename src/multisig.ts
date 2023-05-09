import { z } from 'zod'
import { Connection } from './connection'
import type { MultisigEntity, SignerEntity } from './types'
import { decode } from 'bs58'
import { isAddress } from './utils'
import { Curve } from '@desig/supported-chains'

export class Multisig extends Connection {
  constructor(cluster: string, privkey: string) {
    super(cluster, decode(privkey))
  }

  /**
   * Fetch multisig data including signer data
   * @param multisigId Multisig id
   * @returns Multisig data
   */
  getMultisig = async (multisigId: string) => {
    const { data } = await this.connection.get<
      MultisigEntity & { signers: Array<Omit<SignerEntity, 'encryptedShare'>> }
    >(`/multisig/${multisigId}`)
    return data
  }

  /**
   * Initialize a new multig
   * @param curve Elliptic curve
   * @param payload.t The t-out-of-n threshold
   * @param payload.n The t-out-of-n threshold
   * @param payload.pubkeys The list of member pubkeys
   * @returns Multisig data
   */
  initializeMultisig = async (
    curve: Curve,
    payload: {
      t: number
      n: number
      pubkeys: string[]
    },
  ) => {
    // Validation
    z.nativeEnum(Curve).parse(curve)
    z.object({
      t: z.number().int().gte(1).lte(101),
      n: z.number().int().gte(1).lte(101),
      pubkeys: z
        .array(
          z.string().refine(
            (pubkey) => isAddress(pubkey),
            (pubkey) => ({ message: `Invalid pubkey format: ${pubkey}.` }),
          ),
        )
        .nonempty(),
    })
      .refine(({ t, n }) => t <= n, {
        message: 'The threshold t must be less than or equal to n.',
      })
      .refine(({ n, pubkeys }) => n === pubkeys.length, {
        message: 'Insufficient number of member pubkeys.',
      })
      .parse(payload)
    // Request
    const Authorization = await this.getAuthorization(payload)
    const { data } = await this.connection.post<
      Awaited<ReturnType<typeof this.getMultisig>>
    >('/multisig', payload, {
      headers: { Authorization, 'X-Desig-Curve': curve },
    })
    return data
  }
}
