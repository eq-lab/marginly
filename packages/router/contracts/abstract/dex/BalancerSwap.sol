// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';

import '../Dex.sol';

abstract contract BalancerSwap is DexPoolMapping {
  address public immutable balancerVault;

  constructor(address _balancerVault) {
    balancerVault = _balancerVault;
  }

  function balancerSwapExactInput(
    Dex dex,
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut
  ) internal returns (uint256 amountOut) {
    address pool = dexPoolMapping[dex][tokenIn][tokenOut];
    SingleSwap memory swap;
    swap.poolId = IBasePool(pool).getPoolId();
    swap.kind = SwapKind.GIVEN_IN;
    swap.amount = amountIn;
    swap.assetIn = IAsset(tokenIn);
    swap.assetOut = IAsset(tokenOut);

    FundManagement memory funds;
    funds.sender = address(this);
    funds.recipient = payable(msg.sender);

    TransferHelper.safeTransferFrom(tokenIn, msg.sender, address(this), amountIn);
    TransferHelper.safeApprove(tokenIn, balancerVault, amountIn);
    amountOut = IVault(balancerVault).swap(swap, funds, minAmountOut, block.timestamp);
    require(amountOut >= minAmountOut, 'Insufficient amount');
  }

  function balancerSwapExactOutput(
    Dex dex,
    address tokenIn,
    address tokenOut,
    uint256 maxAmountIn,
    uint256 amountOut
  ) internal returns (uint256 amountIn) {
    address pool = dexPoolMapping[dex][tokenIn][tokenOut];
    SingleSwap memory swap;
    swap.poolId = IBasePool(pool).getPoolId();
    swap.kind = SwapKind.GIVEN_OUT;
    swap.amount = amountOut;
    swap.assetIn = IAsset(tokenIn);
    swap.assetOut = IAsset(tokenOut);

    FundManagement memory funds;
    funds.sender = address(this);
    funds.recipient = payable(msg.sender);

    TransferHelper.safeTransferFrom(tokenIn, msg.sender, address(this), maxAmountIn);
    TransferHelper.safeApprove(tokenIn, balancerVault, maxAmountIn);
    amountIn = IVault(balancerVault).swap(swap, funds, maxAmountIn, block.timestamp);
    require(amountIn <= maxAmountIn, 'Too much requested');
    TransferHelper.safeApprove(tokenIn, balancerVault, 0);
    TransferHelper.safeTransfer(tokenIn, msg.sender, maxAmountIn - amountIn);
  }
}

struct FundManagement {
  address sender;
  bool fromInternalBalance;
  address payable recipient;
  bool toInternalBalance;
}

struct SingleSwap {
  bytes32 poolId;
  SwapKind kind;
  IAsset assetIn;
  IAsset assetOut;
  uint256 amount;
  bytes userData;
}

enum SwapKind {
  GIVEN_IN,
  GIVEN_OUT
}

interface IVault {
  function swap(
    SingleSwap memory singleSwap,
    FundManagement memory funds,
    uint256 limit,
    uint256 deadline
  ) external payable returns (uint256);
}

interface IAsset {
  // solhint-disable-previous-line no-empty-blocks
}

interface IBasePool {
  function getPoolId() external view returns (bytes32);
}
