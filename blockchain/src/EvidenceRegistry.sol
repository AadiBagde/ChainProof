// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract EvidenceRegistry {
    enum Status {
        Registered
    }

    uint256 public constant MAX_ID_LENGTH = 64;
    uint256 public constant MAX_CID_LENGTH = 128;
    uint256 public constant MAX_DESCRIPTION_LENGTH = 256;

    struct Evidence {
        bytes32 fileHash;
        string cid;
        string description;
        address registrant;
        uint64 registeredAt;
        address currentCustodian;
        Status status;
        bool exists;
    }

    address public immutable owner;
    address public custodyManager;
    bool public custodyManagerSet;

    mapping(string => Evidence) private evidences;

    error Unauthorized();
    error ZeroAddress();
    error EmptyEvidenceId();
    error EmptyCid();
    error InvalidFileHash();
    error EvidenceIdTooLong();
    error CidTooLong();
    error DescriptionTooLong();
    error EvidenceAlreadyRegistered();
    error EvidenceNotFound();
    error CustodyManagerAlreadySet();
    error SameCustodian();

    event EvidenceRegistered(
        string evidenceId,
        bytes32 fileHash,
        string cid,
        address indexed registrant,
        address indexed custodian,
        uint256 timestamp
    );

    event CustodianUpdated(
        string evidenceId,
        address indexed previousCustodian,
        address indexed newCustodian
    );

    event CustodyManagerSet(address indexed manager);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier onlyCustodyManager() {
        if (msg.sender != custodyManager) revert Unauthorized();
        _;
    }

    function setCustodyManager(address manager) external onlyOwner {
        if (custodyManagerSet) revert CustodyManagerAlreadySet();
        if (manager == address(0)) revert ZeroAddress();
        custodyManager = manager;
        custodyManagerSet = true;
        emit CustodyManagerSet(manager);
    }

    function registerEvidence(
        string calldata evidenceId,
        bytes32 fileHash,
        string calldata cid,
        string calldata description
    ) external {
        uint256 idLen = bytes(evidenceId).length;
        if (idLen == 0) revert EmptyEvidenceId();
        if (idLen > MAX_ID_LENGTH) revert EvidenceIdTooLong();
        if (bytes(cid).length == 0) revert EmptyCid();
        if (bytes(cid).length > MAX_CID_LENGTH) revert CidTooLong();
        if (bytes(description).length > MAX_DESCRIPTION_LENGTH) revert DescriptionTooLong();
        if (fileHash == bytes32(0)) revert InvalidFileHash();
        if (evidences[evidenceId].exists) revert EvidenceAlreadyRegistered();

        evidences[evidenceId] = Evidence({
            fileHash: fileHash,
            cid: cid,
            description: description,
            registrant: msg.sender,
            registeredAt: uint64(block.timestamp),
            currentCustodian: msg.sender,
            status: Status.Registered,
            exists: true
        });

        emit EvidenceRegistered(
            evidenceId, fileHash, cid, msg.sender, msg.sender, block.timestamp
        );
    }

    function updateCustodian(string calldata evidenceId, address newCustodian)
        external
        onlyCustodyManager
    {
        Evidence storage record = evidences[evidenceId];
        if (!record.exists) revert EvidenceNotFound();
        if (newCustodian == address(0)) revert ZeroAddress();
        if (newCustodian == record.currentCustodian) revert SameCustodian();

        address previous = record.currentCustodian;
        record.currentCustodian = newCustodian;
        emit CustodianUpdated(evidenceId, previous, newCustodian);
    }

    function getEvidence(string calldata evidenceId) external view returns (Evidence memory) {
        Evidence memory record = evidences[evidenceId];
        if (!record.exists) revert EvidenceNotFound();
        return record;
    }

    function getCurrentCustodian(string calldata evidenceId) external view returns (address) {
        Evidence storage record = evidences[evidenceId];
        if (!record.exists) revert EvidenceNotFound();
        return record.currentCustodian;
    }

    function evidenceExists(string calldata evidenceId) external view returns (bool) {
        return evidences[evidenceId].exists;
    }
}
