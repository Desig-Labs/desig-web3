import { utils } from '@noble/ed25519'
import { encode } from 'bs58'
import { expect } from 'chai'
import { Keypair, Transaction } from '../dist'
import { cluster, aliceSecret, bobSecret } from './config'

describe('transaction', () => {
  const alice = new Transaction(Keypair.fromSecret(aliceSecret), cluster)
  const bob = new Transaction(Keypair.fromSecret(bobSecret), cluster)
  const message = utils.randomBytes(32)

  it('initialize transaction', async () => {
    const txId = Transaction.deriveTxId(message)
    const { msg, id } = await alice.initialize({ message })
    expect(msg).equal(encode(message))
    expect(txId).equal(id)
  })

  it('fetch transaction', async () => {
    const txId = Transaction.deriveTxId(message)
    const { id, msg } = await alice.fetch(txId)
    expect(msg).equal(encode(message))
    expect(txId).equal(id)
  })

  it('approve transaction by alice', async () => {
    const txId = Transaction.deriveTxId(message)
    const { msg, id } = await alice.approve(txId)
    expect(msg).equal(encode(message))
    expect(txId).equal(id)
  })

  it('approve transaction by bob', async () => {
    const txId = Transaction.deriveTxId(message)
    const { msg, id } = await bob.approve(txId)
    expect(msg).equal(encode(message))
    expect(txId).equal(id)
  })

  it('finalize/verify transaction', async () => {
    const txId = Transaction.deriveTxId(message)
    const sig = await bob.finalize(txId)
    const ok = await bob.verify(txId, sig)
    expect(ok).to.be.true
  })
})
