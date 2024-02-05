import { ContractDescription, EthAddress } from '@marginly/common';
import { BigNumber } from '@ethersproject/bignumber';
import { Logger } from '../logger';

export interface StateStore {
  getById: (id: string) => DeployState | undefined;
  setById: (id: string, deployState: DeployState) => void;
}

export interface DeployState {
  address: string;
  txHash?: string;
}

export interface BaseState {
  contracts: {
    [id: string]: DeployState;
  };
}

export interface MarginlyConfigExistingToken {
  type: 'existing';
  id: string;
  address: EthAddress;
  assertSymbol?: string;
  assertDecimals?: number;
}

export interface MarginlyConfigMintableToken {
  type: 'mintable';
  id: string;
  name: string;
  symbol: string;
  decimals: number;
}

export type MarginlyConfigToken = MarginlyConfigExistingToken | MarginlyConfigMintableToken;

export function isMarginlyConfigExistingToken(token: MarginlyConfigToken): token is MarginlyConfigExistingToken {
  return token.type === 'existing';
}

export function isMarginlyConfigMintableToken(token: MarginlyConfigToken): token is MarginlyConfigMintableToken {
  return token.type === 'mintable';
}

export interface Closable {
  close(): void;
}

export function using<TVal extends Closable, TRet>(val: TVal, func: (val: TVal) => TRet) {
  try {
    return func(val);
  } finally {
    val.close();
  }
}

export const printDeployState = (name: string, { address, txHash }: DeployState, logger: Logger) => {
  logger.log(`${name} address: ${address}, txHash: ${txHash ?? 'unknown'}`);
};

export function readOpenzeppelinContract(name: string): ContractDescription {
  return require(`@openzeppelin/contracts/build/contracts/${name}.json`);
}

export function readUniswapMockContract(name: string): ContractDescription {
  return require(`@marginly/contracts-uniswap-mock/artifacts/contracts/${name}.sol/${name}.json`);
}

export function readMarginlyAdapterContract(name: string): ContractDescription {
  return require(`@marginly/router/artifacts/contracts/adapters/${name}.sol/${name}.json`);
}

export function readMarginlyRouterContract(name: string): ContractDescription {
  return require(`@marginly/router/artifacts/contracts/${name}.sol/${name}.json`);
}

export interface MarginlyDeploymentMarginlyPool {
  id: string;
  address: string;
}

export interface MarginlyDeployment {
  marginlyPools: MarginlyDeploymentMarginlyPool[];
  marginlyKeeper?: { address: string };
  marginlyKeeperUniswapV3: { address: string };
}

export function mergeMarginlyDeployments(
  oldDeployment: MarginlyDeployment,
  newDeployment: MarginlyDeployment
): MarginlyDeployment {
  function assertNoDuplicates(label: string, deployment: MarginlyDeployment) {
    const poolSet = new Set<string>();
    for (const marginlyPool of deployment.marginlyPools) {
      if (poolSet.has(marginlyPool.id)) {
        throw new Error(`Duplicate id of marginly pool '${marginlyPool.id}' in ${label}`);
      }
      poolSet.add(marginlyPool.id);
    }
  }

  assertNoDuplicates('old deployment', oldDeployment);
  assertNoDuplicates('new deployment', newDeployment);

  const mergedDeployment = {
    marginlyPools: [...oldDeployment.marginlyPools],
    marginlyKeeper: newDeployment.marginlyKeeper,
    marginlyKeeperUniswapV3: newDeployment.marginlyKeeperUniswapV3,
  };

  for (const marginlyPool of newDeployment.marginlyPools) {
    const index = mergedDeployment.marginlyPools.findIndex((x) => x.id === marginlyPool.id);
    if (index !== -1) {
      mergedDeployment.marginlyPools.splice(index, 1);
    }
    mergedDeployment.marginlyPools.push(marginlyPool);
  }

  mergedDeployment.marginlyPools.sort((a, b) => {
    if (a.id < b.id) {
      return -1;
    } else if (a.id === b.id) {
      return 0;
    } else {
      return 1;
    }
  });

  return mergedDeployment;
}

export class TimeSpan {
  private static readonly regex: RegExp = /^(\d+) (min|sec)$/;
  private readonly value: BigNumber;
  private readonly measure: 'min' | 'sec';

  private constructor(value: BigNumber, measure: 'min' | 'sec') {
    this.value = value;
    this.measure = measure;
  }

  public static parse(str: string): TimeSpan {
    const match = str.match(this.regex);

    if (match === null) {
      throw new Error(`Error parsing time span from string '${str}'`);
    }

    const valueStr = match[1];
    const measureStr = match[2];

    let measure: 'min' | 'sec';
    switch (measureStr) {
      case 'min':
      case 'sec':
        measure = measureStr;
        break;
      default:
        throw new Error(`Unknown measure '${measureStr} in time span '${str}'`);
    }

    return new TimeSpan(BigNumber.from(valueStr), measure);
  }

  public toSeconds(): BigNumber {
    if (this.measure === 'min') {
      return this.value.mul(60);
    } else if (this.measure === 'sec') {
      return this.value;
    } else {
      throw new Error(`Unknown measure '${this.measure}'`);
    }
  }
}
