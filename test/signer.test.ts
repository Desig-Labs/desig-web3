import { expect } from 'chai'
import { DesigEdDSAKeypair, Signer } from '../dist'
import { cluster, aliceSecret } from './config'

describe('signer', () => {
  const alice = new Signer(cluster, new DesigEdDSAKeypair(aliceSecret))

  it('get signer', async () => {
    const {
      nonce,
      multisig: { id },
    } = await alice.getSigner()
    const [_, masterkey] = aliceSecret.split('/')
    expect(nonce).not.empty
    expect(masterkey).equal(id)
  })

  it('activate signer', async () => {
    const { nonce } = await alice.activateSigner()
    expect(nonce).not.empty
  })
})
