import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { createPendleCaseWeETH27Jun2024 } from '../../shared/fixtures';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { ethers } from 'hardhat';
import { MarginlyRouter__factory } from '../../../typechain-types';
import { PendleAdapter__factory } from '@marginly/router/typechain-types';
import { EthAddress, PositionType } from '@marginly/common';
import { formatUnits, keccak256, parseUnits } from 'ethers/lib/utils';
import { MarginlyFactory__factory, MarginlyPool__factory } from '@marginly/contracts/typechain-types';
import { MarginlyParamsStruct } from '@marginly/contracts/typechain-types/contracts/MarginlyPool';

export const CallType = {
  DepositBase: 0,
  DepositQuote: 1,
  WithdrawBase: 2,
  WithdrawQuote: 3,
  Short: 4,
  Long: 5,
  ClosePosition: 6,
  Reinit: 7,
  ReceivePosition: 8,
  EmergencyWithdraw: 9,
};

// TODO remove me after all the merges are resolved
function getAccountBalanceStorageSlot(account: EthAddress, tokenMappingSlot: string): string {
  return keccak256('0x' + account.toString().slice(2).padStart(64, '0') + tokenMappingSlot);
}

// TODO remove me after all the merges are resolved
export async function setTokenBalance(
  tokenAddress: string,
  balanceOfSlotAddress: string,
  account: EthAddress,
  newBalance: BigNumber
) {
  const balanceOfStorageSlot = getAccountBalanceStorageSlot(account, balanceOfSlotAddress);

  await ethers.provider.send('hardhat_setStorageAt', [
    tokenAddress,
    balanceOfStorageSlot,
    ethers.utils.hexlify(ethers.utils.zeroPad(newBalance.toHexString(), 32)),
  ]);
}

// TODO remove me after all the merges are resolved
export enum ArbMainnetERC20BalanceOfSlot {
  WETH = '0000000000000000000000000000000000000000000000000000000000000033',
  PTWEETH = '0000000000000000000000000000000000000000000000000000000000000000',
}

describe.only('Pendle farming marginly pool', () => {
  it('PT-weETH-27JUN2024 / WETH', async () => {
    console.log('Setting up pool');
    const { oracle } = await loadFixture(createPendleCaseWeETH27Jun2024);

    const [owner, lender, longer1, longer2, longer3, shorter, liquidator] = await ethers.getSigners();

    const IERC20Abi = require('../../../artifacts/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20.json').abi;
    const ptToken = await ethers.getContractAt(IERC20Abi, '0x1c27Ad8a19Ba026ADaBD615F6Bc77158130cfBE4');
    const weth = await ethers.getContractAt(IERC20Abi, '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1');
    const poolInput = {
      poolData: {
        pendleMarket: '0x952083cde7aaa11AB8449057F7de23A970AA8472',
        uniswapV3LikePool: '0x14353445c8329Df76e6f15e9EAD18fA2D45A8BB6',
        ib: '0x35751007a407ca6FEFfE80b3cB397736D2cf4dbe',
        slippage: 20,
      },
      tokenA: ptToken.address,
      tokenB: weth.address,
    };
    const pendleAdapter = await new PendleAdapter__factory().connect(owner).deploy([poolInput]);
    const routerInput = {
      dexIndex: 0,
      adapter: pendleAdapter.address,
    };
    const router = await new MarginlyRouter__factory().connect(owner).deploy([routerInput]);
    const marginlyPoolImpl = await new MarginlyPool__factory().connect(owner).deploy();
    const marginlyFactory = await new MarginlyFactory__factory().connect(owner).deploy(
      marginlyPoolImpl.address, 
      router.address, 
      owner.address, 
      weth.address, 
      owner.address
    );
    let params: MarginlyParamsStruct = {
      interestRate: 30000,
      fee: 20000,
      maxLeverage: 20,
      swapFee: 1000,
      mcSlippage: 10000,
      positionMinAmount: parseUnits('0.001', 18),
      quoteLimit: parseUnits('200', 18),
    };
    
    const poolAddress = 
      await marginlyFactory.callStatic.createPool(weth.address, ptToken.address, oracle.address, 0, params);
    await(await marginlyFactory.connect(owner).createPool(weth.address, ptToken.address, oracle.address, 0, params)).wait();
    const marginly = new MarginlyPool__factory().attach(poolAddress);
    console.log('Setup finished');

    console.log('Lender deposits weth');
    const lenderDepositAmount = parseUnits('30', 18);
    await setTokenBalance(weth.address, ArbMainnetERC20BalanceOfSlot.WETH, EthAddress.parse(lender.address), lenderDepositAmount);
    await weth.connect(lender).approve(marginly.address, lenderDepositAmount);
    await marginly
      .connect(lender)
      .execute(CallType.DepositQuote, lenderDepositAmount, 0, 0, false, ethers.constants.AddressZero, 0);

    const longerDepositAmount = parseUnits('1', 18);
    const longAmount = parseUnits('10', 18);
    let price = (await marginly.connect(owner).getBasePrice()).inner;
    console.log('Longer1 deposits pt and longs');
    await setTokenBalance(
      ptToken.address,
      ArbMainnetERC20BalanceOfSlot.PTWEETH,
      EthAddress.parse(longer1.address),
      longerDepositAmount
    );
    await ptToken.connect(longer1).approve(marginly.address, longerDepositAmount);
    await marginly
      .connect(longer1)
      .execute(CallType.DepositBase, longerDepositAmount, longAmount, price.mul(11).div(10), false, ethers.constants.AddressZero, 0);

    console.log('Longer2 deposits pt and longs');
    await setTokenBalance(
      ptToken.address,
      ArbMainnetERC20BalanceOfSlot.PTWEETH,
      EthAddress.parse(longer2.address),
      longerDepositAmount
    );
    await ptToken.connect(longer2).approve(marginly.address, longerDepositAmount);
    await marginly
      .connect(longer2)
      .execute(CallType.DepositBase, longerDepositAmount, longAmount, price.mul(11).div(10), false, ethers.constants.AddressZero, 0);

    console.log('Longer3 deposits weth and longs');
    await setTokenBalance(weth.address, ArbMainnetERC20BalanceOfSlot.WETH, EthAddress.parse(longer3.address), longerDepositAmount);
    await weth.connect(longer3).approve(marginly.address, longerDepositAmount);
    await marginly
      .connect(longer3)
      .execute(CallType.DepositQuote, longerDepositAmount, longAmount.mul(-1), price.mul(11).div(10), false, ethers.constants.AddressZero, 0);
    
    console.log('Shorter fails');
    await setTokenBalance(weth.address, ArbMainnetERC20BalanceOfSlot.WETH, EthAddress.parse(shorter.address), longerDepositAmount);
    await weth.connect(shorter).approve(marginly.address, longerDepositAmount);
    await expect(
      marginly
        .connect(shorter)
        .execute(CallType.DepositQuote, longerDepositAmount, longAmount, price.mul(2), false, ethers.constants.AddressZero, 0)
    ).to.be.revertedWithCustomError(marginly, 'Forbidden');

    console.log('Time shift');
    await ethers.provider.send('evm_increaseTime', [90 * 24 * 60 * 60]);
    await ethers.provider.send('evm_mine', []);

    console.log('Longer1 closes');
    price = (await marginly.connect(owner).getBasePrice()).inner;
    await marginly
      .connect(longer1)
      .execute(CallType.ClosePosition, 0, 0, price.mul(90).div(100), false, ethers.constants.AddressZero, 0);
    await marginly
      .connect(longer1)
      .execute(CallType.WithdrawBase, parseUnits('100', 18), 0, 0, false, ethers.constants.AddressZero, 0);
    console.log(`longer1 pt balance: ${formatUnits(await ptToken.balanceOf(longer1.address), 18)}`);

    console.log('It\'s too late, time for liquidations: setting maxLeverage as 1');
    params.maxLeverage = 1;
    await marginly.connect(owner).setParameters(params);

    console.log(`Longer2 gets margin called`);
    expect((await marginly.connect(owner).positions(longer2.address))._type).to.be.eq(PositionType.Long);
    await marginly.connect(owner).execute(CallType.Reinit, 0, 0, 0, false, ethers.constants.AddressZero, 0);
    expect((await marginly.connect(owner).positions(longer2.address))._type).to.be.eq(PositionType.Uninitialized);

    console.log(`Liquidator receives longer3 position`);
    const wethDeposit = parseUnits('20', 18);
    await setTokenBalance(weth.address, ArbMainnetERC20BalanceOfSlot.WETH, EthAddress.parse(liquidator.address), wethDeposit);
    await weth.connect(liquidator).approve(marginly.address, wethDeposit);
    await marginly
      .connect(liquidator)
      .execute(CallType.ReceivePosition, wethDeposit, 0, 0, false, longer3.address, 0);
    expect((await marginly.connect(owner).positions(longer3.address))._type).to.be.eq(PositionType.Uninitialized);
    await marginly
      .connect(liquidator)
      .execute(CallType.WithdrawQuote, wethDeposit, 0, 0, false, ethers.constants.AddressZero, 0);
    await marginly
        .connect(liquidator)
        .execute(CallType.WithdrawBase, wethDeposit, 0, 0, false, ethers.constants.AddressZero, 0);
  });
});
