import { getPublicKey } from '@noble/ed25519'
import { decode, encode } from 'bs58'
import { expect } from 'chai'
import { Multisig } from '../dist'
import { eddsa, ecdsa, alicePrivkey, bobPrivkey, carolPrivkey } from './config'

describe('eddsa: multisig', () => {
  const multisig = new Multisig(eddsa.cluster)
  const rand = Math.round(Math.random() * 10 ** 9)
  const t = 2
  const n = 3
  const name = `The Dao #${rand}`
  const pubkeys: string[] = []
  let multisigId = ''

  before(async () => {
    const alicePubkey = await getPublicKey(decode(alicePrivkey))
    const bobPubkey = await getPublicKey(decode(bobPrivkey))
    const carolPubkey = await getPublicKey(decode(carolPrivkey))
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
  const multisig = new Multisig(ecdsa.cluster)
  const rand = Math.round(Math.random() * 10 ** 9)
  const t = 2
  const n = 3
  const name = `The Dao #${rand}`
  const pubkeys: string[] = []
  let multisigId = ''

  before(async () => {
    const alicePubkey = await getPublicKey(decode(alicePrivkey))
    const bobPubkey = await getPublicKey(decode(bobPrivkey))
    const carolPubkey = await getPublicKey(decode(carolPrivkey))
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
