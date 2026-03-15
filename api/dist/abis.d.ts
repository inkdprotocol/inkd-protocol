/**
 * Inkd Protocol — minimal ABIs for the API server
 * Only the functions/events needed to serve API requests.
 * Reflects InkdRegistryV2 (UUPS upgraded proxy on Base Mainnet).
 */
export declare const REGISTRY_ABI: readonly [{
    readonly name: "projectCount";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "getProject";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly name: "projectId";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "tuple";
        readonly components: readonly [{
            readonly name: "id";
            readonly type: "uint256";
        }, {
            readonly name: "name";
            readonly type: "string";
        }, {
            readonly name: "description";
            readonly type: "string";
        }, {
            readonly name: "license";
            readonly type: "string";
        }, {
            readonly name: "readmeHash";
            readonly type: "string";
        }, {
            readonly name: "owner";
            readonly type: "address";
        }, {
            readonly name: "isPublic";
            readonly type: "bool";
        }, {
            readonly name: "isAgent";
            readonly type: "bool";
        }, {
            readonly name: "agentEndpoint";
            readonly type: "string";
        }, {
            readonly name: "createdAt";
            readonly type: "uint256";
        }, {
            readonly name: "versionCount";
            readonly type: "uint256";
        }, {
            readonly name: "exists";
            readonly type: "bool";
        }];
    }];
}, {
    readonly name: "projectMetadataUri";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly name: "projectId";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [{
        readonly type: "string";
    }];
}, {
    readonly name: "projectForkOf";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly name: "projectId";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "projectAccessManifest";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly name: "projectId";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [{
        readonly type: "string";
    }];
}, {
    readonly name: "projectTagsHash";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly name: "projectId";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [{
        readonly type: "bytes32";
    }];
}, {
    readonly name: "getVersionCount";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly name: "projectId";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "getVersion";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly name: "projectId";
        readonly type: "uint256";
    }, {
        readonly name: "versionIndex";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "tuple";
        readonly components: readonly [{
            readonly name: "projectId";
            readonly type: "uint256";
        }, {
            readonly name: "arweaveHash";
            readonly type: "string";
        }, {
            readonly name: "versionTag";
            readonly type: "string";
        }, {
            readonly name: "changelog";
            readonly type: "string";
        }, {
            readonly name: "pushedBy";
            readonly type: "address";
        }, {
            readonly name: "pushedAt";
            readonly type: "uint256";
        }];
    }];
}, {
    readonly name: "getVersionAgent";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly name: "projectId";
        readonly type: "uint256";
    }, {
        readonly name: "versionIndex";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [{
        readonly type: "address";
    }];
}, {
    readonly name: "versionMetaHash";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly name: "projectId";
        readonly type: "uint256";
    }, {
        readonly name: "versionIndex";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [{
        readonly type: "string";
    }];
}, {
    readonly name: "getAgentProjects";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly name: "offset";
        readonly type: "uint256";
    }, {
        readonly name: "limit";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "tuple[]";
        readonly components: readonly [{
            readonly name: "id";
            readonly type: "uint256";
        }, {
            readonly name: "name";
            readonly type: "string";
        }, {
            readonly name: "description";
            readonly type: "string";
        }, {
            readonly name: "license";
            readonly type: "string";
        }, {
            readonly name: "readmeHash";
            readonly type: "string";
        }, {
            readonly name: "owner";
            readonly type: "address";
        }, {
            readonly name: "isPublic";
            readonly type: "bool";
        }, {
            readonly name: "isAgent";
            readonly type: "bool";
        }, {
            readonly name: "agentEndpoint";
            readonly type: "string";
        }, {
            readonly name: "createdAt";
            readonly type: "uint256";
        }, {
            readonly name: "versionCount";
            readonly type: "uint256";
        }, {
            readonly name: "exists";
            readonly type: "bool";
        }];
    }];
}, {
    readonly name: "agentProjectCount";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
    }];
}, {
    readonly name: "createProject";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly name: "name";
        readonly type: "string";
    }, {
        readonly name: "description";
        readonly type: "string";
    }, {
        readonly name: "license";
        readonly type: "string";
    }, {
        readonly name: "isPublic";
        readonly type: "bool";
    }, {
        readonly name: "readmeHash";
        readonly type: "string";
    }, {
        readonly name: "isAgent";
        readonly type: "bool";
    }, {
        readonly name: "agentEndpoint";
        readonly type: "string";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "pushVersion";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly name: "projectId";
        readonly type: "uint256";
    }, {
        readonly name: "arweaveHash";
        readonly type: "string";
    }, {
        readonly name: "versionTag";
        readonly type: "string";
    }, {
        readonly name: "changelog";
        readonly type: "string";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "createProjectV2";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly name: "owner";
        readonly type: "address";
    }, {
        readonly name: "name";
        readonly type: "string";
    }, {
        readonly name: "description";
        readonly type: "string";
    }, {
        readonly name: "license";
        readonly type: "string";
    }, {
        readonly name: "isPublic";
        readonly type: "bool";
    }, {
        readonly name: "readmeHash";
        readonly type: "string";
    }, {
        readonly name: "isAgent";
        readonly type: "bool";
    }, {
        readonly name: "agentEndpoint";
        readonly type: "string";
    }, {
        readonly name: "metadataUri";
        readonly type: "string";
    }, {
        readonly name: "forkOf";
        readonly type: "uint256";
    }, {
        readonly name: "accessManifestHash";
        readonly type: "string";
    }, {
        readonly name: "tagsHash";
        readonly type: "bytes32";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "pushVersionV2";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly name: "projectId";
        readonly type: "uint256";
    }, {
        readonly name: "arweaveHash";
        readonly type: "string";
    }, {
        readonly name: "versionTag";
        readonly type: "string";
    }, {
        readonly name: "changelog";
        readonly type: "string";
    }, {
        readonly name: "agentAddress";
        readonly type: "address";
    }, {
        readonly name: "versionMetadataArweaveHash";
        readonly type: "string";
    }];
    readonly outputs: readonly [];
}, {
    readonly type: "event";
    readonly name: "ProjectCreated";
    readonly inputs: readonly [{
        readonly name: "projectId";
        readonly type: "uint256";
        readonly indexed: true;
    }, {
        readonly name: "owner";
        readonly type: "address";
        readonly indexed: true;
    }, {
        readonly name: "name";
        readonly type: "string";
        readonly indexed: false;
    }, {
        readonly name: "license";
        readonly type: "string";
        readonly indexed: false;
    }];
}, {
    readonly type: "event";
    readonly name: "ProjectCreatedV2";
    readonly inputs: readonly [{
        readonly name: "projectId";
        readonly type: "uint256";
        readonly indexed: true;
    }, {
        readonly name: "owner";
        readonly type: "address";
        readonly indexed: true;
    }, {
        readonly name: "name";
        readonly type: "string";
        readonly indexed: false;
    }, {
        readonly name: "forkOf";
        readonly type: "uint256";
        readonly indexed: false;
    }, {
        readonly name: "metadataUri";
        readonly type: "string";
        readonly indexed: false;
    }];
}, {
    readonly type: "event";
    readonly name: "VersionPushed";
    readonly inputs: readonly [{
        readonly name: "projectId";
        readonly type: "uint256";
        readonly indexed: true;
    }, {
        readonly name: "arweaveHash";
        readonly type: "string";
        readonly indexed: false;
    }, {
        readonly name: "versionTag";
        readonly type: "string";
        readonly indexed: false;
    }, {
        readonly name: "pushedBy";
        readonly type: "address";
        readonly indexed: false;
    }];
}, {
    readonly type: "event";
    readonly name: "VersionPushedV2";
    readonly inputs: readonly [{
        readonly name: "projectId";
        readonly type: "uint256";
        readonly indexed: true;
    }, {
        readonly name: "versionIndex";
        readonly type: "uint256";
        readonly indexed: true;
    }, {
        readonly name: "arweaveHash";
        readonly type: "string";
        readonly indexed: false;
    }, {
        readonly name: "versionTag";
        readonly type: "string";
        readonly indexed: false;
    }, {
        readonly name: "agentAddress";
        readonly type: "address";
        readonly indexed: true;
    }];
}];
export declare const TOKEN_ABI: readonly [{
    readonly name: "totalSupply";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "balanceOf";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly name: "account";
        readonly type: "address";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "approve";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly name: "spender";
        readonly type: "address";
    }, {
        readonly name: "amount";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [{
        readonly type: "bool";
    }];
}];
export declare const TREASURY_ABI: readonly [{
    readonly name: "settle";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly name: "total";
        readonly type: "uint256";
    }, {
        readonly name: "arweaveCost";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "calculateTotal";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly name: "arweaveCost";
        readonly type: "uint256";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "markupBps";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}, {
    readonly name: "feeSplit";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "toArweave";
        readonly type: "uint256";
    }, {
        readonly name: "toBuyback";
        readonly type: "uint256";
    }, {
        readonly name: "toTreasury";
        readonly type: "uint256";
    }];
}, {
    readonly name: "serviceFee";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}];
export declare const USDC_ABI: readonly [{
    readonly name: "transferWithAuthorization";
    readonly type: "function";
    readonly stateMutability: "nonpayable";
    readonly inputs: readonly [{
        readonly name: "from";
        readonly type: "address";
    }, {
        readonly name: "to";
        readonly type: "address";
    }, {
        readonly name: "value";
        readonly type: "uint256";
    }, {
        readonly name: "validAfter";
        readonly type: "uint256";
    }, {
        readonly name: "validBefore";
        readonly type: "uint256";
    }, {
        readonly name: "nonce";
        readonly type: "bytes32";
    }, {
        readonly name: "v";
        readonly type: "uint8";
    }, {
        readonly name: "r";
        readonly type: "bytes32";
    }, {
        readonly name: "s";
        readonly type: "bytes32";
    }];
    readonly outputs: readonly [];
}, {
    readonly name: "balanceOf";
    readonly type: "function";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly name: "account";
        readonly type: "address";
    }];
    readonly outputs: readonly [{
        readonly type: "uint256";
    }];
}];
//# sourceMappingURL=abis.d.ts.map