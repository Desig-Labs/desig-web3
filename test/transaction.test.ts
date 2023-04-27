import { CryptoSys } from '@desig/supported-chains'
import { Signer, Transaction, toSolanaAddress, toEvmAddress } from '../dist'
import {
  alicePrivkey,
  bobPrivkey,
  carolPrivkey,
  ecdsa,
  eddsa,
  print,
  rand,
} from './config'
import { decode, encode } from 'bs58'
import { expect } from 'chai'
import { ECCurve, EdCurve } from '@desig/core'

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
//     const transactions = await alice.getTransactions({})
//     expect(transactions.length).is.greaterThan(0)
//   })
// })

describe('ecdsa: transaction', () => {
  let alice: Transaction
  let bob: Transaction
  let carol: Transaction
  const eddyPrivkey = encode(EdCurve.ff.rand())
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

  // it('n-extension', async () => {
  //   const transaction = await alice.initializeTransaction({
  //     type: 'nExtension',
  //     params: { pubkey: eddyPubkey },
  //   })
  //   const transactionId = Transaction.deriveTransactionId(transaction.msg)
  //   await alice.signTransaction(transactionId)
  //   await bob.signTransaction(transactionId)
  //   const { n } = await bob.execTransaction(transactionId)
  //   console.log(n)
  // })

  it('sync n-extension', async () => {
    await alice.syncTransaction()
  })

  // it('n-reduction', async () => {
  //   const transaction = await alice.initializeTransaction({
  //     type: 'nReduction',
  //     params: { pubkey: eddyPubkey },
  //   })
  //   const transactionId = Transaction.deriveTransactionId(
  //     transaction.multisig.id,
  //     decode(transaction.msg),
  //   )
  //   await alice.signTransaction(transactionId)
  //   await bob.signTransaction(transactionId)
  //   const { n } = await bob.execTransaction(transactionId)
  //   expect(transactionId).equal(transaction.id)
  //   expect(n).equal(3)
  // })

  // it('get transactions', async () => {
  //   const transactions = await alice.getTransactions({}, {})
  //   expect(transactions.length).is.greaterThan(0)
  // })
})
