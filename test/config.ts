import {
  Cluster,
  Connection,
  PublicKey,
  SystemProgram,
  Transaction as SolTransaction,
} from '@solana/web3.js'
import {
  Transaction as EthTransaction,
  toBeHex,
  WebSocketProvider,
} from 'ethers'
import { Goerli, SolanaDevnet } from '@desig/supported-chains'
import { isEthereumAddress } from '../dist'

/**
 * Main users
 */
export const alicePrivkey = '41XjN7eYCDhmGFPXLEW8CrqsFnF7r2Kg9SERXP664WmJ'
export const bobPrivkey = '4d24Hnff6irybALSpHXCsChsjfVUmbQEPxZkKCAhGXLB'
export const carolPrivkey = 'Bro7rv256G25xvsuY4dbRN2PiQtwR97RpeKAwXJTKfq'

/**
 * EdDSA utils
 */
export const eddsa = {
  // Desig
  // cluster: 'https://eddsa.desig.dev',
  cluster: 'http://localhost:10000',
  // Solana
  chain: new SolanaDevnet(),
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
  getWeb3: () => new WebSocketProvider(ecdsa.chain.rpc),
  transfer: async (payer: string) => {
    const web3 = ecdsa.getWeb3()
    const chain = new Goerli()
    const params = {
      to: '0x69b84C6cE3a1b130e46a2982B92DA9A04de92aFE',
      value: toBeHex('1000000000'),
    }
    const nonce = await web3.getTransactionCount(payer)
    const { gasPrice } = await web3.getFeeData()
    if (!gasPrice) throw new Error('Invalid gas price')
    const gasLimit = await web3.estimateGas(params)
    const tx = EthTransaction.from({
      ...params,
      chainId: chain.chainId,
      nonce,
      gasLimit: toBeHex(gasLimit),
      gasPrice: toBeHex(gasPrice),
    })
    return tx
  },
  sendAndConfirm: async (signedTx: EthTransaction) => {
    const web3 = ecdsa.getWeb3()
    const { hash: txId } = await web3.broadcastTransaction(signedTx.serialized)
    while (true) {
      const currentBlockNumber = await web3.getBlockNumber()
      const { blockNumber } = (await web3.getTransactionReceipt(txId)) || {
        blockNumber: currentBlockNumber,
      }
      if (currentBlockNumber >= blockNumber) break
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
