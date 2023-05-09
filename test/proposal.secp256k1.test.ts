import { decode, encode } from 'bs58'
import { expect } from 'chai'
import { Proposal, Signer, toEvmAddress } from '../dist'
import {
  cluster,
  chain,
  print,
  alicePrivkey,
  bobPrivkey,
  carolPrivkey,
} from './config'
import { randomBytes } from '@noble/hashes/utils'
import { keccak_256 } from '@noble/hashes/sha3'
import { Curve } from '@desig/supported-chains'

describe('secp256k1: proposal', () => {
  const message = encode(randomBytes(1024))
  let alice: Proposal
  let bob: Proposal
  let carol: Proposal
  let proposalId = ''
  let multisigId = ''

  const initLastProposalInstance = async (privkey: string) => {
    const signer = new Signer(cluster, privkey)
    const signers = await signer.getAllSigners()
    const { id: signerId } =
      signers.find(({ multisig: { curve } }) => curve === Curve.secp256k1) || {}
    if (!signerId) throw new Error('Not available signer')
    const keypair = await signer.getSignerKeypair(signerId)
    return new Proposal(cluster, privkey, keypair)
  }

  it('eth address', async () => {
    alice = await initLastProposalInstance(alicePrivkey)
    bob = await initLastProposalInstance(bobPrivkey)
    carol = await initLastProposalInstance(carolPrivkey)
    // Master key
    multisigId = encode(alice.keypair!.masterkey)
    print('master key:', toEvmAddress(alice.keypair!.masterkey))
    expect(alice.keypair!.masterkey).deep.equal(bob.keypair!.masterkey)
    expect(alice.keypair!.masterkey).deep.equal(carol.keypair!.masterkey)
  })

  it('initialize proposal', async () => {
    const raw = new TextEncoder().encode(message)
    const msg = keccak_256(raw)
    proposalId = Proposal.deriveProposalId(multisigId, msg)
    const proposal = await alice.initializeProposal({
      msg,
      raw,
      chainId: chain.secp256k1.chainId,
    })
    expect(encode(msg)).equal(proposal.msg)
    expect(proposalId).equal(proposal.id)
    expect(proposal.chainId).equal(chain.secp256k1.chainId)
  })

  it('get proposal', async () => {
    const { id, raw } = await alice.getProposal(proposalId)
    expect(new TextDecoder().decode(decode(raw))).equal(message)
    expect(proposalId).equal(id)
  })

  it('get proposals', async () => {
    const proposals = await alice.getProposals({})
    expect(proposals.length).is.greaterThan(0)
  })

  it('approve proposal by alice', async () => {
    const {
      proposal: { id },
    } = await alice.approveProposal(proposalId)
    expect(proposalId).equal(id)
  })

  it('approve proposal by bob', async () => {
    const {
      proposal: { id },
    } = await bob.approveProposal(proposalId)
    expect(proposalId).equal(id)
  })

  it('finalize/verify/submit proposal', async () => {
    // Finalize the proposal
    const { sig } = await carol.finalizeSignature(proposalId)
    expect(sig).not.empty
    // Verify the proposal
    const ok = await carol.verifySignature(proposalId, sig)
    expect(ok).to.be.true
  })
})
