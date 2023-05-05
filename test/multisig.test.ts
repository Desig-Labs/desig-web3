import { decode, encode } from 'bs58'
import { expect } from 'chai'
import { Multisig } from '../dist'
import { eddsa, ecdsa, alicePrivkey, bobPrivkey, carolPrivkey } from './config'
import { EdCurve } from '@desig/core'
import { CryptoSys } from '@desig/supported-chains'

const pubkeys = [
  encode(EdCurve.getPublicKey(decode(alicePrivkey))),
  encode(EdCurve.getPublicKey(decode(bobPrivkey))),
  encode(EdCurve.getPublicKey(decode(carolPrivkey))),
]

describe('eddsa: multisig', () => {
  const multisig = new Multisig(eddsa.cluster, CryptoSys.EdDSA)
  const t = 2
  const n = 3
  let multisigId = ''

  it('initialize multisig', async () => {
    const data = await multisig.initializeMultisig({ t, n, pubkeys })
    multisigId = data.id
    expect(data.t).equals(t)
    expect(data.n).equals(n)
    expect(multisigId).to.not.empty
  })

  it('fecth multsig', async () => {
    const data = await multisig.getMultisig(multisigId)
    expect(data.t).equals(t)
    expect(data.n).equals(n)
  })
})

describe('ecdsa: multisig', () => {
  const multisig = new Multisig(ecdsa.cluster, CryptoSys.ECDSA)
  const t = 2
  const n = 3
  let multisigId = ''

  it('initialize multisig', async () => {
    const data = await multisig.initializeMultisig({ t, n, pubkeys })
    multisigId = data.id
    expect(data.t).equals(t)
    expect(data.n).equals(n)
    expect(multisigId).to.not.empty
  })

  it('fecth multsig', async () => {
    const data = await multisig.getMultisig(multisigId)
    expect(data.t).equals(t)
    expect(data.n).equals(n)
  })
})
