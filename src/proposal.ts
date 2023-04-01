import { ECTSS, EdCurve, EdTSS, SecretSharing } from '@desig/core'
import { CryptoSys } from '@desig/supported-chains'
import { utils } from '@noble/ed25519'
import { keccak_256 } from '@noble/hashes/sha3'
import { BN } from 'bn.js'
import { decode, encode } from 'bs58'
import { io, Socket } from 'socket.io-client'
import { Connection } from './connection'
import { DesigECDSAKeypair, DesigEdDSAKeypair } from './keypair'
import { Multisig, MultisigEntity } from './multisig'
import { SignerEntiry } from './signer'
import { PaginationParams } from './types'

export type ApprovalEntity = {
  id: number
  signature: string
  randomness: string
  signer: Omit<SignerEntiry, 'multisig'>
  createdAt: Date
  updatedAt: Date
}

export type ProposalEntity = {
  id: string
  multisig: Pick<MultisigEntity, 'id'>
  chainId: string
  approvals: ApprovalEntity[]
  msg: string
  raw: string
  R: string
  sqrhz?: string
  ttl: number
  createdAt: Date
  updatedAt: Date
}

export type ApprovalEvents = 'insertApproval' | 'updateSignature'
export type ApprovalEventResponse = ApprovalEntity & {
  proposal: Omit<ProposalEntity, 'approvals'>
}

export const APPROVAL_EVENTS: ApprovalEvents[] = [
  'insertApproval',
  'updateSignature',
]

export class Proposal extends Connection {
  private socket: Socket

  constructor(cluster: string, keypair: DesigEdDSAKeypair | DesigECDSAKeypair) {
    super(cluster, { keypair })
  }

  /**
   * Derive the proposal id by its content
   * @param msg Proposal's content (Or message)
   * @returns The proposal id
   */
  static deriveProposalId = (msg: Uint8Array): string => encode(keccak_256(msg))

  /**
   * Initialize a socket
   */
  private initSocket = () => {
    if (this.keypair) {
      if (!this.socket)
        this.socket = io(this.cluster, {
          auth: async (cb) => {
            const Authorization = await this.getNonceAuthorization()
            return cb({ Authorization })
          },
        })
      this.socket.emit('proposal')
    } else this.socket = undefined
    return this.socket
  }

  /**
   * Watch approval changes
   * @param callback Callback event
   */
  watch = (
    callback: (event: ApprovalEvents, data: ApprovalEventResponse) => void,
  ) => {
    const socket = this.initSocket()
    APPROVAL_EVENTS.forEach((event) =>
      socket.on(event, (res: ApprovalEventResponse) => callback(event, res)),
    )
  }

  /**
   * Unwatch approval changes
   */
  unwatch = () => {
    this.socket.disconnect()
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
  }: Partial<PaginationParams>): Promise<ProposalEntity[]> => {
    const Authorization = await this.getNonceAuthorization()
    const { data } = await this.connection.get<ProposalEntity[]>(
      `/proposal?limit=${limit}&offset=${offset}`,
      { headers: { Authorization } },
    )
    return data
  }

  /**
   * Get a prposal data. Note that it's only about multisig info.
   * @param id Proposal id
   * @returns Proposal data
   */
  getProposal = async (id: string): Promise<ProposalEntity> => {
    const Authorization = await this.getNonceAuthorization()
    const { data } = await this.connection.get<ProposalEntity>(
      `/proposal/${id}`,
      { headers: { Authorization } },
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
  }: {
    raw: Uint8Array
    msg: Uint8Array
    chainId: string
  }): Promise<ProposalEntity> => {
    const multisigId = encode(this.keypair.masterkey)
    const Authorization = await this.getNonceAuthorization()
    const { data } = await this.connection.post<ProposalEntity>(
      '/proposal',
      {
        multisigId,
        msg: encode(msg),
        raw: encode(raw),
        chainId,
      },
      { headers: { Authorization } },
    )
    return data
  }

  /**
   * Approve the proposal.
   * You will need to submit the commitment in the 1st round to be able to join the 2nd round of signing.
   * @param id Proposal id
   * @returns Proposal data
   */
  approveProposal = async (id: string): Promise<ProposalEntity> => {
    if (this.keypair.cryptosys === CryptoSys.EdDSA)
      return this.approveEdTransactrion(id)
    if (this.keypair.cryptosys === CryptoSys.ECDSA)
      return this.approveEcTransaction(id)
    throw new Error('Invalid crypto system')
  }
  // Approve Ed Transaction
  private approveEdTransactrion = async (id: string) => {
    const { msg, approvals, R } = await this.getProposal(id)
    const { randomness } = approvals.find(
      ({ signer: { id } }) => id === encode(this.keypair.pubkey),
    )
    const signature = EdTSS.sign(
      decode(msg),
      decode(R),
      this.keypair.masterkey,
      decode(randomness).subarray(32),
      this.keypair.privkey,
    )
    const Authorization = await this.getNonceAuthorization()
    const { data } = await this.connection.patch<ProposalEntity>(
      `/proposal/${id}`,
      { signature: encode(signature) },
      { headers: { Authorization } },
    )
    return data
  }
  // Approve EC Transaction
  private approveEcTransaction = async (id: string) => {
    const { approvals, R } = await this.getProposal(id)
    const { randomness } = approvals.find(
      ({ signer: { id } }) => id === encode(this.keypair.pubkey),
    )
    const signature = ECTSS.sign(
      decode(R),
      decode(randomness).subarray(32),
      this.keypair.privkey,
    )
    const Authorization = await this.getNonceAuthorization()
    const { data } = await this.connection.patch<ProposalEntity>(
      `/proposal/${id}`,
      { signature: encode(signature) },
      { headers: { Authorization } },
    )
    return data
  }

  /**
   * Finalize the partial signatures. The function will combine the partial signatures and construct the valid signature.
   * @param id Proposal id
   * @returns Master signature
   */
  finalizeSignature = async (
    id: string,
  ): Promise<{ sig: string; recv?: number }> => {
    const { t } = this.keypair.getThreshold()
    const tx = await this.getProposal(id)
    const approvals = tx.approvals.filter(({ signature }) => !!signature)
    if (approvals.length < t)
      throw new Error(
        `Insufficient number of signatures. Require ${t} but got ${approvals.length}.`,
      )
    if (this.keypair.cryptosys === CryptoSys.EdDSA)
      return this.finalizeEdSignature(approvals)
    if (this.keypair.cryptosys === CryptoSys.ECDSA) {
      const { msg, R, sqrhz } = tx
      return this.finalizeEcSignature(approvals, { msg, R, sqrhz })
    }
    throw new Error('Invalid crypto system')
  }
  // Finalize Ed Signature
  private finalizeEdSignature = async (approvals: ApprovalEntity[]) => {
    const secretSharing = new SecretSharing(EdTSS.ff.r, 'le')
    const indice = approvals.map(({ signer: { index } }) =>
      new BN(index).toArrayLike(Buffer, 'le', 8),
    )
    const pi = secretSharing.pi(indice)
    const sigs = approvals.map(({ signature }, i) =>
      utils.concatBytes(
        EdCurve.mulScalar(decode(signature).subarray(0, 32), pi[i]),
        secretSharing.yl(decode(signature).subarray(32), pi[i]),
      ),
    )
    const sig = EdTSS.addSig(sigs)
    return { sig: encode(sig) }
  }
  // Finalize EC Signature
  private finalizeEcSignature = async (
    signatures: ApprovalEntity[],
    { msg, R, sqrhz }: { msg: string; R: string; sqrhz: string },
  ) => {
    const secretSharing = new SecretSharing(ECTSS.ff.r, 'be')
    const multisig = new Multisig(this.cluster)
    const multisigId = encode(this.keypair.masterkey)
    const { sqrpriv } = await multisig.getMultisig(multisigId)
    if (!sqrpriv) throw new Error('Invalid transaction')
    const indice = signatures.map(({ signer: { index } }) =>
      new BN(index).toArrayLike(Buffer, 'be', 8),
    )
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
    return { sig: encode(sig), recv }
  }

  /**
   * Verify a master signature
   * @param id Proposal id
   * @param signature Master signature
   * @returns true/false
   */
  verifySignature = async (id: string, signature: string) => {
    const { msg } = await this.getProposal(id)
    if (this.keypair.cryptosys === CryptoSys.EdDSA)
      return EdTSS.verify(
        decode(msg),
        decode(signature),
        this.keypair.masterkey,
      )
    if (this.keypair.cryptosys === CryptoSys.ECDSA)
      return ECTSS.verify(
        decode(msg),
        decode(signature),
        this.keypair.masterkey,
      )
    throw new Error('Invalid crypto system')
  }
}
