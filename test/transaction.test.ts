import { utils } from '@noble/ed25519'
import { encode } from 'bs58'
import { expect } from 'chai'
import { getCurve, Keypair, Transaction } from '../dist'

const cluster = 'https://devnet.desig.io'
const secret =
  'eddsa/CaaPrxEHR6CTDLqXda2tocrCrGuRU83BEfcby8dJWuaU/3KWq19hjnoKJG4LJ71d4R6kZJQ1AMe7eMGHFWnpBfSWa6N7vj4KWZCH9yYpJT1S22aBToQktFcnT6Vt7GUV3CbW'

describe('transaction', () => {
  const keypair = Keypair.fromSecret(secret)
  const transaction = new Transaction(keypair, cluster)
  const message = utils.randomBytes(32)

  it('initialize transaction', async () => {
    const txId = Transaction.deriveTxId(message)
    const { msg, id } = await transaction.initialize(message)
    expect(msg).equal(encode(message))
    expect(txId).equal(id)
  })

  it('fetch transaction', async () => {
    const txId = Transaction.deriveTxId(message)
    const { id, msg } = await transaction.fetch(txId)
    expect(msg).equal(encode(message))
    expect(txId).equal(id)
  })

  it('approve transaction', async () => {
    const txId = Transaction.deriveTxId(message)
    const {
      transaction: { msg, id, randomnesses },
      r,
    } = await transaction.approve(txId)
    const { id: R } = randomnesses.find(
      ({ signer: { id } }) => id === encode(keypair.pubkey),
    ) || { id: '' }
    expect(msg).equal(encode(message))
    expect(txId).equal(id)
    expect(R).equal(encode(getCurve(keypair.cryptosys).baseMul(r)))
  })
})
