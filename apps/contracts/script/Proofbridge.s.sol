// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console2.sol";

import {HonkVerifier, IVerifier} from "src/Verifier.sol";
import {AdManager} from "src/AdManager.sol";
import {OrderPortal} from "src/OrderPortal.sol";
import {IMerkleManager, MerkleManager} from "src/MerkleManager.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";

contract Proofbridge is Script {
    function _envOrAddress(string memory key, address fallback_) internal view returns (address out) {
        try vm.envAddress(key) returns (address v) {
            out = v;
        } catch {
            out = fallback_;
        }
    }

    bytes32 public constant MANAGER_ROLE = keccak256("MANAGER_ROLE");

    function run() external {
        // --- Load deployer ---
        uint256 pk = vm.envUint("PRIVATE_KEY");
        require(pk != 0, "PRIVATE_KEY not set");
        address deployer = vm.addr(pk);

        // --- Choose admin (defaults to deployer, can override via ADMIN env var) ---
        address adminDefault = deployer;
        address admin = _envOrAddress("ADMIN", adminDefault);

        vm.startBroadcast(pk);

        // --- Verifier: reuse or deploy ---
        address verifierMaybe = _envOrAddress("VERIFIER", address(0));
        IVerifier verifier;
        if (verifierMaybe == address(0)) {
            verifier = IVerifier(address(new HonkVerifier()));
            console2.log("Deployed Verifier    :", address(verifier));
        } else {
            verifier = IVerifier(verifierMaybe);
            console2.log("Reusing Verifier     :", address(verifier));
        }

        // --- MerkleManager: reuse or deploy ---
        address merkleManagerMaybe = _envOrAddress("MERKLE_MANAGER", address(0));
        IMerkleManager merkleManager;
        if (merkleManagerMaybe == address(0)) {
            merkleManager = new MerkleManager(admin);
            console2.log("Deployed MerkleManager    :", address(merkleManager));
        } else {
            merkleManager = IMerkleManager(merkleManagerMaybe);
            console2.log("Reusing MerkleManager    :", address(merkleManager));
        }

        // --- Deploy AdManager & OrderPortal ---
        AdManager adManager = new AdManager(admin, verifier, merkleManager);
        console2.log("Deployed AdManager   :", address(adManager));

        OrderPortal orderPortal = new OrderPortal(admin, verifier, merkleManager);
        console2.log("Deployed OrderPortal :", address(orderPortal));

        // --- Assign Manager role to deployed contrats ---
        IAccessControl merkleManagerAsAccessControl = IAccessControl(address(merkleManager));
        merkleManagerAsAccessControl.grantRole(MANAGER_ROLE, address(adManager));
        merkleManagerAsAccessControl.grantRole(MANAGER_ROLE, address(orderPortal));

        vm.stopBroadcast();
    }
}
