import { DeployState, MarginlyConfigToken } from './index';
import { EthAddress, RationalNumber } from '@marginly/common';
import { Contract, ContractFactory } from 'ethers';
import { BigNumber } from '@ethersproject/bignumber';
import * as ethers from 'ethers';
import {
  MarginlyAdapterParam,
  MarginlyConfigMarginlyPool,
  MarginlyConfigUniswapPoolGenuine,
  MarginlyConfigUniswapPoolMock,
} from '../deployer/configs';

export interface ITokenRepository {
  materializeToken(token: MarginlyConfigToken): Promise<void>;
  getTokenInfo(tokenId: string): TokenInfo;
}

export interface TokenInfo {
  address: EthAddress;
  decimals: number;
  symbol: string;
}

export interface IMarginlyDeployer {
  deployMarginlyPoolImplementation(): Promise<DeployResult>;
  deployMarginlyFactory(
    marginlyPoolImplementation: EthAddress,
    uniswapFactory: EthAddress,
    swapRouter: EthAddress,
    feeHolder: EthAddress,
    weth9: MarginlyConfigToken,
    tokenRepository: ITokenRepository,
    techPositionOwner: EthAddress
  ): Promise<DeployResult>;
  deployMarginlyPoolAdmin(marginlyFactoryAddress: EthAddress): Promise<DeployResult>;
  deployMarginlyKeeper(aavePoolAddressesProvider: EthAddress): Promise<DeployResult>;
  toUniswapFee(fee: RationalNumber): BigNumber;
  getOrCreateUniswapPoolGenuine(
    uniswapFactory: EthAddress,
    config: MarginlyConfigUniswapPoolGenuine,
    tokenRepository: ITokenRepository
  ): Promise<LimitedDeployResult>;
  getOrCreateMarginlyPool(
    marginlyPoolFactoryContract: Contract,
    config: MarginlyConfigMarginlyPool,
    tokenRepository: ITokenRepository
  ): Promise<LimitedDeployResult>;
  getOrCreateMockAavePool(): Promise<LimitedDeployResult>;
  getOrCreateMockAavePoolAddressesProvider(aavePoolAddress: EthAddress): Promise<LimitedDeployResult>;
  getAavePoolAddressesProvider(address: EthAddress): ethers.Contract;
  deployMintableToken(name: string, symbol: string, decimals: number): Promise<DeployResult>;
  deployMarginlyAdapter(
    tokenRepository: ITokenRepository,
    dexId: BigNumber,
    name: string,
    pools: MarginlyAdapterParam[],
    balancerVault?: EthAddress
  ): Promise<DeployResult>;
  deployMarginlyRouter(adapters: AdapterDeployResult[]): Promise<DeployResult>;
  deployUniswapRouterMock(weth9: MarginlyConfigToken, tokenRepository: ITokenRepository): Promise<DeployResult>;
  deployUniswapPoolMock(
    oracle: EthAddress,
    poolConfig: MarginlyConfigUniswapPoolMock,
    tokenRepository: ITokenRepository
  ): Promise<DeployResult>;
  ensureTokenAmount(
    token: MarginlyConfigToken,
    ethAddress: EthAddress,
    amount: RationalNumber,
    tokenRepository: ITokenRepository
  ): Promise<void>;
}

export interface DeployResult extends DeployState {
  factory: ContractFactory;
  contract: Contract;
}

export interface LimitedDeployResult extends DeployState {
  contract: Contract;
}

export interface AdapterDeployResult extends LimitedDeployResult {
  dexId: ethers.BigNumber;
}
