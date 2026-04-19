export const AD_MANAGER_LOCK_ABI = [
  {
    type: "function",
    name: "lockForOrder",
    stateMutability: "nonpayable",
    inputs: [
      { name: "signature", type: "bytes" },
      { name: "authToken", type: "bytes32" },
      { name: "timeToExpire", type: "uint256" },
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "orderChainToken", type: "bytes32" },
          { name: "adChainToken", type: "bytes32" },
          { name: "amount", type: "uint256" },
          { name: "bridger", type: "bytes32" },
          { name: "orderChainId", type: "uint256" },
          { name: "srcOrderPortal", type: "bytes32" },
          { name: "orderRecipient", type: "bytes32" },
          { name: "adId", type: "string" },
          { name: "adCreator", type: "bytes32" },
          { name: "adRecipient", type: "bytes32" },
          { name: "salt", type: "uint256" },
          { name: "orderDecimals", type: "uint8" },
          { name: "adDecimals", type: "uint8" },
        ],
      },
    ],
    outputs: [{ name: "orderHash", type: "bytes32" }],
  },
] as const
