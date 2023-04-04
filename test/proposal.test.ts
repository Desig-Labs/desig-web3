import { decode, encode } from 'bs58'
import { expect } from 'chai'
import { Proposal, Signer, toEvmAddress, toSolanaAddress } from '../dist'
import {
  ecdsa,
  eddsa,
  print,
  alicePrivkey,
  bobPrivkey,
  carolPrivkey,
} from './config'

describe('eddsa: proposal', () => {
  const message = 'hello world'
  let alice: Proposal
  let bob: Proposal
  let carol: Proposal
  let proposalId = ''
  let multisigId = ''

  const getLastProposal = async (privkey: string) => {
    const signer = new Signer(eddsa.cluster, decode(privkey))
    const [{ id }] = await signer.getAllSigners()
    const keypair = await signer.getSignerKeypair(id)
    return new Proposal(eddsa.cluster, keypair)
  }

  it('sol address', async () => {
    alice = await getLastProposal(alicePrivkey)
    bob = await getLastProposal(bobPrivkey)
    carol = await getLastProposal(carolPrivkey)
    // Master key
    multisigId = encode(alice.keypair!.masterkey)
    print('master key:', toSolanaAddress(alice.keypair!.masterkey))
    expect(multisigId).equal(encode(bob.keypair!.masterkey))
    expect(multisigId).equal(encode(carol.keypair!.masterkey))
  })

  it('initialize proposal', async () => {
    const raw = new TextEncoder().encode(message)
    const msg = new TextEncoder().encode(message)
    proposalId = Proposal.deriveProposalId(multisigId, msg)
    const proposal = await alice.initializeProposal({
      msg,
      raw,
      chainId: eddsa.chain.chainId,
    })
    expect(new TextDecoder().decode(decode(proposal.msg))).equal(message)
    expect(proposalId).equal(proposal.id)
    expect(proposal.chainId).equal(eddsa.chain.chainId)
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
    const { id } = await alice.approveProposal(proposalId)
    expect(proposalId).equal(id)
  })

  it('approve proposal by bob', async () => {
    const { id } = await bob.approveProposal(proposalId)
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

describe('ecdsa: proposal', () => {
  const message = 'hello world'
  let alice: Proposal
  let bob: Proposal
  let carol: Proposal
  let proposalId = ''
  let multisigId = ''

  const getLastProposal = async (privkey: string) => {
    const signer = new Signer(ecdsa.cluster, decode(privkey))
    const [{ id }] = await signer.getAllSigners()
    const keypair = await signer.getSignerKeypair(id)
    return new Proposal(ecdsa.cluster, keypair)
  }

  it('eth address', async () => {
    alice = await getLastProposal(alicePrivkey)
    bob = await getLastProposal(bobPrivkey)
    carol = await getLastProposal(carolPrivkey)
    // Master key
    multisigId = encode(alice.keypair!.masterkey)
    print('master key:', toEvmAddress(alice.keypair!.masterkey))
    expect(alice.keypair!.masterkey).deep.equal(bob.keypair!.masterkey)
    expect(alice.keypair!.masterkey).deep.equal(carol.keypair!.masterkey)
  })

  it('initialize proposal', async () => {
    const raw = new TextEncoder().encode(message)
    const msg = new TextEncoder().encode(message)
    proposalId = Proposal.deriveProposalId(multisigId, msg)
    const proposal = await alice.initializeProposal({
      msg,
      raw,
      chainId: ecdsa.chain.chainId,
    })
    expect(new TextDecoder().decode(decode(proposal.msg))).equal(message)
    expect(proposalId).equal(proposal.id)
    expect(proposal.chainId).equal(ecdsa.chain.chainId)
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
    const { id } = await alice.approveProposal(proposalId)
    expect(proposalId).equal(id)
  })

  it('approve proposal by bob', async () => {
    const { id } = await bob.approveProposal(proposalId)
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
