// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '../interfaces/IMarginlyRouter.sol';
import '../interfaces/IMarginlyAdapter.sol';
import './interfaces/ICurvePool.sol';

import 'hardhat/console.sol';

interface ISpectraPrincipalToken {
  /**
   * @notice Returns the unix timestamp (uint256) at which the PT contract expires
   * @return The unix timestamp (uint256) when PTs become redeemable
   */
  function maturity() external view returns (uint256);

  /**
   * @notice Burns owner's shares (PTs and YTs before expiry, PTs after expiry)
   * and sends IBTs to receiver
   * @param shares The amount of shares to burn
   * @param receiver The address that will receive the IBTs
   * @param owner The owner of the shares
   * @return ibts The actual amount of IBT received for burning the shares
   */
  function redeemForIBT(uint256 shares, address receiver, address owner) external returns (uint256 ibts);

  /**
   * @notice Burns owner's shares (PTs and YTs before expiry, PTs after expiry)
   * and sends IBTs to receiver
   * @param shares The amount of shares to burn
   * @param receiver The address that will receive the IBTs
   * @param owner The owner of the shares
   * @param minIbts The minimum IBTs that should be returned to user
   * @return ibts The actual amount of IBT received for burning the shares
   */
  function redeemForIBT(
    uint256 shares,
    address receiver,
    address owner,
    uint256 minIbts
  ) external returns (uint256 ibts);

  /**
   * @notice Burns owner's shares (before expiry : PTs and YTs) and sends IBTs to receiver
   * @param ibts The amount of IBT to be received
   * @param receiver The address that will receive the IBTs
   * @param owner The owner of the shares (PTs and YTs)
   * @return shares The actual amount of shares burnt for receiving the IBTs
   */
  function withdrawIBT(uint256 ibts, address receiver, address owner) external returns (uint256 shares);

  /**
   * @notice Burns owner's shares (before expiry : PTs and YTs) and sends IBTs to receiver
   * @param ibts The amount of IBT to be received
   * @param receiver The address that will receive the IBTs
   * @param owner The owner of the shares (PTs and YTs)
   * @param maxShares The maximum shares allowed to be burnt
   * @return shares The actual amount of shares burnt for receiving the IBTs
   */
  function withdrawIBT(
    uint256 ibts,
    address receiver,
    address owner,
    uint256 maxShares
  ) external returns (uint256 shares);
}

interface ISpectra4626Wrapper {
  /// @dev Returns the address of the wrapped vault share.
  function vaultShare() external view returns (address);

  /// @dev Allows the owner to deposit vault shares into the wrapper.
  /// @param vaultShares The amount of vault shares to deposit.
  /// @param receiver The address to receive the wrapper shares.
  /// @return The amount of minted wrapper shares.
  function wrap(uint256 vaultShares, address receiver) external returns (uint256);

  /// @dev Allows the owner to deposit vault shares into the wrapper, with support for slippage protection.
  /// @param vaultShares The amount of vault shares to deposit.
  /// @param receiver The address to receive the wrapper shares.
  /// @param minShares The minimum allowed wrapper shares from this deposit.
  /// @return The amount of minted wrapper shares.
  function wrap(uint256 vaultShares, address receiver, uint256 minShares) external returns (uint256);

  /// @dev Allows the owner to withdraw vault shares from the wrapper.
  /// @param shares The amount of wrapper shares to redeem.
  /// @param receiver The address to receive the vault shares.
  /// @param owner The address of the owner of the wrapper shares.
  /// @return The amount of withdrawn vault shares.
  function unwrap(uint256 shares, address receiver, address owner) external returns (uint256);

  /// @dev Allows the owner to withdraw vault shares from the wrapper, with support for slippage protection.
  /// @param shares The amount of wrapper shares to redeem.
  /// @param receiver The address to receive the vault shares.
  /// @param owner The address of the owner of the wrapper shares.
  /// @param minVaultShares The minimum vault shares that should be returned.
  /// @return The amount of withdrawn vault shares.
  function unwrap(uint256 shares, address receiver, address owner, uint256 minVaultShares) external returns (uint256);

  /// @dev Allows to preview the amount of minted wrapper shares for a given amount of deposited vault shares.
  /// @param vaultShares The amount of vault shares to deposit.
  /// @return The amount of minted vault shares.
  function previewWrap(uint256 vaultShares) external view returns (uint256);

  /// @dev Allows to preview the amount of withdrawn vault shares for a given amount of redeemed wrapper shares.
  /// @param shares The amount of wrapper shares to redeem.
  /// @return The amount of withdrawn vault shares.
  function previewUnwrap(uint256 shares) external view returns (uint256);
}

///@notice Adapter for Spectra Curve pool of two tokens SpectraWrapped IBT and PT
///        but adapter for IBT and PT
contract SpectraSWIbtPtCurveAdapter is IMarginlyAdapter {
  using SafeERC20 for IERC20;

  error WrongPoolInput();
  error UnknownPair();

  event NewPair(address indexed ptToken, address indexed ibToken, address curvePool);

  struct PoolInput {
    address ibToken; // interest bearing token uniBTC
    address ptToken; // principal token, ex PT-uniBTC
    address pool; // curve pool for swIbt and PT
  }

  struct PoolData {
    address pool;
    bool zeroIndexCoinIsIbt; // curvePool.coins[0] is ibt, curvePool.coins[1] is pt
    address swIbt; // address of spectraWrappedIBT
    address pt; // address of pt token
  }

  mapping(address => mapping(address => PoolData)) public getPoolData;

  constructor(PoolInput[] memory pools) {
    _addPools(pools);
  }

  function _addPools(PoolInput[] memory pools) private {
    PoolInput memory input;
    uint256 length = pools.length;
    for (uint256 i; i < length; ) {
      input = pools[i];

      if (input.ibToken == address(0) || input.ptToken == address(0) || input.pool == address(0))
        revert WrongPoolInput();

      address coin0 = ICurvePool(input.pool).coins(0);
      address coin1 = ICurvePool(input.pool).coins(1);

      PoolData memory poolData = PoolData({pool: input.pool, zeroIndexCoinIsIbt: true, swIbt: coin0, pt: coin1});

      if (coin1 == input.ptToken) {
        if (ISpectra4626Wrapper(coin0).vaultShare() != input.ibToken) revert WrongPoolInput();
      } else if (coin0 == input.ptToken) {
        if (ISpectra4626Wrapper(coin1).vaultShare() != input.ibToken) revert WrongPoolInput();

        poolData.zeroIndexCoinIsIbt = false;
        poolData.swIbt = coin1;
        poolData.pt = coin0;
      } else {
        revert WrongPoolInput();
      }

      getPoolData[input.ptToken][input.ibToken] = poolData;
      getPoolData[input.ibToken][input.ptToken] = poolData;

      emit NewPair(input.ptToken, input.ibToken, input.pool);

      unchecked {
        ++i;
      }
    }
  }

  function _getPoolDataSafe(address tokenA, address tokenB) private view returns (PoolData memory poolData) {
    poolData = getPoolData[tokenA][tokenB];
    if (poolData.pool == address(0)) revert UnknownPair();
  }

  function _swapExactInputPreMaturity(
    PoolData memory poolData,
    address recipientArg,
    address tokenInArg,
    uint256 amountInArg,
    uint256 minAmountOut
  ) private returns (uint256 amountOut) {
    bool tokenInIsPt = tokenInArg == poolData.pt;
    uint256 tokenInIndex = poolData.zeroIndexCoinIsIbt && tokenInIsPt ? 1 : 0;

    address tokenIn = tokenInArg;
    uint256 amountIn = amountInArg;
    address recipient = recipientArg;

    if (!tokenInIsPt) {
      // wrap ib to swIbt and change reciptient to current address(this) to let contract unwrap
      IERC20(tokenIn).forceApprove(poolData.swIbt, amountInArg);
      amountIn = ISpectra4626Wrapper(poolData.swIbt).wrap(amountInArg, address(this));
      tokenIn = poolData.swIbt;
    } else {
      // change recipient to address(this), it let make unwrap swIbt for Ibt after swap
      recipient = address(this);
    }

    amountOut = _curveSwapExactInput(poolData.pool, recipient, tokenIn, tokenInIndex, amountIn, minAmountOut);

    if (tokenInIsPt) {
      // unwrap swIbt to ib
      amountOut = ISpectra4626Wrapper(poolData.swIbt).unwrap(amountOut, recipientArg, address(this));
    }
  }

  function _swapExactInputPostMaturiy(
    PoolData memory poolData,
    address recipient,
    address tokenIn,
    uint256 amountIn
  ) private returns (uint256 amountOut) {
    if (tokenIn == poolData.pt) {
      uint256 swAmountOut = ISpectraPrincipalToken(poolData.pt).redeemForIBT(amountIn, address(this), address(this));
      amountOut = ISpectra4626Wrapper(poolData.swIbt).unwrap(swAmountOut, recipient, address(this));
    } else {
      // swIbt to pt swap is not possible after maturity
      revert NotSupported();
    }
  }

  /// @notice Swap maxAmountIn of pt token for swIbt token,
  ///         unwrap swIbt token to ibt
  ///         check excessive amount out and wrap back to swIbt
  ///         swap excessive amount swIbt to pt
  ///         transfer pt to recipient
  function _swapExactOutputPtToIbtPreMaturity(
    PoolData memory poolData,
    address recipient,
    address ibOut,
    uint256 ibAmountOut,
    uint256 maxPtAmountIn
  ) private returns (uint256 ptAmountIn) {
    uint256 tokenInIndex = poolData.zeroIndexCoinIsIbt ? 1 : 0;

    // convert ibAmountOut to swAmountOut
    uint256 swAmountOut = ISpectra4626Wrapper(poolData.swIbt).previewWrap(ibAmountOut);

    // swap maxAmountPt to swIbt
    uint256 swActualAmountOut = _curveSwapExactInput(
      poolData.pool,
      address(this),
      poolData.pt,
      tokenInIndex,
      maxPtAmountIn,
      swAmountOut
    );

    // unwrap swIbt to ibt
    uint256 ibActualAmountOut = ISpectra4626Wrapper(poolData.swIbt).unwrap(
      swActualAmountOut,
      address(this),
      address(this)
    );

    IERC20(ibOut).safeTransfer(recipient, ibAmountOut);

    if (ibActualAmountOut < ibAmountOut) {
      revert TooMuchRequested();
    }

    if (ibActualAmountOut == ibAmountOut) {
      return maxPtAmountIn;
    }

    uint256 deltaIbAmountOut = ibActualAmountOut - ibAmountOut;

    // wrap extra amountOut ibt to swIbt
    IERC20(ibOut).forceApprove(poolData.swIbt, deltaIbAmountOut);
    uint256 deltaSwAmountOut = ISpectra4626Wrapper(poolData.swIbt).wrap(deltaIbAmountOut, address(this));

    // swap and move excessive tokenIn directly to recipient.
    // last arg minAmountOut is zero because we made worst allowed by user swap
    // and an additional swap with whichever output only improves it,
    // so the tx shouldn't be reverted
    uint256 excessivePtAmountIn = _curveSwapExactInput(
      poolData.pool,
      recipient,
      poolData.swIbt,
      1 - tokenInIndex,
      deltaSwAmountOut,
      0
    );

    ptAmountIn = maxPtAmountIn - excessivePtAmountIn;
  }

  function _swapExactOutputIbtToPtPreMaturity(
    PoolData memory poolData,
    address recipient,
    address ibIn,
    uint256 ptAmountOut,
    uint256 maxIbAmountIn
  ) private returns (uint256 ibAmountIn) {
    uint256 tokenInIndex = poolData.zeroIndexCoinIsIbt ? 0 : 1;

    // wrap ibt to swIbt
    IERC20(ibIn).forceApprove(poolData.swIbt, maxIbAmountIn);
    uint256 swMaxAmountIn = ISpectra4626Wrapper(poolData.swIbt).wrap(maxIbAmountIn, address(this));

    // swap all swMaxAmountIn to pt tokens
    uint256 ptActualAmountOut = _curveSwapExactInput(
      poolData.pool,
      address(this),
      poolData.swIbt,
      tokenInIndex,
      swMaxAmountIn,
      ptAmountOut
    );

    if (ptActualAmountOut < ptAmountOut) {
      revert TooMuchRequested();
    }

    IERC20(poolData.pt).safeTransfer(recipient, ptAmountOut);

    if (ptActualAmountOut == ptAmountOut) {
      return maxIbAmountIn;
    }

    uint256 deltaPtAmountOut = ptActualAmountOut - ptAmountOut;
    // swap and move excessive tokenIn
    // last arg minAmountOut is zero because we made worst allowed by user swap
    // and an additional swap with whichever output only improves it,
    // so the tx shouldn't be reverted
    uint256 excessiveSwAmountIn = _curveSwapExactInput(
      poolData.pool,
      address(this),
      poolData.pt,
      1 - tokenInIndex,
      deltaPtAmountOut,
      0
    );
    // unwrap exessive sw into ib and transfer back to recipient
    uint256 excessiveIbAmountIn = ISpectra4626Wrapper(poolData.swIbt).unwrap(
      excessiveSwAmountIn,
      recipient,
      address(this)
    );
    ibAmountIn = maxIbAmountIn - excessiveIbAmountIn;
  }

  function _swapExactOutputPostMaturity(
    PoolData memory poolData,
    address recipient,
    address tokenOut,
    uint256 amountOut,
    uint256 maxAmountIn
  ) private returns (uint256 amountIn) {
    if (tokenOut == poolData.pt) {
      // swap swIbt to pt is not possible after maturity
      revert NotSupported();
    } else {
      // calc swAmount from amountOut
      uint256 swAmountOut = ISpectra4626Wrapper(poolData.swIbt).previewWrap(amountOut);

      amountIn = ISpectraPrincipalToken(poolData.pt).withdrawIBT(swAmountOut, address(this), address(this));
      uint256 actualAmountOut = ISpectra4626Wrapper(poolData.swIbt).unwrap(swAmountOut, address(this), address(this));

      if (actualAmountOut < amountOut) revert InsufficientAmount();

      // actualAmountOut could be more than amountOut, but it's not possible to change it back to PT aftrer maturity
      // dust may be left on the contract
      IERC20(tokenOut).safeTransfer(recipient, amountOut);

      if (maxAmountIn == amountIn) {
        return amountIn;
      }

      // return tokenIn pt-uniBTC back to recipient
      IERC20(poolData.pt).safeTransfer(recipient, maxAmountIn - amountIn);
    }
  }

  function _curveSwapExactInput(
    address poolAddress,
    address recipient,
    address tokenIn,
    uint256 tokenInIndex,
    uint256 amountIn,
    uint256 minAmountOut
  ) private returns (uint256 amountOut) {
    SafeERC20.forceApprove(IERC20(tokenIn), poolAddress, amountIn);

    amountOut = ICurvePool(poolAddress).exchange(
      tokenInIndex,
      1 - tokenInIndex,
      amountIn,
      minAmountOut,
      false,
      recipient
    );
  }

  function _ptIsExpired(address pt) private view returns (bool) {
    return ISpectraPrincipalToken(pt).maturity() < block.timestamp;
  }

  function swapExactInput(
    address recipient,
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut,
    bytes calldata data
  ) external returns (uint256 amountOut) {
    PoolData memory poolData = _getPoolDataSafe(tokenIn, tokenOut);

    // move all input tokens from router to this adapter
    IMarginlyRouter(msg.sender).adapterCallback(address(this), amountIn, data);

    if (_ptIsExpired(poolData.pt)) {
      amountOut = _swapExactInputPostMaturiy(poolData, recipient, tokenIn, amountIn);
    } else {
      amountOut = _swapExactInputPreMaturity(poolData, recipient, tokenIn, amountIn, minAmountOut);
    }

    if (amountOut < minAmountOut) revert InsufficientAmount();
  }

  function swapExactOutput(
    address recipient,
    address tokenIn,
    address tokenOut,
    uint256 maxAmountIn,
    uint256 amountOut,
    bytes calldata data
  ) external returns (uint256 amountIn) {
    PoolData memory poolData = _getPoolDataSafe(tokenIn, tokenOut);

    IMarginlyRouter(msg.sender).adapterCallback(address(this), maxAmountIn, data);

    if (_ptIsExpired(poolData.pt)) {
      amountIn = _swapExactOutputPostMaturity(poolData, recipient, tokenOut, amountOut, maxAmountIn);
    } else {
      if (tokenIn == poolData.pt) {
        amountIn = _swapExactOutputPtToIbtPreMaturity(poolData, recipient, tokenOut, amountOut, maxAmountIn);
      } else {
        amountIn = _swapExactOutputIbtToPtPreMaturity(poolData, recipient, tokenIn, amountOut, maxAmountIn);
      }
    }
  }

  function addPools(PoolInput[] calldata poolsData) external {
    _addPools(poolsData);
  }
}
