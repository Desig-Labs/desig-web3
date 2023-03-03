# Decentralized Signature | Desig

[![Twitter Follow](https://img.shields.io/twitter/follow/DesigLabs?style=social)](https://twitter.com/DesigLabs)

This library to help clients to interact with the Desig cluster.

## Installation

```
yarn add @desig/web3
```

## Usage

### Interactive Mode

```ts
import { Keypair, Transaction } from '@desig/web3'
const secret = 'your secret'
const keypair = Keypair.fromSecret(secret)
const transaction = new Transaction(keypair)
await transaction.approve(...)
```

### Read-only Mode

```ts
import { CryptoSys, Keypair, Multisig } from '@desig/web3'
const multisig = new Multisig()
await multisig.fetch(...)
```

## Example

```ts
import { DesigEdDSAKeypair, Multisig, Transaction } from '@desig/web3'
import { transfer, sendAndConfirm } from '<appendix_transfer_solana>'
import { SolanaDevnet } from '@desig/supported_chains'

// Init a 2-out-of-2 multisig
const multisig = new Multisig('https://<desig_cluster>')
const t = 2
const n = 2
const name = 'My first DAO'
const emails = ['<alice_email>@gmail.com', '<bob_email>@gmail.com']
const { id: multisigId } = await multisig.initializeMultisig({
  t,
  n,
  name,
  emails,
})
// Create alice keypair and bob keypair from secrets sent to the emails
const aliceKeypair = new DesigEdDSAKeypair('<alice_secret>')
const bobKeypair = new DesigEdDSAKeypair('<bob_secret>')
// aliceKeypair.masterkey === bobKeypair.masterkey is true
const masterkey = new PublicKey(aliceKeypair.masterkey)
// Alice initilizes a transaction
const aliceTx = new Transaction('https://<desig_cluster>', aliceKeypair)
const bobTx = new Transaction('https://<desig_cluster>', bobKeypair)
const tx = transfer(masterkey)
const raw = tx.serialize({ verifySignatures: false })
const msg = tx.serializeMessage()
const { id: txId } = await aliceTx.initializeTransaction({
  msg,
  raw,
  chainId: new SolanaDevnet().chainId,
})
// Alice approves the transaction
await aliceTx.approveTransaction(txId)
// Bob approves the transaction
await bobTx.approveTransaction(txId)
// Bob finalizes the transaction
const { sig } = await bobTx.finalizeSignature(txId)
const { raw } = await bobTx.getTransaction(txId)
const signedTx = Transaction.from(decode(raw))
signedTx.addSignature(masterkey, Buffer.from(decode(sig)))
// Bob submits the transaction
const txHash = await sendAndConfirm(tx)
```

## Appendix

### Transfer Solana

```ts
import {
  Cluster,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from '@solana/web3.js'

const conn = new Connection('https://api.devnet.solana.com')

export const transfer = async (payer: PublicKey) => {
  const tx = new Transaction()
  const ix = SystemProgram.transfer({
    fromPubkey: payer,
    toPubkey: new Keypair().publicKey,
    lamports: 5000,
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

## Copyright

Desig © 2023, All Rights Reserved.
