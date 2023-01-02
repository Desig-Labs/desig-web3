import { utils } from '@noble/ed25519'
import { encode } from 'bs58'
import { expect } from 'chai'
import { getCurve, Keypair, Transaction } from '../dist'

const cluster = 'https://devnet.desig.io'
const secret =
  'eddsa/6RpyheKTsdjrcR7KtsHdDp5L7RhtqMHSpJDHoeofKTSZ/3KWq19hjnoKJG4LJ71d4R6kZJQ1AMe7eDqe9YqPY9DF1Fva3TkBc9xP7XTuLmXG5t2kWCEriZ5tKv2YWnm4kTn5'

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
    const { msg, id } = await transaction.approve(txId)
    expect(msg).equal(encode(message))
    expect(txId).equal(id)
  })
})
