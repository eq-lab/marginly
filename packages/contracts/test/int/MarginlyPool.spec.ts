import { ethers } from 'hardhat';
import bn from 'bignumber.js';
import { BigNumber } from 'ethers';
import { MarginlyPool } from '../../typechain-types/contracts/';
import { CallType, ZERO_ADDRESS } from '../shared/utils';

function toHumanPrice(priceX96: BigNumber, decimalsDiff: number) {
  const one = bn(2 ** 96);

  const multiplier = bn(10).pow(decimalsDiff);
  return bn(priceX96.toString()).times(multiplier).div(one.toString()).toString();
}

function printPrices(balancePrice: BigNumber, mcPrice: BigNumber, decimalsDiff: number) {
  console.log(`Balance price is ${toHumanPrice(balancePrice, decimalsDiff)}  (${balancePrice})`);
  console.log(`MC price is ${toHumanPrice(mcPrice, decimalsDiff)} (${mcPrice})`);
}

async function getDecimals(contractAddress: string): Promise<number> {
  const abi = ['function decimals() view returns (uint8)'];
  const contract = new ethers.Contract(contractAddress, abi, ethers.provider);
  return await contract.decimals();
}

async function getDecimalsDiff(quoteToken: string, baseToken: string): Promise<number> {
  const baseDecimals = await getDecimals(baseToken);
  const quoteDecimals = await getDecimals(quoteToken);
  return baseDecimals - quoteDecimals;
}

describe.only('Blast marginlypool', () => {
  const defaultSwapCallData = 23592961;
  let marginlyPool: MarginlyPool;
  before(async () => {
    marginlyPool = await ethers.getContractAt('MarginlyPool', '0xA24D9FB1CA3909DaaAF62503c766680d087E72B9');
  });

  it('execute long', async () => {
    const ethOptions = {
      gasPrice: 500,
    };

    const signerAddress = '0x6a623d5914EaEe64CB92CEA87497367937E89d71';
    const signer = await ethers.getImpersonatedSigner(signerAddress);
    const depositBase = BigNumber.from('10000000000000000');
    const long = BigNumber.from('20000000000000000');
    const limitPriceX96 = BigNumber.from('296710746095966368867304439181536');
    //const limitPriceX96 = BigNumber.from('316912650057057000000000000000000');
    await marginlyPool
      .connect(signer)
      .execute(CallType.DepositBase, depositBase, long, limitPriceX96, true, ZERO_ADDRESS, defaultSwapCallData, {
        value: depositBase,
        ...ethOptions,
      });
  });
});
