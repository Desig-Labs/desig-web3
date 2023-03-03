import { expect } from 'chai'
import { Multisig } from '../dist'
import { eddsa, ecdsa } from './config'

describe('eddsa: multisig', () => {
  const multisig = new Multisig(eddsa.cluster)
  const rand = Math.round(Math.random() * 10 ** 9)
  const t = 2
  const n = 3
  const name = `The Dao #${rand}`
  const emails = [
    'dummy@desig.io',
    'dummy@desig.dev',
    'dummy@descartes.network',
  ]
  let multisigId = ''

  it('initialize multisig', async () => {
    const data = await multisig.initializeMultisig({ t, n, name, emails })
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
  const emails = [
    'dummy@desig.io',
    'dummy@desig.dev',
    'dummy@descartes.network',
  ]
  let multisigId = ''

  it('initialize multisig', async () => {
    const data = await multisig.initializeMultisig({ t, n, name, emails })
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
