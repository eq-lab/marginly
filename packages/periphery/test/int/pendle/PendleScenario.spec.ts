import { expect } from 'chai';
import { BigNumber } from 'ethers';
import { createPendleCaseUSDe29Aug2024, createPendleCaseWeETH27Jun2024 } from '../../shared/fixtures';
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
  USDC = '0000000000000000000000000000000000000000000000000000000000000009',
  WETH = '0000000000000000000000000000000000000000000000000000000000000033',
  PTWEETH = '0000000000000000000000000000000000000000000000000000000000000000',
}

describe('Pendle farming marginly pool', () => {
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
    const marginlyFactory = await new MarginlyFactory__factory()
      .connect(owner)
      .deploy(marginlyPoolImpl.address, router.address, owner.address, weth.address, owner.address);
    let params: MarginlyParamsStruct = {
      interestRate: 30000,
      fee: 20000,
      maxLeverage: 20,
      swapFee: 1000,
      mcSlippage: 10000,
      positionMinAmount: parseUnits('0.001', 18),
      quoteLimit: parseUnits('200', 18),
    };

    const poolAddress = await marginlyFactory.callStatic.createPool(
      weth.address,
      ptToken.address,
      oracle.address,
      0,
      params
    );
    await (
      await marginlyFactory.connect(owner).createPool(weth.address, ptToken.address, oracle.address, 0, params)
    ).wait();
    const marginly = new MarginlyPool__factory().attach(poolAddress);
    console.log('Setup finished');

    console.log('Lender deposits weth');
    const lenderDepositAmount = parseUnits('30', 18);
    await setTokenBalance(
      weth.address,
      ArbMainnetERC20BalanceOfSlot.WETH,
      EthAddress.parse(lender.address),
      lenderDepositAmount
    );
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
      .execute(
        CallType.DepositBase,
        longerDepositAmount,
        longAmount,
        price.mul(11).div(10),
        false,
        ethers.constants.AddressZero,
        0
      );

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
      .execute(
        CallType.DepositBase,
        longerDepositAmount,
        longAmount,
        price.mul(11).div(10),
        false,
        ethers.constants.AddressZero,
        0
      );

    console.log('Longer3 deposits weth and longs');
    await setTokenBalance(
      weth.address,
      ArbMainnetERC20BalanceOfSlot.WETH,
      EthAddress.parse(longer3.address),
      longerDepositAmount
    );
    await weth.connect(longer3).approve(marginly.address, longerDepositAmount);
    await marginly
      .connect(longer3)
      .execute(
        CallType.DepositQuote,
        longerDepositAmount,
        longAmount.mul(-1),
        price.mul(11).div(10),
        false,
        ethers.constants.AddressZero,
        0
      );

    console.log('Shorter fails');
    await setTokenBalance(
      weth.address,
      ArbMainnetERC20BalanceOfSlot.WETH,
      EthAddress.parse(shorter.address),
      longerDepositAmount
    );
    await weth.connect(shorter).approve(marginly.address, longerDepositAmount);
    await expect(
      marginly
        .connect(shorter)
        .execute(
          CallType.DepositQuote,
          longerDepositAmount,
          longAmount,
          price.mul(2),
          false,
          ethers.constants.AddressZero,
          0
        )
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

    console.log("It's too late, time for liquidations: setting maxLeverage as 1");
    params.maxLeverage = 1;
    await marginly.connect(owner).setParameters(params);

    console.log(`Longer2 gets margin called`);
    expect((await marginly.connect(owner).positions(longer2.address))._type).to.be.eq(PositionType.Long);
    await marginly.connect(owner).execute(CallType.Reinit, 0, 0, 0, false, ethers.constants.AddressZero, 0);
    expect((await marginly.connect(owner).positions(longer2.address))._type).to.be.eq(PositionType.Uninitialized);

    console.log(`Liquidator receives longer3 position`);
    const wethDeposit = parseUnits('20', 18);
    await setTokenBalance(
      weth.address,
      ArbMainnetERC20BalanceOfSlot.WETH,
      EthAddress.parse(liquidator.address),
      wethDeposit
    );
    await weth.connect(liquidator).approve(marginly.address, wethDeposit);
    await marginly.connect(liquidator).execute(CallType.ReceivePosition, wethDeposit, 0, 0, false, longer3.address, 0);
    expect((await marginly.connect(owner).positions(longer3.address))._type).to.be.eq(PositionType.Uninitialized);
    await marginly
      .connect(liquidator)
      .execute(CallType.WithdrawQuote, wethDeposit, 0, 0, false, ethers.constants.AddressZero, 0);
    await marginly
      .connect(liquidator)
      .execute(CallType.WithdrawBase, wethDeposit, 0, 0, false, ethers.constants.AddressZero, 0);
  });

  it('PT-USDe-29AUG2024 / USDC', async () => {
    console.log('Setting up pool');
    const { oracle } = await loadFixture(createPendleCaseUSDe29Aug2024);

    const [owner, lender, longer1, longer2, longer3, shorter, liquidator] = await ethers.getSigners();

    const IERC20Abi = require('../../../artifacts/@openzeppelin/contracts/token/ERC20/IERC20.sol/IERC20.json').abi;
    const ptToken = await ethers.getContractAt(IERC20Abi, '0xad853EB4fB3Fe4a66CdFCD7b75922a0494955292');
    const usdc = await ethers.getContractAt(IERC20Abi, '0xaf88d065e77c8cc2239327c5edb3a432268e5831');
    const poolInput = {
      poolData: {
        pendleMarket: '0x2dfaf9a5e4f293bceede49f2dba29aacdd88e0c4',
        uniswapV3LikePool: '0xc23f308cf1bfa7efffb592920a619f00990f8d74',
        ib: '0x5d3a1Ff2b6BAb83b63cd9AD0787074081a52ef34',
        slippage: 20,
      },
      tokenA: ptToken.address,
      tokenB: usdc.address,
    };
    const pendleAdapter = await new PendleAdapter__factory().connect(owner).deploy([poolInput]);
    const routerInput = {
      dexIndex: 0,
      adapter: pendleAdapter.address,
    };
    const router = await new MarginlyRouter__factory().connect(owner).deploy([routerInput]);
    const marginlyPoolImpl = await new MarginlyPool__factory().connect(owner).deploy();
    const marginlyFactory = await new MarginlyFactory__factory()
      .connect(owner)
      .deploy(marginlyPoolImpl.address, router.address, owner.address, usdc.address, owner.address);
    let params: MarginlyParamsStruct = {
      interestRate: 30000,
      fee: 20000,
      maxLeverage: 20,
      swapFee: 1000,
      mcSlippage: 10000,
      positionMinAmount: parseUnits('1', 6),
      quoteLimit: parseUnits('100000', 6),
    };

    const poolAddress = await marginlyFactory.callStatic.createPool(
      usdc.address,
      ptToken.address,
      oracle.address,
      0,
      params
    );
    await (
      await marginlyFactory.connect(owner).createPool(usdc.address, ptToken.address, oracle.address, 0, params)
    ).wait();
    const marginly = new MarginlyPool__factory().attach(poolAddress);
    console.log('Setup finished');

    console.log('Lender deposits usdc');
    const lenderDepositAmount = parseUnits('10000', 6);
    await setTokenBalance(
      usdc.address,
      ArbMainnetERC20BalanceOfSlot.USDC,
      EthAddress.parse(lender.address),
      lenderDepositAmount
    );
    await usdc.connect(lender).approve(marginly.address, lenderDepositAmount);
    let tx = await marginly
      .connect(lender)
      .execute(CallType.DepositQuote, lenderDepositAmount, 0, 0, false, ethers.constants.AddressZero, 0);
    console.log(`Lender deposit gas used: ${(await tx.wait()).gasUsed}`);

    const longerDepositAmount = parseUnits('100', 18);
    const longAmount = parseUnits('1000', 18);
    let price = (await marginly.connect(owner).getBasePrice()).inner;
    console.log('Longer1 deposits pt and longs');
    await setTokenBalance(
      ptToken.address,
      ArbMainnetERC20BalanceOfSlot.PTWEETH,
      EthAddress.parse(longer1.address),
      longerDepositAmount
    );
    await ptToken.connect(longer1).approve(marginly.address, longerDepositAmount);
    tx = await marginly
      .connect(longer1)
      .execute(
        CallType.DepositBase,
        longerDepositAmount,
        longAmount,
        price.mul(11).div(10),
        false,
        ethers.constants.AddressZero,
        0
      );

    console.log(`Longer1 depositBase and long gas used: ${(await tx.wait()).gasUsed}`);

    console.log('Longer2 deposits pt and longs');
    await setTokenBalance(
      ptToken.address,
      ArbMainnetERC20BalanceOfSlot.PTWEETH,
      EthAddress.parse(longer2.address),
      longerDepositAmount
    );
    await ptToken.connect(longer2).approve(marginly.address, longerDepositAmount);
    tx = await marginly
      .connect(longer2)
      .execute(
        CallType.DepositBase,
        longerDepositAmount,
        longAmount,
        price.mul(11).div(10),
        false,
        ethers.constants.AddressZero,
        0
      );

    console.log(`Longer2 depositBase and long gas used: ${(await tx.wait()).gasUsed}`);

    const longer3DepositAmount = parseUnits('100', 6);
    console.log('Longer3 deposits usdc and longs');
    await setTokenBalance(
      usdc.address,
      ArbMainnetERC20BalanceOfSlot.USDC,
      EthAddress.parse(longer3.address),
      longer3DepositAmount
    );
    await usdc.connect(longer3).approve(marginly.address, longer3DepositAmount);
    tx = await marginly
      .connect(longer3)
      .execute(
        CallType.DepositQuote,
        longer3DepositAmount,
        longAmount.mul(-1),
        price.mul(12).div(10),
        false,
        ethers.constants.AddressZero,
        0
      );

    console.log(`Longer3 depositQuote and long gas used: ${(await tx.wait()).gasUsed}`);

    console.log('Shorter fails');
    const shortDepositAmount = parseUnits('100', 6);
    await setTokenBalance(
      usdc.address,
      ArbMainnetERC20BalanceOfSlot.USDC,
      EthAddress.parse(shorter.address),
      shortDepositAmount
    );
    await usdc.connect(shorter).approve(marginly.address, shortDepositAmount);
    await expect(
      marginly
        .connect(shorter)
        .execute(
          CallType.DepositQuote,
          shortDepositAmount,
          longAmount,
          price.mul(2),
          false,
          ethers.constants.AddressZero,
          0
        )
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

    console.log("It's too late, time for liquidations: setting maxLeverage as 1");
    params.maxLeverage = 1;
    await marginly.connect(owner).setParameters(params);

    console.log(`Longer2 gets margin called`);
    expect((await marginly.connect(owner).positions(longer2.address))._type).to.be.eq(PositionType.Long);
    await marginly.connect(owner).execute(CallType.Reinit, 0, 0, 0, false, ethers.constants.AddressZero, 0);
    expect((await marginly.connect(owner).positions(longer2.address))._type).to.be.eq(PositionType.Uninitialized);

    console.log(`Liquidator receives longer3 position`);
    const liquidatorDeposit = parseUnits('2000', 6);
    await setTokenBalance(
      usdc.address,
      ArbMainnetERC20BalanceOfSlot.USDC,
      EthAddress.parse(liquidator.address),
      liquidatorDeposit
    );
    await usdc.connect(liquidator).approve(marginly.address, liquidatorDeposit);
    await marginly
      .connect(liquidator)
      .execute(CallType.ReceivePosition, liquidatorDeposit, 0, 0, false, longer3.address, 0);
    expect((await marginly.connect(owner).positions(longer3.address))._type).to.be.eq(PositionType.Uninitialized);
    await marginly
      .connect(liquidator)
      .execute(CallType.WithdrawQuote, parseUnits('1000', 18), 0, 0, false, ethers.constants.AddressZero, 0);
    await marginly
      .connect(liquidator)
      .execute(CallType.WithdrawBase, parseUnits('1000', 18), 0, 0, false, ethers.constants.AddressZero, 0);
  });
});
