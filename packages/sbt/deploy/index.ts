import * as ethers from 'ethers';
import { DeployState, Logger, StateStore } from '@marginly/deploy';
import { Contract, ContractFactory, Signer } from 'ethers';
import { ContractDescription, waitForTx } from '@marginly/common';
import fs from 'fs';
import path from 'path';

const contractsDir = '../../../../artifacts/contracts/SBT.sol';
const contractName = 'SBT';
const contractDeploymentId = contractName + 'Implementation';

export interface SbtDeployConfig {
  ethConnection: EthConnectionConfig;
  tokens: TokenInfo[];
  owner?: ContractOwnerInfo;
  balances: Balance[];
}

export interface SbtDeployment {
  sbt: { address: string; tokens: TokenInfo[]; owner: string };
}

interface TokenInfo {
  id: number;
  uri: string;
  tokenBalanceLimit: number;
}

export interface EthOptions {
  gasLimit?: number;
  gasPrice?: number;
}

export interface EthConnectionConfig {
  ethOptions: EthOptions;
  assertChainId?: number;
}

export interface ContractOwnerInfo {
  address: string;
  comment: string;
}

export interface Balance {
  address: string;
  tokenId: number;
  amount: number;
}

interface DeployResult extends DeployState {
  factory: ContractFactory;
  contract: Contract;
}

const deployTemplate = (
  signer: Signer,
  ethArgs: EthOptions,
  contractReader: (name: string) => ContractDescription,
  stateStore: StateStore,
  logger: Logger
) => {
  return async (
    name: string,
    args: unknown[],
    id: string,
    contractReaderOverride: (name: string) => ContractDescription = contractReader
  ): Promise<DeployResult> => {
    const contractDescription = contractReaderOverride(name);
    const factory = new ethers.ContractFactory(contractDescription.abi, contractDescription.bytecode, signer);

    const stateFromFile = stateStore.getById(id);
    if (stateFromFile) {
      logger.log(`Import ${name} contract from state file`);
      const contract = factory.attach(stateFromFile.address);
      return {
        address: stateFromFile.address,
        txHash: stateFromFile.txHash,
        factory: factory,
        contract: contract,
      };
    }

    const contract = await factory.deploy(...args, ethArgs);
    await contract.deployed();
    const result = {
      address: contract.address,
      txHash: contract.deployTransaction.hash,
      factory,
      contract,
    };
    stateStore.setById(id, {
      address: contract.address,
      txHash: contract.deployTransaction.hash,
    });
    return result;
  };
};

export async function deploySbt(
  signer: ethers.Signer,
  config: SbtDeployConfig,
  stateStore: StateStore,
  logger: Logger
): Promise<SbtDeployment> {
  console.log('\n\nDEPLOY SBT\n');

  assertOwnerFromConfig(config);
  await assertNetworkFromConfig(config, signer.provider!);
  assertTokensFromConfig(config);
  assertBalancesFromConfig(config);

  const signerBalance = await signer.getBalance();
  console.log(`Signer balance: ${ethers.utils.formatUnits(signerBalance)} ETH`);

  const contractReader = createContractReader(contractsDir);

  const deploy = deployTemplate(signer, config.ethConnection.ethOptions, contractReader, stateStore, logger);

  const ids = config.tokens.map((x) => x.id);
  const limits = config.tokens.map((x) => x.tokenBalanceLimit);
  const uris = config.tokens.map((x) => x.uri);

  const deployResult = await deploy(contractName, [ids, limits, uris], contractDeploymentId);

  logger.log(`Deploy address: ${deployResult.address}`);
  logger.log(`Deploy tx: ${deployResult.txHash}`);

  const sbtContractDescription = contractReader(contractName);
  const sbtContractFactory = new ethers.ContractFactory(sbtContractDescription.abi, sbtContractDescription.bytecode);
  const sbtContract = sbtContractFactory.attach(deployResult.address).connect(signer);

  await initBalances(config, signer, sbtContract, logger);
  const owner = await setNewOwner(config, signer, sbtContract, logger);

  return { sbt: { address: deployResult.address, tokens: config.tokens, owner } };
}

function assertOwnerFromConfig(config: SbtDeployConfig): void {
  if (config.owner !== undefined) {
    if (!ethers.utils.isAddress(config.owner.address)) {
      throw new Error(`owner.address is not a valid eth address. Owner: ${config.owner.address}`);
    }
  }
}

async function assertNetworkFromConfig(config: SbtDeployConfig, provider: ethers.providers.Provider): Promise<void> {
  const network = await provider.getNetwork();
  if (network === undefined) {
    throw new Error("Can't fetch network info from node");
  }

  if (config.ethConnection.assertChainId !== undefined) {
    if (network.chainId !== config.ethConnection.assertChainId) {
      throw new Error(
        `Invalid network ChainId. Expected: ${config.ethConnection.assertChainId}, actual: ${network.chainId}`
      );
    }
  }
}

function assertTokensFromConfig(config: SbtDeployConfig): void {
  if (config.balances.length === 0) {
    return;
  }
  if (config.tokens.length === 0) {
    throw new Error(`Config contains balances, but not contains tokens info.`);
  }

  const sortedById = config.tokens.sort((a, b) => a.id - b.id);
  for (let i = 0; i < sortedById.length; i++) {
    const token = sortedById[i];
    if (token.id !== i) {
      const ids = sortedById.map((x) => x.id);
      throw new Error(
        `Tokens ids must be started from 0 and increased by 1. ` +
          `Example: 0, 1, 2, 3. Actual token ids from config: ${ids.join(', ')}`
      );
    }

    if (token.tokenBalanceLimit < 1) {
      throw new Error(
        `Token balance limit must be >= 1. ` +
          `tokenBalanceLimit from config: ${token.tokenBalanceLimit}, tokenId: ${token.id}`
      );
    }
    if (token.uri.length === 0) {
      throw new Error(`Empty uri for token with id ${token.id}`);
    }
  }
}

function assertBalancesFromConfig(config: SbtDeployConfig): void {
  if (config.tokens.length === 0) {
    return;
  }

  for (const balance of config.balances) {
    const duplicates = config.balances.filter(
      (x) => x.address.toLowerCase() === balance.address.toLowerCase() && x.tokenId === balance.tokenId
    );
    if (duplicates.length > 1) {
      throw new Error(`Config has duplicates of balances. Address: ${balance.address}, tokenId: ${balance.tokenId}`);
    }
    const token = config.tokens.find((x) => x.id === balance.tokenId);
    if (token === undefined) {
      throw new Error(
        `Config has balance with unknown token. Address: ${balance.address}, tokenId: ${balance.tokenId}`
      );
    }

    if (balance.amount > token.tokenBalanceLimit) {
      throw new Error(
        `Config has balance which exceeds the limit. ` +
          `Address: ${balance.address}, tokenId: ${balance.tokenId}, ` +
          `balance: ${balance.amount}, limit: ${token.tokenBalanceLimit}`
      );
    }
  }
}

function createContractReader(contractRoot: string) {
  return (name: string) => {
    return JSON.parse(fs.readFileSync(`${contractRoot}${path.sep}${name}.json`, 'utf-8'));
  };
}

async function initBalances(
  config: SbtDeployConfig,
  signer: ethers.Signer,
  sbtContract: ethers.Contract,
  logger: Logger
): Promise<void> {
  if (config.balances.length === 0) {
    logger.log(`Nothing to mint. Skip`);
    return;
  }

  const accounts = [];
  const tokenIds = [];

  for (const b of config.balances) {
    if (!ethers.utils.isAddress(b.address)) {
      throw new Error(`Invalid eth address in config. Address: ${b.address}`);
    }
    const balance = (await sbtContract.balanceOf(b.address, b.tokenId)).toNumber();
    if (balance > b.amount) {
      throw new Error(
        `Balance from chain > balance from config. ` +
          `Address: ${b.address}, tokenId: ${b.tokenId}, config balance: ${b.amount}, chain balance: ${balance}`
      );
    }
    for (let i = 0; i < b.amount - balance; i++) {
      accounts.push(b.address);
      tokenIds.push(b.tokenId);
    }
  }

  if (accounts.length > 0) {
    const tx = await sbtContract.mint(accounts, tokenIds, config.ethConnection.ethOptions);
    logger.log(`Mint tx hash: ${tx.hash}`);
    await waitForTx(signer.provider!, tx.hash);
  } else {
    logger.log(`Bala`);
  }

  for (const b of config.balances) {
    const balance = (await sbtContract.balanceOf(b.address, b.tokenId)).toNumber();
    if (balance !== b.amount) {
      throw new Error(
        `Balance from chain != balance from config. ` +
          `Address: ${b.address}, tokenId: ${b.tokenId}, config balance: ${b.amount}, chain balance: ${balance}`
      );
    } else {
      logger.log(`Successful mint: address: ${b.address}, tokenId: ${b.tokenId}, amount: ${b.amount}`);
    }
  }
}

async function setNewOwner(
  config: SbtDeployConfig,
  signer: ethers.Signer,
  sbtContract: ethers.Contract,
  logger: Logger
): Promise<string> {
  if (config.owner === undefined) {
    logger.log('Skip setting of new owner');
    return await signer.getAddress();
  }
  const currentOwner = await sbtContract._owner();
  logger.log(`currentOwner: ${currentOwner}, config.owner.address: ${config.owner.address}`);
  if (currentOwner.toLowerCase() === config.owner.address.toLowerCase()) {
    logger.log('Contract owner already set. Skip');
    return config.owner.address;
  }

  const tx = await sbtContract.setNewOwner(config.owner.address, config.ethConnection.ethOptions);
  logger.log(`Set new owner tx hash: ${tx.hash}`);
  await waitForTx(signer.provider!, tx.hash);

  const newOwner = await sbtContract._owner();
  if (newOwner.toLowerCase() !== config.owner.address.toLowerCase()) {
    throw new Error(`Owner from chain != owner from config. Chain: ${newOwner}, config: ${config.owner.address}`);
  }
  return config.owner.address;
}
