export const ORDER_PORTAL_ABI = [
  {
    type: 'constructor',
    inputs: [
      {
        name: 'admin',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '_verifier',
        type: 'address',
        internalType: 'contract IVerifier',
      },
      {
        name: '_merkleManager',
        type: 'address',
        internalType: 'contract IMerkleManager',
      },
      {
        name: '_wNativeToken',
        type: 'address',
        internalType: 'contract IwNativeToken',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'fallback',
    stateMutability: 'payable',
  },
  {
    type: 'receive',
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'ADMIN_ROLE',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'DEFAULT_ADMIN_ROLE',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'DOMAIN_TYPEHASH_MIN',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'NATIVE_TOKEN_ADDRESS',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'ORDER_TYPEHASH',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'chains',
    inputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'supported',
        type: 'bool',
        internalType: 'bool',
      },
      {
        name: 'adManager',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'checkRequestHashExists',
    inputs: [
      {
        name: 'message',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'createOrder',
    inputs: [
      {
        name: 'signature',
        type: 'bytes',
        internalType: 'bytes',
      },
      {
        name: 'authToken',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'timeToExpire',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'params',
        type: 'tuple',
        internalType: 'struct OrderPortal.OrderParams',
        components: [
          {
            name: 'orderChainToken',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'adChainToken',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'amount',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'bridger',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'orderRecipient',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'adChainId',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'adManager',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'adId',
            type: 'string',
            internalType: 'string',
          },
          {
            name: 'adCreator',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'adRecipient',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'salt',
            type: 'uint256',
            internalType: 'uint256',
          },
        ],
      },
    ],
    outputs: [
      {
        name: 'orderHash',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'createOrderRequestHash',
    inputs: [
      {
        name: 'adId',
        type: 'string',
        internalType: 'string',
      },
      {
        name: 'orderHash',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'authToken',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'timeToExpire',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'message',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'eip712Domain',
    inputs: [],
    outputs: [
      {
        name: 'fields',
        type: 'bytes1',
        internalType: 'bytes1',
      },
      {
        name: 'name',
        type: 'string',
        internalType: 'string',
      },
      {
        name: 'version',
        type: 'string',
        internalType: 'string',
      },
      {
        name: 'chainId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'verifyingContract',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'salt',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'extensions',
        type: 'uint256[]',
        internalType: 'uint256[]',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getChainID',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getDestToken',
    inputs: [
      {
        name: 'orderToken',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'adChainId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'adChainToken',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getHistoricalRoot',
    inputs: [
      {
        name: 'index',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'root',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getLatestMerkleRoot',
    inputs: [],
    outputs: [
      {
        name: 'root',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getMerkleLeafCount',
    inputs: [],
    outputs: [
      {
        name: 'count',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getRoleAdmin',
    inputs: [
      {
        name: 'role',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getSigner',
    inputs: [
      {
        name: 'message',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'signature',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'grantRole',
    inputs: [
      {
        name: 'role',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'account',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'hasRole',
    inputs: [
      {
        name: 'role',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'account',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'hashRequest',
    inputs: [
      {
        name: 'authToken',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'timeToExpire',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: '_action',
        type: 'string',
        internalType: 'string',
      },
      {
        name: '_params',
        type: 'bytes[]',
        internalType: 'bytes[]',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'i_merkleManager',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IMerkleManager',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'i_verifier',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IVerifier',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'managers',
    inputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'nullifierUsed',
    inputs: [
      {
        name: '',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'orders',
    inputs: [
      {
        name: '',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint8',
        internalType: 'enum OrderPortal.Status',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'removeChain',
    inputs: [
      {
        name: 'adChainId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'removeTokenRoute',
    inputs: [
      {
        name: 'orderToken',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'adChainId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'renounceRole',
    inputs: [
      {
        name: 'role',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'callerConfirmation',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'requestHashes',
    inputs: [
      {
        name: '',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'requestTokens',
    inputs: [
      {
        name: '',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'revokeRole',
    inputs: [
      {
        name: 'role',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'account',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setChain',
    inputs: [
      {
        name: 'adChainId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'adManager',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'supported',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setManager',
    inputs: [
      {
        name: '_manager',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '_status',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setTokenRoute',
    inputs: [
      {
        name: 'orderToken',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'adChainId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'adToken',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'supportsInterface',
    inputs: [
      {
        name: 'interfaceId',
        type: 'bytes4',
        internalType: 'bytes4',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'tokenRoute',
    inputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'unlock',
    inputs: [
      {
        name: 'signature',
        type: 'bytes',
        internalType: 'bytes',
      },
      {
        name: 'authToken',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'timeToExpire',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'params',
        type: 'tuple',
        internalType: 'struct OrderPortal.OrderParams',
        components: [
          {
            name: 'orderChainToken',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'adChainToken',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'amount',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'bridger',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'orderRecipient',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'adChainId',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'adManager',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'adId',
            type: 'string',
            internalType: 'string',
          },
          {
            name: 'adCreator',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'adRecipient',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'salt',
            type: 'uint256',
            internalType: 'uint256',
          },
        ],
      },
      {
        name: 'nullifierHash',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'targetRoot',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'proof',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    outputs: [],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'unlockOrderRequestHash',
    inputs: [
      {
        name: 'adId',
        type: 'string',
        internalType: 'string',
      },
      {
        name: 'orderHash',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: '_targetRoot',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'authToken',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'timeToExpire',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'message',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'wNativeToken',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IwNativeToken',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'ChainSet',
    inputs: [
      {
        name: 'chainId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
      {
        name: 'adManager',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'supported',
        type: 'bool',
        indexed: false,
        internalType: 'bool',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'EIP712DomainChanged',
    inputs: [],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'OrderCreated',
    inputs: [
      {
        name: 'orderHash',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'bridger',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'orderChainToken',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'amount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'adChainId',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'adChainToken',
        type: 'bytes32',
        indexed: false,
        internalType: 'bytes32',
      },
      {
        name: 'adManager',
        type: 'bytes32',
        indexed: false,
        internalType: 'bytes32',
      },
      {
        name: 'adId',
        type: 'string',
        indexed: false,
        internalType: 'string',
      },
      {
        name: 'adCreator',
        type: 'bytes32',
        indexed: false,
        internalType: 'bytes32',
      },
      {
        name: 'adRecipient',
        type: 'bytes32',
        indexed: false,
        internalType: 'bytes32',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'OrderUnlocked',
    inputs: [
      {
        name: 'orderHash',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'recipient',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'nullifierHash',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'RoleAdminChanged',
    inputs: [
      {
        name: 'role',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'previousAdminRole',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'newAdminRole',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'RoleGranted',
    inputs: [
      {
        name: 'role',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'account',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'sender',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'RoleRevoked',
    inputs: [
      {
        name: 'role',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'account',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'sender',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'TokenRouteRemoved',
    inputs: [
      {
        name: 'orderChainToken',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'adChainId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'TokenRouteSet',
    inputs: [
      {
        name: 'orderChainToken',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'adChainId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
      {
        name: 'adChainToken',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'UpdateManager',
    inputs: [
      {
        name: 'manager',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'status',
        type: 'bool',
        indexed: false,
        internalType: 'bool',
      },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'AccessControlBadConfirmation',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AccessControlUnauthorizedAccount',
    inputs: [
      {
        name: 'account',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'neededRole',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
  },
  {
    type: 'error',
    name: 'ECDSAInvalidSignature',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ECDSAInvalidSignatureLength',
    inputs: [
      {
        name: 'length',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'ECDSAInvalidSignatureS',
    inputs: [
      {
        name: 's',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
  },
  {
    type: 'error',
    name: 'InvalidShortString',
    inputs: [],
  },
  {
    type: 'error',
    name: 'OrderPortal__AdChainNotSupported',
    inputs: [
      {
        name: 'adChainId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'OrderPortal__AdManagerMismatch',
    inputs: [
      {
        name: 'expected',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
  },
  {
    type: 'error',
    name: 'OrderPortal__AdTokenMismatch',
    inputs: [],
  },
  {
    type: 'error',
    name: 'OrderPortal__BridgerMustBeSender',
    inputs: [],
  },
  {
    type: 'error',
    name: 'OrderPortal__InsufficientLiquidity',
    inputs: [],
  },
  {
    type: 'error',
    name: 'OrderPortal__InvalidAdRecipient',
    inputs: [],
  },
  {
    type: 'error',
    name: 'OrderPortal__InvalidMessage',
    inputs: [],
  },
  {
    type: 'error',
    name: 'OrderPortal__InvalidProof',
    inputs: [],
  },
  {
    type: 'error',
    name: 'OrderPortal__InvalidSigner',
    inputs: [],
  },
  {
    type: 'error',
    name: 'OrderPortal__MerkleManagerAppendFailed',
    inputs: [],
  },
  {
    type: 'error',
    name: 'OrderPortal__MissingRoute',
    inputs: [],
  },
  {
    type: 'error',
    name: 'OrderPortal__NotEvmAddress',
    inputs: [
      {
        name: 'value',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
  },
  {
    type: 'error',
    name: 'OrderPortal__NullifierUsed',
    inputs: [
      {
        name: 'nullifierHash',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
  },
  {
    type: 'error',
    name: 'OrderPortal__OrderExists',
    inputs: [
      {
        name: 'orderHash',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
  },
  {
    type: 'error',
    name: 'OrderPortal__OrderNotOpen',
    inputs: [
      {
        name: 'orderHash',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
  },
  {
    type: 'error',
    name: 'OrderPortal__RequestHashedProcessed',
    inputs: [],
  },
  {
    type: 'error',
    name: 'OrderPortal__RequestTokenExpired',
    inputs: [],
  },
  {
    type: 'error',
    name: 'OrderPortal__RoutesZeroAddress',
    inputs: [
      {
        name: 'orderToken',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'adToken',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
  },
  {
    type: 'error',
    name: 'OrderPortal__TokenAlreadyUsed',
    inputs: [],
  },
  {
    type: 'error',
    name: 'OrderPortal__ZeroAddress',
    inputs: [],
  },
  {
    type: 'error',
    name: 'OrderPortal__ZeroAmount',
    inputs: [],
  },
  {
    type: 'error',
    name: 'OrderPortal__ZeroSigner',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ReentrancyGuardReentrantCall',
    inputs: [],
  },
  {
    type: 'error',
    name: 'SafeERC20FailedOperation',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'StringTooLong',
    inputs: [
      {
        name: 'str',
        type: 'string',
        internalType: 'string',
      },
    ],
  },
] as const;
