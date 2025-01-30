// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/access/Ownable2Step.sol';
import '../interfaces/IMarginlyRouter.sol';
import '../interfaces/IMarginlyAdapter.sol';
import './interfaces/ICurvePool.sol';
import './interfaces/ISpectraErc4626Wrapper.sol';
import './interfaces/ISpectraPrincipalToken.sol';
import './interfaces/IERC4626.sol';

/// @title Adapter for Spectra finance pool (old curve pool) of two tokens IBT/PT
/// @dev Two cases supported:
///      1) Spectra pool PT / sw-IBT for marginly pool PT / IBT.
///             Adapter will wrap/unwrap IBT to sw-IBT during swaps.
///      2) Spectra pool PT / IBT, marginly pool PT / IBT
///      3) Spectra pool PT / IBT, marginly pool PT / Underlying of IBT.
///           Adapter will wrap/unwrap IBT to Underlying. Only for IBT tokens that supports immediate withdraw
contract SpectraAdapter is IMarginlyAdapter, Ownable2Step {
  using SafeERC20 for IERC20;

  error WrongPoolInput();
  error UnknownPair();

  event NewPair(address indexed ptToken, address indexed ibToken, address curvePool);

  // TODO: use this enum
  enum QuoteTokenKind {
    IbtCompatibleWithERC4626,
    IbtNotCompatibleWithERC4626,
    UnderlyingOfIbt
  }

  struct PoolInput {
    /// @dev Address of Principal Token
    address pt;
    /// @dev Address of QuoteToken. Could be IBT or Underlying asset of IBT
    address quoteToken;
    /// @dev Address of spectra curve pool IBT or Spectra Wrapped IBT / PT
    address pool;
  }

  struct PoolData {
    /// @dev Address of spectra curve pool IBT/PT-IBT or sw-IBT/PT-sw-IBT
    address pool;
    /// @dev Address of IBT (or sw-IBT)
    address ibt;
    /// @dev Address of pt token
    address pt;
    /// @dev True if curvePool.coins[0] is ibt, curvePool.coins[1] is pt
    bool zeroIndexCoinIsIbt;
    /// @dev True if QuoteToken is IBT not compatible with ERC4626. Spectra pool PT-sw-IBT / sw-IBT
    bool unwrapSwIbtToIbt;
    /// @dev True if QuoteToken is Underlying and ibt should be unwrapped to underlying token
    bool unwrapIbtToUnderlying;
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

      address coin0 = ICurvePool(input.pool).coins(0);
      address coin1 = ICurvePool(input.pool).coins(1);

      PoolData memory poolData = PoolData({
        pool: input.pool,
        zeroIndexCoinIsIbt: true,
        ibt: coin0,
        pt: coin1,
        unwrapSwIbtToIbt: false,
        unwrapIbtToUnderlying: false
      });

      if (coin1 == input.pt) {
        //check other token is spectra wrapper or not
        if (coin0 != input.quoteToken) {
          if (ISpectraErc4626Wrapper(coin0).vaultShare() == input.quoteToken) {
            poolData.unwrapSwIbtToIbt = true;
          } else if (IERC4626(coin0).asset() == input.quoteToken) {
            poolData.unwrapIbtToUnderlying = true;
          } else {
            revert WrongPoolInput();
          }
        }
      } else if (coin0 == input.pt) {
        if (coin1 != input.quoteToken) {
          if (ISpectraErc4626Wrapper(coin1).vaultShare() == input.quoteToken) {
            poolData.unwrapSwIbtToIbt = true;
          } else if (IERC4626(coin0).asset() == input.quoteToken) {
            poolData.unwrapIbtToUnderlying = true;
          } else {
            revert WrongPoolInput();
          }
        }

        poolData.zeroIndexCoinIsIbt = false;
        poolData.ibt = coin1;
        poolData.pt = coin0;
      } else {
        revert WrongPoolInput();
      }

      getPoolData[input.pt][input.quoteToken] = poolData;
      getPoolData[input.quoteToken][input.pt] = poolData;

      emit NewPair(input.pt, input.quoteToken, input.pool);

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

    if (tokenInIsPt) {
      // PT -> IBT
      address recipient = recipientArg;

      if (poolData.unwrapIbtToUnderlying || poolData.unwrapSwIbtToIbt) {
        // change recipient to address(this), it let make unwrap swIbt for Ibt after swap
        recipient = address(this);
      }

      amountOut = _curveSwapExactInput(poolData.pool, recipient, tokenInArg, tokenInIndex, amountInArg, minAmountOut);

      if (poolData.unwrapSwIbtToIbt) {
        // sw-IBT unwrap to IBT
        amountOut = ISpectraErc4626Wrapper(poolData.ibt).unwrap(amountOut, recipientArg, address(this));
      } else if (poolData.unwrapIbtToUnderlying) {
        // IBT redeem to underlying asset
        amountOut = IERC4626(poolData.ibt).redeem(amountOut, recipientArg, address(this));
      }
    } else {
      // IBT -> PT

      uint256 amountIn = amountInArg;
      address tokenIn = tokenInArg;

      if (poolData.unwrapSwIbtToIbt) {
        // wrap IBT to sw-IBT and change recipient to current address(this)
        IERC20(tokenIn).forceApprove(poolData.ibt, amountInArg);
        amountIn = ISpectraErc4626Wrapper(poolData.ibt).wrap(amountInArg, address(this));
        tokenIn = poolData.ibt; // tokenIn is sw-IBT
      } else if (poolData.unwrapIbtToUnderlying) {
        // wrap Underlying asset to IBT and change recipient to current address(this)
        IERC20(tokenIn).forceApprove(poolData.ibt, amountInArg);
        amountIn = IERC4626(poolData.ibt).deposit(amountInArg, address(this));
        tokenIn = poolData.ibt;
      }

      // swap in curve IBT to PT
      amountOut = _curveSwapExactInput(poolData.pool, recipientArg, tokenIn, tokenInIndex, amountIn, minAmountOut);
    }
  }

  function _swapExactInputPostMaturity(
    PoolData memory poolData,
    address recipient,
    address tokenIn,
    uint256 amountIn
  ) private returns (uint256 amountOut) {
    if (tokenIn == poolData.pt) {
      if (poolData.unwrapSwIbtToIbt) {
        // redeem sw-IBT
        uint256 swAmountOut = ISpectraPrincipalToken(poolData.pt).redeemForIBT(amountIn, address(this), address(this));
        // unwrap sw-IBT to IBT
        amountOut = ISpectraErc4626Wrapper(poolData.ibt).unwrap(swAmountOut, recipient, address(this));
      }
      if (poolData.unwrapIbtToUnderlying) {
        // redeem IBT
        uint ibtAmountOut = ISpectraPrincipalToken(poolData.pt).redeemForIBT(amountIn, recipient, address(this));
        // redeem Underlying
        amountOut = IERC4626(poolData.ibt).redeem(ibtAmountOut, recipient, address(this));
      } else {
        amountOut = ISpectraPrincipalToken(poolData.pt).redeemForIBT(amountIn, recipient, address(this));
      }
    } else {
      // IBT to PT swap is not possible after maturity
      revert NotSupported();
    }
  }

  /// @dev Swap PT to exact amount of IBT. When IBT is SpectraWrapper
  function _swapExactOutputPtToSwIbtToIbtPreMaturity(
    PoolData memory poolData,
    address recipient,
    address ibtOut,
    uint256 ibtAmountOut,
    uint256 maxPtAmountIn
  ) private returns (uint256 ptAmountIn) {
    uint256 tokenInIndex = poolData.zeroIndexCoinIsIbt ? 1 : 0;

    // PT -> sw-IBT -> IBT
    // convert ibAmountOut to swAmountOut
    uint256 swAmountOut = ISpectraErc4626Wrapper(poolData.ibt).previewWrap(ibtAmountOut);

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
    uint256 ibtActualAmountOut = ISpectraErc4626Wrapper(poolData.ibt).unwrap(
      swActualAmountOut,
      address(this),
      address(this)
    );

    IERC20(ibtOut).safeTransfer(recipient, ibtAmountOut);

    if (ibtActualAmountOut < ibtAmountOut) {
      revert TooMuchRequested();
    }

    if (ibtActualAmountOut == ibtAmountOut) {
      return maxPtAmountIn;
    }

    uint256 deltaIbtAmountOut = ibtActualAmountOut - ibtAmountOut;

    // wrap extra amountOut ibt to swIbt
    IERC20(ibtOut).forceApprove(poolData.ibt, deltaIbtAmountOut);
    uint256 deltaSwAmountOut = ISpectraErc4626Wrapper(poolData.ibt).wrap(deltaIbtAmountOut, address(this));

    // swap and move excessive tokenIn directly to recipient.
    // last arg minAmountOut is zero because we made worst allowed by user swap
    // and an additional swap with whichever output only improves it,
    // so the tx shouldn't be reverted
    uint256 excessivePtAmountIn = _curveSwapExactInput(
      poolData.pool,
      recipient,
      poolData.ibt,
      1 - tokenInIndex,
      deltaSwAmountOut,
      0
    );

    ptAmountIn = maxPtAmountIn - excessivePtAmountIn;
  }

  function _swapExactOutputPtToIbtPreMaturity(
    PoolData memory poolData,
    address recipient,
    address ibtOut,
    uint256 ibtAmountOut,
    uint256 maxPtAmountIn
  ) private returns (uint256 ptAmountIn) {
    uint256 tokenInIndex = poolData.zeroIndexCoinIsIbt ? 1 : 0;

    // PT -> IBT
    // swap maxAmountPt to ibt
    uint256 ibtActualAmountOut = _curveSwapExactInput(
      poolData.pool,
      address(this),
      poolData.pt,
      tokenInIndex,
      maxPtAmountIn,
      ibtAmountOut
    );

    IERC20(ibtOut).safeTransfer(recipient, ibtAmountOut);

    if (ibtActualAmountOut < ibtAmountOut) {
      revert TooMuchRequested();
    }

    if (ibtActualAmountOut == ibtAmountOut) {
      return maxPtAmountIn;
    }

    // swap and move excessive tokenIn directly to recipient.
    // last arg minAmountOut is zero because we made worst allowed by user swap
    // and an additional swap with whichever output only improves it,
    // so the tx shouldn't be reverted
    uint256 excessivePtAmountIn = _curveSwapExactInput(
      poolData.pool,
      recipient,
      poolData.ibt,
      1 - tokenInIndex,
      ibtActualAmountOut - ibtAmountOut,
      0
    );

    ptAmountIn = maxPtAmountIn - excessivePtAmountIn;
  }

  /// @dev Swap IBT to exact amount of PT. When IBT is SpectraWrapper
  function _swapExactOutputIbtToSwIbtToPtPreMaturity(
    PoolData memory poolData,
    address recipient,
    address ibtIn,
    uint256 ptAmountOut,
    uint256 maxIbtAmountIn
  ) private returns (uint256 ibAmountIn) {
    // IBT -> sw-IBT -> PT
    uint256 tokenInIndex = poolData.zeroIndexCoinIsIbt ? 0 : 1;

    // wrap ibt to swIbt
    IERC20(ibtIn).forceApprove(poolData.ibt, maxIbtAmountIn);
    uint256 swMaxAmountIn = ISpectraErc4626Wrapper(poolData.ibt).wrap(maxIbtAmountIn, address(this));

    // swap swMaxAmountIn to pt tokens
    uint256 ptActualAmountOut = _curveSwapExactInput(
      poolData.pool,
      address(this),
      poolData.ibt,
      tokenInIndex,
      swMaxAmountIn,
      ptAmountOut
    );

    if (ptActualAmountOut < ptAmountOut) {
      revert TooMuchRequested();
    }

    IERC20(poolData.pt).safeTransfer(recipient, ptAmountOut);

    if (ptActualAmountOut == ptAmountOut) {
      return maxIbtAmountIn;
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
    uint256 excessiveIbAmountIn = ISpectraErc4626Wrapper(poolData.ibt).unwrap(
      excessiveSwAmountIn,
      recipient,
      address(this)
    );
    ibAmountIn = maxIbtAmountIn - excessiveIbAmountIn;
  }

  /// @dev Swap IBT to exact amount of PT
  function _swapExactOutputIbtToPtPreMaturity(
    PoolData memory poolData,
    address recipient,
    address ibtIn,
    uint256 ptAmountOut,
    uint256 maxIbtAmountIn
  ) private returns (uint256 ibAmountIn) {
    uint256 tokenInIndex = poolData.zeroIndexCoinIsIbt ? 0 : 1;

    // IBT -> PT
    // swap all swMaxAmountIn to pt tokens
    uint256 ptActualAmountOut = _curveSwapExactInput(
      poolData.pool,
      address(this),
      ibtIn,
      tokenInIndex,
      maxIbtAmountIn,
      ptAmountOut
    );

    if (ptActualAmountOut < ptAmountOut) {
      revert TooMuchRequested();
    }

    IERC20(poolData.pt).safeTransfer(recipient, ptAmountOut);

    if (ptActualAmountOut == ptAmountOut) {
      return maxIbtAmountIn;
    }

    uint256 deltaPtAmountOut = ptActualAmountOut - ptAmountOut;
    // swap and move excessive tokenIn
    // last arg minAmountOut is zero because we made worst allowed by user swap
    // and an additional swap with whichever output only improves it,
    // so the tx shouldn't be reverted
    uint256 excessiveIbtAmountIn = _curveSwapExactInput(
      poolData.pool,
      recipient,
      poolData.pt,
      1 - tokenInIndex,
      deltaPtAmountOut,
      0
    );

    ibAmountIn = maxIbtAmountIn - excessiveIbtAmountIn;
  }

  function _swapExactOutputPostMaturity(
    PoolData memory poolData,
    address recipient,
    address tokenOut,
    uint256 amountOut,
    uint256 maxAmountIn
  ) private returns (uint256 amountIn) {
    if (tokenOut == poolData.pt) {
      // swap IBT to PT is not possible after maturity
      revert NotSupported();
    } else {
      if (poolData.unwrapSwIbtToIbt) {
        // PT withdraw to sw-IBT, then unwrap sw-IBT to IBT
        // calc sw-IBT amount from amountOut
        uint256 swAmountOut = ISpectraErc4626Wrapper(poolData.ibt).previewUnwrap(amountOut);
        amountIn = ISpectraPrincipalToken(poolData.pt).withdrawIBT(swAmountOut, address(this), address(this));

        uint256 actualAmountOut = ISpectraErc4626Wrapper(poolData.ibt).unwrap(
          swAmountOut,
          address(this),
          address(this)
        );
        if (actualAmountOut < amountOut) revert InsufficientAmount();

        // actualAmountOut could be more than amountOut, but it's not possible to change it back to PT aftrer maturity
        // dust may be left on the contract
        IERC20(tokenOut).safeTransfer(recipient, amountOut);

        if (maxAmountIn == amountIn) {
          return amountIn;
        }

        // return rest of PT token back to recipient
        IERC20(poolData.pt).safeTransfer(recipient, maxAmountIn - amountIn);
      } else if (poolData.unwrapIbtToUnderlying) {
        // PT withdraw to sw-IBT, then unwrap sw-IBT to IBT
        // calc sw-IBT amount from amountOut
        uint256 ibtAmountOut = IERC4626(poolData.ibt).previewMint(amountOut);
        amountIn = ISpectraPrincipalToken(poolData.pt).withdrawIBT(ibtAmountOut, address(this), address(this));

        uint256 actualAmountOut = ISpectraErc4626Wrapper(poolData.ibt).unwrap(
          swAmountOut,
          address(this),
          address(this)
        );
        if (actualAmountOut < amountOut) revert InsufficientAmount();

        // actualAmountOut could be more than amountOut, but it's not possible to change it back to PT aftrer maturity
        // dust may be left on the contract
        IERC20(tokenOut).safeTransfer(recipient, amountOut);

        if (maxAmountIn == amountIn) {
          return amountIn;
        }

        // return rest of PT token back to recipient
        IERC20(poolData.pt).safeTransfer(recipient, maxAmountIn - amountIn);
      } else {
        amountIn = ISpectraPrincipalToken(poolData.pt).withdrawIBT(amountOut, recipient, address(this));

        if (maxAmountIn == amountIn) {
          return amountIn;
        }
        IERC20(poolData.pt).safeTransfer(recipient, maxAmountIn - amountIn);
      }
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
      amountOut = _swapExactInputPostMaturity(poolData, recipient, tokenIn, amountIn);
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
        if (poolData.unwrapSwIbtToIbt) {
          amountIn = _swapExactOutputPtToSwIbtToIbtPreMaturity(poolData, recipient, tokenOut, amountOut, maxAmountIn);
        } else if (poolData.unwrapIbtToUnderlying) {
          amountIn = 0; // _swapExactOutputPtToIbtToUnderlyingPreMaturity(...) TODO: not implemented
        } else {
          amountIn = _swapExactOutputPtToIbtPreMaturity(poolData, recipient, tokenOut, amountOut, maxAmountIn);
        }
      } else {
        if (poolData.unwrapSwIbtToIbt) {
          amountIn = _swapExactOutputIbtToSwIbtToPtPreMaturity(poolData, recipient, tokenIn, amountOut, maxAmountIn);
        } else if (poolData.unwrapIbtToUnderlying) {
          amountIn = 0; //_swapExactOutputUnderlyingToIbtToPtPreMaturity(...);    TODO: not implemented
        } else {
          amountIn = _swapExactOutputIbtToPtPreMaturity(poolData, recipient, tokenIn, amountOut, maxAmountIn);
        }
      }
    }
  }

  function addPools(PoolInput[] calldata poolsData) external onlyOwner {
    _addPools(poolsData);
  }

  /// @dev During swap Pt to exact SW after maturity a little amount of sw-ibt might stay at the adapter contract
  function sweepDust(address token, address recipient) external onlyOwner {
    uint256 dust = IERC20(token).balanceOf(address(this));
    IERC20(token).safeTransfer(recipient, dust);
  }
}
