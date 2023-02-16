import { encode } from 'bs58'
import { expect } from 'chai'
import { DesigEdDSAKeypair, Signer } from '../dist'
import { cluster, aliceSecret } from './config'

describe('signer', () => {
  const alice = new Signer(cluster, new DesigEdDSAKeypair(aliceSecret))

  it('fetch signer', async () => {
    const {
      nonce,
      multisig: { id },
    } = await alice.fetch()
    const [_, masterkey] = aliceSecret.split('/')
    expect(nonce).not.empty
    expect(masterkey).equal(id)
  })

  it('get authorization', async () => {
    const authorization = await alice.authorize()
    expect(authorization).not.empty
  })
})
