import { decode, encode } from 'bs58'
import { expect } from 'chai'
import { Multisig } from '../dist'
import { eddsa, ecdsa, alicePrivkey, bobPrivkey, carolPrivkey } from './config'
import { ECCurve, EdCurve } from '@desig/core'
import { CryptoSys } from '@desig/supported-chains'

describe('eddsa: multisig', () => {
  const multisig = new Multisig(eddsa.cluster, CryptoSys.EdDSA)
  const rand = Math.round(Math.random() * 10 ** 9)
  const t = 2
  const n = 3
  const name = `The Dao #${rand}`
  const pubkeys: string[] = []
  let multisigId = ''

  before(async () => {
    const alicePubkey = EdCurve.getPublicKey(decode(alicePrivkey))
    const bobPubkey = EdCurve.getPublicKey(decode(bobPrivkey))
    const carolPubkey = EdCurve.getPublicKey(decode(carolPrivkey))
    pubkeys.push(encode(alicePubkey))
    pubkeys.push(encode(bobPubkey))
    pubkeys.push(encode(carolPubkey))
  })

  it('initialize multisig', async () => {
    const data = await multisig.initializeMultisig({ t, n, name, pubkeys })
    multisigId = data.id
    expect(data.name).equals(name)
    expect(data.t).equals(t)
    expect(data.n).equals(n)
    expect(multisigId).to.not.empty
  })

  it('fecth multsig', async () => {
    const data = await multisig.getMultisig(multisigId)
    expect(data.name).equals(name)
    expect(data.t).equals(t)
    expect(data.n).equals(n)
  })
})

describe('ecdsa: multisig', () => {
  const multisig = new Multisig(ecdsa.cluster, CryptoSys.ECDSA)
  const rand = Math.round(Math.random() * 10 ** 9)
  const t = 2
  const n = 3
  const name = `The Dao #${rand}`
  const pubkeys: string[] = []
  let multisigId = ''

  before(async () => {
    const alicePubkey = ECCurve.getPublicKey(decode(alicePrivkey))
    const bobPubkey = ECCurve.getPublicKey(decode(bobPrivkey))
    const carolPubkey = ECCurve.getPublicKey(decode(carolPrivkey))
    pubkeys.push(encode(alicePubkey))
    pubkeys.push(encode(bobPubkey))
    pubkeys.push(encode(carolPubkey))
  })

  it('initialize multisig', async () => {
    const data = await multisig.initializeMultisig({ t, n, name, pubkeys })
    multisigId = data.id
    expect(data.name).equals(name)
    expect(data.t).equals(t)
    expect(data.n).equals(n)
    expect(multisigId).to.not.empty
  })

  it('fecth multsig', async () => {
    const data = await multisig.getMultisig(multisigId)
    expect(data.name).equals(name)
    expect(data.t).equals(t)
    expect(data.n).equals(n)
  })
})
