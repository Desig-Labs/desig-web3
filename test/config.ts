import {
  Cluster,
  Connection,
  PublicKey,
  SystemProgram,
  Transaction as SolTransaction,
} from '@solana/web3.js'
import { Transaction as EthTransaction } from '@ethereumjs/tx'
import Web3 from 'web3'
import { Goerli, SolanaDevnet } from '@desig/supported-chains'

/**
 * EdDSA utils
 */
export const eddsa = {
  // Desig
  cluster: 'https://eddsa.desig.dev',
  aliceSecret:
    'eddsa/4JKKpEK3teGFFbxeTFzScBaYse55mH4LgbtYG3q4BcKv/2AFv15MNPuABCdZq1uf8PCPa2gBYrgjpLxDu1mGCiBkfdqvP3ahydUXYF1YshvsCARgpvgt5wHcghGUfQxghGEf',
  bobSecret:
    'eddsa/4JKKpEK3teGFFbxeTFzScBaYse55mH4LgbtYG3q4BcKv/3KWq19hjnoKJG4LJ71d4R6kZJQ1AMe7eL7tZpLsUD7Uq2rmEra5eGGeCRQWgDvpYtneHzY8qBS58hPjVSpJAviy',
  // Solana
  chain: new SolanaDevnet(),
  getConnection: () => new Connection(eddsa.chain.rpc, 'confirmed'),
  transfer: async (payer: PublicKey) => {
    const conn = eddsa.getConnection()
    const tx = new SolTransaction()
    const ix = SystemProgram.transfer({
      fromPubkey: payer,
      toPubkey: new PublicKey('8W6QginLcAydYyMYjxuyKQN56NzeakDE3aRFrAmocS6D'),
      lamports: 5000,
    })
    tx.add(ix)
    tx.feePayer = payer
    tx.recentBlockhash = (await conn.getLatestBlockhash('confirmed')).blockhash
    return tx
  },
  sendAndConfirm: async (tx: SolTransaction) => {
    const conn = eddsa.getConnection()
    const signature = await conn.sendRawTransaction(tx.serialize(), {
      skipPreflight: true,
      preflightCommitment: 'confirmed',
    })
    const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash()
    await conn.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    })
    return signature
  },
}

/**
 * ECDSA utils
 */
export const ecdsa = {
  // Desig
  cluster: 'https://ecdsa.desig.dev',
  aliceSecret:
    'ecdsa/obYW9zYB2kpC2LkPWtY2NWSbAQCBkm8SdGwjer9opXho/11111117w73KBk3i3nfBqBxxqr85e7XXgqBPApfjiUqNd6TauKPZHmmimqwgc7TqqqGPF3wXrA4As1FuUesL',
  bobSecret:
    'ecdsa/obYW9zYB2kpC2LkPWtY2NWSbAQCBkm8SdGwjer9opXho/1111111EsD5dNV6R6ZzbLdmuAJi6Lz183nhEJod4Yqs9UWP4twVE7tsadFA4iWLqeL8AzVFfQtbr1S5er21U',
  // Ethereum
  chain: new Goerli(),
  getWeb3: () => new Web3(ecdsa.chain.rpc),
  transfer: async (payer: string) => {
    const web3 = ecdsa.getWeb3()
    const chain = new Goerli()
    const params = {
      to: '0x69b84C6cE3a1b130e46a2982B92DA9A04de92aFE',
      value: web3.utils.toHex('1000000000'),
    }
    const nonce = await web3.eth.getTransactionCount(payer)
    const gasPrice = await web3.eth.getGasPrice()
    const gasLimit = await web3.eth.estimateGas(params)
    const tx = new EthTransaction(
      {
        ...params,
        nonce: web3.utils.toHex(nonce),
        gasLimit: web3.utils.toHex(gasLimit),
        gasPrice: web3.utils.toHex(gasPrice),
      },
      { common: chain.getEVMCommon() },
    )
    return tx
  },
  sendAndConfirm: async (signedTx: EthTransaction) => {
    const web3 = ecdsa.getWeb3()
    const serializedTx = signedTx.serialize()
    const { transactionHash: txId } = await web3.eth.sendSignedTransaction(
      web3.utils.bytesToHex([...serializedTx]),
    )
    while (true) {
      const { blockNumber } = await web3.eth.getTransactionReceipt(txId)
      const currentBlockNumber = await web3.eth.getBlockNumber()
      if (currentBlockNumber - blockNumber >= 2) break
      else await asyncWait(5000)
    }
    return txId
  },
}

/**
 * Delay by async/await
 * @param ms - milisenconds
 * @returns
 */
export const asyncWait = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Beautiful printing
 * @param args
 */
export const print = (...args: any[]) => {
  console.group()
  console.log('\x1b[36m↳\x1b[0m', ...args, '')
  console.groupEnd()
}

/**
 * Validate Ethereum address
 * @param address Ethereum address
 * @returns true/false
 */
export const isEthereumAddress = (
  address: string | undefined,
): address is string => {
  if (!address) return false
  return Web3.utils.isAddress(address)
}

export const etherscan = (addrOrTx: string, net: string = 'goerli'): string => {
  const subnet = net === 'mainnet' ? '' : `${net}.`
  const pathname = isEthereumAddress(addrOrTx) ? 'address' : 'tx'
  return `https://${subnet}etherscan.io/${pathname}/${addrOrTx}`
}

/**
 * Validate Solana address
 * @param address Solana address
 * @returns true/false
 */
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
