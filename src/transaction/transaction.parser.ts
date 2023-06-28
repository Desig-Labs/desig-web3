import { keccak_256 } from '@noble/hashes/sha3'
import { transaction } from '../../proto'
import { equal } from '@desig/core'

export enum TransactionType {
  tExtension = 'tExtension',
  tReduction = 'tReduction',
  nExtension = 'nExtension',
  nReduction = 'nReduction',
}

export class TransactionParser {
  constructor() {}

  static selectors: Record<TransactionType, Uint8Array> = {
    tExtension: keccak_256(TransactionType.tExtension).subarray(0, 8),
    tReduction: keccak_256(TransactionType.tReduction).subarray(0, 8),
    nExtension: keccak_256(TransactionType.nExtension).subarray(0, 8),
    nReduction: keccak_256(TransactionType.nReduction).subarray(0, 8),
  }

  static parseType = (selector: Uint8Array) => {
    if (equal([selector, this.selectors.nExtension]))
      return TransactionType.nExtension
    if (equal([selector, this.selectors.nReduction]))
      return TransactionType.nReduction
    if (equal([selector, this.selectors.tExtension]))
      return TransactionType.tExtension
    if (equal([selector, this.selectors.tReduction]))
      return TransactionType.tReduction
    throw new Error('Unsupported Desig transaction.')
  }

  verify = async (buf: Uint8Array, gid?: Uint8Array) => {
    const { selector, refgid, t, n } = transaction.BaseTransaction.decode(buf)
    if (!!gid && !equal([gid, refgid])) throw new Error('Stale transaction.')
    return {
      txType: TransactionParser.parseType(selector),
      refgid,
      t: Number(t),
      n: Number(n),
    }
  }

  nExtension = {
    encode: (data: Omit<transaction.InExtension, 'selector'>) => {
      const payload = {
        selector: TransactionParser.selectors[TransactionType.nExtension],
        ...data,
      }
      const er = transaction.nExtension.verify(payload)
      if (er) throw new Error(er)
      const msg = transaction.nExtension.create(payload)
      return transaction.nExtension.encode(msg).finish()
    },
    decode: (buf: Uint8Array) => {
      const { selector, ...data } = transaction.nExtension.decode(buf)
      if (TransactionParser.parseType(selector) !== TransactionType.nExtension)
        throw new Error('Invalid type')
      return data
    },
  }

  nReduction = {
    encode: (data: Omit<transaction.InReduction, 'selector'>) => {
      const payload = {
        selector: TransactionParser.selectors[TransactionType.nReduction],
        ...data,
      }
      const er = transaction.nReduction.verify(payload)
      if (er) throw new Error(er)
      const msg = transaction.nReduction.create(payload)
      return transaction.nReduction.encode(msg).finish()
    },
    decode: (buf: Uint8Array) => {
      const { selector, ...data } = transaction.nReduction.decode(buf)
      if (TransactionParser.parseType(selector) !== TransactionType.nReduction)
        throw new Error('Invalid type')
      return data
    },
  }

  tExtension = {
    encode: (data: Omit<transaction.ItExtension, 'selector'>) => {
      const payload = {
        selector: TransactionParser.selectors[TransactionType.tExtension],
        ...data,
      }
      const er = transaction.tExtension.verify(payload)
      if (er) throw new Error(er)
      const msg = transaction.tExtension.create(payload)
      return transaction.tExtension.encode(msg).finish()
    },
    decode: (buf: Uint8Array) => {
      const { selector, ...data } = transaction.tExtension.decode(buf)
      if (TransactionParser.parseType(selector) !== TransactionType.tExtension)
        throw new Error('Invalid type')
      return data
    },
  }

  tReduction = {
    encode: (data: Omit<transaction.ItReduction, 'selector'>) => {
      const payload = {
        selector: TransactionParser.selectors[TransactionType.tReduction],
        ...data,
      }
      const er = transaction.tReduction.verify(payload)
      if (er) throw new Error(er)
      const msg = transaction.tReduction.create(payload)
      return transaction.tReduction.encode(msg).finish()
    },
    decode: (buf: Uint8Array) => {
      const { selector, ...data } = transaction.tReduction.decode(buf)
      if (TransactionParser.parseType(selector) !== TransactionType.tReduction)
        throw new Error('Invalid type')
      return data
    },
  }
}
