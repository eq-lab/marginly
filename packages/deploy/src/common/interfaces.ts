import { DeployState, MarginlyConfigToken } from './index';
import { EthAddress } from '@marginly/common';
import { Contract, ContractFactory } from 'ethers';

export interface ITokenRepository {
  materializeToken(token: MarginlyConfigToken): Promise<void>;
  getTokenInfo(tokenId: string): TokenInfo;
}

export interface TokenInfo {
  address: EthAddress;
  decimals: number;
  symbol: string;
}

export interface ITokenDeployer {
  deployMintableToken(name: string, symbol: string, decimals: number): Promise<DeployResult>;
}

export interface DeployResult extends DeployState {
  factory: ContractFactory;
  contract: Contract;
}

export interface LimitedDeployResult extends DeployState {
  contract: Contract;
}
