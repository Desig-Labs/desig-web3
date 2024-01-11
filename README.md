# Decentralized Signature | Desig

[![Twitter Follow](https://img.shields.io/twitter/follow/DesigLabs?style=social)](https://twitter.com/DesigLabs)

This library to help clients to interact with the Desig cluster.

## Installation

```
pnpm add @desig/web3
```

## Usage

```ts
import { encode } from 'bs58'
import { utils } from '@noble/ed25519'
import { DesigKeypair, Multisig, Signer, Proposal, Transaction } from '@desig/web3'

const cluster = 'https://mainnet.desig.io'
const privkey = encode(utils.randomPrivateKey())
const secretShare = 'ed25519/<master>/<share>'
const keypair = DesigKeypair.fromSecret(secret)

// Create multisig instance
const dMultisig = new Multisig(cluster, privkey)
await dMultisig.getMultisigs()
await dMultisig.getMultisig('multisigId')

// Create signer instance
const dSigner = new Signer(cluster, privkey)
await dSigner.getAllSigners()
await dSigner.getSigner('signerId')

// Create proposal instance
const dProposal = new Proposal(cluster, privkey, keypair)
await dProposal.approveProposal('proposalId')
await dProposal.initializeProposal({ raw: ..., msg: ..., chainId: ... })

// Create transaction instance
const dTransaction = new Transaction(cluster, privkey, keypair)
await dTransaction.initializeTransaction({ type: ..., params: { ... }})
await dTransaction.getTransaction('transactionId')
await dTransaction.signTransaction('transactionId')
```

## Example

### Create a multisig

```ts
import { encode } from 'bs58'
import { utils } from '@noble/ed25519'
import { Multisig } from '@desig/web3'
import { EdCurve } from '@desig/core'
import { Curve } from '@desig/supported-chains'

const privkey = encode(utils.randomPrivateKey())
const pubkey = encode(EdCurve.getPublicKey(decode(privkey)))

const dMultisig = new Multisig('https://mainnet.desig.io', privkey)
const t = 2
const n = 2
const pubkeys = [pubkey, pubkey] // You can change it to other members' pubkey
const curve = Curve.ed25519 // Refer https://chainlist.desig.io/ to find the corresponding chain
const multisig = await dMultisig.initializeMultisig(curve, {
  t,
  n,
  pubkeys,
})
```

### Create a proposal: Transfer SOL

```ts
import { Transaction } from '@solana/web3.js'
import { DesigKeypair, Proposal } from '@desig/web3'
import { transfer, sendAndConfirm } from '<appendix_transfer_solana>'
import { SolanaDevnet } from '@desig/supported_chains'

// Create alice keypair and bob keypair from secrets sent to the emails
const aliceKeypair = new DesigKeypair('<alice_secret_share>')
const bobKeypair = new DesigKeypair('<bob_secret_share>')
// aliceKeypair.masterkey === bobKeypair.masterkey is true
const masterkey = new PublicKey(aliceKeypair.masterkey)
// Alice initilizes a transaction
const aliceProposal = new Proposal(
  'https://mainnet.desig.io',
  alicePrivkey,
  aliceKeypair,
)
const bobProposal = new Proposal(
  'https://mainnet.desig.io',
  bobPrivkey,
  bobKeypair,
)
const tx = transfer(masterkey, 5000)
const raw = tx.serialize({ verifySignatures: false })
const msg = tx.serializeMessage()
const { id: proposalId } = await aliceProposal.initializeProposal({
  msg,
  raw,
  chainId: new SolanaDevnet().chainId,
})
// Alice approves the transaction
await aliceProposal.approveProposal(proposalId)
// Bob approves the transaction
await bobProposal.approveProposal(proposalId)
// Bob finalizes the transaction
const { sig } = await bobProposal.finalizeSignature(proposalId)
const { raw } = await bobProposal.getProposal(proposalId)
const serializedTx = Transaction.from(decode(raw))
const signedTx = addSolSignature(serializedTx, { sig, pubkey: masterkey })
// Bob submits the transaction
const txHash = await sendAndConfirm(signedTx)
```

### Create a proposal: Transfer ETH

```ts
import { Transaction, hexlify } from 'ethers'
import { DesigKeypair, Proposal } from '@desig/web3'
import { transfer, sendAndConfirm } from '<appendix_transfer_ethereum>'
import { CryptoSys, Goerli } from '@desig/supported_chains'

// Create alice keypair and bob keypair from secrets sent to the emails
const aliceKeypair = new DesigKeypair('<alice_secret_share>')
const bobKeypair = new DesigKeypair('<bob_secret_share>')
// aliceKeypair.masterkey === bobKeypair.masterkey is true
const masterkey = new PublicKey(aliceKeypair.masterkey)
// Alice initilizes a transaction
const aliceProposal = new Proposal(
  'https://mainnet.desig.io',
  alicePrivkey,
  aliceKeypair,
)
const bobProposal = new Proposal(
  'https://mainnet.desig.io',
  bobPrivkey,
  bobKeypair,
)
const tx = transfer(masterkey, 5000)
const raw = getBytes(tx.unsignedSerialized)
const msg = getBytes(tx.unsignedHash)
const { id: proposalId } = await aliceProposal.initializeProposal({
  msg,
  raw,
  chainId: new Goerli().chainId,
})
// Alice approves the transaction
await aliceProposal.approveProposal(proposalId)
// Bob approves the transaction
await bobProposal.approveProposal(proposalId)
// Bob finalizes the transaction
const { sig } = await bobProposal.finalizeSignature(proposalId)
const { raw, chainId } = await bobProposal.getProposal(proposalId)
const serializedTx = addEvmSignature(decode(raw), { sig, recv }, chainId)
const signedTx = Transaction.from(hexlify(serializedTx))
// Bob submits the transaction
const txHash = await sendAndConfirm(signedTx)
```

### More examples

[https://github.com/Desig-Labs/desig-web3/tree/master/test](https://github.com/Desig-Labs/desig-web3/tree/master/test)

## Appendix

### Transfer Solana

```ts
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
} from '@solana/web3.js'

const conn = new Connection('https://api.devnet.solana.com')

export const transfer = async (payer: PublicKey, lamports: number) => {
  const tx = new Transaction()
  const ix = SystemProgram.transfer({
    fromPubkey: payer,
    toPubkey: payer,
    lamports,
  })
  tx.add(ix)
  tx.feePayer = payer
  tx.recentBlockhash = (await conn.getLatestBlockhash('confirmed')).blockhash
  return tx
}

export const sendAndConfirm = async (tx: Transaction) => {
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
}
```

### Transfer Ethereum

```ts
import { Transaction, toBeHex, WebSocketProvider } from 'ethers'

export const asyncWait = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const transfer = async (payer: string, wei: number) => {
  // You can fill up the transaction params by yourself
  const tx = Transaction.from({
    to: payer,
    value: toBeHex(wei.toString()),
    chainId,
    nonce,
    gasLimit,
    gasPrice,
  })
  return tx
}

export const sendAndConfirm = async (tx: Transaction) => {
  const web3 = new WebSocketProvider('<infura_websocket_api>')
  const { hash } = await web3.broadcastTransaction(tx.serialized)
  while (true) {
    const currentBlockNumber = await web3.getBlockNumber()
    const { blockNumber } = (await web3.getTransactionReceipt(hash)) || {
      blockNumber: currentBlockNumber,
    }
    if (currentBlockNumber - blockNumber >= 1) break
    else await asyncWait(1000)
  }
  return hash
}
```

## Copyright

Desig © 2023, All Rights Reserved.
