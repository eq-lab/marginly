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
import './interfaces/ICurveRouterNg.sol';

/// @dev This adapter is using for swaps PT token (Principal token) to IB token (Interest bearing)  in Pendle Market without trading pools
contract PendleCurveRouterNgAdapter is IMarginlyAdapter, Ownable2Step {
  using PYIndexLib for IPYieldToken;

  struct RouteData {
    IPMarket pendleMarket;
    IStandardizedYield sy;
    IPPrincipalToken pt;
    IPYieldToken yt;
    uint8 slippage;
    uint32 curveSlippage;
    address ib; // interest bearing token
    address[11] curveRoute;
    uint256[5][5] curveSwapParams;
    address[5] curvePools;
  }

  struct RouteInput {
    // address of pendle market, that holds info about pt, ib, sy tokens
    address pendleMarket;
    // slippage using in pendle approx swap
    uint8 slippage;
    uint32 curveSlippage; // by default 0.001%, 0.00001
    // Docs from https://github.com/curvefi/curve-router-ng/blob/master/contracts/Router.vy
    // Array of [initial token, pool or zap, token, pool or zap, token, ...]
    // The array is iterated until a pool address of 0x00, then the last
    // given token is transferred to `_receiver`
    address[11] curveRoute;
    // Multidimensional array of [i, j, swap_type, pool_type, n_coins] where
    //                     i is the index of input token
    //                     j is the index of output token

    //                     The swap_type should be:
    //                     1. for `exchange`,
    //                     2. for `exchange_underlying`,
    //                     3. for underlying exchange via zap: factory stable metapools with lending base pool `exchange_underlying`
    //                        and factory crypto-meta pools underlying exchange (`exchange` method in zap)
    //                     4. for coin -> LP token "exchange" (actually `add_liquidity`),
    //                     5. for lending pool underlying coin -> LP token "exchange" (actually `add_liquidity`),
    //                     6. for LP token -> coin "exchange" (actually `remove_liquidity_one_coin`)
    //                     7. for LP token -> lending or fake pool underlying coin "exchange" (actually `remove_liquidity_one_coin`)
    //                     8. for ETH <-> WETH, ETH -> stETH or ETH -> frxETH, stETH <-> wstETH, frxETH <-> sfrxETH, ETH -> wBETH, USDe -> sUSDe

    //                     pool_type: 1 - stable, 2 - twocrypto, 3 - tricrypto, 4 - llamma
    //                                10 - stable-ng, 20 - twocrypto-ng, 30 - tricrypto-ng

    //                     n_coins is the number of coins in pool
    uint256[5][5] curveSwapParams;
    // Array of pools for swaps via zap contracts. This parameter is only needed for swap_type = 3.
    address[5] curvePools;
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

  address public curveRouter;

  mapping(address => mapping(address => RouteData)) public getRouteData;
  uint256 private callbackAmountIn;

  event NewPair(address indexed ptToken, address indexed quoteToken, address pendleMarket, uint8 slippage);

  error ApproximationFailed();
  error UnknownPair();
  error WrongInput();
  error ZeroAddress();

  constructor(address _curveRouter, RouteInput[] memory routes) {
    if (_curveRouter == address(0)) revert ZeroAddress();

    curveRouter = _curveRouter;
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
        address _curveRouter = curveRouter;
        uint256 estimatedQuoteAmount = ICurveRouterNg(_curveRouter).get_dx(
          routeData.curveRoute,
          routeData.curveSwapParams,
          ibAmount,
          routeData.curvePools
        );
        estimatedQuoteAmount =
          (estimatedQuoteAmount * (routeData.curveSlippage + CURVE_SLIPPAGE_ONE)) /
          CURVE_SLIPPAGE_ONE;

        callbackAmountIn = estimatedQuoteAmount;

        IMarginlyRouter(data.router).adapterCallback(address(this), estimatedQuoteAmount, data.adapterCallbackData);

        SafeERC20.forceApprove(IERC20(data.tokenIn), _curveRouter, estimatedQuoteAmount);
        ICurveRouterNg(_curveRouter).exchange(
          routeData.curveRoute,
          routeData.curveSwapParams,
          estimatedQuoteAmount,
          ibAmount, // min output ibAmount
          routeData.curvePools,
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
    address _curveRouter = curveRouter;
    if (tokenIn == address(routeData.pt)) {
      // swap pt -> sy in pendle
      IMarginlyRouter(msg.sender).adapterCallback(address(routeData.pendleMarket), amountIn, data);
      (uint256 syAmountIn, ) = routeData.pendleMarket.swapExactPtForSy(address(this), amountIn, new bytes(0));

      // unwrap sy to ib to address(this)
      uint256 ibAmountIn = _pendleRedeemSy(routeData, address(this), syAmountIn);

      // approve router to spend ib from adapter
      SafeERC20.forceApprove(IERC20(routeData.ib), _curveRouter, ibAmountIn);

      // swap ib -> quote token in curveRouter
      amountOut = ICurveRouterNg(_curveRouter).exchange(
        routeData.curveRoute,
        routeData.curveSwapParams,
        ibAmountIn,
        minAmountOut,
        routeData.curvePools,
        recipient
      );
    } else {
      // transfer quote token into adapter
      IMarginlyRouter(msg.sender).adapterCallback(address(this), amountIn, data);
      SafeERC20.forceApprove(IERC20(tokenIn), _curveRouter, amountIn);
      // swap quote token -> ib
      uint256 ibAmount = ICurveRouterNg(_curveRouter).exchange(
        routeData.curveRoute,
        routeData.curveSwapParams,
        amountIn, // quoteToken amount In
        0, // unknown minAmountOut of ib
        routeData.curvePools,
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
    address _curveRouter = curveRouter;

    if (tokenIn == address(routeData.pt)) {
      // estimate ibIn to get quoteToken amountOut in curve
      uint256 estimatedIbAmount = ICurveRouterNg(_curveRouter).get_dx(
        routeData.curveRoute,
        routeData.curveSwapParams,
        amountOut, //quoteToken amount
        routeData.curvePools
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

      SafeERC20.forceApprove(IERC20(routeData.ib), _curveRouter, ibRedeemed);

      // swap ib to quote token
      ICurveRouterNg(_curveRouter).exchange(
        routeData.curveRoute,
        routeData.curveSwapParams,
        ibRedeemed,
        amountOut,
        routeData.curvePools,
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

      address _curveRouter = curveRouter;

      // approve to curve router
      SafeERC20.forceApprove(IERC20(routeData.ib), _curveRouter, ibAmount);

      // ib to quote in curve
      amountOut = ICurveRouterNg(_curveRouter).exchange(
        routeData.curveRoute,
        routeData.curveSwapParams,
        ibAmount,
        minAmountOut,
        routeData.curvePools,
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
      address _curveRouter = curveRouter;

      // estimate on curve ibAmount to get amountOut
      uint256 estimatedIbAmount = ICurveRouterNg(_curveRouter).get_dx(
        routeData.curveRoute,
        routeData.curveSwapParams,
        amountOut, // quoteAmountOut
        routeData.curvePools
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

      SafeERC20.forceApprove(IERC20(routeData.ib), _curveRouter, ibRedeemed);

      // exchange ib to quoteToken in curve
      ICurveRouterNg(_curveRouter).exchange(
        routeData.curveRoute,
        routeData.curveSwapParams,
        ibRedeemed,
        amountOut,
        routeData.curvePools,
        address(this)
      );
      // delta actualAmountOut - amountOut stays in adapter contract, because router has strict check of amountOut
      // transfer to recipient exact amountOut
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

      address ibToken = input.curveRoute[0];

      // prepare inverted route for swap quoteToken -> ..curve.. -> ibToken -> ptToken
      address[11] memory invertedCurveRoute;
      uint256 index = 0;
      for (uint256 j = 10; ; --j) {
        if (input.curveRoute[j] == address(0)) continue;

        invertedCurveRoute[index] = input.curveRoute[j];

        ++index;
        if (j == 0) break;
      }

      address quoteToken = invertedCurveRoute[0];

      // prepare inverted curveSwapParams and invertedCurvePools
      uint256[5][5] memory invertedCurveSwapParams;
      address[5] memory invertedCurvePools;
      index = 0;
      for (uint256 j = 4; ; --j) {
        if (input.curveSwapParams[j][0] == 0 && input.curveSwapParams[j][1] == 0) {
          continue; // empty element
        }

        invertedCurveSwapParams[index][0] = input.curveSwapParams[j][1];
        invertedCurveSwapParams[index][1] = input.curveSwapParams[j][0];
        invertedCurveSwapParams[index][2] = input.curveSwapParams[j][2];
        invertedCurveSwapParams[index][3] = input.curveSwapParams[j][3];
        invertedCurveSwapParams[index][4] = input.curveSwapParams[j][4];

        invertedCurvePools[index] = input.curvePools[j];

        ++index;
        if (j == 0) break;
      }

      (IStandardizedYield sy, IPPrincipalToken pt, IPYieldToken yt) = IPMarket(input.pendleMarket).readTokens();
      if (!sy.isValidTokenIn(ibToken)) revert WrongInput();
      if (!sy.isValidTokenOut(ibToken)) revert WrongInput();

      {
        RouteData memory ptToQuoteSwapRoute = RouteData({
          pendleMarket: IPMarket(input.pendleMarket),
          ib: ibToken,
          sy: sy,
          pt: pt,
          yt: yt,
          slippage: input.slippage,
          curveSlippage: input.curveSlippage,
          curveRoute: input.curveRoute,
          curveSwapParams: input.curveSwapParams,
          curvePools: input.curvePools
        });
        RouteData memory quoteToPtSwapRoute = RouteData({
          pendleMarket: IPMarket(input.pendleMarket),
          ib: ibToken,
          sy: sy,
          pt: pt,
          yt: yt,
          slippage: input.slippage,
          curveSlippage: input.curveSlippage,
          curveRoute: invertedCurveRoute,
          curveSwapParams: invertedCurveSwapParams,
          curvePools: invertedCurvePools
        });

        getRouteData[address(pt)][quoteToken] = ptToQuoteSwapRoute;
        getRouteData[quoteToken][address(pt)] = quoteToPtSwapRoute;
      }

      emit NewPair(address(pt), quoteToken, input.pendleMarket, input.slippage);

      unchecked {
        ++i;
      }
    }
  }
}
