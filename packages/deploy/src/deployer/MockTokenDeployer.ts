import { BigNumber, Signer, ethers } from 'ethers';
import { MarginlyConfigToken, StateStore, isMarginlyConfigMintableToken, readUniswapMockContract } from '../common';
import { DeployResult, ITokenDeployer, ITokenRepository } from '../common/interfaces';
import { EthOptions } from '../config';
import { Logger } from '../logger';
import { BaseDeployer } from './BaseDeployer';
import { EthAddress, RationalNumber } from '@marginly/common';

export class MockTokenDeployer extends BaseDeployer implements ITokenDeployer {
  public constructor(signer: Signer, ethArgs: EthOptions, stateStore: StateStore, logger: Logger) {
    super(signer, ethArgs, stateStore, logger);
  }

  public deployMintableToken(name: string, symbol: string, decimals: number): Promise<DeployResult> {
    return this.deploy('MintableToken', [name, symbol, decimals], `token_${symbol}`, readUniswapMockContract);
  }

  public async ensureTokenAmount(
    token: MarginlyConfigToken,
    ethAddress: EthAddress,
    amount: RationalNumber,
    tokenRepository: ITokenRepository
  ): Promise<void> {
    if (isMarginlyConfigMintableToken(token)) {
      const tokenInfo = tokenRepository.getTokenInfo(token.id);
      const tokenContractDescription = readUniswapMockContract('MintableToken');
      const tokenContract = new ethers.Contract(
        tokenInfo.address.toString(),
        tokenContractDescription.abi,
        this.signer
      );
      const one = BigNumber.from(10).pow(tokenInfo.decimals);

      const desiredBalance = amount.mul(one).toInteger();
      const currentBalance: BigNumber = await tokenContract.balanceOf(ethAddress.toString());

      if (currentBalance.lt(desiredBalance)) {
        await tokenContract.mint(ethAddress.toString(), desiredBalance.sub(currentBalance));
      }
    } else {
      throw new Error(`Unable to set balance for token ${token.id}`);
    }
  }
}
