import { utils } from '@noble/ed25519'
import { sha512 } from '@noble/hashes/sha512'
// @noble/ed25519 patch
utils.sha512Sync = (...m) => sha512(utils.concatBytes(...m))

export * from './types'
export * from './keypair'
export * from './connection'
export * from './proposal'
export * from './multisig'
export * from './signer'
export * from './evm'
export * from './sol'
