import * as ec from '@noble/secp256k1'
import * as ed from '@noble/ed25519'
import { sha512 } from '@noble/hashes/sha512'
import { sha256 } from '@noble/hashes/sha256'
import { hmac } from '@noble/hashes/hmac'
import { concatBytes } from '@noble/hashes/utils'
// @noble/ed25519 patch
ed.utils.sha512Sync = (...m) => sha512(concatBytes(...m))
// @noble/secp256k1 patch
ec.utils.hmacSha256Sync = (k, ...m) => hmac(sha256, k, concatBytes(...m))

export * from './types'
export * from './keypair'
export * from './connection'
export * from './multisig'
export * from './signer'
export * from './proposal'
export * from './transaction'
export * from './evm'
export * from './sol'
export * from './sui'
