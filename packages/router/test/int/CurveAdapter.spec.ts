import { ethers, network } from 'hardhat';
import { CurveAdapter, ERC20, ICurvePool, MarginlyRouter } from '../../typechain-types';
import { AdapterInputStruct } from '@marginly/periphery/typechain-types/contracts/admin/abstract/RouterActions';
import { PoolInputStruct } from '../../typechain-types/contracts/adapters/CurveAdapter';
import { BigNumber } from 'ethers';
import { EthAddress } from '@marginly/common';
import { keccak256 } from 'ethers/lib/utils';
import { AST } from 'eslint';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

function printPriceOracle(price: BigNumber, token0: TokenInfo, token1: TokenInfo) {
  const priceStr = ethers.utils.formatEther(price);
  const inversePrice = 1 / Number.parseFloat(priceStr);
  console.log(`Price (fees not included):`);
  console.log(`1 ${token1.symbol} = ${priceStr} ${token0.symbol}`);
  console.log(`1 ${token0.symbol} = ${inversePrice} ${token1.symbol}`);
}

const BALANCEOF_SLOT_WETH = '0000000000000000000000000000000000000000000000000000000000000033';
const BALANCEOF_SLOT_FRXETH = '0000000000000000000000000000000000000000000000000000000000000000';

interface TokenInfo {
  contract: ERC20;
  symbol: string;
  decimals: number;
  balanceOfSlot: string;
}

function getAccountBalanceStorageSlot(account: EthAddress, tokenMappingSlot: string): string {
  return keccak256('0x' + account.toString().slice(2).padStart(64, '0') + tokenMappingSlot);
}

async function setTokenBalance(token: TokenInfo, account: EthAddress, newBalance: BigNumber) {
  const balanceOfStorageSlot = getAccountBalanceStorageSlot(account, token.balanceOfSlot);

  await ethers.provider.send('hardhat_setStorageAt', [
    token.contract.address,
    balanceOfStorageSlot,
    ethers.utils.hexlify(ethers.utils.zeroPad(newBalance.toHexString(), 32)),
  ]);
}

function formatTokenBalance(token: TokenInfo, amount: BigNumber): string {
  return `${ethers.utils.formatUnits(amount, token.decimals)} ${token.symbol}`;
}

describe('Curve adapter for frxETH/WETH pool (CurveAdapter)', () => {
  // rxETH/WETH pool - https://curve.fi/#/arbitrum/pools/factory-v2-140/deposit
  const poolAddress = '0x1DeB3b1cA6afca0FF9C5cE9301950dC98Ac0D523';
  let token0: TokenInfo;
  let token1: TokenInfo;
  let pool: ICurvePool;
  let router: MarginlyRouter;
  let adapter: CurveAdapter;

  before(async () => {
    pool = await ethers.getContractAt('ICurvePool', poolAddress);
    const adapterFactory = await ethers.getContractFactory('CurveAdapter');

    const token0Address = await pool.callStatic.coins(0);
    const token1Address = await pool.callStatic.coins(1);
    const token0Contract = await ethers.getContractAt('ERC20', token0Address);
    const token1Contract = await ethers.getContractAt('ERC20', token1Address);
    const token0Symbol = await token0Contract.symbol();
    const token1Symbol = await token1Contract.symbol();
    const token0Decimals = await token0Contract.decimals();
    const token1Decimals = await token1Contract.decimals();

    token0 = <TokenInfo>{
      contract: token0Contract,
      symbol: token0Symbol,
      decimals: token0Decimals,
      balanceOfSlot: BALANCEOF_SLOT_WETH,
    };
    token1 = <TokenInfo>{
      contract: token1Contract,
      symbol: token1Symbol,
      decimals: token1Decimals,
      balanceOfSlot: BALANCEOF_SLOT_FRXETH,
    };
    adapter = await adapterFactory.deploy([
      <PoolInputStruct>{ token0: token0Address, token1: token1Address, pool: poolAddress },
    ]);

    const routerFactory = await ethers.getContractFactory('MarginlyRouter');
    router = await routerFactory.deploy([<AdapterInputStruct>{ dexIndex: 0, adapter: adapter.address }]);

    const [owner, user1, user2] = await ethers.getSigners();

    const token0InitBalance = BigNumber.from(10).pow(18);
    await setTokenBalance(token0, EthAddress.parse(owner.address), token0InitBalance);
    await setTokenBalance(token0, EthAddress.parse(user1.address), token0InitBalance);
    await setTokenBalance(token0, EthAddress.parse(user2.address), token0InitBalance);

    const token1InitBalance = BigNumber.from(10).pow(19);
    await setTokenBalance(token1, EthAddress.parse(owner.address), token1InitBalance);
    await setTokenBalance(token1, EthAddress.parse(user1.address), token1InitBalance);
    await setTokenBalance(token1, EthAddress.parse(user2.address), token1InitBalance);
  });

  async function swapExactInput(
    signer: SignerWithAddress,
    zeroToOne: boolean,
    amountIn: BigNumber,
    minAmountOut: BigNumber
  ) {
    const token0BalanceBefore = await token0.contract.balanceOf(signer.address);
    const token1BalanceBefore = await token1.contract.balanceOf(signer.address);
    console.log(
      `signer balance before swap: ${formatTokenBalance(token0, token0BalanceBefore)}, ` +
        `${formatTokenBalance(token1, token1BalanceBefore)}`
    );
    const amountInStr = formatTokenBalance(zeroToOne ? token0 : token1, amountIn);
    const minAmountOutStr = formatTokenBalance(zeroToOne ? token1 : token0, minAmountOut);

    console.log(`swapExactInput:`);
    console.log(`amountIn: ${amountInStr}`);
    console.log(`minAmountOut: ${minAmountOutStr}`);

    await router.swapExactInput(
      BigNumber.from(0),
      token0.contract.address,
      token1.contract.address,
      amountIn,
      minAmountOut
    );

    const token0BalanceAfter = await token0.contract.balanceOf(signer.address);
    const token1BalanceAfter = await token1.contract.balanceOf(signer.address);

    console.log(
      `signer balance after swap: ${formatTokenBalance(token0, token0BalanceAfter)}, ` +
        `${formatTokenBalance(token1, token1BalanceAfter)}`
    );

    // todo
    const token0Delta = token0BalanceBefore.sub(token0BalanceAfter);
    const token1Delta = token1BalanceAfter.sub(token1BalanceBefore);
    console.log(
      `signer balances delta: -${formatTokenBalance(token0, token0Delta)}, ` +
        `${formatTokenBalance(token1, token1Delta)}`
    );
  }

  it('Swap WETH to frxETH', async () => {
    const [owner, user] = await ethers.getSigners();
    const ownerAddress = EthAddress.parse(owner.address);

    // const priceBefore = await pool.price_oracle();
    // printPriceOracle(priceBefore, token0, token1);

    // const balanceBefore = await token0.contract.balanceOf(owner.address);
    // console.log(`owner balance before: ${ethers.utils.formatUnits(balanceBefore, token0.decimals)} ${token0.symbol}`);
    //
    // const initialWethBalance = BigNumber.from(10).pow(18);
    // await setTokenBalance(token0, ownerAddress, initialWethBalance);

    const amountIn = BigNumber.from(10).pow(15); // 0.0001 WETH
    const minAmountOut = amountIn.div(100);

    await token0.contract.approve(router.address, amountIn);

    await swapExactInput(owner, true, amountIn, minAmountOut);

    // const token0BalanceAfter = await token0.contract.balanceOf(owner.address);
    // const token1BalanceAfter = await token1.contract.balanceOf(owner.address);
    // console.log(
    //   `owner balance after swap: ${formatTokenBalance(token0, token0BalanceAfter)}, ` +
    //     `${formatTokenBalance(token1, token1BalanceAfter)}`
    // );
    // const balancePrice = await oracle.getBalancePrice(weth, frxEth);
    // const mcPrice = await oracle.getMargincallPrice(weth, frxEth);
    //
    // const decimalsDiff = await getDecimalsDiff(weth, frxEth);
    // printPrices(balancePrice, mcPrice, decimalsDiff);
  });
});
