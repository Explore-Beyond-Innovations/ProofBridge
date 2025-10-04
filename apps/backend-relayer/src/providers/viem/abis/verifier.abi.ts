export const VERIFIER_ABI = [
  {
    type: 'function',
    name: 'verify',
    inputs: [
      { name: 'proof', type: 'bytes', internalType: 'bytes' },
      { name: 'publicInputs', type: 'bytes32[]', internalType: 'bytes32[]' },
    ],
    outputs: [{ name: '', type: 'bool', internalType: 'bool' }],
    stateMutability: 'view',
  },
  { type: 'error', name: 'ProofLengthWrong', inputs: [] },
  { type: 'error', name: 'PublicInputsLengthWrong', inputs: [] },
  { type: 'error', name: 'ShpleminiFailed', inputs: [] },
  { type: 'error', name: 'SumcheckFailed', inputs: [] },
];
