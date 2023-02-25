import { PublicKey, Transaction as SolTransaction } from '@solana/web3.js'
import { Transaction as EthTransaction } from '@ethereumjs/tx'
import { decode, encode } from 'bs58'
import { expect } from 'chai'
import {
  DesigECDSAKeypair,
  DesigEdDSAKeypair,
  Transaction,
  toEthereumAddress,
} from '../dist'
import { ecdsa, eddsa, print, solscan, etherscan } from './config'
import { Chain, Common, Hardfork } from '@ethereumjs/common'
import Web3 from 'web3'

describe('eddsa: transaction', () => {
  const aliceKeypair = new DesigEdDSAKeypair(eddsa.aliceSecret)
  const bobKeypair = new DesigEdDSAKeypair(eddsa.bobSecret)
  const alice = new Transaction(eddsa.cluster, aliceKeypair)
  const bob = new Transaction(eddsa.cluster, bobKeypair)
  const masterkey = new PublicKey(aliceKeypair.masterkey)
  let txId: string

  it('initialize transaction', async () => {
    const tx = await eddsa.transfer(masterkey)
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
    const { sig } = await bob.finalizeSignature(txId)
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
    const txHash = await eddsa.sendAndConfirm(tx)
    print(solscan(txHash))
    expect(txHash).not.empty
  })
})

describe('ecdsa: transaction', () => {
  const aliceKeypair = new DesigECDSAKeypair(ecdsa.aliceSecret)
  const bobKeypair = new DesigECDSAKeypair(ecdsa.bobSecret)
  const alice = new Transaction(ecdsa.cluster, aliceKeypair)
  const bob = new Transaction(ecdsa.cluster, bobKeypair)
  const masterkey = toEthereumAddress(aliceKeypair.masterkey)
  let txId: string

  it('initialize transaction', async () => {
    const tx = await ecdsa.transfer(masterkey)
    const raw = tx.serialize()
    const msg = tx.getMessageToSign()
    txId = Transaction.deriveTxId(msg)
    const { msg: message, id } = await alice.initializeTransaction({ msg, raw })
    expect(message).equal(encode(msg))
    expect(txId).equal(id)
  })

  it('get transaction', async () => {
    const { id, msg, raw } = await alice.getTransaction(txId)
    const tx = EthTransaction.fromSerializedTx(Buffer.from(decode(raw)), {
      common: new Common({
        chain: Chain.Goerli,
      }),
    })
    const message = tx.getMessageToSign()
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
    const { sig, recv } = await bob.finalizeSignature(txId)
    expect(sig).not.empty
    if (recv === undefined) throw 'Invalid recv' // trick for typesafe
    // Verify the transaction
    const ok = await bob.verifySignature(txId, sig)
    expect(ok).to.be.true
    // Reconstruct the transaction
    const { msg, raw } = await alice.getTransaction(txId)
    const tx = EthTransaction.fromSerializedTx(Buffer.from(decode(raw)), {
      common: new Common({
        chain: Chain.Goerli,
      }),
    })
    const message = tx.getMessageToSign()
    expect(msg).equal(encode(message))
    // Add the signature
    const chainId = tx.common.chainId()
    const r = decode(sig).slice(0, 32)
    const s = Buffer.from(decode(sig).slice(32, 64))
    const v = BigInt(recv + 35) + chainId * BigInt(2)
    const signedTx = EthTransaction.fromTxData({
      ...tx.toJSON(),
      r: BigInt(Web3.utils.bytesToHex([...r])),
      s: BigInt(Web3.utils.bytesToHex([...s])),
      v,
    })
    // Submit the transaction
    const txHash = await ecdsa.sendAndConfirm(signedTx)
    print(etherscan(txHash))
    expect(txHash).not.empty
  })
})
