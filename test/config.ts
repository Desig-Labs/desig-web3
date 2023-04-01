import { Goerli, SolanaDevnet } from '@desig/supported-chains'

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
  cluster: 'https://eddsa.desig.dev',
  // Solana
  chain: new SolanaDevnet(),
}

/**
 * ECDSA utils
 */
export const ecdsa = {
  // Desig
  cluster: 'https://ecdsa.desig.dev',
  // Ethereum
  chain: new Goerli(),
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
