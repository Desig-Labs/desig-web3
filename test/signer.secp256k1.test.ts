import { expect } from 'chai'
import { Signer } from '../dist'
import { cluster, alicePrivkey } from './config'

describe('secp256k1: signer', () => {
  const alice = new Signer(cluster, alicePrivkey)
  let signerId: string = ''

  it('get all signers', async () => {
    const [{ id }] = await alice.getAllSigners()
    signerId = id
  })

  it('get signer', async () => {
    const { owner } = await alice.getSigner(signerId)
    expect(owner).equal(alice.owner)
  })

  it('activate signer', async () => {
    const { activated } = await alice.activateSigner(signerId)
    expect(activated).true
  })
})
