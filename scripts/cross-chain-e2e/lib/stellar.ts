/** Compat re-exports — canonical homes are @proofbridge/stellar-deploy + @proofbridge/evm-deploy. */

export {
  stellar,
  deployContract,
  invokeContract,
  getAddress,
  getSecret,
  deploySAC,
  strkeyToHex,
  decodeEd25519Secret,
} from "@proofbridge/stellar-deploy";

export { evmAddressToBytes32 } from "@proofbridge/evm-deploy";
