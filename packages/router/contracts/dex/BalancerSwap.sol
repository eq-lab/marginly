// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';

import './dex.sol';

abstract contract BalancerSwap is DexFactoryList {
  function balancerSwapExactInput(
    Dex dex,
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut
  ) internal returns (uint256 amountOut) {
    SingleSwap memory swap;
    // poolRequest.poolId = poolId;
    swap.poolId = bytes32(0);
    swap.kind = SwapKind.GIVEN_IN;
    swap.amount = amountIn;
    swap.assetIn = IAsset(tokenIn);
    swap.assetOut = IAsset(tokenOut);

    FundManagement memory funds;
    funds.sender = msg.sender;
    funds.recipient = payable(msg.sender);

    TransferHelper.safeTransferFrom(tokenIn, msg.sender, address(this), amountIn);
    TransferHelper.safeApprove(tokenIn, dexFactoryList[dex], amountIn);
    amountOut = IVault(dexFactoryList[dex]).swap(swap, funds, minAmountOut, block.timestamp);
    require(amountOut > minAmountOut, 'Insufficient amount');

    // receiveAsset(tokenIn, amountIn, funds.sender, funds.fromInternalBalance);
    // sendAsset(tokenOut, amountOut, funds.recipient, funds.toInternalBalance);
  }

  function balancerSwapExactOutput(
    Dex dex,
    address tokenIn,
    address tokenOut,
    uint256 maxAmountIn,
    uint256 amountOut
  ) internal returns (uint256 amountIn) {
    SingleSwap memory swap;
    // poolRequest.poolId = poolId;
    swap.poolId = bytes32(0);
    swap.kind = SwapKind.GIVEN_OUT;
    swap.amount = amountOut;
    swap.assetIn = IAsset(tokenIn);
    swap.assetOut = IAsset(tokenOut);

    FundManagement memory funds;
    funds.sender = address(this);
    funds.recipient = payable(msg.sender);

    TransferHelper.safeTransferFrom(tokenIn, msg.sender, address(this), maxAmountIn);
    TransferHelper.safeApprove(tokenIn, dexFactoryList[dex], maxAmountIn);
    amountIn = IVault(dexFactoryList[dex]).swap(swap, funds, maxAmountIn, block.timestamp);
    require(amountIn <= maxAmountIn, 'Too much requested');
    TransferHelper.safeApprove(tokenIn, dexFactoryList[dex], 0);
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
