import { PublicKey, Transaction as SolTransaction } from '@solana/web3.js'
import { decode, encode } from 'bs58'
import { expect } from 'chai'
import {
  DesigECDSAKeypair,
  DesigEdDSAKeypair,
  Proposal,
  toEthereumAddress,
} from '../dist'
import { ecdsa, eddsa, print, solscan, etherscan } from './config'
import { Transaction as EthTransaction, hexlify, getBytes } from 'ethers'

describe('eddsa: proposal', () => {
  const aliceKeypair = new DesigEdDSAKeypair(eddsa.aliceSecret)
  const bobKeypair = new DesigEdDSAKeypair(eddsa.bobSecret)
  const alice = new Proposal(eddsa.cluster, aliceKeypair)
  const bob = new Proposal(eddsa.cluster, bobKeypair)
  const masterkey = new PublicKey(aliceKeypair.masterkey)
  let txId: string

  it('sol address', () => {
    print('master key:', masterkey.toBase58())
  })

  it('initialize proposal', async () => {
    const tx = await eddsa.transfer(masterkey)
    const raw = tx.serialize({ verifySignatures: false })
    const msg = tx.serializeMessage()
    txId = Proposal.deriveTxId(msg)
    const {
      msg: message,
      id,
      chainId,
    } = await alice.initializeProposal({
      msg,
      raw,
      chainId: eddsa.chain.chainId,
    })
    expect(message).equal(encode(msg))
    expect(txId).equal(id)
    expect(chainId).equal(eddsa.chain.chainId)
  })

  it('get proposal', async () => {
    const { id, msg, raw } = await alice.getProposal(txId)
    const tx = SolTransaction.from(decode(raw))
    const message = tx.serializeMessage()
    expect(msg).equal(encode(message))
    expect(txId).equal(id)
  })

  it('get proposals', async () => {
    const proposals = await alice.getProposals({})
    expect(proposals.length).is.greaterThan(0)
  })

  it('approve proposal by alice', async () => {
    const { id } = await alice.approveProposal(txId)
    expect(txId).equal(id)
  })

  it('approve proposal by bob', async () => {
    const { id } = await bob.approveProposal(txId)
    expect(txId).equal(id)
  })

  it('finalize/verify/submit proposal', async () => {
    // Finalize the proposal
    const { sig } = await bob.finalizeSignature(txId)
    expect(sig).not.empty
    // Verify the proposal
    const ok = await bob.verifySignature(txId, sig)
    expect(ok).to.be.true
    // Reconstruct the proposal
    const { msg, raw } = await alice.getProposal(txId)
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

describe('ecdsa: proposal', () => {
  const aliceKeypair = new DesigECDSAKeypair(ecdsa.aliceSecret)
  const bobKeypair = new DesigECDSAKeypair(ecdsa.bobSecret)
  const alice = new Proposal(ecdsa.cluster, aliceKeypair)
  const bob = new Proposal(ecdsa.cluster, bobKeypair)
  const masterkey = toEthereumAddress(aliceKeypair.masterkey)
  let txId: string

  it('eth address', () => {
    print('master key:', masterkey)
  })

  it('initialize proposal', async () => {
    const tx = await ecdsa.transfer(masterkey)
    const raw = getBytes(tx.unsignedSerialized)
    const msg = getBytes(tx.unsignedHash)
    txId = Proposal.deriveTxId(msg)
    const {
      msg: message,
      id,
      chainId,
    } = await alice.initializeProposal({
      msg,
      raw,
      chainId: ecdsa.chain.chainId,
    })
    expect(message).equal(encode(msg))
    expect(txId).equal(id)
    expect(chainId).equal(ecdsa.chain.chainId)
  })

  it('get proposal', async () => {
    const { id, msg, raw } = await alice.getProposal(txId)
    const tx = EthTransaction.from(hexlify(decode(raw)))
    const message = getBytes(tx.unsignedHash)
    expect(msg).equal(encode(message))
    expect(txId).equal(id)
  })

  it('get proposals', async () => {
    const proposals = await alice.getProposals({})
    expect(proposals.length).is.greaterThan(0)
  })

  it('approve proposal by alice', async () => {
    const { id } = await alice.approveProposal(txId)
    expect(txId).equal(id)
  })

  it('approve proposal by bob', async () => {
    const { id } = await bob.approveProposal(txId)
    expect(txId).equal(id)
  })

  it('finalize/verify/submit proposal', async () => {
    // Finalize the proposal
    const { sig, recv } = await bob.finalizeSignature(txId)
    expect(sig).not.empty
    if (recv === undefined) throw new Error('Invalid recv') // trick for typesafe
    // Verify the proposal
    const ok = await bob.verifySignature(txId, sig)
    expect(ok).to.be.true
    // Reconstruct the proposal
    const { msg, raw, chainId } = await alice.getProposal(txId)
    const tx = EthTransaction.from(hexlify(decode(raw)))
    const message = getBytes(tx.unsignedHash)
    expect(msg).equal(encode(message))
    // Add the signature
    const r = decode(sig).slice(0, 32)
    const s = Buffer.from(decode(sig).slice(32, 64))
    const v = BigInt(recv + 35) + BigInt(chainId) * BigInt(2)
    const signedTx = EthTransaction.from({
      ...tx.toJSON(),
      signature: {
        r: BigInt(hexlify(r)),
        s: BigInt(hexlify(s)),
        v,
      },
    })
    // Submit the transaction
    const txHash = await ecdsa.sendAndConfirm(signedTx)
    print(etherscan(txHash))
    expect(txHash).not.empty
  })
})
