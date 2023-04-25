export type PaginationParams = {
  offset: number
  limit: number
}

export type SignerEntity = {
  id: string
  activated: boolean
  owner: string
  encryptedShare: string
  multisig: MultisigEntity
  createdAt: Date
  updatedAt: Date
}

export type MultisigEntity = {
  id: string
  gid: string
  t: number
  n: number
  name: string
  sqrpriv?: string
  signers: SignerEntity[]
  nonce: number
  createdAt: Date
  updatedAt: Date
}

export type ApprovalEntity = {
  id: number
  signature: string
  randomness: string
  signer: Omit<SignerEntity, 'multisig'>
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

export type SignatureEntity = {
  id: number
  signature: string
  signer: Omit<SignerEntity, 'multisig'>
  createdAt: Date
  updatedAt: Date
}

export type TransactionEntity = {
  id: string
  multisig: Pick<MultisigEntity, 'id'>
  signatures: SignatureEntity[]
  msg: string
  raw: string
  ttl: number
  createdAt: Date
  updatedAt: Date
}

export type ApprovalEvents = 'insertApproval' | 'updateSignature'
export type ApprovalEventResponse = ApprovalEntity & {
  proposal: Omit<ProposalEntity, 'approvals'>
}

export type TransactionType =
  | 'changeName'
  | 'tExtension'
  | 'tReduction'
  | 'nExtension'
  | 'nReduction'
export type TransactionParams = {
  name?: string
  pubkey?: string
}
