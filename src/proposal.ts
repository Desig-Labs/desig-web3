import { ECTSS, EdCurve, EdTSS, ElGamal, SecretSharing } from '@desig/core'
import { keccak_256 } from '@noble/hashes/sha3'
import { concatBytes } from '@noble/hashes/utils'
import { decode, encode } from 'bs58'
import { Connection, EventStreaming } from './connection'
import { DesigKeypair } from './keypair'
import { Multisig } from './multisig'
import type {
  ExtendedApprovalEntity,
  ExtendedProposalEntity,
  PaginationParams,
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
   * Derive the approval id by the proposal id and the signer id
   * @param proposalId Proposal id
   * @param signerId Signer id
   * @returns Approval id
   */
  static deriveApprovalId(proposalId: string, signerId: string) {
    const seed = concatBytes(decode(proposalId), decode(signerId))
    return encode(keccak_256(seed))
  }

  /**
   * Watch new approval
   * @param callback
   * @returns Close function
   */
  watch = (callback: (approvalId: string, er?: string) => void) => {
    const multisigId = encode(this.keypair.masterkey)
    const unwatch = this.on(EventStreaming.approval, multisigId, callback)
    return unwatch
  }

  /**
   * Get proposals data. Note that it's only about multisig info.
   * @param chainId Chain id
   * @param pagination.size Page size
   * @param pagination.after Page cursor
   * @returns Proposal data
   */
  getProposals = async (
    chainId: string,
    { size = 10, after }: Partial<PaginationParams> = {},
  ) => {
    const { data } = await this.connection.get<ExtendedProposalEntity[]>(
      '/proposal',
      {
        params: {
          multisigId: encode(this.keypair.masterkey),
          chainId,
          size,
          after,
        },
      },
    )
    return data
  }

  /**
   * Get a prposal data. Note that it's only about multisig info.
   * @param proposalId Proposal id
   * @returns Proposal data
   */
  getProposal = async (proposalId: string) => {
    const { data } = await this.connection.get<ExtendedProposalEntity>(
      `/proposal/${proposalId}`,
    )
    return data
  }

  /**
   * Get an approval data.
   * @param approvalId Approval id
   * @returns Approval data
   */
  getApproval = async (approvalId: string) => {
    const { data } = await this.connection.get<ExtendedApprovalEntity>(
      `/approval/${approvalId}`,
    )
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
    ttl,
  }: {
    raw: Uint8Array
    msg: Uint8Array
    chainId: string
    ttl?: number
  }) => {
    const payload: any = {
      multisigId: encode(this.keypair.masterkey),
      msg: encode(msg),
      raw: encode(raw),
      chainId,
    }
    if (ttl) payload.ttl = ttl
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
    const { msg, approvals, R } = await this.getProposal(proposalId)
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
    const { msg, approvals, R } = await this.getProposal(proposalId)
    const { randomness } = approvals.find(
      ({ signer: { id } }) => id === encode(this.keypair.index),
    )
    const elgamal = new ElGamal()
    const x = elgamal.decrypt(decode(randomness), this.privkey)
    const signature = ECTSS.sign(decode(msg), decode(R), x, this.keypair.share)
    return encode(signature)
  }

  /**
   * Update tx hash for ux utilities.
   * @param proposalId Proposal id
   * @param txHash Transaction hash
   */
  updateTxHash = async (proposalId: string, txHash: string) => {
    const payload = { txHash }
    const Authorization = await this.getAuthorization(payload)
    const { data } = await this.connection.patch<
      Awaited<ReturnType<typeof this.getProposal>>
    >(`/proposal/${proposalId}`, payload, { headers: { Authorization } })
    return data
  }

  /**
   * Finalize the partial signatures. The function will combine the partial signatures and construct the valid signature.
   * @param proposalId Proposal id
   * @returns Master signature
   */
  finalizeSignature = async (
    proposalId: string,
  ): Promise<{ sig: Uint8Array; recv?: number }> => {
    const {
      data: { sig, recv },
    } = await this.connection.get<
      Awaited<{ sig: string; recv: number | undefined }>
    >(`/proposal/${proposalId}/signature`, {
      headers: { 'X-Desig-Curve': this.keypair.curve },
    })
    return { sig: decode(sig), recv }
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
