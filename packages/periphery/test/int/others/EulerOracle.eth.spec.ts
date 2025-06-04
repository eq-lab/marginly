import { ethers } from 'hardhat';
import { Signer } from 'ethers';
import { getDecimalsDiff, printPrices } from '../../shared/common';
import { EulerPriceOracle } from '../../../typechain-types';
import { resetFork } from '../../shared/utils';

describe('EulerOracle', () => {
  const FORK_BLOCK_NUMBER = 22616500;

  let oracle: EulerPriceOracle;
  let owner: Signer;

  before(async () => {
    await resetFork(FORK_BLOCK_NUMBER);

    [owner] = await ethers.getSigners();
    const factory = await ethers.getContractFactory('EulerPriceOracle');
    oracle = (await factory.deploy()) as EulerPriceOracle;
  });

  it('wstETH/WETH', async () => {
    const wstETH = '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0';
    const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
    //lidoFundamentalOracle
    const eulerOracle = '0x7c37aB8Cd76Ee8888ad7F19C1F8a3A6D1622e9B8';

    oracle.connect(owner).addPair(WETH, wstETH, eulerOracle);

    const balancePrice = await oracle.getBalancePrice(WETH, wstETH);
    const mcPrice = await oracle.getMargincallPrice(WETH, wstETH);

    let decimalsDiff = await getDecimalsDiff(WETH, wstETH);
    printPrices(balancePrice, mcPrice, decimalsDiff);

    const invertedPrice = await oracle.getBalancePrice(wstETH, WETH);
    const invertedMcPrice = await oracle.getMargincallPrice(wstETH, WETH);
    decimalsDiff = await getDecimalsDiff(wstETH, WETH);
    printPrices(invertedPrice, invertedMcPrice, decimalsDiff);
  });
});
