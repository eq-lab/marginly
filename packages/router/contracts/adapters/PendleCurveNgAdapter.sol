// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import '@openzeppelin/contracts/utils/math/Math.sol';
import '@openzeppelin/contracts/access/Ownable2Step.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import '@pendle/core-v2/contracts/router/base/MarketApproxLib.sol';
import '@pendle/core-v2/contracts/interfaces/IPMarket.sol';
import '@pendle/core-v2/contracts/core/StandardizedYield/PYIndex.sol';

import '../interfaces/IMarginlyAdapter.sol';
import '../interfaces/IMarginlyRouter.sol';
import './interfaces/ICurvePool.sol';

/// @dev Adapter for swapping PT token to IB and IB to quoteToken using Curve pool
contract PendleCurveNgAdapter is IMarginlyAdapter, Ownable2Step {
  using PYIndexLib for IPYieldToken;

  struct RouteData {
    /// @dev Pendle Market contract
    IPMarket pendleMarket;
    /// @dev SY token
    IStandardizedYield sy;
    /// @dev PT token
    IPPrincipalToken pt;
    /// @dev YT token
    IPYieldToken yt;
    /// @dev Slippage for Pendle approx swap
    uint8 slippage;
    /// @dev Slippage for Curve swap exact output
    uint32 curveSlippage;
    /// @dev Interest bearing token
    address ib;
    /// @dev Curve pool address
    address curvePool;
    /// @dev index of coin in curve pool
    uint8 curveInputCoinIndex;
    /// @dev index of coin in curve pool
    uint8 curveOutputCoinIndex;
  }

  struct RouteInput {
    address pendleMarket;
    // slippage, used in pendle approx swap
    uint8 slippage;
    uint32 curveSlippage; // by default 10, 0.001%, 0.00001
    address curvePool;
    address ibToken;
    address quoteToken;
  }

  struct CallbackData {
    address tokenIn;
    address tokenOut;
    address router;
    bool isExactOutput;
    bytes adapterCallbackData;
  }

  uint256 private constant PENDLE_ONE = 1e18;
  uint256 private constant EPSILON = 1e15;
  uint256 private constant PENDLE_SLIPPAGE_ONE = 100;
  uint256 private constant MAX_ITERATIONS = 10;
  uint256 private constant CURVE_SLIPPAGE_ONE = 1e6;

  mapping(address => mapping(address => RouteData)) public getRouteData;
  uint256 private callbackAmountIn;

  event NewPair(address indexed ptToken, address indexed quoteToken, address pendleMarket, uint8 slippage);

  error ApproximationFailed();
  error UnknownPair();
  error WrongInput();
  error ZeroAddress();

  constructor(RouteInput[] memory routes) {
    _addPairs(routes);
  }

  function addPairs(RouteInput[] calldata routes) external onlyOwner {
    _addPairs(routes);
  }

  /// @dev During swap Pt to exact SY before maturity a little amount of SY might stay at the adapter contract
  function redeemDust(address token, address recipient) external onlyOwner {
    SafeERC20.safeTransfer(IERC20(token), recipient, IERC20(token).balanceOf(address(this)));
  }

  function swapExactInput(
    address recipient,
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut,
    bytes calldata data
  ) external returns (uint256 amountOut) {
    RouteData memory routeData = _getRouteDataSafe(tokenIn, tokenOut);

    if (routeData.pt.isExpired()) {
      amountOut = _swapExactInputPostMaturity(routeData, recipient, tokenIn, amountIn, minAmountOut, data);
    } else {
      amountOut = _swapExactInputPreMaturity(routeData, recipient, tokenIn, tokenOut, amountIn, minAmountOut, data);
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
    RouteData memory routeData = _getRouteDataSafe(tokenIn, tokenOut);

    if (routeData.yt.isExpired()) {
      amountIn = _swapExactOutputPostMaturity(routeData, recipient, tokenIn, tokenOut, amountOut, data);
    } else {
      amountIn = _swapExactOutputPreMaturity(routeData, recipient, tokenIn, tokenOut, maxAmountIn, amountOut, data);
    }

    if (amountIn > maxAmountIn) revert TooMuchRequested();
  }

  /// @dev Triggered by PendleMarket
  function swapCallback(int256 ptToAccount, int256 syToAccount, bytes calldata _data) external {
    require(ptToAccount > 0 || syToAccount > 0);

    CallbackData memory data = abi.decode(_data, (CallbackData));
    RouteData memory routeData = _getRouteDataSafe(data.tokenIn, data.tokenOut);
    require(msg.sender == address(routeData.pendleMarket));

    if (syToAccount > 0) {
      // this clause is realized in case of both exactInput and exactOutput with pt tokens as input
      // we need to send pt tokens from router-call initiator to finalize the swap
      IMarginlyRouter(data.router).adapterCallback(msg.sender, uint256(-ptToAccount), data.adapterCallbackData);
    } else {
      // pt token is output token
      // 1) swapExactInput
      //    quote token -> ib token in curve
      //    approx swap exact sy to pt in pendle
      //    callback: mint sy amount into pendle market
      //
      // 2) swapExactOutput
      //   swap sy for exact pt in pendle
      //   callback: in callback we know exact amount sy/ib and make swap quote -> ib in curve
      //   callback: mint sy amount into pendle market
      uint256 ibAmount = uint256(-syToAccount);
      if (data.isExactOutput) {
        // estimate amount of quoteToken to get uint256(-syToAccount)
        uint256 estimatedQuoteAmount = ICurvePool(routeData.curvePool).get_dx(
          int128(uint128(routeData.curveInputCoinIndex)),
          int128(uint128(routeData.curveOutputCoinIndex)),
          ibAmount
        );
        estimatedQuoteAmount =
          (estimatedQuoteAmount * (routeData.curveSlippage + CURVE_SLIPPAGE_ONE)) /
          CURVE_SLIPPAGE_ONE;

        callbackAmountIn = estimatedQuoteAmount;

        IMarginlyRouter(data.router).adapterCallback(address(this), estimatedQuoteAmount, data.adapterCallbackData);

        SafeERC20.forceApprove(IERC20(data.tokenIn), routeData.curvePool, estimatedQuoteAmount);
        ICurvePool(routeData.curvePool).exchange(
          int128(uint128(routeData.curveInputCoinIndex)),
          int128(uint128(routeData.curveOutputCoinIndex)),
          estimatedQuoteAmount,
          ibAmount, // min output ibAmount
          address(this)
        );
      }
      _pendleMintSy(routeData, msg.sender, ibAmount);
    }
  }

  function _getRouteDataSafe(address tokenA, address tokenB) private view returns (RouteData memory routeData) {
    routeData = getRouteData[tokenA][tokenB];
    if (address(routeData.pendleMarket) == address(0)) revert UnknownPair();
  }

  function _swapExactInputPreMaturity(
    RouteData memory routeData,
    address recipient,
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut,
    bytes calldata data
  ) private returns (uint256 amountOut) {
    if (tokenIn == address(routeData.pt)) {
      // swap pt -> sy in pendle
      IMarginlyRouter(msg.sender).adapterCallback(address(routeData.pendleMarket), amountIn, data);
      (uint256 syAmountIn, ) = routeData.pendleMarket.swapExactPtForSy(address(this), amountIn, new bytes(0));

      //unwrap sy to ib to address(this)
      uint256 ibAmountIn = _pendleRedeemSy(routeData, address(this), syAmountIn);

      // approve router to spend ib from adapter
      SafeERC20.forceApprove(IERC20(routeData.ib), routeData.curvePool, ibAmountIn);

      //swap ib -> quote token in curveRouter
      amountOut = ICurvePool(routeData.curvePool).exchange(
        int128(uint128(routeData.curveInputCoinIndex)),
        int128(uint128(routeData.curveOutputCoinIndex)),
        ibAmountIn,
        minAmountOut,
        recipient
      );
    } else {
      // transfer quote token into adapter
      IMarginlyRouter(msg.sender).adapterCallback(address(this), amountIn, data);
      SafeERC20.forceApprove(IERC20(tokenIn), routeData.curvePool, amountIn);
      // swap quote token -> ib
      uint256 ibAmount = ICurvePool(routeData.curvePool).exchange(
        int128(uint128(routeData.curveInputCoinIndex)),
        int128(uint128(routeData.curveOutputCoinIndex)),
        amountIn, // quoteToken amount In
        0, // unknown minAmountOut of ib
        address(this)
      );
      // wrap ib to sy (in swapCallback from pendle)
      // swap sy to pt in pendle, pt to recipient

      // tokenIn ib to sy wrap (in swap callback) -> sy to pendle -> pt to recipient
      CallbackData memory swapCallbackData = CallbackData({
        tokenIn: tokenIn,
        tokenOut: tokenOut,
        router: msg.sender,
        isExactOutput: false,
        adapterCallbackData: data
      });
      amountOut = _pendleApproxSwapExactSyForPt(
        routeData,
        recipient,
        ibAmount,
        minAmountOut,
        abi.encode(swapCallbackData)
      );
    }
  }

  function _swapExactOutputPreMaturity(
    RouteData memory routeData,
    address recipient,
    address tokenIn,
    address tokenOut,
    uint256 maxAmountIn,
    uint256 amountOut,
    bytes calldata data
  ) private returns (uint256 amountIn) {
    CallbackData memory swapCallbackData = CallbackData({
      tokenIn: tokenIn,
      tokenOut: tokenOut,
      router: msg.sender,
      isExactOutput: true,
      adapterCallbackData: data
    });

    if (tokenIn == address(routeData.pt)) {
      //estimate ibIn to get quoteToken amountOut in curve
      uint256 estimatedIbAmount = ICurvePool(routeData.curvePool).get_dx(
        int128(uint128(routeData.curveInputCoinIndex)),
        int128(uint128(routeData.curveOutputCoinIndex)),
        amountOut //quoteToken amount
      );
      estimatedIbAmount = (estimatedIbAmount * (routeData.curveSlippage + CURVE_SLIPPAGE_ONE)) / CURVE_SLIPPAGE_ONE;

      // approx Pt to Sy -> in callback send Pt to PendleMarket
      // then unwrap Sy to Ib and send to recipient
      (, uint256 ptAmountIn) = _pendleApproxSwapPtForExactSy(
        routeData,
        address(this),
        estimatedIbAmount,
        maxAmountIn,
        abi.encode(swapCallbackData)
      );
      amountIn = ptAmountIn;

      // use amountOut here, because actualSyAmountOut a little bit more than amountOut
      uint256 ibRedeemed = _pendleRedeemSy(routeData, address(this), estimatedIbAmount);

      SafeERC20.forceApprove(IERC20(routeData.ib), routeData.curvePool, ibRedeemed);

      //swap ib to quote token
      ICurvePool(routeData.curvePool).exchange(
        int128(uint128(routeData.curveInputCoinIndex)),
        int128(uint128(routeData.curveOutputCoinIndex)),
        ibRedeemed,
        amountOut,
        address(this)
      );

      // transfer amountOut to recipient, delta = actualAmountOut - amountOut stays in adapter contract balance
      SafeERC20.safeTransfer(IERC20(tokenOut), recipient, amountOut);
    } else {
      // Sy to Pt -> in callback unwrap Sy to Ib and send to pendle market
      // in callback:
      // estimate amount of quote to get ib in curve
      // exchange quote -> ib in curve
      routeData.pendleMarket.swapSyForExactPt(recipient, amountOut, abi.encode(swapCallbackData));
      amountIn = _getAmountIn();
    }
  }

  function _swapExactInputPostMaturity(
    RouteData memory routeData,
    address recipient,
    address tokenIn,
    uint256 amountIn,
    uint256 minAmountOut,
    bytes calldata data
  ) private returns (uint256 amountOut) {
    if (tokenIn == address(routeData.pt)) {
      // pt redeem -> sy -> unwrap sy to ib
      uint256 syRedeemed = _redeemPY(routeData.yt, msg.sender, amountIn, data);
      uint256 ibAmount = _pendleRedeemSy(routeData, address(this), syRedeemed);
      // approve to curve pool
      SafeERC20.forceApprove(IERC20(routeData.ib), routeData.curvePool, ibAmount);

      // ib to quote in curve
      amountOut = ICurvePool(routeData.curvePool).exchange(
        int128(uint128(routeData.curveInputCoinIndex)),
        int128(uint128(routeData.curveOutputCoinIndex)),
        ibAmount,
        minAmountOut,
        recipient
      );
    } else {
      // quote to pt swap is not possible after maturity
      revert NotSupported();
    }
  }

  function _swapExactOutputPostMaturity(
    RouteData memory routeData,
    address recipient,
    address tokenIn,
    address tokenOut,
    uint256 amountOut,
    bytes calldata data
  ) private returns (uint256 amountIn) {
    if (tokenIn == address(routeData.pt)) {
      // estimate on curve ibAmount to get amountOut
      uint256 estimatedIbAmount = ICurvePool(routeData.curvePool).get_dx(
        int128(uint128(routeData.curveInputCoinIndex)),
        int128(uint128(routeData.curveOutputCoinIndex)),
        amountOut // quoteAmountOut
      );

      // here we use a little more than estimationValue
      estimatedIbAmount = (estimatedIbAmount * (CURVE_SLIPPAGE_ONE + routeData.curveSlippage)) / CURVE_SLIPPAGE_ONE;

      // calculate pt amountIn
      // https://github.com/pendle-finance/pendle-core-v2-public/blob/bc27b10c33ac16d6e1936a9ddd24d536b00c96a4/contracts/core/YieldContractsV2/PendleYieldTokenV2.sol#L301
      amountIn = Math.mulDiv(estimatedIbAmount, routeData.yt.pyIndexCurrent(), PENDLE_ONE, Math.Rounding.Up);

      uint256 ibRedeemed = _pendleRedeemSy(
        routeData,
        address(this),
        _redeemPY(routeData.yt, msg.sender, amountIn, data) // syRedeemed
      );

      SafeERC20.forceApprove(IERC20(routeData.ib), routeData.curvePool, ibRedeemed);

      // exchange ib to quoteToken in curve
      ICurvePool(routeData.curvePool).exchange(
        int128(uint128(routeData.curveInputCoinIndex)),
        int128(uint128(routeData.curveOutputCoinIndex)),
        ibRedeemed,
        amountOut,
        address(this)
      );
      //delta actualAmountOut - amountOut stays in adapter contract, because router has strict check of amountOut
      //transfer to recipient exact amountOut
      SafeERC20.safeTransfer(IERC20(tokenOut), recipient, amountOut);
    } else {
      // sy to pt swap is not possible after maturity
      revert NotSupported();
    }
  }

  function _pendleApproxSwapExactSyForPt(
    RouteData memory routeData,
    address recipient,
    uint256 syAmountIn,
    uint256 minPtAmountOut,
    bytes memory data
  ) private returns (uint256 ptAmountOut) {
    uint8 slippage = routeData.slippage;
    ApproxParams memory approx = ApproxParams({
      guessMin: minPtAmountOut,
      guessMax: (minPtAmountOut * (PENDLE_SLIPPAGE_ONE + slippage)) / PENDLE_SLIPPAGE_ONE,
      guessOffchain: 0,
      maxIteration: MAX_ITERATIONS,
      eps: EPSILON
    });

    (ptAmountOut, ) = MarketApproxPtOutLib.approxSwapExactSyForPt(
      routeData.pendleMarket.readState(address(this)),
      routeData.yt.newIndex(),
      syAmountIn,
      block.timestamp,
      approx
    );
    (uint256 actualSyAmountIn, ) = routeData.pendleMarket.swapSyForExactPt(recipient, ptAmountOut, data);
    if (actualSyAmountIn > syAmountIn) revert ApproximationFailed();
  }

  function _pendleApproxSwapPtForExactSy(
    RouteData memory routeData,
    address recipient,
    uint256 syAmountOut,
    uint256 maxPtAmountIn,
    bytes memory data
  ) private returns (uint256 actualSyAmountOut, uint256 actualPtAmountIn) {
    uint8 slippage = routeData.slippage;
    ApproxParams memory approx = ApproxParams({
      guessMin: (maxPtAmountIn * (PENDLE_SLIPPAGE_ONE - slippage)) / PENDLE_SLIPPAGE_ONE,
      guessMax: maxPtAmountIn,
      guessOffchain: 0,
      maxIteration: MAX_ITERATIONS,
      eps: EPSILON
    });

    (actualPtAmountIn, , ) = MarketApproxPtInLib.approxSwapPtForExactSy(
      routeData.pendleMarket.readState(address(this)),
      routeData.yt.newIndex(),
      syAmountOut,
      block.timestamp,
      approx
    );
    if (actualPtAmountIn > maxPtAmountIn) revert ApproximationFailed();

    (actualSyAmountOut, ) = routeData.pendleMarket.swapExactPtForSy(recipient, actualPtAmountIn, data);
    if (actualSyAmountOut < syAmountOut) revert ApproximationFailed();
  }

  function _pendleMintSy(
    RouteData memory routeData,
    address recipient,
    uint256 ibIn
  ) private returns (uint256 syMinted) {
    SafeERC20.forceApprove(IERC20(routeData.ib), address(routeData.sy), ibIn);
    // setting `minSyOut` value as ibIn (1:1 swap)
    syMinted = routeData.sy.deposit(recipient, routeData.ib, ibIn, ibIn);
  }

  function _pendleRedeemSy(
    RouteData memory routeData,
    address recipient,
    uint256 syIn
  ) private returns (uint256 ibRedeemed) {
    // setting `minTokenOut` value as syIn (1:1 swap)
    ibRedeemed = routeData.sy.redeem(recipient, syIn, routeData.ib, syIn, false);
  }

  function _redeemPY(
    IPYieldToken yt,
    address router,
    uint256 ptAmount,
    bytes memory adapterCallbackData
  ) private returns (uint256 syRedeemed) {
    IMarginlyRouter(router).adapterCallback(address(yt), ptAmount, adapterCallbackData);
    syRedeemed = yt.redeemPY(address(this));
  }

  function _getAmountIn() private returns (uint256 amountIn) {
    amountIn = callbackAmountIn;
    delete callbackAmountIn;
  }

  function _addPairs(RouteInput[] memory routes) private {
    RouteInput memory input;
    uint256 length = routes.length;
    for (uint256 i; i < length; ) {
      input = routes[i];

      if (input.pendleMarket == address(0)) revert WrongInput();
      if (input.slippage >= PENDLE_ONE) revert WrongInput();
      if (input.curveSlippage >= CURVE_SLIPPAGE_ONE) revert WrongInput();

      (IStandardizedYield sy, IPPrincipalToken pt, IPYieldToken yt) = IPMarket(input.pendleMarket).readTokens();
      if (!sy.isValidTokenIn(input.ibToken)) revert WrongInput();
      if (!sy.isValidTokenOut(input.ibToken)) revert WrongInput();

      int8 ibTokenCurveIndex = -1; // -1 means not initialized value
      int8 quoteTokenCurveIndex = -1;

      uint256 coinsCount = ICurvePool(input.curvePool).N_COINS();
      for (uint256 coinsIdx; coinsIdx < coinsCount; ) {
        address coin = ICurvePool(input.curvePool).coins(coinsIdx);
        if (coin == input.ibToken) {
          ibTokenCurveIndex = int8(int256(coinsIdx));
        } else if (coin == input.quoteToken) {
          quoteTokenCurveIndex = int8(int256(coinsIdx));
        }

        unchecked {
          ++coinsIdx;
        }
      }

      if (ibTokenCurveIndex == -1 || quoteTokenCurveIndex == -1) revert WrongInput();

      RouteData memory ptToQuoteSwapRoute = RouteData({
        pendleMarket: IPMarket(input.pendleMarket),
        ib: input.ibToken,
        sy: sy,
        pt: pt,
        yt: yt,
        slippage: input.slippage,
        curveSlippage: input.curveSlippage,
        curvePool: input.curvePool,
        curveInputCoinIndex: uint8(ibTokenCurveIndex),
        curveOutputCoinIndex: uint8(quoteTokenCurveIndex)
      });

      RouteData memory quoteToPtSwapRoute = RouteData({
        pendleMarket: IPMarket(input.pendleMarket),
        ib: input.ibToken,
        sy: sy,
        pt: pt,
        yt: yt,
        slippage: input.slippage,
        curveSlippage: input.curveSlippage,
        curvePool: input.curvePool,
        curveInputCoinIndex: uint8(quoteTokenCurveIndex),
        curveOutputCoinIndex: uint8(ibTokenCurveIndex)
      });

      getRouteData[address(pt)][input.quoteToken] = ptToQuoteSwapRoute;
      getRouteData[input.quoteToken][address(pt)] = quoteToPtSwapRoute;

      emit NewPair(address(pt), input.quoteToken, input.pendleMarket, input.slippage);

      unchecked {
        ++i;
      }
    }
  }
}
