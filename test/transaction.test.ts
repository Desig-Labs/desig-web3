import { CryptoSys } from '@desig/supported-chains'
import { Signer, Transaction, toSolanaAddress, toEvmAddress } from '../dist'
import {
  alicePrivkey,
  bobPrivkey,
  carolPrivkey,
  ecdsa,
  eddsa,
  eddyPrivkey,
  print,
  rand,
} from './config'
import { decode, encode } from 'bs58'
import { expect } from 'chai'
import { ECCurve, EdCurve, SecretSharing } from '@desig/core'

// describe('eddsa: transaction', () => {
//   let alice: Transaction
//   let bob: Transaction
//   let carol: Transaction
//   const eddyPrivkey = encode(EdCurve.ff.rand())
//   const eddyPubkey = encode(EdCurve.getPublicKey(decode(eddyPrivkey)))
//   let multisigId = ''

//   const initLastTransactionInstance = async (privkey: string) => {
//     const signer = new Signer(eddsa.cluster, CryptoSys.EdDSA, decode(privkey))
//     const [{ id }] = await signer.getAllSigners()
//     const keypair = await signer.getSignerKeypair(id)
//     return new Transaction(
//       eddsa.cluster,
//       CryptoSys.EdDSA,
//       decode(privkey),
//       keypair,
//     )
//   }

//   it('sol address', async () => {
//     alice = await initLastTransactionInstance(alicePrivkey)
//     bob = await initLastTransactionInstance(bobPrivkey)
//     carol = await initLastTransactionInstance(carolPrivkey)
//     // Master key
//     multisigId = encode(alice.keypair!.masterkey)
//     print('master key:', toSolanaAddress(alice.keypair!.masterkey))
//     expect(multisigId).equal(encode(bob.keypair!.masterkey))
//     expect(multisigId).equal(encode(carol.keypair!.masterkey))
//   })

//   it('change name', async () => {
//     const name = `The Dao #${rand()}`
//     const transaction = await alice.initializeTransaction({
//       type: 'changeName',
//       params: { name },
//     })
//     const transactionId = Transaction.deriveTransactionId(
//       transaction.multisig.id,
//       decode(transaction.msg),
//     )
//     await alice.signTransaction(transactionId)
//     await bob.signTransaction(transactionId)
//     const multisig = await bob.execTransaction(transactionId)
//     expect(transactionId).equal(transaction.id)
//     expect(name).equal(multisig.name)
//   })

//   it('n-extension', async () => {
//     const transaction = await alice.initializeTransaction({
//       type: 'nExtension',
//       params: { pubkey: eddyPubkey },
//     })
//     const transactionId = Transaction.deriveTransactionId(
//       transaction.multisig.id,
//       decode(transaction.msg),
//     )
//     await alice.signTransaction(transactionId)
//     await bob.signTransaction(transactionId)
//     const { n } = await bob.execTransaction(transactionId)
//     expect(transactionId).equal(transaction.id)
//     expect(n).equal(4)
//   })

//   it('n-reduction', async () => {
//     const transaction = await alice.initializeTransaction({
//       type: 'nReduction',
//       params: { pubkey: eddyPubkey },
//     })
//     const transactionId = Transaction.deriveTransactionId(
//       transaction.multisig.id,
//       decode(transaction.msg),
//     )
//     await alice.signTransaction(transactionId)
//     await bob.signTransaction(transactionId)
//     const { n } = await bob.execTransaction(transactionId)
//     expect(transactionId).equal(transaction.id)
//     expect(n).equal(3)
//   })

//   it('get transactions', async () => {
//     const transactions = await alice.getTransactions()
//     expect(transactions.length).is.greaterThan(0)
//   })
// })

describe('ecdsa: transaction', () => {
  let alice: Transaction
  let bob: Transaction
  let carol: Transaction
  const eddyPubkey = encode(EdCurve.getPublicKey(decode(eddyPrivkey)))
  let multisigId = ''

  const initLastTransactionInstance = async (privkey: string) => {
    const signer = new Signer(ecdsa.cluster, CryptoSys.ECDSA, decode(privkey))
    const [{ id }] = await signer.getAllSigners()
    const keypair = await signer.getSignerKeypair(id)
    return new Transaction(
      ecdsa.cluster,
      CryptoSys.ECDSA,
      decode(privkey),
      keypair,
    )
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
      type: 'nExtension',
      params: { pubkey: eddyPubkey },
    })
    const transactionId = Transaction.deriveTransactionId(transaction.msg)
    await alice.signTransaction(transactionId)
    await bob.signTransaction(transactionId)
    const { n } = await bob.execTransaction(transactionId)
    // Activate Eddy
    const eddySigner = new Signer(
      ecdsa.cluster,
      CryptoSys.ECDSA,
      decode(eddyPrivkey),
    )
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
      type: 'tExtension',
      params: {},
    })
    const transactionId = Transaction.deriveTransactionId(transaction.msg)
    await alice.signTransaction(transactionId)
    await bob.signTransaction(transactionId)
    const { t } = await bob.execTransaction(transactionId)
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
      type: 'nReduction',
      params: { index: eddy.index },
    })
    const transactionId = Transaction.deriveTransactionId(transaction.msg)
    await alice.signTransaction(transactionId)
    await bob.signTransaction(transactionId)
    await eddy.signTransaction(transactionId)
    const { n } = await bob.execTransaction(transactionId)
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

  // it('get transactions', async () => {
  //   const transactions = await alice.getTransactions()
  //   expect(transactions.length).is.greaterThan(0)
  // })
})
