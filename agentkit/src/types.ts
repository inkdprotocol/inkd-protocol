export interface InkdConfig {
  /** inkd API base URL. Default: https://api.inkdprotocol.com */
  apiUrl?: string
  /** Network. Default: mainnet */
  network?: 'mainnet' | 'testnet'
}

export interface InkdProject {
  id:            string
  name:          string
  description:   string
  license:       string
  owner:         string
  isPublic:      boolean
  isAgent:       boolean
  agentEndpoint: string
  createdAt:     string
  versionCount:  string
}

export interface InkdVersion {
  versionIndex: string
  projectId:    string
  versionTag:   string
  arweaveHash:  string
  changelog:    string
  pushedAt:     string
  pushedBy:     string
  agentAddress: string
}
