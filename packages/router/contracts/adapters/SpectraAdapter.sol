// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/access/Ownable2Step.sol';
import '@openzeppelin/contracts/interfaces/IERC4626.sol';

import '../interfaces/IMarginlyRouter.sol';
import '../interfaces/IMarginlyAdapter.sol';
import './interfaces/ICurvePool.sol';
import './interfaces/ISpectraErc4626Wrapper.sol';
import './interfaces/ISpectraPrincipalToken.sol';

/// @title Adapter for Spectra finance pool (old curve pool) of two tokens IBT/PT
/// @dev Two cases supported:
///      1) Spectra pool PT / sw-IBT, marginly pool PT / IBT.
///             Adapter will wrap/unwrap IBT to sw-IBT during swaps.
///      2) Spectra pool PT / IBT, marginly pool PT / IBT
///      3) Spectra pool PT / IBT, marginly pool PT / Underlying of IBT.
///           Adapter will wrap/unwrap IBT to Underlying. Only for IBT tokens that supports immediate withdraw
contract SpectraAdapter is IMarginlyAdapter, Ownable2Step {
  using SafeERC20 for IERC20;

  error WrongPoolInput();
  error UnknownPair();

  event NewPair(address indexed ptToken, address indexed ibToken, address curvePool);

  enum QuoteTokenKind {
    Ibt, // IBT token compatible with ERC4626
    IbtNotCompatibleWithERC4626, // Quote token is IBT not compatible with ERC4626
    UnderlyingOfIbt // Quote token is Underlying asset of IBT token compatible with ERC4626
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
    /// @dev Type of quote token
    QuoteTokenKind quoteTokenKind;
  }

  mapping(address => mapping(address => PoolData)) public getPoolData;

  constructor(PoolInput[] memory pools) {
    _addPools(pools);
  }

  /// @dev Returns type of quote token
  /// @param coin Address of coin in Spectra pool
  /// @param quoteToken Address of quote token in Adapter
  function _getQuoteTokenKind(address coin, address quoteToken) private view returns (QuoteTokenKind) {
    if (coin == quoteToken) {
      return QuoteTokenKind.Ibt;
    } else if (IERC4626(coin).asset() == quoteToken) {
      return QuoteTokenKind.UnderlyingOfIbt;
    } else if (ISpectraErc4626Wrapper(coin).vaultShare() == quoteToken) {
      return QuoteTokenKind.IbtNotCompatibleWithERC4626;
    } else {
      revert WrongPoolInput();
    }
  }

  /// @dev Add array of pools
  /// @param pools Array of input pools
  function _addPools(PoolInput[] memory pools) private {
    PoolInput memory input;
    uint256 length = pools.length;
    for (uint256 i; i < length; ) {
      input = pools[i];

      address coin0 = ICurvePool(input.pool).coins(0);
      address coin1 = ICurvePool(input.pool).coins(1);

      PoolData memory poolData;
      poolData.pool = input.pool;

      if (coin1 == input.pt) {
        // check quote token is IBT, underlying of ibt or wrapped ibt
        poolData.quoteTokenKind = _getQuoteTokenKind(coin0, input.quoteToken);
        poolData.zeroIndexCoinIsIbt = true;
        poolData.ibt = coin0;
        poolData.pt = coin1;
      } else if (coin0 == input.pt) {
        // check quote token is IBT, underlying of ibt or wrapped ibt
        poolData.quoteTokenKind = _getQuoteTokenKind(coin1, input.quoteToken);
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

  /// @dev Returns pool data by pair of tokens
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

      if (poolData.quoteTokenKind != QuoteTokenKind.Ibt) {
        // change recipient to address(this), it let make unwrap swIbt for Ibt after swap
        recipient = address(this);
      }

      amountOut = _curveSwapExactInput(poolData.pool, recipient, tokenInArg, tokenInIndex, amountInArg, minAmountOut);

      if (poolData.quoteTokenKind == QuoteTokenKind.IbtNotCompatibleWithERC4626) {
        // sw-IBT unwrap to IBT
        amountOut = ISpectraErc4626Wrapper(poolData.ibt).unwrap(amountOut, recipientArg, address(this));
      } else if (poolData.quoteTokenKind == QuoteTokenKind.UnderlyingOfIbt) {
        // IBT redeem to underlying asset
        amountOut = IERC4626(poolData.ibt).redeem(amountOut, recipientArg, address(this));
      }
    } else {
      // IBT -> PT

      uint256 amountIn = amountInArg;

      if (poolData.quoteTokenKind == QuoteTokenKind.IbtNotCompatibleWithERC4626) {
        // wrap IBT to sw-IBT and change recipient to current address(this)
        IERC20(tokenInArg).forceApprove(poolData.ibt, amountInArg);
        amountIn = ISpectraErc4626Wrapper(poolData.ibt).wrap(amountInArg, address(this));
        // tokenIn is sw-IBT
      } else if (poolData.quoteTokenKind == QuoteTokenKind.UnderlyingOfIbt) {
        // wrap Underlying asset to IBT and change recipient to current address(this)
        IERC20(tokenInArg).forceApprove(poolData.ibt, amountInArg);
        amountIn = IERC4626(poolData.ibt).deposit(amountInArg, address(this));
      }

      // swap in curve IBT to PT
      amountOut = _curveSwapExactInput(poolData.pool, recipientArg, poolData.ibt, tokenInIndex, amountIn, minAmountOut);
    }
  }

  function _swapExactInputPostMaturity(
    PoolData memory poolData,
    address recipient,
    address tokenIn,
    uint256 amountIn
  ) private returns (uint256 amountOut) {
    if (tokenIn != poolData.pt) {
      // IBT to PT swap is not possible after maturity
      revert NotSupported();
    }

    if (poolData.quoteTokenKind == QuoteTokenKind.IbtNotCompatibleWithERC4626) {
      // convert PT to sw-IBT
      uint256 swAmountOut = ISpectraPrincipalToken(poolData.pt).redeemForIBT(amountIn, address(this), address(this));
      // convert sw-IBT to IBT
      amountOut = ISpectraErc4626Wrapper(poolData.ibt).unwrap(swAmountOut, recipient, address(this));
    } else if (poolData.quoteTokenKind == QuoteTokenKind.UnderlyingOfIbt) {
      // convert PT to Underlying
      amountOut = ISpectraPrincipalToken(poolData.pt).redeem(amountIn, recipient, address(this));
    } else {
      amountOut = ISpectraPrincipalToken(poolData.pt).redeemForIBT(amountIn, recipient, address(this));
    }
  }

  function _swapExactOutputPtToIbtToUnderlyingPreMaturity(
    PoolData memory poolData,
    address recipient,
    uint256 quoteAmountOut,
    uint256 maxPtAmountIn
  ) private returns (uint256 ptAmountIn) {
    // PT -> IBT -> underlying

    uint256 tokenInIndex = poolData.zeroIndexCoinIsIbt ? 1 : 0;

    // calculate amount of IBT for exact quoteAmountOut
    uint256 ibtAmountOut = IERC4626(poolData.ibt).previewWithdraw(quoteAmountOut);

    // swap maxAmountPt to IBT
    uint256 ibtActualAmountOut = _curveSwapExactInput(
      poolData.pool,
      address(this),
      poolData.pt,
      tokenInIndex,
      maxPtAmountIn,
      ibtAmountOut
    );

    // withdraw exact amount of Underlying asset from IBT
    IERC4626(poolData.ibt).withdraw(quoteAmountOut, recipient, address(this));

    if (ibtActualAmountOut == ibtAmountOut) {
      return maxPtAmountIn;
    }

    uint256 deltaIbtAmountOut = ibtActualAmountOut - ibtAmountOut;

    // swap and move excessive tokenIn directly to recipient.
    // last arg minAmountOut is zero because we made worst allowed by user swap
    // and an additional swap with whichever output only improves it,
    // so the tx shouldn't be reverted
    uint256 excessivePtAmountIn = _curveSwapExactInput(
      poolData.pool,
      recipient,
      poolData.ibt,
      1 - tokenInIndex,
      deltaIbtAmountOut,
      0
    );

    ptAmountIn = maxPtAmountIn - excessivePtAmountIn;
  }

  /// @dev Swap PT to exact amount of IBT. When IBT is SpectraWrapper
  function _swapExactOutputPtToSwIbtToIbtPreMaturity(
    PoolData memory poolData,
    address recipient,
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

    // unwrap swAmountOut to get exact ibtAmountOut
    ISpectraErc4626Wrapper(poolData.ibt).unwrap(swAmountOut, recipient, address(this));

    if (swActualAmountOut == swAmountOut) {
      return maxPtAmountIn;
    }

    uint256 deltaSwAmountOut = swActualAmountOut - swAmountOut;

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

    if (ibtActualAmountOut < ibtAmountOut) {
      revert TooMuchRequested();
    }

    IERC20(ibtOut).safeTransfer(recipient, ibtAmountOut);

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

  /// @dev Swap IBT to exact amount of PT. Returns excessive input amount
  function _swapExactOutputIbtToPt(
    PoolData memory poolData,
    address recipient,
    bool sendExcessiveToRecipient,
    uint256 ibtInMaximum,
    uint256 amountPtOut
  ) private returns (uint256 excessiveIbtAmount) {
    uint256 tokenInIndex = poolData.zeroIndexCoinIsIbt ? 0 : 1;
    // swap all IBT to PT
    uint256 actualAmountPtOut = _curveSwapExactInput(
      poolData.pool,
      address(this),
      poolData.ibt,
      tokenInIndex,
      ibtInMaximum,
      amountPtOut
    );

    if (actualAmountPtOut < amountPtOut) {
      revert TooMuchRequested();
    }

    // send exact amount of tokenOut to recipient
    IERC20(poolData.pt).safeTransfer(recipient, amountPtOut);

    if (actualAmountPtOut == amountPtOut) {
      return 0; // all input amount was used
    }

    uint256 deltaAmountPtOut = actualAmountPtOut - amountPtOut;
    // swap and move excessive PT amount back to IBT
    excessiveIbtAmount = _curveSwapExactInput(
      poolData.pool,
      sendExcessiveToRecipient ? recipient : address(this),
      poolData.pt,
      1 - tokenInIndex,
      deltaAmountPtOut,
      0
    );
  }

  function _swapExactOutputUnderlyingToIbtToPtPreMaturity(
    PoolData memory poolData,
    address recipient,
    address quoteTokenIn,
    uint256 ptAmountOut,
    uint256 maxUnderlyingAmountIn
  ) private returns (uint256 underlyingAmountIn) {
    // Underlying -> IBT -> PT
    // Convert all Underlying to IBT
    IERC20(quoteTokenIn).forceApprove(poolData.ibt, maxUnderlyingAmountIn);
    uint256 ibtMaxAmountIn = IERC4626(poolData.ibt).deposit(maxUnderlyingAmountIn, address(this));

    // swap all IBT to PT
    uint256 excessiveIbtIn = _swapExactOutputIbtToPt(poolData, recipient, false, ibtMaxAmountIn, ptAmountOut);
    if (excessiveIbtIn == 0) return maxUnderlyingAmountIn;

    // convert excessive IBT to Underlying and return to recipient
    uint256 excessiveUnderlyingAmountIn = IERC4626(poolData.ibt).redeem(excessiveIbtIn, recipient, address(this));
    underlyingAmountIn = maxUnderlyingAmountIn - excessiveUnderlyingAmountIn;
  }

  function _swapExactOutputIbtToSwIbtToPtPreMaturity(
    PoolData memory poolData,
    address recipient,
    address ibtIn,
    uint256 ptAmountOut,
    uint256 maxIbtAmountIn
  ) private returns (uint256 ibAmountIn) {
    // IBT -> sw-IBT -> PT
    // wrap ibt to swIbt
    IERC20(ibtIn).forceApprove(poolData.ibt, maxIbtAmountIn);
    uint256 maxSwAmountIn = ISpectraErc4626Wrapper(poolData.ibt).wrap(maxIbtAmountIn, address(this));

    uint256 excessiveSwAmountIn = _swapExactOutputIbtToPt(poolData, recipient, false, maxSwAmountIn, ptAmountOut);
    if (excessiveSwAmountIn == 0) return maxIbtAmountIn;

    // unwrap excessive sw into ib and transfer back to recipient
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
    uint256 ptAmountOut,
    uint256 maxIbtAmountIn
  ) private returns (uint256 ibAmountIn) {
    // IBT -> PT
    uint256 excessiveIbtAmountIn = _swapExactOutputIbtToPt(poolData, recipient, true, maxIbtAmountIn, ptAmountOut);
    if (excessiveIbtAmountIn == 0) return maxIbtAmountIn;

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
    }

    if (poolData.quoteTokenKind == QuoteTokenKind.IbtNotCompatibleWithERC4626) {
      // PT -> sw-IBT -> IBT
      // calc sw-IBT amount from amountOut
      uint256 swAmountOut = ISpectraErc4626Wrapper(poolData.ibt).previewWrap(amountOut);
      amountIn = ISpectraPrincipalToken(poolData.pt).withdrawIBT(swAmountOut, address(this), address(this));
      uint256 actualAmountOut = ISpectraErc4626Wrapper(poolData.ibt).unwrap(swAmountOut, address(this), address(this));
      if (actualAmountOut < amountOut) revert InsufficientAmount();

      // actualAmountOut could be more than amountOut, but it's not possible to change it back to PT after maturity
      // dust may be left on the contract
      IERC20(tokenOut).safeTransfer(recipient, amountOut);
    } else if (poolData.quoteTokenKind == QuoteTokenKind.UnderlyingOfIbt) {
      // PT -> Underlying
      amountIn = ISpectraPrincipalToken(poolData.pt).withdraw(amountOut, recipient, address(this));
    } else {
      amountIn = ISpectraPrincipalToken(poolData.pt).withdrawIBT(amountOut, recipient, address(this));
    }

    if (maxAmountIn == amountIn) {
      return amountIn;
    }
    // return rest of PT token back to recipient
    IERC20(poolData.pt).safeTransfer(recipient, maxAmountIn - amountIn);
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
        if (poolData.quoteTokenKind == QuoteTokenKind.IbtNotCompatibleWithERC4626) {
          amountIn = _swapExactOutputPtToSwIbtToIbtPreMaturity(poolData, recipient, amountOut, maxAmountIn);
        } else if (poolData.quoteTokenKind == QuoteTokenKind.UnderlyingOfIbt) {
          amountIn = _swapExactOutputPtToIbtToUnderlyingPreMaturity(poolData, recipient, amountOut, maxAmountIn);
        } else {
          amountIn = _swapExactOutputPtToIbtPreMaturity(poolData, recipient, tokenOut, amountOut, maxAmountIn);
        }
      } else {
        if (poolData.quoteTokenKind == QuoteTokenKind.IbtNotCompatibleWithERC4626) {
          amountIn = _swapExactOutputIbtToSwIbtToPtPreMaturity(poolData, recipient, tokenIn, amountOut, maxAmountIn);
        } else if (poolData.quoteTokenKind == QuoteTokenKind.UnderlyingOfIbt) {
          amountIn = _swapExactOutputUnderlyingToIbtToPtPreMaturity(
            poolData,
            recipient,
            tokenIn,
            amountOut,
            maxAmountIn
          );
        } else {
          amountIn = _swapExactOutputIbtToPtPreMaturity(poolData, recipient, amountOut, maxAmountIn);
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
