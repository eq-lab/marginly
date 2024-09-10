import { ethers } from 'hardhat';
import {
  AlgebraTickOracle,
  MarginlyCompositeOracle,
  UniswapV3TickOracle,
} from '../../../typechain-types/contracts/oracles';
import { getDecimalsDiff, printPrices } from '../../shared/common';

describe('Composite oracle weETH/ARB with uniswapV3 weETH/WETH and uniswapV3 ARB/WETH', () => {
  const uniswapFactory = '0x1F98431c8aD98523631AE4a59f267346ea31F984';
  const weETH = '0x35751007a407ca6FEFfE80b3cB397736D2cf4dbe';
  const weth = '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1';
  const arb = '0x912CE59144191C1204E64559FE8253a0e49E6548';

  let uniswapV3Oracle: UniswapV3TickOracle;
  let compositeOracle: MarginlyCompositeOracle;

  before(async () => {
    const factory = await ethers.getContractFactory('UniswapV3TickOracle');
    uniswapV3Oracle = await factory.deploy(uniswapFactory);
    await uniswapV3Oracle.setOptions(weth, weETH, 1800, 5, 100);
    await uniswapV3Oracle.setOptions(weETH, weth, 1800, 5, 100);
    await uniswapV3Oracle.setOptions(arb, weth, 1800, 5, 500);
    await uniswapV3Oracle.setOptions(weth, arb, 1800, 5, 500);

    compositeOracle = await (await ethers.getContractFactory('MarginlyCompositeOracle')).deploy();
    await compositeOracle.setPair(arb, weth, weETH, uniswapV3Oracle.address, uniswapV3Oracle.address);
  });

  it('weETH/arb price', async () => {
    const balancePrice = await compositeOracle.getBalancePrice(arb, weETH);
    const mcPrice = await compositeOracle.getMargincallPrice(arb, weETH);

    const decimalsDiff = await getDecimalsDiff(arb, weETH);
    printPrices(balancePrice, mcPrice, decimalsDiff);
  });
});

describe('Composite oracle wbtc/arb with uniswapV3 abr/weth and algebra-camelot weth/wbtc', () => {
  const uniswapFactory = '0x1F98431c8aD98523631AE4a59f267346ea31F984';
  const camelotFactory = '0x1a3c9B1d2F0529D97f2afC5136Cc23e58f1FD35B';
  const weth = '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1';
  const wbtc = '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f';
  const arb = '0x912CE59144191C1204E64559FE8253a0e49E6548';

  let uniswapV3Oracle: UniswapV3TickOracle;
  let camelotOracle: AlgebraTickOracle;
  let compositeOracle: MarginlyCompositeOracle;

  before(async () => {
    uniswapV3Oracle = await (await ethers.getContractFactory('UniswapV3TickOracle')).deploy(uniswapFactory);
    await uniswapV3Oracle.setOptions(arb, weth, 1800, 5, 500);
    await uniswapV3Oracle.setOptions(weth, arb, 1800, 5, 500);

    camelotOracle = await (await ethers.getContractFactory('AlgebraTickOracle')).deploy(camelotFactory);
    await camelotOracle.setOptions(weth, wbtc, 1800, 5);
    await camelotOracle.setOptions(wbtc, weth, 1800, 5);

    compositeOracle = await (await ethers.getContractFactory('MarginlyCompositeOracle')).deploy();
    await compositeOracle.setPair(arb, weth, wbtc, uniswapV3Oracle.address, camelotOracle.address);
  });

  it('wbtc/arb price', async () => {
    const wbtcWethBalancePrice = await camelotOracle.getBalancePrice(weth, wbtc);
    const wbtcWethMcPrice = await camelotOracle.getBalancePrice(weth, wbtc);

    console.log('wbtc/weth');
    printPrices(wbtcWethBalancePrice, wbtcWethMcPrice, await getDecimalsDiff(weth, wbtc));

    const wethArbBalancePrice = await uniswapV3Oracle.getBalancePrice(arb, weth);
    const wethArbMcPrice = await uniswapV3Oracle.getBalancePrice(arb, weth);

    console.log('weth/arb');
    printPrices(wethArbBalancePrice, wethArbMcPrice, await getDecimalsDiff(arb, weth));

    const wbtcArbBalancePrice = await compositeOracle.getBalancePrice(arb, wbtc);
    const wbtcArbMcPrice = await compositeOracle.getMargincallPrice(arb, wbtc);

    console.log('wbtc/arb');
    printPrices(wbtcArbBalancePrice, wbtcArbMcPrice, await getDecimalsDiff(arb, wbtc));
  });
});
