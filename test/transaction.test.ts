import { PublicKey, Transaction as SolTransaction } from '@solana/web3.js'
import { decode, encode } from 'bs58'
import { expect } from 'chai'
import { DesigEdDSAKeypair, Transaction } from '../dist'
import {
  cluster,
  aliceSecret,
  bobSecret,
  transfer,
  sendAndConfirm,
  print,
  solscan,
} from './config'

describe('transaction', () => {
  const aliceKeypair = new DesigEdDSAKeypair(aliceSecret)
  const bobKeypair = new DesigEdDSAKeypair(bobSecret)
  const alice = new Transaction(cluster, aliceKeypair)
  const bob = new Transaction(cluster, bobKeypair)
  const masterkey = new PublicKey(aliceKeypair.masterkey)
  let tx: SolTransaction

  before(async () => {
    tx = await transfer(masterkey)
  })

  it('initialize transaction', async () => {
    const message = tx.serializeMessage()
    const txId = Transaction.deriveTxId(message)
    const { msg, id } = await alice.initialize({ message })
    expect(msg).equal(encode(message))
    expect(txId).equal(id)
  })

  it('fetch transaction', async () => {
    const message = tx.serializeMessage()
    const txId = Transaction.deriveTxId(message)
    const { id, msg } = await alice.fetch(txId)
    expect(msg).equal(encode(message))
    expect(txId).equal(id)
  })

  it('approve transaction by alice', async () => {
    const message = tx.serializeMessage()
    const txId = Transaction.deriveTxId(message)
    const { msg, id } = await alice.approve(txId)
    expect(msg).equal(encode(message))
    expect(txId).equal(id)
  })

  it('approve transaction by bob', async () => {
    const message = tx.serializeMessage()
    const txId = Transaction.deriveTxId(message)
    const { msg, id } = await bob.approve(txId)
    expect(msg).equal(encode(message))
    expect(txId).equal(id)
  })

  it('finalize/verify/submit transaction', async () => {
    const message = tx.serializeMessage()
    const txId = Transaction.deriveTxId(message)
    const sig = await bob.finalize(txId)
    const ok = await bob.verify(txId, sig)
    tx.addSignature(masterkey, Buffer.from(decode(sig)))
    const txHash = await sendAndConfirm(tx)
    print(solscan(txHash))
    expect(sig).not.empty
    expect(ok).to.be.true
    expect(txHash).not.empty
  })
})
