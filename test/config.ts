import {
  Cluster,
  Connection,
  PublicKey,
  SystemProgram,
  Transaction as SolTransaction,
} from '@solana/web3.js'
import { Chain, Common, Hardfork } from '@ethereumjs/common'
import { Transaction as EthTransaction } from '@ethereumjs/tx'
import Web3 from 'web3'

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
  connection: new Connection('https://api.devnet.solana.com', 'confirmed'),
  transfer: async (payer: PublicKey) => {
    const tx = new SolTransaction()
    const ix = SystemProgram.transfer({
      fromPubkey: payer,
      toPubkey: new PublicKey('8W6QginLcAydYyMYjxuyKQN56NzeakDE3aRFrAmocS6D'),
      lamports: 5000,
    })
    tx.add(ix)
    tx.feePayer = payer
    tx.recentBlockhash = (
      await eddsa.connection.getLatestBlockhash('confirmed')
    ).blockhash
    return tx
  },
  sendAndConfirm: async (tx: SolTransaction) => {
    const signature = await eddsa.connection.sendRawTransaction(
      tx.serialize(),
      {
        skipPreflight: true,
        preflightCommitment: 'confirmed',
      },
    )
    const { blockhash, lastValidBlockHeight } =
      await eddsa.connection.getLatestBlockhash()
    await eddsa.connection.confirmTransaction({
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
  // cluster: 'http://localhost:10000',
  aliceSecret:
    'ecdsa/obYW9zYB2kpC2LkPWtY2NWSbAQCBkm8SdGwjer9opXho/11111117w73KBk3i3nfBqBxxqr85e7XXgqBPApfjiUqNd6TauKPZHmmimqwgc7TqqqGPF3wXrA4As1FuUesL',
  bobSecret:
    'ecdsa/obYW9zYB2kpC2LkPWtY2NWSbAQCBkm8SdGwjer9opXho/1111111EsD5dNV6R6ZzbLdmuAJi6Lz183nhEJod4Yqs9UWP4twVE7tsadFA4iWLqeL8AzVFfQtbr1S5er21U',
  // Ethereum
  web3: new Web3(
    'https://goerli.infura.io/v3/783c24a3a364474a8dbed638263dc410',
  ),
  transfer: async (payer: string) => {
    const params = {
      to: '0x76d8B624eFDDd1e9fC4297F82a2689315ac62d82',
      value: ecdsa.web3.utils.toHex('1000000000'),
    }
    const nonce = await ecdsa.web3.eth.getTransactionCount(payer)
    const gasPrice = await ecdsa.web3.eth.getGasPrice()
    const gasLimit = await ecdsa.web3.eth.estimateGas(params)
    const common = new Common({
      chain: Chain.Goerli,
      hardfork: Hardfork.Istanbul,
    })
    const tx = new EthTransaction(
      {
        ...params,
        nonce: ecdsa.web3.utils.toHex(nonce),
        gasLimit: ecdsa.web3.utils.toHex(gasLimit),
        gasPrice: ecdsa.web3.utils.toHex(gasPrice),
      },
      { common },
    )
    return tx
  },
  sendAndConfirm: async (signedTx: EthTransaction) => {
    const serializedTx = signedTx.serialize()
    const { transactionHash: txId } =
      await ecdsa.web3.eth.sendSignedTransaction(
        ecdsa.web3.utils.bytesToHex([...serializedTx]),
      )
    while (true) {
      const { blockNumber } = await ecdsa.web3.eth.getTransactionReceipt(txId)
      const currentBlockNumber = await ecdsa.web3.eth.getBlockNumber()
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
