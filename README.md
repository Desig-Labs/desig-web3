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

## Copyright

Desig © 2023, All Rights Reserved.
