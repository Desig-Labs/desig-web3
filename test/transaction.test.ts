import { CryptoSys } from '@desig/supported-chains'
import { Signer, Transaction, toSolanaAddress } from '../dist'
import { alicePrivkey, bobPrivkey, carolPrivkey, eddsa, print } from './config'
import { decode, encode } from 'bs58'
import { expect } from 'chai'

describe('eddsa: transaction', () => {
  let alice: Transaction
  let bob: Transaction
  let carol: Transaction
  let transactionId = ''
  let multisigId = ''

  const initLastTransactionInstance = async (privkey: string) => {
    const signer = new Signer(eddsa.cluster, CryptoSys.EdDSA, decode(privkey))
    const [{ id }] = await signer.getAllSigners()
    const keypair = await signer.getSignerKeypair(id)
    return new Transaction(eddsa.cluster, CryptoSys.EdDSA, keypair)
  }

  it('sol address', async () => {
    alice = await initLastTransactionInstance(alicePrivkey)
    bob = await initLastTransactionInstance(bobPrivkey)
    carol = await initLastTransactionInstance(carolPrivkey)
    // Master key
    multisigId = encode(alice.keypair!.masterkey)
    print('master key:', toSolanaAddress(alice.keypair!.masterkey))
    expect(multisigId).equal(encode(bob.keypair!.masterkey))
    expect(multisigId).equal(encode(carol.keypair!.masterkey))
  })

  it('get transactions', async () => {
    const transactions = await alice.getTransactions({})
    console.log(transactions)
  })
})
