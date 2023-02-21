import {
  Cluster,
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
} from '@solana/web3.js'

export const cluster = 'http://localhost:10000'
// export const cluster = 'https://eddsa.desig.dev'
export const aliceSecret =
  'eddsa/4JKKpEK3teGFFbxeTFzScBaYse55mH4LgbtYG3q4BcKv/2AFv15MNPuABCdZq1uf8PCPa2gBYrgjpLxDu1mGCiBkfdqvP3ahydUXYF1YshvsCARgpvgt5wHcghGUfQxghGEf'
export const bobSecret =
  'eddsa/4JKKpEK3teGFFbxeTFzScBaYse55mH4LgbtYG3q4BcKv/3KWq19hjnoKJG4LJ71d4R6kZJQ1AMe7eL7tZpLsUD7Uq2rmEra5eGGeCRQWgDvpYtneHzY8qBS58hPjVSpJAviy'

const connection = new Connection('https://devnet.genesysgo.net', 'confirmed')

export const transfer = async (payer: PublicKey) => {
  const tx = new Transaction()
  const ix = SystemProgram.transfer({
    fromPubkey: payer,
    toPubkey: new PublicKey('8W6QginLcAydYyMYjxuyKQN56NzeakDE3aRFrAmocS6D'),
    lamports: 5000,
  })
  tx.add(ix)
  tx.feePayer = payer
  tx.recentBlockhash = (
    await connection.getLatestBlockhash('confirmed')
  ).blockhash
  return tx
}

export const sendAndConfirm = async (tx: Transaction) => {
  const signature = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: true,
    preflightCommitment: 'confirmed',
  })
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash()
  await connection.confirmTransaction({
    signature,
    blockhash,
    lastValidBlockHeight,
  })
  return signature
}

export const print = (...args: any[]) => {
  console.group()
  console.log('\x1b[36m↳\x1b[0m', ...args, '')
  console.groupEnd()
}

export const isSolanaAddress = (
  address: string | undefined,
): address is string => {
  if (!address) return false
  try {
    const publicKey = new PublicKey(address)
    if (!publicKey) throw new Error('Invalid public key')
    return true
  } catch (er) {
    return false
  }
}

export const solscan = (
  addressOrTxId: string,
  net: Cluster = 'devnet',
): string => {
  if (isSolanaAddress(addressOrTxId)) {
    return `https://solscan.io/account/${addressOrTxId}?cluster=${net}`
  }
  return `https://solscan.io/tx/${addressOrTxId}?cluster=${net}`
}
