import { expect } from 'chai'
import { Multisig } from '../dist'
import { cluster } from './config'

describe('multisig', () => {
  const multisig = new Multisig(cluster)
  const rand = Math.round(Math.random() * 10 ** 9)
  const t = 2
  const n = 3
  const name = `The Dao #${rand}`
  const emails = ['dummy@desig.io', 'dummy@desig.dev']
  let multisigId = ''

  it('initialize multisig', async () => {
    const data = await multisig.initialize({ t, n, name, emails })
    multisigId = data.id
    expect(data.name).equals(name)
    expect(data.t).equals(t)
    expect(data.n).equals(n)
    expect(multisigId).to.not.empty
  })

  it('fecth multsig', async () => {
    const data = await multisig.fetch(multisigId)
    expect(data.name).equals(name)
    expect(data.t).equals(t)
    expect(data.n).equals(n)
  })
})
