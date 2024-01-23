import { BigNumber, ethers } from 'ethers';

export function encodeLiquidationParams(
  asset: string,
  amount: BigNumber,
  marginlyPool: string,
  positionToLiquidate: string,
  liquidator: string,
  uniswapPool: string,
  minProfit: BigNumber,
  swapCallData: BigNumber
): string {
  /**
       *  address asset;
        uint256 amount;
        address marginlyPool;
        address positionToLiquidate;
        address liquidator;
        address uniswapPool;
        uint256 minProfit;
        uint256 swapCallData;
       */

  return ethers.utils.defaultAbiCoder.encode(
    ['address', 'uint256', 'address', 'address', 'address', 'address', 'uint256', 'uint256'],
    [asset, amount, marginlyPool, positionToLiquidate, liquidator, uniswapPool, minProfit, swapCallData]
  );
}
