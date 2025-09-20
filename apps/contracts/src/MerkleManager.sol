// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {StatelessMmrPoseidon, Field} from "@soliditymmr/lib/StatelessMmrPoseidon.sol";
import {StatelessMmrHelpers} from "@soliditymmr/lib/StatelessMmrHelpers.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IMerkleManager {
    function getRootHash() external view returns (bytes32);
    function appendOrderHash(bytes32 orderHash) external returns (bool);
    function getElementsCount() external view returns (uint256);
    function getOrderIndex(bytes32 orderHash) external view returns (uint256);
    function getLastPeaks() external view returns (bytes32[] memory);
    function verifyProof(
        uint256 index,
        bytes32 value,
        bytes32[] memory proof,
        bytes32[] memory peaks,
        uint256 elementsCount,
        bytes32 root
    ) external pure;
    function fieldMod(bytes32 orderHash) external pure returns (bytes32 orderHashMod);
}

/**
 * @title MerkleManager
 * @dev Manages all order hashes for ProofBridge protocol per chain
 */
contract MerkleManager is IMerkleManager, AccessControl, ReentrancyGuard {
    // Mapping of node index to relative root hash
    mapping(uint256 => bytes32) internal nodeIndexToRoot;

    // Mapping of node index to peaks. Peaks can be calculated and/or stored off-chain
    mapping(uint256 => bytes32[]) internal nodeIndexToPeaks;

    // Mapping of order hash to its index in the tree
    mapping(bytes32 => uint256) internal orderHashToIndex;

    // Peaks of the last tree can be calculated and/or stored off-chain
    bytes32[] internal lastPeaks;

    // Latest elements count
    uint256 internal lastElementsCount;

    // Latest root hash
    bytes32 internal lastRoot;

    // Number of leaves in the tree
    uint256 internal leavesCount;

    /// @notice Roles
    bytes32 public constant ADMIN_ROLE = DEFAULT_ADMIN_ROLE;
    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    // Errors
    error MerkleManager__ZeroAddress();

    // Emitted event after each successful `append` operation
    // Index of the appended deposit
    // The deposit order hash
    // The new root hash after append
    // The new number of elements in the tree
    event DepositHashAppended(uint256 index, bytes32 orderHash, bytes32 rootHash, uint256 elementsCount);

    // Role definition for admin
    constructor(address admin) {
        if (admin == address(0)) {
            revert MerkleManager__ZeroAddress();
        }
        _grantRole(ADMIN_ROLE, admin);
        _setRoleAdmin(MANAGER_ROLE, ADMIN_ROLE);
    }

    /**
     * @dev Appends a new deposit order to the tree.
     * Updates peaks, root, and mappings. Emits DepositHashAppended.
     * @param orderHash The hash of the order to append.
     */
    function appendOrderHash(bytes32 orderHash) external nonReentrant onlyRole(MANAGER_ROLE) returns (bool) {
        bytes32 orderHashMod = fieldMod(orderHash);
        // Append element to the tree and retrieve updated peaks and root
        (uint256 nextElementsCount, bytes32 nextRootHash, bytes32[] memory nextPeaks) =
            StatelessMmrPoseidon.appendWithPeaksRetrieval(orderHashMod, lastPeaks, lastElementsCount, lastRoot);

        // Update contract state with new peaks, root, and element count
        lastPeaks = nextPeaks;
        lastElementsCount = nextElementsCount;
        lastRoot = nextRootHash;
        nodeIndexToRoot[nextElementsCount] = lastRoot;
        nodeIndexToPeaks[nextElementsCount] = lastPeaks;

        // Map order hash to its correct MMR leaf index
        uint256 mmrLeafIndex = leafCountToMmrIndex(leavesCount);
        orderHashToIndex[orderHash] = mmrLeafIndex;
        leavesCount += 1;

        emit DepositHashAppended(mmrLeafIndex, orderHash, lastRoot, lastElementsCount);
        return true;
    }

    /**
     * @dev Returns the root hash of the tree.
     * @return The latest root hash.
     */
    function getRootHash() external view returns (bytes32) {
        return lastRoot;
    }

    /**
     * @dev Returns the number of nodes in the tree.
     * @return The latest elements count.
     */
    function getElementsCount() external view returns (uint256) {
        return lastElementsCount;
    }

    /**
     * @dev Returns the number of nodes in the tree.
     * @param orderHash order hash to check for.
     * @return The index of the order hash in the tree.
     */
    function getOrderIndex(bytes32 orderHash) external view returns (uint256) {
        // Return the index of the order hash in the tree
        return orderHashToIndex[orderHash];
    }

    /**
     * @dev Returns the peaks of the last tree.
     * @return Array of peak hashes.
     */
    function getLastPeaks() external view returns (bytes32[] memory) {
        return lastPeaks;
    }

    /**
     * @dev Verifies a Merkle proof for a deposit.
     * @param index The index of the leaf in the tree.
     * @param value The value of the leaf.
     * @param proof The Merkle proof array.
     * @param peaks The peaks of the tree.
     * @param elementsCount The total number of elements in the tree.
     * @param root The expected root hash.
     */
    function verifyProof(
        uint256 index,
        bytes32 value,
        bytes32[] memory proof,
        bytes32[] memory peaks,
        uint256 elementsCount,
        bytes32 root
    ) external pure {
        // Verify the proof using StatelessMmr
        StatelessMmrPoseidon.verifyProof(index, value, proof, peaks, elementsCount, root);
    }

    function fieldMod(bytes32 orderHash) public pure returns (bytes32 orderHashMod) {
        orderHashMod = bytes32(uint256(orderHash) % Field.PRIME);
    }

    /**
     * @dev Converts a leaf count (0-based) to the actual MMR leaf index
     * @param leafCount The sequential leaf number (0, 1, 2, 3...)
     * @return The actual MMR index where this leaf is positioned
     */
    function leafCountToMmrIndex(uint256 leafCount) internal pure returns (uint256) {
        if (leafCount == 0) return 0;

        // Calculate the number of internal nodes before this leaf
        uint256 internalNodes = 0;
        uint256 temp = leafCount;

        while (temp > 0) {
            temp >>= 1;
            internalNodes += temp;
        }

        return leafCount + internalNodes + 1;
    }
}
