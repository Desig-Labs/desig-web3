import { ECTSS, EdCurve, EdTSS, ElGamal, SecretSharing } from '@desig/core'
import { keccak_256 } from '@noble/hashes/sha3'
import { concatBytes } from '@noble/hashes/utils'
import { decode, encode } from 'bs58'
import { Connection } from './connection'
import { DesigKeypair } from './keypair'
import { Multisig } from './multisig'
import type {
  ApprovalEntity,
  PaginationParams,
  ProposalEntity,
  SignerEntity,
} from './types'
import { Curve } from '@desig/supported-chains'

export class Proposal extends Connection {
  constructor(cluster: string, privkey: string, keypair: DesigKeypair) {
    super(cluster, decode(privkey), keypair)
  }

  /**
   * Derive the proposal id by the multisig id and its content
   * @param multisigId Multisig id
   * @param msg Proposal's content (Or message)
   * @returns Proposal id
   */
  static deriveProposalId = (multisigId: string, msg: Uint8Array): string => {
    const seed = concatBytes(decode(multisigId), msg)
    return encode(keccak_256(seed))
  }

  /**
   * Derive the approval id by the multisig id and the signer id
   * @param proposalId Proposal id
   * @param signerId Signer id
   * @returns Approval id
   */
  static deriveApprovalId(proposalId: string, signerId: string) {
    const seed = concatBytes(decode(proposalId), decode(signerId))
    return encode(keccak_256(seed))
  }

  /**
   * Get proposals data. Note that it's only about multisig info.
   * @param pagination.limit Limit
   * @param pagination.offset Offset
   * @returns Proposal data
   */
  getProposals = async ({
    offset = 0,
    limit = 500,
  }: Partial<PaginationParams> = {}) => {
    const { data } = await this.connection.get<ProposalEntity[]>('/proposal', {
      params: {
        multisigId: encode(this.keypair.masterkey),
        limit,
        offset,
      },
    })
    return data
  }

  /**
   * Get a prposal data. Note that it's only about multisig info.
   * @param proposalId Proposal id
   * @returns Proposal data
   */
  getProposal = async (proposalId: string) => {
    const { data } = await this.connection.get<
      ProposalEntity & { approvals: ApprovalEntity[] }
    >(`/proposal/${proposalId}`)
    return data
  }

  /**
   * Get an approval data.
   * @param approvalId Approval id
   * @returns Approval data
   */
  getApproval = async (approvalId: string) => {
    const { data } = await this.connection.get<
      ApprovalEntity & { proposal: ProposalEntity; signer: SignerEntity }
    >(`/approval/${approvalId}`)
    return data
  }

  /**
   * Submit a proposal to desig cluster
   * @param raw Raw message
   * @param msg Message buffer (The sign data)
   * @returns Proposal data
   */
  initializeProposal = async ({
    raw,
    msg,
    chainId,
  }: {
    raw: Uint8Array
    msg: Uint8Array
    chainId: string
  }): Promise<ProposalEntity> => {
    const payload = {
      multisigId: encode(this.keypair.masterkey),
      msg: encode(msg),
      raw: encode(raw),
      chainId,
    }
    const Authorization = await this.getAuthorization(payload)
    const { data } = await this.connection.post<
      Awaited<ReturnType<typeof this.getProposal>>
    >('/proposal', payload, {
      headers: { Authorization, 'X-Desig-Curve': this.keypair.curve },
    })
    return data
  }

  /**
   * Approve a proposal.
   * You will need to submit the commitment in the 1st round to be able to join the 2nd round of signing.
   * @param proposalId Proposal id
   * @returns Proposal data
   */
  approveProposal = async (proposalId: string) => {
    const signature = await (() => {
      switch (this.keypair.curve) {
        case Curve.ed25519:
          return this.approveEd25519Proposal(proposalId)
        case Curve.secp256k1:
          return this.approveSecp256k1Proposal(proposalId)
        default:
          throw new Error('Unsupported elliptic curve.')
      }
    })()
    const approvalId = Proposal.deriveApprovalId(proposalId, this.index)
    const payload = { signature }
    const Authorization = await this.getAuthorization(payload)
    const { data } = await this.connection.patch<
      Awaited<ReturnType<typeof this.getApproval>>
    >(`/approval/${approvalId}`, payload, { headers: { Authorization } })
    return data
  }
  // Approve Ed25519 Proposal
  private approveEd25519Proposal = async (proposalId: string) => {
    const data = await this.getProposal(proposalId)
    const { msg, approvals, R } = data
    const { randomness } = approvals.find(
      ({ signer: { id } }) => id === encode(this.keypair.index),
    )
    const elgamal = new ElGamal()
    const r = elgamal.decrypt(decode(randomness), this.privkey)
    const signature = EdTSS.sign(
      decode(msg),
      decode(R),
      this.keypair.masterkey,
      r,
      this.keypair.share,
    )
    return encode(signature)
  }
  // Approve Secp256k1 Proposal
  private approveSecp256k1Proposal = async (proposalId: string) => {
    const { approvals, R } = await this.getProposal(proposalId)
    const { randomness } = approvals.find(
      ({ signer: { id } }) => id === encode(this.keypair.index),
    )
    const elgamal = new ElGamal()
    const r = elgamal.decrypt(decode(randomness), this.privkey)
    const signature = ECTSS.sign(decode(R), r, this.keypair.share)
    return encode(signature)
  }

  /**
   * Finalize the partial signatures. The function will combine the partial signatures and construct the valid signature.
   * @param id Proposal id
   * @returns Master signature
   */
  finalizeSignature = async (
    id: string,
  ): Promise<{ sig: Uint8Array; recv?: number }> => {
    const { t } = this.keypair.getThreshold()
    const { msg, R, sqrhz, approvals } = await this.getProposal(id)
    const signatures = approvals.filter(({ signature }) => !!signature)
    if (signatures.length < t)
      throw new Error(
        `Insufficient number of signatures. Require ${t} but got ${signatures.length}.`,
      )
    if (this.keypair.curve === Curve.ed25519)
      return this.finalizeEd25519Signature(signatures)
    if (this.keypair.curve === Curve.secp256k1)
      return this.finalizeSecp256k1Signature(signatures, { msg, R, sqrhz })
    throw new Error('Unsupported elliptic curve.')
  }
  // Finalize Ed25519 Signature
  private finalizeEd25519Signature = async (approvals: ApprovalEntity[]) => {
    const secretSharing = new SecretSharing(EdTSS.ff)
    const indice = approvals.map(({ signer: { id } }) => decode(id))
    const pi = secretSharing.pi(indice)
    const sigs = approvals.map(({ signature }, i) =>
      concatBytes(
        EdCurve.mulScalar(decode(signature).subarray(0, 32), pi[i]),
        secretSharing.yl(decode(signature).subarray(32), pi[i]),
      ),
    )
    const sig = EdTSS.addSig(sigs)
    return { sig }
  }
  // Finalize Secp256k1 Signature
  private finalizeSecp256k1Signature = async (
    signatures: ApprovalEntity[],
    { msg, R, sqrhz }: { msg: string; R: string; sqrhz: string },
  ) => {
    const secretSharing = new SecretSharing(ECTSS.ff)
    const multisig = new Multisig(this.cluster, encode(this.privkey))
    const multisigId = encode(this.keypair.masterkey)
    const { sqrpriv } = await multisig.getMultisig(multisigId)
    if (!sqrpriv) throw new Error('Invalid transaction.')
    const indice = signatures.map(({ signer: { id } }) => decode(id))
    const pi = secretSharing.pi(indice)
    const sigs = signatures.map(({ signature }, i) =>
      secretSharing.yl(decode(signature), pi[i]),
    )
    const [sig, recv] = ECTSS.addSig(
      sigs,
      decode(msg),
      decode(R),
      decode(sqrpriv),
      decode(sqrhz),
    )
    return { sig, recv }
  }

  /**
   * Verify a master signature
   * @param id Proposal id
   * @param signature Master signature
   * @returns true/false
   */
  verifySignature = async (id: string, signature: Uint8Array) => {
    const { msg } = await this.getProposal(id)
    if (this.keypair.curve === Curve.ed25519)
      return EdTSS.verify(decode(msg), signature, this.keypair.masterkey)
    if (this.keypair.curve === Curve.secp256k1)
      return ECTSS.verify(decode(msg), signature, this.keypair.masterkey)
    throw new Error('Invalid crypto system')
  }
}
