// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import '@openzeppelin/contracts/utils/math/Math.sol';
import '@openzeppelin/contracts/access/Ownable2Step.sol';
import '@openzeppelin/contracts/interfaces/IERC4626.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';

import '@pendle/core-v2/contracts/router/base/MarketApproxLib.sol';
import '@pendle/core-v2/contracts/interfaces/IPMarket.sol';
import '@pendle/core-v2/contracts/core/StandardizedYield/PYIndex.sol';

import '../interfaces/IMarginlyAdapter.sol';
import '../interfaces/IMarginlyRouter.sol';

///@dev Pendle adapter for exchanging PT to Asset, if Asset is valid input and output asset for SY
contract PendlePtToAssetAdapter is IMarginlyAdapter, Ownable2Step {
  using PYIndexLib for IPYieldToken;

  struct PendleMarketData {
    IPMarket market;
    IStandardizedYield sy;
    IPPrincipalToken pt;
    IPYieldToken yt;
    IERC20 asset;
    uint8 slippage;
  }

  struct PoolInput {
    address pendleMarket;
    uint8 slippage;
    address ptToken;
    address asset;
  }

  struct CallbackData {
    address tokenIn;
    address tokenOut;
    address router;
    bytes adapterCallbackData;
    bool isExactOutput;
  }

  uint256 private constant PENDLE_ONE = 1e18;
  uint256 private constant EPSILON = 1e15;
  uint256 private constant ONE = 100;
  uint256 private constant MAX_ITERATIONS = 10;

  mapping(address => mapping(address => PendleMarketData)) public getMarketData;

  event NewPair(address indexed ptToken, address indexed asset, address pendleMarket, uint8 slippage);

  error ApproximationFailed();
  error UnknownPair();
  error WrongPoolInput();

  constructor(PoolInput[] memory poolsData) {
    _addPools(poolsData);
  }

  function addPools(PoolInput[] calldata poolsData) external onlyOwner {
    _addPools(poolsData);
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
    PendleMarketData memory marketData = _getMarketDataSafe(tokenIn, tokenOut);

    if (marketData.yt.isExpired()) {
      amountOut = _swapExactInputPostMaturity(marketData, recipient, tokenIn, amountIn, data);
    } else {
      amountOut = _swapExactInputPreMaturity(marketData, recipient, tokenIn, tokenOut, amountIn, minAmountOut, data);
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
    PendleMarketData memory marketData = _getMarketDataSafe(tokenIn, tokenOut);

    if (marketData.yt.isExpired()) {
      amountIn = _swapExactOutputPostMaturity(marketData, recipient, tokenIn, amountOut, data);
    } else {
      amountIn = _swapExactOutputPreMaturity(marketData, recipient, tokenIn, tokenOut, maxAmountIn, amountOut, data);
    }

    if (amountIn > maxAmountIn) revert TooMuchRequested();
  }

  /// @dev Triggered by PendleMarket
  function swapCallback(int256 ptToAccount, int256 syToAccount, bytes calldata _data) external {
    require(ptToAccount > 0 || syToAccount > 0);

    CallbackData memory data = abi.decode(_data, (CallbackData));
    PendleMarketData memory marketData = _getMarketDataSafe(data.tokenIn, data.tokenOut);
    require(msg.sender == address(marketData.market));

    if (syToAccount > 0) {
      // this clause is realized in case of both exactInput and exactOutput with pt tokens as input
      // we need to send pt tokens from router-call initiator to finalize the swap
      IMarginlyRouter(data.router).adapterCallback(msg.sender, uint256(-ptToAccount), data.adapterCallbackData);
    } else {
      // this clause is realized when pt tokens is output
      // we need to mint SY from Asset and send to pendle
      _pendleMintSy(marketData, msg.sender, uint256(-syToAccount), data);
    }
  }

  function _getMarketDataSafe(
    address tokenA,
    address tokenB
  ) private view returns (PendleMarketData memory marketData) {
    marketData = getMarketData[tokenA][tokenB];
    if (address(marketData.market) == address(0)) revert UnknownPair();
  }

  function _swapExactInputPreMaturity(
    PendleMarketData memory marketData,
    address recipient,
    address tokenIn,
    address tokenOut,
    uint256 amountIn,
    uint256 minAmountOut,
    bytes calldata data
  ) private returns (uint256 amountOut) {
    if (tokenIn == address(marketData.pt)) {
      // pt to pendle -> sy redeem to asset and send to recipient
      IMarginlyRouter(msg.sender).adapterCallback(address(marketData.market), amountIn, data);
      (uint256 syAmountOut, ) = marketData.market.swapExactPtForSy(address(this), amountIn, new bytes(0));
      amountOut = _pendleRedeemSy(marketData, recipient, syAmountOut);
    } else {
      // asset to sy wrap (in swap callback) -> sy to pendle -> pt to recipient
      CallbackData memory swapCallbackData = CallbackData({
        tokenIn: tokenIn,
        tokenOut: tokenOut,
        router: msg.sender,
        adapterCallbackData: data,
        isExactOutput: false
      });
      IMarginlyRouter(msg.sender).adapterCallback(address(this), amountIn, data);
      uint256 syAmountIn = marketData.sy.previewDeposit(address(marketData.asset), amountIn);
      amountOut = _pendleApproxSwapExactSyForPt(
        marketData,
        recipient,
        syAmountIn,
        minAmountOut,
        abi.encode(swapCallbackData)
      );
    }
  }

  function _swapExactOutputPreMaturity(
    PendleMarketData memory marketData,
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
      adapterCallbackData: data,
      isExactOutput: true
    });

    if (tokenIn == address(marketData.pt)) {
      // Calculate amount of SY could be redeemed from exact amount of Asset
      uint256 estimatedSyOut = _assetToSyUpForRedeem(marketData, amountOut);

      // approx Pt to Sy -> in callback send Pt to PendleMarket
      // then unwrap Sy to Asset and send to recipient
      (uint256 actualSyAmountOut, uint256 ptAmountIn) = _pendleApproxSwapPtForExactSy(
        marketData,
        address(this),
        estimatedSyOut,
        maxAmountIn,
        abi.encode(swapCallbackData)
      );
      amountIn = ptAmountIn;
      // use amountOut here, because actualSyAmountOut a little bit more than amountOut
      _pendleRedeemSy(marketData, address(this), actualSyAmountOut);
      SafeERC20.safeTransfer(marketData.asset, recipient, amountOut);
    } else {
      // Sy to Pt -> in callback mint Sy from Asset and send to pendleMarket
      (amountIn, ) = marketData.market.swapSyForExactPt(recipient, amountOut, abi.encode(swapCallbackData));
    }
  }

  function _swapExactInputPostMaturity(
    PendleMarketData memory marketData,
    address recipient,
    address tokenIn,
    uint256 amountIn,
    bytes calldata data
  ) private returns (uint256 amountOut) {
    if (tokenIn == address(marketData.pt)) {
      // pt redeem -> sy -> unwrap sy to ib
      uint256 syRedeemed = _redeemPY(marketData.yt, msg.sender, amountIn, data);
      amountOut = _pendleRedeemSy(marketData, recipient, syRedeemed);
    } else {
      // sy to pt swap is not possible after maturity
      revert NotSupported();
    }
  }

  function _swapExactOutputPostMaturity(
    PendleMarketData memory marketData,
    address recipient,
    address tokenIn,
    uint256 amountOut,
    bytes calldata data
  ) private returns (uint256 amountIn) {
    if (tokenIn == address(marketData.pt)) {
      // Calc how much SY need to redeem exact amount of Asset
      uint256 estimatedSyAmountOut = _assetToSyUpForRedeem(marketData, amountOut);

      // https://github.com/pendle-finance/pendle-core-v2-public/blob/bc27b10c33ac16d6e1936a9ddd24d536b00c96a4/contracts/core/YieldContractsV2/PendleYieldTokenV2.sol#L301
      uint256 index = marketData.yt.pyIndexCurrent();
      amountIn = Math.mulDiv(estimatedSyAmountOut, index, PENDLE_ONE, Math.Rounding.Up);
      uint256 syAmountOut = _redeemPY(marketData.yt, msg.sender, amountIn, data);
      _pendleRedeemSy(marketData, address(this), syAmountOut);
      SafeERC20.safeTransfer(marketData.asset, recipient, amountOut);
      //small amount of asset left in the adapter contract
    } else {
      // sy to pt swap is not possible after maturity
      revert NotSupported();
    }
  }

  function _pendleApproxSwapExactSyForPt(
    PendleMarketData memory marketData,
    address recipient,
    uint256 syAmountIn,
    uint256 minPtAmountOut,
    bytes memory data
  ) private returns (uint256 ptAmountOut) {
    uint8 slippage = marketData.slippage;
    ApproxParams memory approx = ApproxParams({
      guessMin: minPtAmountOut,
      guessMax: (minPtAmountOut * (ONE + slippage)) / (ONE - slippage),
      guessOffchain: 0,
      maxIteration: MAX_ITERATIONS,
      eps: EPSILON
    });

    (ptAmountOut, ) = MarketApproxPtOutLib.approxSwapExactSyForPt(
      marketData.market.readState(address(this)),
      marketData.yt.newIndex(),
      syAmountIn,
      block.timestamp,
      approx
    );
    (uint256 actualSyAmountIn, ) = marketData.market.swapSyForExactPt(recipient, ptAmountOut, data);
    if (actualSyAmountIn > syAmountIn) revert ApproximationFailed();
  }

  function _pendleApproxSwapPtForExactSy(
    PendleMarketData memory marketData,
    address recipient,
    uint256 syAmountOut,
    uint256 maxPtAmountIn,
    bytes memory data
  ) private returns (uint256 actualSyAmountOut, uint256 actualPtAmountIn) {
    uint8 slippage = marketData.slippage;
    ApproxParams memory approx = ApproxParams({
      guessMin: (maxPtAmountIn * (ONE - slippage)) / (ONE + slippage),
      guessMax: maxPtAmountIn,
      guessOffchain: 0,
      maxIteration: MAX_ITERATIONS,
      eps: EPSILON
    });

    (actualPtAmountIn, , ) = MarketApproxPtInLib.approxSwapPtForExactSy(
      IPMarket(marketData.market).readState(address(this)),
      marketData.yt.newIndex(),
      syAmountOut,
      block.timestamp,
      approx
    );
    if (actualPtAmountIn > maxPtAmountIn) revert ApproximationFailed();

    (actualSyAmountOut, ) = marketData.market.swapExactPtForSy(recipient, actualPtAmountIn, data);
    if (actualSyAmountOut < syAmountOut) revert ApproximationFailed();
  }

  ///@dev Mint SY from Asset
  function _pendleMintSy(
    PendleMarketData memory marketData,
    address recipient,
    uint256 syAmount,
    CallbackData memory data
  ) private returns (uint256 syMinted) {
    // Calculate amount of asset needed to mint syAmount
    uint256 estimatedAssetIn = _syToAssetUpForDeposit(marketData, syAmount);

    if (data.isExactOutput) {
      //transfer estimatedAssetIn of Asset to adapter
      IMarginlyRouter(data.router).adapterCallback(address(this), estimatedAssetIn, data.adapterCallbackData);
    }
    SafeERC20.forceApprove(marketData.asset, address(marketData.sy), estimatedAssetIn);
    syMinted = IStandardizedYield(marketData.sy).deposit(
      address(this),
      address(marketData.asset),
      estimatedAssetIn,
      syAmount
    );

    // small amount of sy left in the adapter contract
    // transfer exact amount of sy to recipient
    SafeERC20.safeTransfer(marketData.sy, recipient, syAmount);
  }

  ///@dev Redeem for Asset. When asset is YieldAsset of SY then 1:1 swap, otherwise it is not
  function _pendleRedeemSy(
    PendleMarketData memory marketData,
    address recipient,
    uint256 syIn
  ) private returns (uint256 assetRedeemed) {
    assetRedeemed = IStandardizedYield(marketData.sy).redeem(recipient, syIn, address(marketData.asset), syIn, false);
  }

  ///@dev Redeem after maturity
  function _redeemPY(
    IPYieldToken yt,
    address router,
    uint256 ptAmount,
    bytes memory adapterCallbackData
  ) private returns (uint256 syRedeemed) {
    IMarginlyRouter(router).adapterCallback(address(yt), ptAmount, adapterCallbackData);
    syRedeemed = yt.redeemPY(address(this));
  }

  ///@dev Calc how much SY need to redeem exact assetAmount
  function _assetToSyUpForRedeem(
    PendleMarketData memory marketData,
    uint256 assetAmount
  ) private view returns (uint256) {
    uint256 assetsPerSyUnit = IStandardizedYield(marketData.sy).previewRedeem(address(marketData.asset), PENDLE_ONE);
    return (PENDLE_ONE * assetAmount + assetsPerSyUnit - 1) / assetsPerSyUnit;
  }

  ///@dev Calc how much asset need to deposit and get exact amount of SY
  function _syToAssetUpForDeposit(PendleMarketData memory marketData, uint256 syAmount) private view returns (uint256) {
    uint256 syPerAssetUnit = IStandardizedYield(marketData.sy).previewDeposit(address(marketData.asset), PENDLE_ONE);
    return (PENDLE_ONE * syAmount + syPerAssetUnit - 1) / syPerAssetUnit;
  }

  function _addPools(PoolInput[] memory poolsData) private {
    PoolInput memory input;
    uint256 length = poolsData.length;
    for (uint256 i; i < length; ) {
      input = poolsData[i];

      if (
        input.ptToken == address(0) ||
        input.asset == address(0) ||
        input.pendleMarket == address(0) ||
        input.slippage >= ONE
      ) revert WrongPoolInput();

      (IStandardizedYield sy, IPPrincipalToken pt, IPYieldToken yt) = IPMarket(input.pendleMarket).readTokens();
      if (input.ptToken != address(pt)) revert WrongPoolInput();
      if (!sy.isValidTokenIn(input.asset) || !sy.isValidTokenOut(input.asset)) revert WrongPoolInput();

      PendleMarketData memory marketData = PendleMarketData({
        market: IPMarket(input.pendleMarket),
        sy: sy,
        pt: pt,
        yt: yt,
        asset: IERC20(input.asset),
        slippage: input.slippage
      });

      getMarketData[input.ptToken][input.asset] = marketData;
      getMarketData[input.asset][input.ptToken] = marketData;

      emit NewPair(input.ptToken, input.asset, input.pendleMarket, input.slippage);

      unchecked {
        ++i;
      }
    }
  }
}
