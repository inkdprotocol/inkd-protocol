// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {InkdRegistry} from "./InkdRegistry.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title InkdRegistryV2 — Extensible upgrade of InkdRegistry
/// @notice Adds metadataUri, forkOf, accessManifest, tagsHash, and on-chain agent identity for versions.
/// @dev UUPS upgrade. All new state is added via mappings at the end of storage — never modifies V1 struct layout.
contract InkdRegistryV2 is InkdRegistry {
    using SafeERC20 for IERC20;

    // ───── V2 Storage (appended AFTER all V1 state — never reorder) ──────────

    /// @notice Arweave hash of extensible project metadata JSON (inkd/project/v1 schema)
    mapping(uint256 => string) public projectMetadataUri;

    /// @notice Fork lineage: 0 = original, N = forked from project N
    mapping(uint256 => uint256) public projectForkOf;

    /// @notice Arweave hash of multi-wallet access control manifest
    mapping(uint256 => string) public projectAccessManifest;

    /// @notice keccak256 of tags JSON array for discovery
    mapping(uint256 => bytes32) public projectTagsHash;

    /// @notice _forks[originalId] = list of fork project IDs
    mapping(uint256 => uint256[]) internal _forks;

    /// @notice Real agent address that triggered a version push (not relayer)
    /// @dev versionAgent[projectId][versionIndex] = agentAddress
    mapping(uint256 => mapping(uint256 => address)) public versionAgent;

    /// @notice Arweave hash of per-version metadata JSON
    mapping(uint256 => mapping(uint256 => string)) public versionMetadataHash;

    // ───── V2 Events ─────────────────────────────────────────────────────────

    event ProjectCreatedV2(
        uint256 indexed projectId,
        address indexed owner,
        string  name,
        uint256 forkOf,
        string  metadataUri
    );

    event VersionPushedV2(
        uint256 indexed projectId,
        string  arweaveHash,
        string  versionTag,
        address indexed agentAddress,
        address relayer
    );

    event MetadataUriUpdated(uint256 indexed projectId, string uri);
    event AccessManifestUpdated(uint256 indexed projectId, string manifestHash);
    event TagsHashUpdated(uint256 indexed projectId, bytes32 hash);
    event ProjectForked(uint256 indexed newProjectId, uint256 indexed originalProjectId, address indexed owner);

    // ───── V2 Errors ─────────────────────────────────────────────────────────

    error OriginalProjectNotFound();

    // ───── V2 Functions ──────────────────────────────────────────────────────

    /// @notice Register a project with full V2 metadata. Backward-compatible: original createProject still works.
    function createProjectV2(
        string calldata name,
        string calldata description,
        string calldata license,
        bool isPublic,
        string calldata readmeHash,
        bool isAgent,
        string calldata agentEndpoint,
        string calldata metadataUri,
        uint256 forkOf,
        string calldata accessManifestHash,
        bytes32 tagsHash
    ) external {
        // Validate fork reference
        if (forkOf != 0 && !projects[forkOf].exists) revert OriginalProjectNotFound();

        // Use V1 createProject logic via internal call — but we need the new ID
        // We replicate the core logic to capture the ID
        if (bytes(name).length == 0) revert EmptyName();
        string memory normalized = _normalizeName(name);
        if (nameTaken[normalized]) revert NameTaken();

        uint256 id = ++projectCount;
        projects[id] = Project({
            id:            id,
            name:          normalized,
            description:   description,
            license:       license,
            readmeHash:    readmeHash,
            owner:         msg.sender,
            isPublic:      isPublic,
            isAgent:       isAgent,
            agentEndpoint: agentEndpoint,
            createdAt:     block.timestamp,
            versionCount:  0,
            exists:        true
        });

        nameTaken[normalized] = true;
        _ownerProjects[msg.sender].push(id);

        // V2 extra state
        if (bytes(metadataUri).length > 0)       projectMetadataUri[id]   = metadataUri;
        if (forkOf != 0)                          projectForkOf[id]        = forkOf;
        if (bytes(accessManifestHash).length > 0) projectAccessManifest[id] = accessManifestHash;
        if (tagsHash != bytes32(0))               projectTagsHash[id]      = tagsHash;

        emit ProjectCreated(id, msg.sender, normalized, license);
        emit ProjectCreatedV2(id, msg.sender, normalized, forkOf, metadataUri);

        if (isAgent) emit AgentRegistered(id, agentEndpoint);

        if (forkOf != 0) {
            _forks[forkOf].push(id);
            emit ProjectForked(id, forkOf, msg.sender);
        }
    }

    /// @notice Push a version with on-chain agent identity. Backward-compatible: original pushVersion still works.
    /// @param agentAddress The actual agent/user who initiated the push (not the relayer/server wallet)
    /// @param versionMetadataArweaveHash Arweave hash of version metadata JSON (optional)
    function pushVersionV2(
        uint256 projectId,
        string calldata arweaveHash,
        string calldata versionTag,
        string calldata changelog,
        address agentAddress,
        string calldata versionMetadataArweaveHash
    ) external {
        Project storage p = projects[projectId];
        if (!p.exists) revert ProjectNotFound();
        if (p.owner != msg.sender && !isCollaborator[projectId][msg.sender]) {
            revert NotOwnerOrCollaborator();
        }

        uint256 fee = treasury.serviceFee();
        if (fee > 0) {
            usdc.safeTransferFrom(msg.sender, address(treasury), fee);
            treasury.receivePayment(fee);
        }

        uint256 versionIndex = p.versionCount;

        _versions[projectId].push(Version({
            projectId:   projectId,
            arweaveHash: arweaveHash,
            versionTag:  versionTag,
            changelog:   changelog,
            pushedBy:    msg.sender,
            pushedAt:    block.timestamp
        }));
        p.versionCount++;

        // V2 extra state
        if (agentAddress != address(0))
            versionAgent[projectId][versionIndex] = agentAddress;
        if (bytes(versionMetadataArweaveHash).length > 0)
            versionMetadataHash[projectId][versionIndex] = versionMetadataArweaveHash;

        emit VersionPushed(projectId, arweaveHash, versionTag, msg.sender);
        emit VersionPushedV2(projectId, arweaveHash, versionTag, agentAddress, msg.sender);
    }

    // ───── V2 Setters ─────────────────────────────────────────────────────────

    function setMetadataUri(uint256 projectId, string calldata uri)
        external
    {
        if (projects[projectId].owner != msg.sender && !isCollaborator[projectId][msg.sender]) revert NotOwnerOrCollaborator();
        projectMetadataUri[projectId] = uri;
        emit MetadataUriUpdated(projectId, uri);
    }

    function setAccessManifest(uint256 projectId, string calldata manifestHash)
        external
    {
        if (projects[projectId].owner != msg.sender && !isCollaborator[projectId][msg.sender]) revert NotOwnerOrCollaborator();
        projectAccessManifest[projectId] = manifestHash;
        emit AccessManifestUpdated(projectId, manifestHash);
    }

    function setTagsHash(uint256 projectId, bytes32 hash)
        external
    {
        if (projects[projectId].owner != msg.sender && !isCollaborator[projectId][msg.sender]) revert NotOwnerOrCollaborator();
        projectTagsHash[projectId] = hash;
        emit TagsHashUpdated(projectId, hash);
    }

    // ───── V2 View Functions ──────────────────────────────────────────────────

    function getProjectV2(uint256 projectId)
        external view
        returns (
            Project memory p,
            string memory metadataUri,
            uint256 forkOf,
            string memory accessManifest,
            bytes32 tagsHash
        )
    {
        if (!projects[projectId].exists) revert ProjectNotFound();
        return (
            projects[projectId],
            projectMetadataUri[projectId],
            projectForkOf[projectId],
            projectAccessManifest[projectId],
            projectTagsHash[projectId]
        );
    }

    function getVersionAgent(uint256 projectId, uint256 versionIndex)
        external view returns (address)
    {
        return versionAgent[projectId][versionIndex];
    }

    function getForks(uint256 originalId)
        external view returns (uint256[] memory)
    {
        return _forks[originalId];
    }
}
