import { expect } from 'chai'
import { DesigECDSAKeypair, DesigEdDSAKeypair, Signer } from '../dist'
import { eddsa, ecdsa } from './config'

describe('eddsa: signer', () => {
  const alice = new Signer(
    eddsa.cluster,
    new DesigEdDSAKeypair(eddsa.aliceSecret),
  )

  it('get signer', async () => {
    const {
      nonce,
      multisig: { id },
    } = await alice.getSigner()
    const [_, masterkey] = eddsa.aliceSecret.split('/')
    expect(nonce).not.empty
    expect(masterkey).equal(id)
  })

  it('activate signer', async () => {
    const { nonce } = await alice.activateSigner()
    expect(nonce).not.empty
  })
})

describe('ecdsa: signer', () => {
  const alice = new Signer(
    ecdsa.cluster,
    new DesigECDSAKeypair(ecdsa.aliceSecret),
  )

  it('get signer', async () => {
    const {
      nonce,
      multisig: { id },
    } = await alice.getSigner()
    const [_, masterkey] = ecdsa.aliceSecret.split('/')
    expect(nonce).not.empty
    expect(masterkey).equal(id)
  })

  it('activate signer', async () => {
    const { nonce } = await alice.activateSigner()
    expect(nonce).not.empty
  })
})
