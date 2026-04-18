/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import * as circuitJson from './circuits/deposit_circuit.json';
import { Barretenberg, Fr, UltraHonkBackend } from '@aztec/bb.js';
import { Noir } from '@noir-lang/noir_js';
import { T_ProofParams, T_ProofResponse } from './types';
import { hexlify } from 'ethers';

@Injectable()
export class ProofService {
  private noirService: Noir;
  private ultralHonkService: UltraHonkBackend;
  static ZERO_32 = `0x${'0'.repeat(64)}`;

  constructor() {
    const circuit = JSON.parse(JSON.stringify(circuitJson));
    this.noirService = new Noir(circuit);
    this.ultralHonkService = new UltraHonkBackend(circuit.bytecode, {
      threads: 4,
    });
  }

  async generateProof(data: T_ProofParams): Promise<T_ProofResponse> {
    const { isAdCreator, merkleProof, orderHash, targetRoot, secret } = data;
    const nullifierHash = await this.generateNullifierHash(
      secret,
      isAdCreator,
      orderHash,
    );
    const inputs = {
      nullifier_hash: nullifierHash,
      order_hash: this.hashToField(orderHash).toString(),
      target_root: targetRoot,
      ad_contract: isAdCreator ? false : true,
      secret,
      target_index: merkleProof.elementIndex.toString(),
      tree_width: merkleProof.width.toString(),
      target_sibling_hashes_len: merkleProof.siblings.length.toString(),
      target_sibling_hashes: this.padArray(
        merkleProof.siblings.map((i) => i.toString()),
      ),
      target_peak_hashes_len: merkleProof.peaks.length.toString(),
      target_peak_hashes: this.padArray(
        merkleProof.peaks.map((i) => i.toString()),
      ),
    };
    const { witness } = await this.noirService.execute(inputs);
    const { proof, publicInputs } = await this.ultralHonkService.generateProof(
      witness,
      {
        keccak: true,
      },
    );

    return { proof: hexlify(proof), publicInputs };
  }

  generateSecret(): string {
    const secret = Fr.random().toBuffer();
    return hexlify(secret);
  }

  async generateNullifierHash(
    secret: string,
    isAdCreator: boolean,
    orderHash: string,
  ): Promise<string> {
    const secretBuffer = Buffer.from(secret.replace(/^0x/i, ''), 'hex');

    const bb = await Barretenberg.new();

    let leftSide: Buffer;
    let rightSide: Buffer;

    if (isAdCreator) {
      rightSide = Buffer.concat([
        Buffer.alloc(16, 0),
        secretBuffer.subarray(16, 32),
      ]);
      leftSide = Buffer.concat([
        secretBuffer.subarray(0, 16),
        Buffer.alloc(16, 0),
      ]);
    } else {
      leftSide = Buffer.concat([
        secretBuffer.subarray(0, 16),
        Buffer.alloc(16, 0),
      ]);
      rightSide = Buffer.concat([
        Buffer.alloc(16, 0),
        secretBuffer.subarray(16, 32),
      ]);
    }

    const orderField = this.hashToField(orderHash);

    const nullifier = await bb.poseidon2Hash(
      isAdCreator
        ? [orderField, Fr.fromBufferReduce(rightSide)]
        : [Fr.fromBufferReduce(leftSide), orderField],
    );

    return nullifier.toString();
  }

  private hashToField(valueHex: string): Fr {
    const hex = valueHex.startsWith('0x') ? valueHex.slice(2) : valueHex;
    const buff = Buffer.from(hex, 'hex');
    return Fr.fromBufferReduce(buff);
  }

  private padArray(array: string[], targetLen = 20): string[] {
    if (array.length > targetLen) {
      throw new Error(`Array length exceeds maximum of ${targetLen}`);
    }

    return [
      ...array.map(String),
      ...Array(targetLen - array.length).fill(ProofService.ZERO_32),
    ];
  }
}
