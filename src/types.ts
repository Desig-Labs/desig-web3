import { Curve } from '@desig/supported-chains'

/**
 * Pagination
 */

export type PaginationParams = {
  offset: number
  limit: number
}

/**
 * Basics
 */

export type SignerEntity = {
  id: string
  activated: boolean
  genesis: string
  owner: string
  encryptedShare: string
  createdAt: number
  updatedAt: number
  deletedAt: number
}

export type MultisigEntity = {
  id: string
  gid: string
  t: number
  n: number
  curve: Curve
  creator: string
  sqrpriv?: string
  createdAt: number
  updatedAt: number
}

export type ProposalEntity = {
  id: string
  chainId: string
  msg: string
  raw: string
  R: string
  sqrhz?: string
  ttl?: number
  creator: string
  createdAt: number
  updatedAt: number
}

export type ApprovalEntity = {
  id: string
  signature: string
  randomness: string
  createdAt: number
  updatedAt: number
}

export type TransactionEntity = {
  id: string
  msg: string
  raw: string
  ttl?: number
  creator: string
  approved: boolean
  createdAt: number
  updatedAt: number
}

export type SignatureEntity = {
  id: number
  signature: string
  pullrequest: string
  createdAt: number
  updatedAt: number
}

/**
 * Events
 */

export type ApprovalEvents = 'insertApproval' | 'updateApproval'
export type ApprovalEventResponse = ApprovalEntity & {
  proposal: Omit<ProposalEntity, 'approvals'>
}

export type SignatureEvents = 'insertSignature' | 'updateSignature'
export type SignatureEventResponse = SignatureEntity & {
  transaction: Omit<TransactionEntity, 'signatures'>
}

/**
 * Transaction types
 */

export enum TransactionType {
  tExtension = 'tExtension',
  tReduction = 'tReduction',
  nExtension = 'nExtension',
  nReduction = 'nReduction',
}
export type TransactionParams = {
  index?: string
  pubkey?: string
}

/**
 * Extended
 */

export type ExtendedSignerEntity = SignerEntity & {
  multisig: MultisigEntity
}

export type ExtendedApprovalEntity = ApprovalEntity & {
  proposal: ProposalEntity
  signer: Omit<SignerEntity, 'encryptedShare'>
}

export type ExtendedProposalEntity = ProposalEntity & {
  multisig: MultisigEntity
  approvals: Array<
    ApprovalEntity & { signer: Omit<SignerEntity, 'encryptedShare'> }
  >
}

export type ExtendedSignatureEntity = SignatureEntity & {
  transaction: TransactionEntity
  signer: Omit<SignerEntity, 'encryptedShare'>
}

export type ExtendedTransactionEntity = TransactionEntity & {
  multisig: MultisigEntity
  signatures: Array<
    SignatureEntity & { signer: Omit<SignerEntity, 'encryptedShare'> }
  >
}
