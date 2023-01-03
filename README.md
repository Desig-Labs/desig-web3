# Decentralized Signature | Desig

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
const keypair = Keypair.fromSecret({ cryptosys: CryptoSys.EdDSA })
const multisig = new Multisig(keypair)
await multisig.fetch(...)
```

## Copyright

Desig © 2023, All Rights Reserved.
