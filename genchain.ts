import { FiniteField } from '@desig/core'
import { sha512 } from '@noble/hashes/sha512'
import BN from 'bn.js'

const chains = ['Solana Mainnet', 'Solana Testnet', 'Solana Devnet']

chains.forEach((chain) => {
  const r = new BN(Number.MAX_SAFE_INTEGER)
  const ff = new FiniteField(r, 'le')
  const id = new BN(ff.norm(sha512(chain)), 16, 'le').toNumber()
  console.log(`✅ ${chain}: ${id}`)
})
