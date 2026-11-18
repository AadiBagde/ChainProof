export const EvidenceRegistryABI = [
  'function owner() view returns (address)',
  'function custodyManager() view returns (address)',
  'function custodyManagerSet() view returns (bool)',
  'function registerEvidence(string evidenceId, bytes32 fileHash, string cid, string description)',
  'function updateCustodian(string evidenceId, address newCustodian)',
  'function getEvidence(string evidenceId) view returns (tuple(bytes32 fileHash, string cid, string description, address registrant, uint64 registeredAt, address currentCustodian, uint8 status, bool exists))',
  'function getCurrentCustodian(string evidenceId) view returns (address)',
  'function evidenceExists(string evidenceId) view returns (bool)',
  'event EvidenceRegistered(string evidenceId, bytes32 fileHash, string cid, address indexed registrant, address indexed custodian, uint256 timestamp)',
  'event CustodianUpdated(string evidenceId, address indexed previousCustodian, address indexed newCustodian)',
];

export const CustodyManagerABI = [
  'function registry() view returns (address)',
  'function transferCustody(string evidenceId, address newCustodian)',
  'function currentCustodian(string evidenceId) view returns (address)',
  'event CustodyTransferred(string evidenceId, address indexed previousCustodian, address indexed newCustodian, uint256 timestamp, address indexed initiator)',
];
