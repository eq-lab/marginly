import { EthAddress } from '@marginly/common';
import * as ethers from 'ethers';
import {
  isMarginlyConfigExistingToken,
  isMarginlyConfigMintableToken,
  MarginlyConfigToken,
  readOpenzeppelinContract,
} from '../common';
import { IMarginlyDeployer, ITokenRepository, TokenInfo } from '../common/interfaces';

export class TokenRepository implements ITokenRepository {
  private readonly provider;
  private readonly marginlyDeployer;
  private readonly tokens;

  public constructor(provider: ethers.providers.Provider, marginlyDeployer: IMarginlyDeployer) {
    this.provider = provider;
    this.marginlyDeployer = marginlyDeployer;
    this.tokens = new Map<string, TokenInfo>();
  }

  public async materializeToken(token: MarginlyConfigToken): Promise<void> {
    if (this.tokens.has(token.id)) {
      throw new Error(`Token with id ${token.id} already materialized`);
    }

    let tokenAddress: EthAddress;
    let tokenDecimals: number;
    let tokenSymbol: string;

    if (isMarginlyConfigExistingToken(token)) {
      const tokenContractDescription = readOpenzeppelinContract('IERC20Metadata');
      const tokenContract = new ethers.Contract(token.address.toString(), tokenContractDescription.abi, this.provider);
      const actualSymbol = await tokenContract.symbol();
      const actualDecimals = await tokenContract.decimals();

      if (token.assertSymbol !== undefined) {
        const expectedSymbol = token.assertSymbol;
        if (actualSymbol !== expectedSymbol) {
          throw new Error(
            `Invalid symbol '${actualSymbol}' for token with id '${token.id}. Expected symbol: '${expectedSymbol}'`
          );
        }
      }
      if (token.assertDecimals !== undefined) {
        const expectedDecimals = token.assertDecimals;
        if (actualDecimals !== expectedDecimals) {
          throw new Error(
            `Invalid decimals '${actualDecimals}' for token with id '${token.id}'. Expected decimals: '${expectedDecimals}'`
          );
        }
      }
      tokenAddress = token.address;
      tokenSymbol = actualSymbol;
      tokenDecimals = actualDecimals;
    } else if (isMarginlyConfigMintableToken(token)) {
      const deployResult = await this.marginlyDeployer.deployMintableToken(token.name, token.symbol, token.decimals);
      tokenAddress = EthAddress.parse(deployResult.address);
      tokenSymbol = await deployResult.contract.symbol();
      tokenDecimals = await deployResult.contract.decimals();
    } else {
      throw new Error('Unknown token type');
    }

    this.tokens.set(token.id, {
      address: tokenAddress,
      symbol: tokenSymbol,
      decimals: tokenDecimals,
    });
  }

  public getTokenInfo(tokenId: string): TokenInfo {
    const tokenInfo = this.tokens.get(tokenId);
    if (tokenInfo === undefined) {
      throw new Error(`Unknown token ${tokenId}`);
    }
    return tokenInfo;
  }
}
