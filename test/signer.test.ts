import { decode } from 'bs58'
import { expect } from 'chai'
import { Signer } from '../dist'
import { eddsa, ecdsa, alicePrivkey } from './config'

describe('eddsa: signer', () => {
  const alice = new Signer(eddsa.cluster, decode(alicePrivkey))
  let signerId: string = ''

  it('get all signers', async () => {
    const [{ id }] = await alice.getAllSigners()
    signerId = id
  })

  it('get signer', async () => {
    const { nonce, owner } = await alice.getSigner(signerId)
    expect(nonce).not.empty
    expect(owner).equal(alice.owner)
  })

  it('activate signer', async () => {
    const { nonce } = await alice.activateSigner(signerId)
    expect(nonce).not.empty
  })
})

describe('ecdsa: signer', () => {
  const alice = new Signer(ecdsa.cluster, decode(alicePrivkey))
  let signerId: string = ''

  it('get all signers', async () => {
    const [{ id }] = await alice.getAllSigners()
    signerId = id
  })

  it('get signer', async () => {
    const { nonce, owner } = await alice.getSigner(signerId)
    expect(nonce).not.empty
    expect(owner).equal(alice.owner)
  })

  it('activate signer', async () => {
    const { nonce } = await alice.activateSigner(signerId)
    expect(nonce).not.empty
  })
})
