// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {EvidenceRegistry} from "../src/EvidenceRegistry.sol";
import {CustodyManager} from "../src/CustodyManager.sol";

contract CustodyManagerTest is Test {
    EvidenceRegistry internal registry;
    CustodyManager internal manager;

    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);
    address internal carol = address(0xCA201);
    address internal attacker = address(0xBAD);

    bytes32 internal constant SAMPLE_HASH =
        hex"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
    string internal constant SAMPLE_ID = "EV-100";
    string internal constant SAMPLE_CID = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";
    string internal constant SAMPLE_DESC = "synthetic image";

    event CustodyTransferred(
        string evidenceId,
        address indexed previousCustodian,
        address indexed newCustodian,
        uint256 timestamp,
        address indexed initiator
    );

    event CustodianUpdated(
        string evidenceId,
        address indexed previousCustodian,
        address indexed newCustodian
    );

    function setUp() public {
        registry = new EvidenceRegistry();
        manager = new CustodyManager(address(registry));
        registry.setCustodyManager(address(manager));

        vm.prank(alice);
        registry.registerEvidence(SAMPLE_ID, SAMPLE_HASH, SAMPLE_CID, SAMPLE_DESC);
    }

    function test_ConstructorRejectsZeroRegistry() public {
        vm.expectRevert(CustodyManager.ZeroAddress.selector);
        new CustodyManager(address(0));
    }

    function test_CurrentCustodianReadsFromRegistry() public view {
        assertEq(manager.currentCustodian(SAMPLE_ID), alice);
        assertEq(address(manager.registry()), address(registry));
    }

    function test_CurrentCustodianTransfersAndEmitsAfterRegistryUpdate() public {
        vm.warp(1_800_000_000);

        vm.expectEmit(true, true, false, true, address(registry));
        emit CustodianUpdated(SAMPLE_ID, alice, bob);

        vm.expectEmit(true, true, true, true, address(manager));
        emit CustodyTransferred(SAMPLE_ID, alice, bob, 1_800_000_000, alice);

        vm.prank(alice);
        manager.transferCustody(SAMPLE_ID, bob);

        assertEq(registry.getCurrentCustodian(SAMPLE_ID), bob);
        assertEq(manager.currentCustodian(SAMPLE_ID), bob);
        assertEq(registry.getEvidence(SAMPLE_ID).registrant, alice);
    }

    function test_UnauthorizedTransferRevertsAndDoesNotChangeCustodian() public {
        vm.prank(attacker);
        vm.expectRevert(CustodyManager.Unauthorized.selector);
        manager.transferCustody(SAMPLE_ID, bob);

        assertEq(registry.getCurrentCustodian(SAMPLE_ID), alice);
    }

    function test_ZeroRecipientRevertsAndDoesNotChangeCustodian() public {
        vm.prank(alice);
        vm.expectRevert(CustodyManager.ZeroAddress.selector);
        manager.transferCustody(SAMPLE_ID, address(0));

        assertEq(registry.getCurrentCustodian(SAMPLE_ID), alice);
    }

    function test_SameCustodianRevertsAndDoesNotChangeCustodian() public {
        vm.prank(alice);
        vm.expectRevert(CustodyManager.SameCustodian.selector);
        manager.transferCustody(SAMPLE_ID, alice);

        assertEq(registry.getCurrentCustodian(SAMPLE_ID), alice);
    }

    function test_UnknownEvidenceReverts() public {
        vm.prank(alice);
        vm.expectRevert(EvidenceRegistry.EvidenceNotFound.selector);
        manager.transferCustody("unknown-id", bob);
    }

    function test_FormerCustodianCannotTransferAfterSuccess() public {
        vm.prank(alice);
        manager.transferCustody(SAMPLE_ID, bob);

        vm.prank(alice);
        vm.expectRevert(CustodyManager.Unauthorized.selector);
        manager.transferCustody(SAMPLE_ID, carol);

        assertEq(registry.getCurrentCustodian(SAMPLE_ID), bob);

        vm.prank(bob);
        manager.transferCustody(SAMPLE_ID, carol);
        assertEq(registry.getCurrentCustodian(SAMPLE_ID), carol);
    }

    function test_UnwiredRegistryRejectsManagerUpdates() public {
        EvidenceRegistry unwired = new EvidenceRegistry();
        CustodyManager other = new CustodyManager(address(unwired));

        vm.prank(alice);
        unwired.registerEvidence(SAMPLE_ID, SAMPLE_HASH, SAMPLE_CID, SAMPLE_DESC);

        vm.prank(alice);
        vm.expectRevert(EvidenceRegistry.Unauthorized.selector);
        other.transferCustody(SAMPLE_ID, bob);

        assertEq(unwired.getCurrentCustodian(SAMPLE_ID), alice);
    }
}
