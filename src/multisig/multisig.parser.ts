import { multisig } from '../../proto'

export class MZkProofParser {
  constructor() {}

  encode = (data: multisig.IZKProof) => {
    const er = multisig.ZKProof.verify(data)
    if (er) throw new Error(er)
    const msg = multisig.ZKProof.create(data)
    return multisig.ZKProof.encode(msg).finish()
  }

  decode = (buf: Uint8Array) => {
    const data = multisig.ZKProof.decode(buf)
    return data
  }
}
