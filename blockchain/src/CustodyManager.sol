// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {EvidenceRegistry} from "./EvidenceRegistry.sol";

contract CustodyManager {
    EvidenceRegistry public immutable registry;

    error Unauthorized();
    error ZeroAddress();
    error SameCustodian();

    event CustodyTransferred(
        string evidenceId,
        address indexed previousCustodian,
        address indexed newCustodian,
        uint256 timestamp,
        address indexed initiator
    );

    constructor(address registryAddress) {
        if (registryAddress == address(0)) revert ZeroAddress();
        registry = EvidenceRegistry(registryAddress);
    }

    function transferCustody(string calldata evidenceId, address newCustodian) external {
        if (newCustodian == address(0)) revert ZeroAddress();

        address previousCustodian = registry.getCurrentCustodian(evidenceId);
        if (msg.sender != previousCustodian) revert Unauthorized();
        if (newCustodian == previousCustodian) revert SameCustodian();

        registry.updateCustodian(evidenceId, newCustodian);

        emit CustodyTransferred(
            evidenceId, previousCustodian, newCustodian, block.timestamp, msg.sender
        );
    }

    function currentCustodian(string calldata evidenceId) external view returns (address) {
        return registry.getCurrentCustodian(evidenceId);
    }
}
