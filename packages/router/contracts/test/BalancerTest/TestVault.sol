// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import '../../adapters/BalancerAdapter.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';

contract TestVault is IVault {
  uint256 public price = 10;

  function swap(
    SingleSwap memory singleSwap,
    FundManagement memory funds,
    uint256 limit,
    uint256 deadline
  ) external payable returns (uint256 amountCalculated) {
    IERC20 tokenIn = IERC20(address(singleSwap.assetIn));
    IERC20 tokenOut = IERC20(address(singleSwap.assetOut));

    SwapRequest memory poolRequest;
    poolRequest.poolId = singleSwap.poolId;
    poolRequest.kind = singleSwap.kind;
    poolRequest.tokenIn = tokenIn;
    poolRequest.tokenOut = tokenOut;
    poolRequest.amount = singleSwap.amount;
    poolRequest.userData = singleSwap.userData;
    poolRequest.from = funds.sender;
    poolRequest.to = funds.recipient;

    uint256 amountIn;
    uint256 amountOut;

    (amountCalculated, amountIn, amountOut) = _swapWithPool(poolRequest);
    require(singleSwap.kind == SwapKind.GIVEN_IN ? amountOut >= limit : amountIn <= limit, 'SWAP_LIMIT');

    // _receiveAsset(singleSwap.assetIn, amountIn, funds.sender, funds.fromInternalBalance);
    TransferHelper.safeTransferFrom(address(singleSwap.assetIn), msg.sender, address(this), amountIn);
    // _sendAsset(singleSwap.assetOut, amountOut, funds.recipient, funds.toInternalBalance);
    TransferHelper.safeTransfer(address(singleSwap.assetOut), funds.recipient, amountOut);
  }

  function _swapWithPool(
    SwapRequest memory request
  ) private returns (uint256 amountCalculated, uint256 amountIn, uint256 amountOut) {
    address pool = _getPoolAddress(request.poolId);
    PoolSpecialization specialization = _getPoolSpecialization(request.poolId);

    if (specialization == PoolSpecialization.TWO_TOKEN) {
      amountCalculated = _processTwoTokenPoolSwapRequest(request, IMinimalSwapInfoPool(pool));
    } else if (specialization == PoolSpecialization.MINIMAL_SWAP_INFO) {
      amountCalculated = _processMinimalSwapInfoPoolSwapRequest(request, IMinimalSwapInfoPool(pool));
    } else {
      // PoolSpecialization.GENERAL
      amountCalculated = _processGeneralPoolSwapRequest(request, IGeneralPool(pool));
    }

    (amountIn, amountOut) = _getAmounts(request.kind, request.amount, amountCalculated);
  }

  function _processTwoTokenPoolSwapRequest(
    SwapRequest memory request,
    IMinimalSwapInfoPool pool
  ) private returns (uint256 amountCalculated) {
    bytes32 tokenInBalance = bytes32(IERC20(request.tokenIn).balanceOf(address(this)));
    bytes32 tokenOutBalance = bytes32(IERC20(request.tokenOut).balanceOf(address(this)));

    (tokenInBalance, tokenOutBalance, amountCalculated) = _callMinimalSwapInfoPoolOnSwapHook(
      request,
      pool,
      tokenInBalance,
      tokenOutBalance
    );
  }

  function _processMinimalSwapInfoPoolSwapRequest(
    SwapRequest memory request,
    IMinimalSwapInfoPool pool
  ) private returns (uint256 amountCalculated) {
    bytes32 tokenInBalance = bytes32(IERC20(request.tokenIn).balanceOf(_getPoolAddress(request.poolId)));
    bytes32 tokenOutBalance = bytes32(IERC20(request.tokenOut).balanceOf(_getPoolAddress(request.poolId)));

    (tokenInBalance, tokenOutBalance, amountCalculated) = _callMinimalSwapInfoPoolOnSwapHook(
      request,
      pool,
      tokenInBalance,
      tokenOutBalance
    );
  }

  function _processGeneralPoolSwapRequest(
    SwapRequest memory request,
    IGeneralPool pool
  ) private returns (uint256 amountCalculated) {
    bytes32 tokenInBalance = bytes32(IERC20(request.tokenIn).balanceOf(_getPoolAddress(request.poolId)));
    bytes32 tokenOutBalance = bytes32(IERC20(request.tokenOut).balanceOf(_getPoolAddress(request.poolId)));

    uint256 indexIn;
    uint256 indexOut;

    indexIn = request.tokenIn < request.tokenOut ? 0 : 1;
    indexOut = request.tokenIn < request.tokenOut ? 1 : 0;

    uint256[] memory currentBalances = new uint256[](2);
    currentBalances[0] = uint256(tokenInBalance);
    currentBalances[1] = uint256(tokenOutBalance);
    amountCalculated = onSwap(request);
    (uint256 amountIn, uint256 amountOut) = _getAmounts(request.kind, request.amount, amountCalculated);
  }

  function _getAmounts(
    SwapKind kind,
    uint256 amountGiven,
    uint256 amountCalculated
  ) private pure returns (uint256 amountIn, uint256 amountOut) {
    if (kind == SwapKind.GIVEN_IN) {
      (amountIn, amountOut) = (amountGiven, amountCalculated);
    } else {
      // SwapKind.GIVEN_OUT
      (amountIn, amountOut) = (amountCalculated, amountGiven);
    }
  }

  function _callMinimalSwapInfoPoolOnSwapHook(
    SwapRequest memory request,
    IMinimalSwapInfoPool pool,
    bytes32 tokenInBalance,
    bytes32 tokenOutBalance
  ) internal returns (bytes32 newTokenInBalance, bytes32 newTokenOutBalance, uint256 amountCalculated) {
    uint256 tokenInTotal = uint256(tokenInBalance);
    uint256 tokenOutTotal = uint256(tokenOutBalance);
    amountCalculated = onSwap(request);
    (uint256 amountIn, uint256 amountOut) = _getAmounts(request.kind, request.amount, amountCalculated);
  }

  function _getPoolAddress(bytes32 poolId) internal pure returns (address) {
    return address(uint160(uint256(poolId) >> (12 * 8)));
  }

  function _getPoolSpecialization(bytes32 poolId) internal pure returns (PoolSpecialization specialization) {
    uint256 value = uint256(poolId >> (10 * 8)) & (2 ** (2 * 8) - 1);
    require(value < 3, 'Errors.INVALID_POOL_ID');
    // solhint-disable-next-line no-inline-assembly
    assembly {
      specialization := value
    }
  }

  function onSwap(SwapRequest memory request) private view returns (uint256 amountCalculated) {
    if ((request.kind == SwapKind.GIVEN_IN && request.tokenIn < request.tokenOut)) {
      amountCalculated = price * request.amount;
    } else if ((request.kind == SwapKind.GIVEN_IN && request.tokenIn > request.tokenOut)) {
      amountCalculated = request.amount / price;
    } else if ((request.kind == SwapKind.GIVEN_OUT && request.tokenIn > request.tokenOut)) {
      amountCalculated = price * request.amount;
    } else if ((request.kind == SwapKind.GIVEN_OUT && request.tokenIn < request.tokenOut)) {
      amountCalculated = request.amount / price;
    }
  }
}

struct SwapRequest {
  SwapKind kind;
  IERC20 tokenIn;
  IERC20 tokenOut;
  uint256 amount;
  // Misc data
  bytes32 poolId;
  uint256 lastChangeBlock;
  address from;
  address to;
  bytes userData;
}

enum PoolSpecialization {
  GENERAL,
  MINIMAL_SWAP_INFO,
  TWO_TOKEN
}

interface IMinimalSwapInfoPool {
  function onSwap(
    SwapRequest memory swapRequest,
    uint256 currentBalanceTokenIn,
    uint256 currentBalanceTokenOut
  ) external returns (uint256 amount);
}

interface IGeneralPool {
  function onSwap(
    SwapRequest memory swapRequest,
    uint256[] memory balances,
    uint256 indexIn,
    uint256 indexOut
  ) external returns (uint256 amount);
}
