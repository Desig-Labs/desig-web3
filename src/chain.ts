/**
 * Almost EVM-based chains are available here: https://chainlist.wtf/
 * Other unsupported chains are derived by its hash (../genchain.ts)
 */

export enum Chain {
  Ethereum = '1',
  Goerli = '5',
  Sepolia = '11155111',
  BSCMainnet = '56',
  BSCTestnet = '97',
  SolanaMainnet = '3297058409350302',
  SolanaTestnet = '1953402825157648',
  SolanaDevnet = '3336862955977731',
}
