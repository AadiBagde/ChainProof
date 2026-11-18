// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {EvidenceRegistry} from "../src/EvidenceRegistry.sol";
import {CustodyManager} from "../src/CustodyManager.sol";

contract EvidenceRegistryTest is Test {
    EvidenceRegistry internal registry;
    CustodyManager internal manager;

    address internal owner = address(this);
    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);
    address internal attacker = address(0xBAD);

    bytes32 internal constant SAMPLE_HASH =
        hex"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    string internal constant SAMPLE_ID = "EV-001";
    string internal constant SAMPLE_CID = "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";
    string internal constant SAMPLE_DESC = "synthetic log file";

    event EvidenceRegistered(
        string evidenceId,
        bytes32 fileHash,
        string cid,
        address indexed registrant,
        address indexed custodian,
        uint256 timestamp
    );

    event CustodyManagerSet(address indexed manager);

    function setUp() public {
        registry = new EvidenceRegistry();
        manager = new CustodyManager(address(registry));
        registry.setCustodyManager(address(manager));
    }

    function _registerAs(address who, string memory id) internal {
        vm.prank(who);
        registry.registerEvidence(id, SAMPLE_HASH, SAMPLE_CID, SAMPLE_DESC);
    }

    function test_RegisterEvidenceStoresStateAndEmitsEvent() public {
        vm.warp(1_700_000_000);

        vm.expectEmit(true, true, false, true);
        emit EvidenceRegistered(
            SAMPLE_ID, SAMPLE_HASH, SAMPLE_CID, alice, alice, 1_700_000_000
        );

        vm.prank(alice);
        registry.registerEvidence(SAMPLE_ID, SAMPLE_HASH, SAMPLE_CID, SAMPLE_DESC);

        EvidenceRegistry.Evidence memory record = registry.getEvidence(SAMPLE_ID);
        assertEq(record.fileHash, SAMPLE_HASH);
        assertEq(record.cid, SAMPLE_CID);
        assertEq(record.description, SAMPLE_DESC);
        assertEq(record.registrant, alice);
        assertEq(record.registeredAt, 1_700_000_000);
        assertEq(record.currentCustodian, alice);
        assertEq(uint256(record.status), uint256(EvidenceRegistry.Status.Registered));
        assertTrue(record.exists);
        assertTrue(registry.evidenceExists(SAMPLE_ID));
        assertEq(registry.getCurrentCustodian(SAMPLE_ID), alice);
    }

    function test_RejectDuplicateEvidenceId() public {
        _registerAs(alice, SAMPLE_ID);
        vm.prank(bob);
        vm.expectRevert(EvidenceRegistry.EvidenceAlreadyRegistered.selector);
        registry.registerEvidence(SAMPLE_ID, SAMPLE_HASH, SAMPLE_CID, SAMPLE_DESC);
    }

    function test_RejectEmptyEvidenceId() public {
        vm.prank(alice);
        vm.expectRevert(EvidenceRegistry.EmptyEvidenceId.selector);
        registry.registerEvidence("", SAMPLE_HASH, SAMPLE_CID, SAMPLE_DESC);
    }

    function test_RejectEmptyCid() public {
        vm.prank(alice);
        vm.expectRevert(EvidenceRegistry.EmptyCid.selector);
        registry.registerEvidence(SAMPLE_ID, SAMPLE_HASH, "", SAMPLE_DESC);
    }

    function test_RejectZeroFileHash() public {
        vm.prank(alice);
        vm.expectRevert(EvidenceRegistry.InvalidFileHash.selector);
        registry.registerEvidence(SAMPLE_ID, bytes32(0), SAMPLE_CID, SAMPLE_DESC);
    }

    function test_RejectOverlongIdCidAndDescription() public {
        string memory longId = _repeat("x", 65);
        string memory longCid = _repeat("c", 129);
        string memory longDesc = _repeat("d", 257);

        vm.startPrank(alice);
        vm.expectRevert(EvidenceRegistry.EvidenceIdTooLong.selector);
        registry.registerEvidence(longId, SAMPLE_HASH, SAMPLE_CID, SAMPLE_DESC);

        vm.expectRevert(EvidenceRegistry.CidTooLong.selector);
        registry.registerEvidence(SAMPLE_ID, SAMPLE_HASH, longCid, SAMPLE_DESC);

        vm.expectRevert(EvidenceRegistry.DescriptionTooLong.selector);
        registry.registerEvidence(SAMPLE_ID, SAMPLE_HASH, SAMPLE_CID, longDesc);
        vm.stopPrank();
    }

    function test_AllowEmptyDescriptionAndBoundaryLengths() public {
        string memory id64 = _repeat("i", 64);
        string memory cid128 = _repeat("c", 128);
        string memory desc256 = _repeat("d", 256);

        vm.prank(alice);
        registry.registerEvidence(id64, SAMPLE_HASH, cid128, "");

        EvidenceRegistry.Evidence memory record = registry.getEvidence(id64);
        assertEq(record.description, "");
        assertEq(bytes(record.cid).length, 128);

        vm.prank(bob);
        registry.registerEvidence("EV-002", SAMPLE_HASH, SAMPLE_CID, desc256);
        assertEq(bytes(registry.getEvidence("EV-002").description).length, 256);
    }

    function test_GetEvidenceRevertsForUnknownId() public {
        vm.expectRevert(EvidenceRegistry.EvidenceNotFound.selector);
        registry.getEvidence("missing");
    }

    function test_UnauthorizedCallerCannotUpdateCustodian() public {
        _registerAs(alice, SAMPLE_ID);

        vm.prank(attacker);
        vm.expectRevert(EvidenceRegistry.Unauthorized.selector);
        registry.updateCustodian(SAMPLE_ID, bob);

        assertEq(registry.getCurrentCustodian(SAMPLE_ID), alice);
    }

    function test_UnauthorizedCallerCannotSetCustodyManager() public {
        EvidenceRegistry fresh = new EvidenceRegistry();
        vm.prank(attacker);
        vm.expectRevert(EvidenceRegistry.Unauthorized.selector);
        fresh.setCustodyManager(address(manager));
        assertEq(fresh.custodyManager(), address(0));
        assertFalse(fresh.custodyManagerSet());
    }

    function test_OwnerCannotReplaceCustodyManager() public {
        vm.expectRevert(EvidenceRegistry.CustodyManagerAlreadySet.selector);
        registry.setCustodyManager(address(0x1234));
        assertEq(registry.custodyManager(), address(manager));
    }

    function test_SetCustodyManagerRejectsZeroAndEmits() public {
        EvidenceRegistry fresh = new EvidenceRegistry();
        vm.expectRevert(EvidenceRegistry.ZeroAddress.selector);
        fresh.setCustodyManager(address(0));

        vm.expectEmit(true, false, false, true);
        emit CustodyManagerSet(address(manager));
        fresh.setCustodyManager(address(manager));
        assertTrue(fresh.custodyManagerSet());
        assertEq(fresh.custodyManager(), address(manager));
    }

    function test_OwnerIsDeployer() public view {
        assertEq(registry.owner(), owner);
    }

    function _repeat(string memory ch, uint256 n) internal pure returns (string memory) {
        bytes memory out = new bytes(n);
        bytes memory src = bytes(ch);
        for (uint256 i = 0; i < n; i++) {
            out[i] = src[0];
        }
        return string(out);
    }
}
