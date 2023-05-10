import { Signer, Transaction, TransactionType, toEvmAddress } from '../dist'
import {
  alicePrivkey,
  bobPrivkey,
  carolPrivkey,
  eddyPrivkey,
  cluster,
  print,
} from './config'
import { decode, encode } from 'bs58'
import { expect } from 'chai'
import { ECCurve, EdCurve, SecretSharing } from '@desig/core'
import { Curve } from '@desig/supported-chains'

describe('secp256k1: transaction', () => {
  let alice: Transaction
  let bob: Transaction
  let carol: Transaction
  const eddyPubkey = encode(EdCurve.getPublicKey(decode(eddyPrivkey)))
  let multisigId = ''

  const initLastTransactionInstance = async (privkey: string) => {
    const signer = new Signer(cluster, privkey)
    const signers = await signer.getAllSigners()
    const { id: signerId } =
      signers.find(({ multisig: { curve } }) => curve === Curve.secp256k1) || {}
    if (!signerId) throw new Error('Unavailable signer.')
    const keypair = await signer.getSignerKeypair(signerId)
    return new Transaction(cluster, privkey, keypair)
  }

  it('eth address', async () => {
    alice = await initLastTransactionInstance(alicePrivkey)
    bob = await initLastTransactionInstance(bobPrivkey)
    carol = await initLastTransactionInstance(carolPrivkey)
    // Master key
    multisigId = encode(alice.keypair!.masterkey)
    print('master key:', toEvmAddress(alice.keypair!.masterkey))
    expect(multisigId).equal(encode(bob.keypair!.masterkey))
    expect(multisigId).equal(encode(carol.keypair!.masterkey))
  })

  it('n-extension', async () => {
    // Add Eddy
    const transaction = await alice.initializeTransaction({
      type: TransactionType.nExtension,
      params: { pubkey: eddyPubkey },
    })
    const transactionId = Transaction.deriveTransactionId(transaction.msg)
    await alice.signTransaction(transactionId)
    await bob.signTransaction(transactionId)
    const {
      multisig: { n },
    } = await bob.execTransaction(transactionId)
    // Activate Eddy
    const eddySigner = new Signer(cluster, eddyPrivkey)
    const signers = await eddySigner.getAllSigners({ multisigId })
    await Promise.all(
      signers.map(async ({ id }) => {
        await eddySigner.activateSigner(id)
      }),
    )
    // Assert
    expect(n).equal(4)
  })

  it('sync n-extension: alice, bob, eddy', async () => {
    const eddy = await initLastTransactionInstance(eddyPrivkey)
    await alice.syncTransaction()
    await bob.syncTransaction()
    await eddy.syncTransaction()
    if (!alice.keypair || !bob.keypair || !eddy.keypair)
      throw new Error('Invalid keypair')
    const sss = new SecretSharing(ECCurve.ff)
    const derkey = sss.construct([
      alice.keypair.getShare(),
      bob.keypair.getShare(),
      eddy.keypair.getShare(),
    ])
    const pubkey = ECCurve.getPublicKey(derkey, true)
    expect(encode(pubkey)).equal(encode(alice.keypair.masterkey))
  })

  it('t-extension', async () => {
    const transaction = await alice.initializeTransaction({
      type: TransactionType.tExtension,
      params: {},
    })
    const transactionId = Transaction.deriveTransactionId(transaction.msg)
    await alice.signTransaction(transactionId)
    await bob.signTransaction(transactionId)
    const {
      multisig: { t },
    } = await bob.execTransaction(transactionId)
    // Assert
    expect(t).equal(3)
  })

  it('sync t-extension: alice, bob, eddy', async () => {
    const eddy = await initLastTransactionInstance(eddyPrivkey)
    await alice.syncTransaction()
    await bob.syncTransaction()
    await eddy.syncTransaction()
    if (!alice.keypair || !bob.keypair || !eddy.keypair)
      throw new Error('Invalid keypair')
    const sss = new SecretSharing(ECCurve.ff)
    const derkey = sss.construct([
      alice.keypair.getShare(),
      bob.keypair.getShare(),
      eddy.keypair.getShare(),
    ])
    const pubkey = ECCurve.getPublicKey(derkey, true)
    expect(encode(pubkey)).equal(encode(alice.keypair.masterkey))
  })

  it('n-reduction', async () => {
    const eddy = await initLastTransactionInstance(eddyPrivkey)
    const transaction = await alice.initializeTransaction({
      type: TransactionType.nReduction,
      params: { index: eddy.index },
    })
    const transactionId = Transaction.deriveTransactionId(transaction.msg)
    await alice.signTransaction(transactionId)
    await bob.signTransaction(transactionId)
    await eddy.signTransaction(transactionId)
    const {
      multisig: { n },
    } = await bob.execTransaction(transactionId)
    // Assert
    expect(n).equal(3)
  })

  it('sync n-reduction: alice, bob, carol', async () => {
    await alice.syncTransaction()
    await bob.syncTransaction()
    await carol.syncTransaction()
    if (!alice.keypair || !bob.keypair || !carol.keypair)
      throw new Error('Invalid keypair')
    const sss = new SecretSharing(ECCurve.ff)
    const derkey = sss.construct([
      alice.keypair.getShare(),
      bob.keypair.getShare(),
      carol.keypair.getShare(),
    ])
    const pubkey = ECCurve.getPublicKey(derkey, true)
    expect(encode(pubkey)).equal(encode(alice.keypair.masterkey))
  })

  it('t-reduction', async () => {
    const transaction = await alice.initializeTransaction({
      type: TransactionType.tReduction,
      params: {},
    })
    const transactionId = Transaction.deriveTransactionId(transaction.msg)
    await alice.signTransaction(transactionId)
    await bob.signTransaction(transactionId)
    await carol.signTransaction(transactionId)
    const {
      multisig: { t },
    } = await bob.execTransaction(transactionId)
    // Assert
    expect(t).equal(2)
  })

  it('sync t-reduction: alice, bob', async () => {
    await alice.syncTransaction()
    await bob.syncTransaction()
    if (!alice.keypair || !bob.keypair) throw new Error('Invalid keypair')
    const sss = new SecretSharing(ECCurve.ff)
    const derkey = sss.construct([
      alice.keypair.getShare(),
      bob.keypair.getShare(),
    ])
    const pubkey = ECCurve.getPublicKey(derkey, true)
    expect(encode(pubkey)).equal(encode(alice.keypair.masterkey))
  })

  it('get transactions', async () => {
    const transactions = await alice.getTransactions()
    expect(transactions.length).is.greaterThan(0)
  })
})
