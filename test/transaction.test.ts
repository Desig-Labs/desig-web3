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
  let txId: string

  it('initialize transaction', async () => {
    const tx = await transfer(masterkey)
    const raw = tx.serialize({ verifySignatures: false })
    const msg = tx.serializeMessage()
    txId = Transaction.deriveTxId(msg)
    const { msg: message, id } = await alice.initializeTransaction({ msg, raw })
    expect(message).equal(encode(msg))
    expect(txId).equal(id)
  })

  it('get transaction', async () => {
    const { id, msg, raw } = await alice.getTransaction(txId)
    const tx = SolTransaction.from(decode(raw))
    const message = tx.serializeMessage()
    expect(msg).equal(encode(message))
    expect(txId).equal(id)
  })

  it('get transactions', async () => {
    const transactions = await alice.getTransactions({})
    expect(transactions.length).is.greaterThan(0)
  })

  it('approve transaction by alice', async () => {
    const { id } = await alice.approveTransaction(txId)
    expect(txId).equal(id)
  })

  it('approve transaction by bob', async () => {
    const { id } = await bob.approveTransaction(txId)
    expect(txId).equal(id)
  })

  it('finalize/verify/submit transaction', async () => {
    // Finalize the transaction
    const sig = await bob.finalizeSignature(txId)
    expect(sig).not.empty
    // Verify the transaction
    const ok = await bob.verifySignature(txId, sig)
    expect(ok).to.be.true
    // Reconstruct the transaction
    const { msg, raw } = await alice.getTransaction(txId)
    const tx = SolTransaction.from(decode(raw))
    const message = tx.serializeMessage()
    expect(msg).equal(encode(message))
    // Add the signature
    tx.addSignature(masterkey, Buffer.from(decode(sig)))
    // Submit the transaction
    const txHash = await sendAndConfirm(tx)
    print(solscan(txHash))
    expect(txHash).not.empty
  })
})
