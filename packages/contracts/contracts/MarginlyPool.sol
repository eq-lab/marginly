// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import '@uniswap/v3-core/contracts/libraries/LowGasSafeMath.sol';
import '@uniswap/v3-core/contracts/interfaces/IERC20Minimal.sol';
import '@uniswap/v3-core/contracts/interfaces/IUniswapV3Pool.sol';
import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';
import '@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol';

import '@openzeppelin/contracts/access/AccessControl.sol';
import '@openzeppelin/contracts/utils/math/Math.sol';

import './interfaces/IMarginlyPool.sol';
import './interfaces/IMarginlyFactory.sol';
import './dataTypes/MarginlyParams.sol';
import './dataTypes/Position.sol';
import './dataTypes/Mode.sol';
import './libraries/MaxBinaryHeapLib.sol';
import './libraries/OracleLib.sol';
import './libraries/FP48.sol';
import './libraries/FP96.sol';

//import 'hardhat/console.sol';

contract MarginlyPool is IMarginlyPool {
  using FP96 for FP96.FixedPoint;
  using MaxBinaryHeapLib for MaxBinaryHeapLib.Heap;
  using LowGasSafeMath for uint256;

  /// @dev FP96 inner value of count of seconds in year. Equal 365.25 * 24 * 60 * 60
  uint256 constant SECONDS_IN_YEAR_X96 = 2500250661360148260042022567123353600;

  /// @dev Denominator of fee value
  uint24 constant WHOLE_ONE = 1e6;

  /// @inheritdoc IMarginlyPool
  address public override factory;

  /// @dev [0] - quote token, [1] - base token
  address[2] public tokens;

  /// @inheritdoc IMarginlyPool
  uint24 public override uniswapFee;
  /// @inheritdoc IMarginlyPool
  address public override uniswapPool;
  /// @inheritdoc IMarginlyPool
  bool public override quoteTokenIsToken0;
  /// @dev reentrancy guard
  bool public unlocked;

  Mode public mode;

  MarginlyParams public params;

  /// @dev Sum of all [0]quote token/[1] base token in collateral
  uint256[2] discountedCollaterals;
  /// @dev Sum of all [0]quote token/[1] base token in debt
  uint256[2] discountedDebts;

  /// @dev Timestamp of last reinit execution
  uint256 public lastReinitTimestampSeconds;

  /// @dev Collateral coefficients. [0] - quoteCollateralCoeff [1] - baseCollateralCoeff
  FP96.FixedPoint[2] public collateralCoeffs;

  /// @dev Debt coefficients. [0] - quoteDebtCoeff [1] - baseDebtCoeff
  FP96.FixedPoint[2] public debtCoeffs;

  /// @dev Initial price. Used to sort key calculation.
  FP96.FixedPoint public initialPrice;
  /// @dev Ratio of best side collaterals before and after margin call of opposite side in shutdown mode
  FP96.FixedPoint public emergencyWithdrawCoeff;

  // struct Leverage {
  //   /// @dev This is a leverage of all long positions in the system
  //   uint128 shortX96;
  //   /// @dev This is a leverage of all short positions in the system
  //   uint128 longX96;
  // }

  // Leverage public systemLeverage;

  /// @dev [0] - shortLeverageX96, [1] - longLeverageX96
  uint128[2] leveragesX96;

  /// @dev [0] - shortHeap -  heap of short positions, root - the worst short position
  /// [1] - longHeap - heap of long positions, root - the worst long position
  /// Sort key - leverage calculated with discounted collateral, debt
  MaxBinaryHeapLib.Heap[2] private heaps;

  /// @notice users positions
  mapping(address => Position) public positions;

  constructor() {
    factory = address(0xdead);
  }

  /// @inheritdoc IMarginlyPool
  function initialize(
    address _quoteToken,
    address _baseToken,
    uint24 _uniswapFee,
    bool _quoteTokenIsToken0,
    address _uniswapPool,
    MarginlyParams memory _params
  ) external {
    require(factory == address(0), 'FB'); // Forbidden

    factory = msg.sender;
    tokens = [_quoteToken, _baseToken];
    uniswapFee = _uniswapFee;
    quoteTokenIsToken0 = _quoteTokenIsToken0;
    uniswapPool = _uniswapPool;
    params = _params;

    collateralCoeffs[0] = FP96.one();
    collateralCoeffs[1] = FP96.one();
    debtCoeffs[0] = FP96.one();
    debtCoeffs[1] = FP96.one();
    lastReinitTimestampSeconds = block.timestamp;
    unlocked = true;
  }

  function _lock() private view {
    require(unlocked, 'LOK'); // Locked for reentrant call
  }

  /// @dev Protects against reentrancy
  modifier lock() {
    _lock();
    unlocked = false;
    _;
    unlocked = true;
  }

  function _onlyAdminOrManager() private view {
    require(msg.sender == IMarginlyFactory(factory).owner(), 'AD'); // Access denied
  }

  modifier onlyAdminOrManager() {
    _onlyAdminOrManager();
    _;
  }

  /// @inheritdoc IMarginlyPoolOwnerActions
  function setParameters(MarginlyParams calldata _params) external override onlyAdminOrManager {
    params = _params;
  }

  /// @dev Swaps tokens to receive exact amountOut and send at most amountInMaximum
  function swapExactOutput(
    bool quoteIn,
    uint256 amountInMaximum,
    uint256 amountOut
  ) private returns (uint256 amountInActual) {
    address swapRouter = getSwapRouter();
    (address tokenIn, address tokenOut) = quoteIn ? (quoteToken(), baseToken()) : (baseToken(), quoteToken());

    TransferHelper.safeApprove(tokenIn, swapRouter, amountInMaximum);

    amountInActual = ISwapRouter(swapRouter).exactOutputSingle(
      ISwapRouter.ExactOutputSingleParams({
        tokenIn: tokenIn,
        tokenOut: tokenOut,
        fee: uniswapFee,
        recipient: address(this),
        deadline: block.timestamp,
        amountInMaximum: amountInMaximum,
        amountOut: amountOut,
        sqrtPriceLimitX96: 0
      })
    );

    TransferHelper.safeApprove(tokenIn, swapRouter, 0);
  }

  /// @dev Swaps tokens to spend exact amountIn and receive at least amountOutMinimum
  function swapExactInput(
    bool quoteIn,
    uint256 amountIn,
    uint256 amountOutMinimum
  ) private returns (uint256 amountOutActual) {
    address swapRouter = getSwapRouter();
    (address tokenIn, address tokenOut) = quoteIn ? (quoteToken(), baseToken()) : (baseToken(), quoteToken());

    TransferHelper.safeApprove(tokenIn, swapRouter, amountIn);

    amountOutActual = ISwapRouter(swapRouter).exactInputSingle(
      ISwapRouter.ExactInputSingleParams({
        tokenIn: tokenIn,
        tokenOut: tokenOut,
        fee: uniswapFee,
        recipient: address(this),
        deadline: block.timestamp,
        amountIn: amountIn,
        amountOutMinimum: amountOutMinimum,
        sqrtPriceLimitX96: 0
      })
    );
  }

  /// @dev Enact margin call procedure for the position
  /// @param user User's address
  /// @param position User's position to reinit
  function enactMarginCall(address user, Position storage position) private {
    uint256 swapPriceX96;
    if (position._type == PositionType.Short) {
      uint256 realQuoteCollateral = quoteCollateralCoeff().mul(position.discountedAmount[0]);
      uint256 realBaseDebt = baseDebtCoeff().mul(position.discountedAmount[1]);

      // short position mc
      uint baseOutMinimum = FP96.fromRatio(WHOLE_ONE - params.mcSlippage, WHOLE_ONE).mul(
        getCurrentBasePrice().recipMul(realQuoteCollateral)
      );
      uint256 swappedBaseDebt = swapExactInput(true, realQuoteCollateral, baseOutMinimum);
      swapPriceX96 = getSwapPrice(realQuoteCollateral, swappedBaseDebt);
      // baseCollateralCoeff += rcd * (rqc - sqc) / sqc
      if (swappedBaseDebt >= realBaseDebt) {
        // Position has enough collateral to repay debt
        uint256 baseDebtDelta = swappedBaseDebt.sub(realBaseDebt);
        collateralCoeffs[1] = baseCollateralCoeff().add(FP96.fromRatio(baseDebtDelta, discountedBaseCollateral()));
      } else {
        // Position's debt has been repaid by pool
        uint256 baseDebtDelta = realBaseDebt.sub(swappedBaseDebt);
        collateralCoeffs[1] = baseCollateralCoeff().sub(FP96.fromRatio(baseDebtDelta, discountedBaseCollateral()));
      }

      discountedCollaterals[0] = discountedQuoteCollateral().sub(position.discountedAmount[0]);
      discountedDebts[1] = discountedBaseDebt().sub(position.discountedAmount[1]);

      //remove position
      heaps[0].remove(positions, 0);
    } else if (position._type == PositionType.Long) {
      uint256 realBaseCollateral = baseCollateralCoeff().mul(position.discountedAmount[1]);
      uint256 realQuoteDebt = quoteDebtCoeff().mul(position.discountedAmount[0]);

      // long position mc
      uint256 quoteOutMinimum = FP96.fromRatio(WHOLE_ONE - params.mcSlippage, WHOLE_ONE).mul(
        getCurrentBasePrice().mul(realBaseCollateral)
      );
      uint256 swappedQuoteDebt = swapExactInput(false, realBaseCollateral, quoteOutMinimum);
      swapPriceX96 = getSwapPrice(swappedQuoteDebt, realBaseCollateral);
      // quoteCollateralCoef += rqd * (rbc - sbc) / sbc
      if (swappedQuoteDebt >= realQuoteDebt) {
        // Position has enough collateral to repay debt
        uint256 quoteDebtDelta = swappedQuoteDebt.sub(realQuoteDebt);
        collateralCoeffs[0] = quoteCollateralCoeff().add(FP96.fromRatio(quoteDebtDelta, discountedQuoteCollateral()));
      } else {
        // Position's debt has been repaid by pool
        uint256 quoteDebtDelta = realQuoteDebt.sub(swappedQuoteDebt);
        collateralCoeffs[0] = quoteCollateralCoeff().sub(FP96.fromRatio(quoteDebtDelta, discountedQuoteCollateral()));
      }

      discountedCollaterals[1] = discountedBaseCollateral().sub(position.discountedAmount[1]);
      discountedDebts[0] = discountedQuoteDebt().sub(position.discountedAmount[0]);

      //remove position
      heaps[1].remove(positions, 0);
    } else {
      revert('WPT'); // Wrong position type to MC
    }

    delete positions[user];
    emit EnactMarginCall(user, swapPriceX96);
  }

  /// @dev Calculate leverage
  function calcLeverage(uint256 collateral, uint256 debt) private pure returns (uint256 leverage) {
    if (collateral > debt) {
      return Math.mulDiv(FP96.Q96, collateral, collateral - debt);
    } else {
      return FP96.INNER_MAX;
    }
  }

  /// @dev Calculate sort key for ordering long/short positions.
  /// Sort key represents value of debt / collateral both in quoteToken.
  /// as FixedPoint with 10 bits for decimals
  function calcSortKey(uint256 collateral, uint256 debt) private pure returns (uint96) {
    uint96 maxValue = type(uint96).max;
    if (collateral != 0) {
      uint256 result = Math.mulDiv(FP48.Q48, debt, collateral);
      if (result > maxValue) {
        return maxValue;
      } else {
        return uint96(result);
      }
    } else {
      return maxValue;
    }
  }

  function deposit(bool isQuoteDeposit, uint256 amount) internal {
    require(amount != 0, 'ZA'); // Zero amount

    (bool callerMarginCalled, FP96.FixedPoint memory basePrice) = reinitInternal();
    if (callerMarginCalled) {
      return;
    }

    Position storage position = positions[msg.sender];
    bool marginCallHappened;
    if (position._type == PositionType.Uninitialized) {
      position._type = PositionType.Lend;
    } else {
      marginCallHappened = reinitAccount(msg.sender, basePrice);
      if (marginCallHappened) {
        return;
      }
    }

    uint256 tokenIndex = isQuoteDeposit ? 0 : 1;
    PositionType depositTokenInDebtPositionType = isQuoteDeposit ? PositionType.Long : PositionType.Short;

    FP96.FixedPoint memory _collateralCoeff = collateralCoeffs[tokenIndex];
    FP96.FixedPoint memory _debtCoeff = debtCoeffs[tokenIndex];
    uint256 _discountedCollateral = discountedCollaterals[tokenIndex];
    uint256 _discountedDebt = discountedDebts[tokenIndex];

    {
      uint256 poolBalance = _collateralCoeff.mul(_discountedCollateral).sub(_debtCoeff.mul(_discountedDebt));
      uint256 limit = isQuoteDeposit ? params.quoteLimit : params.baseLimit;
      require(poolBalance.add(amount) <= limit, 'EL');  // exceeds limit
    }

    if (position._type == depositTokenInDebtPositionType) {
      // Deposit token is debt token
      uint256 realDebt = _debtCoeff.mul(position.discountedAmount[tokenIndex]);

      if (amount >= realDebt) {
        // Short position debt <= depositAmount, increase collateral on delta, change position to Lend
        // discountedBaseCollateralDelta = (amount - realDebt)/ baseCollateralCoeff
        uint256 discountedCollateralDelta = _collateralCoeff.recipMul(amount.sub(realDebt));
        uint256 discountedDebtDelta = position.discountedAmount[tokenIndex];

        position._type = PositionType.Lend;
        position.discountedAmount[tokenIndex] = discountedCollateralDelta;

        // update aggregates
        discountedCollaterals[tokenIndex] = _discountedCollateral.add(discountedCollateralDelta);
        discountedDebts[tokenIndex] = _discountedDebt.sub(discountedDebtDelta);
      } else {
        // Short position, debt > depositAmount, decrease debt
        // discountedBaseDebtDelta = (realDebt - amount) / coeff
        uint256 discountedDebtDelta = _debtCoeff.recipMul(realDebt.sub(amount));
        position.discountedAmount[tokenIndex] = position.discountedAmount[tokenIndex].sub(discountedDebtDelta); // FIXME: position.disountedAmount to array

        // update aggregates
        discountedDebts[tokenIndex] = _discountedDebt.sub(discountedDebtDelta);
      }
    } else {
      // Deposit token is collateral token

      // Lend position, increase collateral on amount
      // discountedCollateralDelta = amount / baseCollateralCoeff
      uint256 discountedCollateralDelta = _collateralCoeff.recipMul(amount);
      position.discountedAmount[tokenIndex] = position.discountedAmount[tokenIndex].add(
        discountedCollateralDelta
      );

      // update aggregates
      discountedCollaterals[tokenIndex] = _discountedCollateral.add(discountedCollateralDelta);
    }

    updateSystemLeverage(isQuoteDeposit, basePrice);

    marginCallHappened = reinitAccount(msg.sender, basePrice);
    require(!marginCallHappened, 'MC'); // Margin call

    address depositToken = tokens[tokenIndex];
    TransferHelper.safeTransferFrom(depositToken, msg.sender, address(this), amount);

    //FIXME: create Deposit event
    emit Deposit(
      msg.sender,
      isQuoteDeposit,
      amount,
      position._type,
      position.discountedAmount[tokenIndex]
    );
  }

  function depositBase(uint256 amount) external override lock{
    deposit(false, amount);
  }

  function depositQuote(uint256 amount) external override lock {
    deposit(true, amount);
  }

  function withdraw(bool isQuote, uint256 realAmount) internal{
    require(realAmount != 0, 'ZA'); // Zero amount

    Position storage position = positions[msg.sender];

    {
      PositionType _type = position._type;
      require(_type != PositionType.Uninitialized, 'U'); // Uninitialized position
      require(_type != (isQuote ? PositionType.Long : PositionType.Short));
    }

    (bool callerMarginCalled, FP96.FixedPoint memory basePrice) = reinitInternal();
    if (callerMarginCalled) {
      return;
    }

    bool marginCallHappened = reinitAccount(msg.sender, basePrice);
    if (marginCallHappened) {
      return;
    }

    (uint256 tokenIndex, uint256 otherTokenIndex) = isQuote ? (0,1) : (1,0);

    FP96.FixedPoint memory _collateralCoeff = collateralCoeffs[tokenIndex];
    uint256 positionAmount = position.discountedAmount[tokenIndex];

    uint256 realPositionAmount = _collateralCoeff.mul(positionAmount);
    uint256 realAmountToWithdraw;
    bool needToDeletePosition = false;
    uint256 discountedCollateralDelta;

    if (realAmount >= realPositionAmount) {
      // full withdraw
      realAmountToWithdraw = realPositionAmount;
      discountedCollateralDelta = positionAmount;

      needToDeletePosition = position.discountedAmount[otherTokenIndex] == 0;
    } else {
      // partial withdraw
      realAmountToWithdraw = realAmount;
      discountedCollateralDelta = _collateralCoeff.recipMul(realAmountToWithdraw);
    }

    position.discountedAmount[tokenIndex] = positionAmount.sub(discountedCollateralDelta);
    discountedCollaterals[tokenIndex] = discountedCollaterals[tokenIndex].sub(discountedCollateralDelta);

    updateSystemLeverage(isQuote, basePrice);

    marginCallHappened = reinitAccount(msg.sender, basePrice);
    require(!marginCallHappened, 'MC'); // Margin call

    if (needToDeletePosition) {
      delete positions[msg.sender];
    }

    TransferHelper.safeTransfer(tokens[tokenIndex], msg.sender, realAmountToWithdraw);

    emit Withdraw(msg.sender, isQuote, realAmountToWithdraw, discountedCollateralDelta);
  }

  /// @inheritdoc IMarginlyPool
  function withdrawBase(uint256 realAmount) external override lock {
    withdraw(false, realAmount);
  }

  /// @inheritdoc IMarginlyPool
  function withdrawQuote(uint256 realAmount) external override lock {
    withdraw(true, realAmount);
  }

  /// @inheritdoc IMarginlyPool
  function closePosition() external override lock {
    Position storage position = positions[msg.sender];
    require(position._type != PositionType.Uninitialized, 'U'); // Uninitialized position
    require(position._type != PositionType.Lend, 'L'); // Lend, nothing to close

    (bool callerMarginCalled, FP96.FixedPoint memory basePrice) = reinitInternal();
    if (callerMarginCalled) {
      return;
    }

    {
      bool marginCallHappened = reinitAccount(msg.sender, basePrice);
      if (marginCallHappened) {
        return;
      }
    }
    uint256 realCollateralDelta;
    uint256 discountedCollateralDelta;
    address collateralToken;
    uint256 swapPriceX96;
    if (position._type == PositionType.Short) {
      uint256 realQuoteCollateral = quoteCollateralCoeff().mul(position.discountedAmount[0]);
      uint256 realBaseDebt = baseDebtCoeff().mul(position.discountedAmount[1]);

      uint256 swappedQuoteCollateral = swapExactOutput(true, realQuoteCollateral, realBaseDebt);
      swapPriceX96 = getSwapPrice(swappedQuoteCollateral, realBaseDebt);

      //Check slippage below params.positionSlippage
      uint256 quoteInMaximum = FP96.fromRatio(WHOLE_ONE + params.positionSlippage, WHOLE_ONE).mul(
        getCurrentBasePrice().mul(realBaseDebt)
      );
      require(swappedQuoteCollateral <= quoteInMaximum, 'SL'); // Slippage above maximum

      uint256 realFeeAmount = Math.mulDiv(params.swapFee, swappedQuoteCollateral, WHOLE_ONE);
      chargeFee(realFeeAmount);

      uint256 discountedQuoteCollateralDelta = quoteCollateralCoeff().recipMul(
        swappedQuoteCollateral.add(realFeeAmount)
      );

      discountedCollaterals[0] = discountedQuoteCollateral().sub(discountedQuoteCollateralDelta);
      discountedDebts[1] = discountedBaseDebt().sub(position.discountedAmount[1]);

      position.discountedAmount[0] = position.discountedAmount[0].sub(discountedQuoteCollateralDelta);
      position.discountedAmount[1] = 0;
      position._type = PositionType.Lend;

      // update event data
      discountedCollateralDelta = discountedQuoteCollateralDelta;

      uint32 heapIndex = position.heapPosition - 1;
      heaps[0].remove(positions, heapIndex);

      updateSystemLeverage(true, basePrice);

      realCollateralDelta = swappedQuoteCollateral;
      collateralToken = quoteToken();
    } else if (position._type == PositionType.Long) {
      uint256 realBaseCollateral = baseCollateralCoeff().mul(position.discountedAmount[1]);
      uint256 realQuoteDebt = quoteDebtCoeff().mul(position.discountedAmount[0]);

      uint256 realFeeAmount = Math.mulDiv(params.swapFee, realQuoteDebt, WHOLE_ONE);
      uint256 exactQuoteOut = realQuoteDebt.add(realFeeAmount);
      uint256 swappedBaseCollateral = swapExactOutput(false, realBaseCollateral, exactQuoteOut);
      swapPriceX96 = getSwapPrice(exactQuoteOut, swappedBaseCollateral);

      //Check slippage below params.positionSlippage
      uint256 baseInMaximum = FP96.fromRatio(WHOLE_ONE + params.positionSlippage, WHOLE_ONE).mul(
        getCurrentBasePrice().recipMul(exactQuoteOut)
      );
      require(swappedBaseCollateral <= baseInMaximum, 'SL'); // Slippage above maximum

      chargeFee(realFeeAmount);

      uint256 discountedBaseCollateralDelta = baseCollateralCoeff().recipMul(swappedBaseCollateral);

      discountedCollaterals[1] = discountedBaseCollateral().sub(discountedBaseCollateralDelta);
      discountedDebts[0] = discountedQuoteDebt().sub(position.discountedAmount[0]);

      position.discountedAmount[1] = position.discountedAmount[1].sub(discountedBaseCollateralDelta);
      position.discountedAmount[0] = 0;
      position._type = PositionType.Lend;

      // update event data
      discountedCollateralDelta = discountedBaseCollateralDelta;

      uint32 heapIndex = position.heapPosition - 1;
      heaps[1].remove(positions, heapIndex);

      updateSystemLeverage(false, basePrice);

      realCollateralDelta = swappedBaseCollateral;
      collateralToken = baseToken();
    }

    emit ClosePosition(msg.sender, collateralToken, realCollateralDelta, swapPriceX96, discountedCollateralDelta);
  }

  /// @dev Charge swap fee in quote token
  function chargeFee(uint256 feeAmount) private {
    TransferHelper.safeTransfer(quoteToken(), IMarginlyFactory(factory).feeHolder(), feeAmount);
  }

  /// @notice Get oracle price baseToken / quoteToken
  function getBasePrice() public view returns (FP96.FixedPoint memory) {
    uint256 sqrtPriceX96 = OracleLib.getSqrtPriceX96(uniswapPool, params.priceSecondsAgo);
    return sqrtPriceX96ToPrice(sqrtPriceX96);
  }

  /// @notice Get current price of the pool
  function getCurrentBasePrice() public view returns (FP96.FixedPoint memory) {
    (uint256 sqrtPriceX96, , , , , , ) = IUniswapV3Pool(uniswapPool).slot0();
    return sqrtPriceX96ToPrice(sqrtPriceX96);
  }

  function sqrtPriceX96ToPrice(uint256 sqrtPriceX96) private view returns (FP96.FixedPoint memory price) {
    price = FP96.FixedPoint({inner: sqrtPriceX96});
    price = price.mul(price);
    if (quoteTokenIsToken0) {
      // Price quote to base = 1 / basePrice
      price = FP96.fromRatio(FP96.Q96, price.inner);
    }
  }

  /// @inheritdoc IMarginlyPool
  function short(uint256 realBaseAmount) external override lock {
    require(mode == Mode.Regular, 'NA'); // Position opening is not allowed
    require(realBaseAmount >= params.positionMinAmount, 'MA'); //Less than min amount

    (bool callerMarginCalled, FP96.FixedPoint memory basePrice) = reinitInternal();
    if (callerMarginCalled) {
      return;
    }

    bool marginCallHappened = reinitAccount(msg.sender, basePrice);
    if (marginCallHappened) {
      return;
    }

    Position storage position = positions[msg.sender];

    require(
      position._type == PositionType.Short ||
        (position._type == PositionType.Lend && position.discountedAmount[1] == 0),
      'WPT'
    ); // Wrong position type

    // Make swap with max slippage params.positionSlippage
    uint256 quoteOutMinimum = getCurrentBasePrice()
      .mul(FP96.fromRatio(WHOLE_ONE - params.positionSlippage, WHOLE_ONE))
      .mul(realBaseAmount);
    uint256 realQuoteCollateralChangeWithFee = swapExactInput(false, realBaseAmount, quoteOutMinimum);
    uint256 swapPriceX96 = getSwapPrice(realQuoteCollateralChangeWithFee, realBaseAmount);

    uint256 realSwapFee = Math.mulDiv(params.swapFee, realQuoteCollateralChangeWithFee, WHOLE_ONE);
    uint256 realQuoteCollateralChange = realQuoteCollateralChangeWithFee.sub(realSwapFee);

    FP96.FixedPoint memory _quoteCollateralCoeff = quoteCollateralCoeff();
    uint256 _discountedQuoteCollateral = discountedQuoteCollateral();

    // use scope here to avoid "Stack too deep error"
    {
      uint256 poolQuoteBalance = _quoteCollateralCoeff.mul(_discountedQuoteCollateral).sub(
        quoteDebtCoeff().mul(discountedQuoteDebt())
      );
      require(poolQuoteBalance.add(realQuoteCollateralChange) <= params.quoteLimit, 'EL'); // exceeds limit
    }

    uint256 discountedQuoteChange = _quoteCollateralCoeff.recipMul(realQuoteCollateralChange);

    position.discountedAmount[0] = position.discountedAmount[0].add(discountedQuoteChange);
    discountedCollaterals[0] = _discountedQuoteCollateral.add(discountedQuoteChange);
    chargeFee(realSwapFee);

    uint256 discountedBaseDebtChange = baseDebtCoeff().recipMul(realBaseAmount);
    position.discountedAmount[1] = position.discountedAmount[1].add(discountedBaseDebtChange);
    discountedDebts[1] = discountedBaseDebt().add(discountedBaseDebtChange);

    if (position._type == PositionType.Lend) {
      //init heap with default value 1.0
      require(position.heapPosition == 0, 'WP'); // Wrong position heap index
      heaps[0].insert(positions, MaxBinaryHeapLib.Node({key: FP48.Q48, account: msg.sender}));
    }

    position._type = PositionType.Short;

    updateSystemLeverage(true, basePrice);

    marginCallHappened = reinitAccount(msg.sender, basePrice);
    require(!marginCallHappened, 'MC'); // Margin call

    emit Short(msg.sender, realBaseAmount, swapPriceX96, discountedQuoteChange, discountedBaseDebtChange);
  }

  /// @inheritdoc IMarginlyPool
  function long(uint256 realBaseAmount) external override lock {
    require(mode == Mode.Regular, 'NA'); // Position opening is not allowed
    require(realBaseAmount >= params.positionMinAmount, 'MA'); //Less than min amount

    (bool callerMarginCalled, FP96.FixedPoint memory basePrice) = reinitInternal();
    if (callerMarginCalled) {
      return;
    }

    bool marginCallHappened = reinitAccount(msg.sender, basePrice);
    if (marginCallHappened) {
      return;
    }

    FP96.FixedPoint memory _baseCollateralCoeff = baseCollateralCoeff();
    uint256 _discountedBaseCollateral = discountedBaseCollateral();

    {
      uint256 poolBaseBalance = _baseCollateralCoeff.mul(_discountedBaseCollateral) -
        baseDebtCoeff().mul(discountedBaseDebt());
      require(realBaseAmount.add(poolBaseBalance) <= params.baseLimit, 'EL'); // exceeds limit
    }

    Position storage position = positions[msg.sender];
    require(
      position._type == PositionType.Long ||
        (position._type == PositionType.Lend && position.discountedAmount[0] == 0),
      'WPT'
    ); // Wrong position type

    // Make swap with max slippage params.positionSlippage
    uint256 realQuoteInMaximum = getCurrentBasePrice()
      .mul(FP96.fromRatio(WHOLE_ONE + params.positionSlippage, WHOLE_ONE))
      .mul(realBaseAmount);
    uint256 realQuoteAmount = swapExactOutput(true, realQuoteInMaximum, realBaseAmount);
    uint256 swapPriceX96 = getSwapPrice(realQuoteAmount, realBaseAmount);

    uint256 realSwapFee = Math.mulDiv(params.swapFee, realQuoteAmount, WHOLE_ONE);
    realQuoteAmount = realQuoteAmount.add(realSwapFee); // we need to add this fee to position debt
    chargeFee(realSwapFee);

    uint256 discountedBaseCollateralChange = _baseCollateralCoeff.recipMul(realBaseAmount);
    position.discountedAmount[1] = position.discountedAmount[1].add(discountedBaseCollateralChange);
    discountedCollaterals[1] = _discountedBaseCollateral.add(discountedBaseCollateralChange);

    uint256 discountedQuoteDebtChange = quoteDebtCoeff().recipMul(realQuoteAmount);
    position.discountedAmount[0] = position.discountedAmount[0].add(discountedQuoteDebtChange);
    discountedDebts[0] = discountedQuoteDebt().add(discountedQuoteDebtChange);

    if (position._type == PositionType.Lend) {
      require(position.heapPosition == 0, 'WP'); // Wrong position heap index
      //init heap with default value 1.0
      heaps[1].insert(positions, MaxBinaryHeapLib.Node({key: FP48.Q48, account: msg.sender}));
    }

    position._type = PositionType.Long;

    updateSystemLeverage(false, basePrice);

    marginCallHappened = reinitAccount(msg.sender, basePrice);
    require(!marginCallHappened, 'MC'); //Margin call

    emit Long(msg.sender, realBaseAmount, swapPriceX96, discountedQuoteDebtChange, discountedBaseCollateralChange);
  }

  /// @dev Update collateral and debt coeffs in system
  function accrueInterest() private returns (bool) {
    uint256 secondsPassed = block.timestamp - lastReinitTimestampSeconds;
    if (secondsPassed == 0) {
      return false;
    }
    lastReinitTimestampSeconds = block.timestamp;

    FP96.FixedPoint memory secondsInYear = FP96.FixedPoint({inner: SECONDS_IN_YEAR_X96});
    FP96.FixedPoint memory interestRate = FP96.FixedPoint({
      inner: Math.mulDiv(params.interestRate, FP96.Q96, WHOLE_ONE)
    });
    if (discountedBaseCollateral() != 0) {
      FP96.FixedPoint memory baseDebtCoeffMul = FP96.powTaylor(
        interestRate.mul(FP96.FixedPoint({inner: leveragesX96[0]})).div(secondsInYear).add(FP96.one()),
        secondsPassed
      );

      FP96.FixedPoint memory baseDebtCoeffOld = baseDebtCoeff();
      debtCoeffs[1] = baseDebtCoeff().mul(baseDebtCoeffMul);
      collateralCoeffs[1] = baseCollateralCoeff().add(
        FP96.fromRatio(baseDebtCoeff().sub(baseDebtCoeffOld).mul(discountedBaseDebt()), discountedBaseCollateral())
      );
    }

    if (discountedQuoteCollateral() != 0) {
      FP96.FixedPoint memory quoteDebtCoeffMul = FP96.powTaylor(
        interestRate.mul(FP96.FixedPoint({inner: leveragesX96[1]})).div(secondsInYear).add(FP96.one()),
        secondsPassed
      );

      FP96.FixedPoint memory quoteDebtCoeffOld = quoteDebtCoeff();
      debtCoeffs[0] = quoteDebtCoeff().mul(quoteDebtCoeffMul);
      collateralCoeffs[0] = quoteCollateralCoeff().add(
        FP96.fromRatio(quoteDebtCoeff().sub(quoteDebtCoeffOld).mul(discountedQuoteDebt()), discountedQuoteCollateral())
      );
    }

    return true;
  }

  /// @dev Returns max allowable leverage as FP96 value
  function getMaxLeverageX96() private view returns (uint256) {
    return uint256((mode == Mode.Recovery ? params.recoveryMaxLeverage : params.maxLeverage)) << FP96.RESOLUTION;
  }

  /// @inheritdoc IMarginlyPool
  function reinit() external override lock {
    reinitInternal();
  }

  /// @dev Accrue interest and try to reinit riskiest accounts (accounts on top of both heaps)
  function reinitInternal() private returns (bool callerMarginCalled, FP96.FixedPoint memory basePrice) {
    basePrice = getBasePrice();
    if (!accrueInterest()) {
      return (callerMarginCalled, basePrice); // (false, basePrice)
    }

    updateSystemLeverage(false, basePrice);
    updateSystemLeverage(true, basePrice);

    (bool success, MaxBinaryHeapLib.Node memory root) = heaps[0].getNodeByIndex(0);
    if (success) {
      bool marginCallHappened = reinitAccount(root.account, basePrice);
      callerMarginCalled = marginCallHappened && root.account == msg.sender;
    }

    (success, root) = heaps[1].getNodeByIndex(0);
    if (success) {
      bool marginCallHappened = reinitAccount(root.account, basePrice);
      callerMarginCalled = callerMarginCalled || (marginCallHappened && root.account == msg.sender); // since caller can be in short or long position
    }
  }

  /// @dev Recalculates and saves user leverage and enact marginal if needed
  function reinitAccount(address user, FP96.FixedPoint memory basePrice) private returns (bool marginCallHappened) {
    Position storage position = positions[user];

    if (position._type == PositionType.Lend) {
      return false;
    }

    if (initialPrice.inner == 0) {
      initialPrice = basePrice;
    }

    uint256 maxLeverageX96 = getMaxLeverageX96();
    if (position._type == PositionType.Short) {
      uint256 collateral = position.discountedAmount[0];
      uint256 debt = position.discountedAmount[1];

      uint256 realTotalCollateral = quoteCollateralCoeff().mul(collateral);
      uint256 realTotalDebt = baseDebtCoeff().mul(basePrice.mul(debt));

      uint256 leverageX96 = calcLeverage(realTotalCollateral, realTotalDebt);
      if (leverageX96 > maxLeverageX96) {
        enactMarginCall(user, position);
        return true;
      }

      uint96 sortKey = calcSortKey(collateral, initialPrice.mul(debt));

      uint32 heapIndex = position.heapPosition - 1;
      heaps[0].update(positions, heapIndex, sortKey);
    } else if (position._type == PositionType.Long) {
      uint256 collateral = position.discountedAmount[1];
      uint256 debt = position.discountedAmount[0];

      uint256 realTotalCollateral = baseCollateralCoeff().mul(basePrice.mul(collateral));
      uint256 realTotalDebt = quoteDebtCoeff().mul(debt);

      uint256 leverageX96 = calcLeverage(realTotalCollateral, realTotalDebt);
      if (leverageX96 > maxLeverageX96) {
        enactMarginCall(user, position);
        return true;
      }

      uint96 sortKey = calcSortKey(initialPrice.mul(collateral), debt);
      uint32 heapIndex = position.heapPosition - 1;
      heaps[1].update(positions, heapIndex, sortKey);
    }
  }

  /// @inheritdoc IMarginlyPool
  function receivePosition(address badPositionAddress, uint256 quoteAmount, uint256 baseAmount) external override lock {
    require(positions[msg.sender]._type == PositionType.Uninitialized, 'PI'); // Position initialized

    accrueInterest();

    //cache to avoid extra reading
    FP96.FixedPoint memory _quoteCollateralCoeff = quoteCollateralCoeff();
    FP96.FixedPoint memory _baseCollateralCoeff = baseCollateralCoeff();

    uint256 discountedQuoteAmount = _quoteCollateralCoeff.recipMul(quoteAmount);
    uint256 discountedBaseAmount = _baseCollateralCoeff.recipMul(baseAmount);

    Position memory badPosition = positions[badPositionAddress];

    uint256 maxLeverageX96 = getMaxLeverageX96();

    FP96.FixedPoint memory basePrice = getBasePrice();

    if (badPosition._type == PositionType.Short) {
      uint256 realCollateral = _quoteCollateralCoeff.mul(badPosition.discountedAmount[0]);
      uint256 realDebt = baseDebtCoeff().mul(basePrice.mul(badPosition.discountedAmount[1]));

      uint256 leverageX96 = calcLeverage(realCollateral, realDebt);
      require(leverageX96 > maxLeverageX96, 'NL'); // Not liquidatable position

      discountedCollaterals[0] += discountedQuoteAmount;
      badPosition.discountedAmount[0] += discountedQuoteAmount;

      uint32 heapIndex = badPosition.heapPosition - 1;
      if (discountedBaseAmount >= badPosition.discountedAmount[1]) {
        discountedDebts[1] -= badPosition.discountedAmount[1];

        badPosition._type = PositionType.Lend;
        badPosition.heapPosition = 0;
        badPosition.discountedAmount[1] = discountedBaseAmount - badPosition.discountedAmount[1];

        discountedCollaterals[1] += badPosition.discountedAmount[1];

        heaps[0].remove(positions, heapIndex);
      } else {
        badPosition.discountedAmount[1] = badPosition.discountedAmount[1] - discountedBaseAmount;
        discountedDebts[1] -= discountedBaseAmount;

        heaps[0].updateAccount(heapIndex, msg.sender);
      }
    } else if (badPosition._type == PositionType.Long) {
      uint256 realCollateral = _baseCollateralCoeff.mul(basePrice.mul(badPosition.discountedAmount[1]));
      uint256 realDebt = quoteDebtCoeff().mul(badPosition.discountedAmount[0]);

      uint256 leverageX96 = calcLeverage(realCollateral, realDebt);
      require(leverageX96 > maxLeverageX96, 'NL'); // Not liquidatable position

      discountedCollaterals[1] += discountedBaseAmount;
      badPosition.discountedAmount[1] += discountedBaseAmount;

      uint32 heapIndex = badPosition.heapPosition - 1;
      if (discountedQuoteAmount >= badPosition.discountedAmount[0]) {
        discountedDebts[0] -= badPosition.discountedAmount[0];

        badPosition._type = PositionType.Lend;
        badPosition.heapPosition = 0;
        badPosition.discountedAmount[0] = discountedQuoteAmount - badPosition.discountedAmount[0];

        discountedCollaterals[0] += badPosition.discountedAmount[0];

        heaps[1].remove(positions, heapIndex);
      } else {
        badPosition.discountedAmount[0] = badPosition.discountedAmount[0] - discountedQuoteAmount;
        discountedDebts[0] -= discountedQuoteAmount;

        heaps[1].updateAccount(heapIndex, msg.sender);
      }
    } else {
      revert('WPT'); // Wrong position type
    }

    updateSystemLeverage(true, basePrice);
    updateSystemLeverage(false, basePrice);

    // save new position under new key, remove old position
    positions[msg.sender] = badPosition;
    delete positions[badPositionAddress];

    bool marginCallHappened = reinitAccount(msg.sender, basePrice);
    require(!marginCallHappened, 'MC'); // Margin call

    TransferHelper.safeTransferFrom(baseToken(), msg.sender, address(this), baseAmount);
    TransferHelper.safeTransferFrom(quoteToken(), msg.sender, address(this), quoteAmount);

    emit ReceivePosition(
      msg.sender,
      badPositionAddress,
      badPosition._type,
      badPosition.discountedAmount[0],
      badPosition.discountedAmount[1]
    );
  }

  /// @inheritdoc IMarginlyPoolOwnerActions
  function shutDown() external onlyAdminOrManager lock {
    require(mode == Mode.Regular, 'EM'); // Emergency mode activated
    accrueInterest();

    FP96.FixedPoint memory basePrice = getBasePrice();
    uint256 _discountedQuoteCollateral = discountedQuoteCollateral();
    uint256 _discountedBaseCollateral = discountedBaseCollateral();

    /* We use Rounding.Up in baseDebt/quoteDebt calculation 
       to avoid case when "surplus = quoteCollateral - quoteDebt"
       a bit more than IERC20(quoteToken).balanceOf(address(this))
     */

    uint256 baseDebt = baseDebtCoeff().mul(discountedBaseDebt(), Math.Rounding.Up);
    uint256 baseDebtInQuoteUnits = basePrice.mul(baseDebt);
    uint256 quoteCollateral = quoteCollateralCoeff().mul(_discountedQuoteCollateral);

    uint256 quoteDebt = quoteDebtCoeff().mul(discountedQuoteDebt(), Math.Rounding.Up);
    uint256 baseCollateral = baseCollateralCoeff().mul(_discountedBaseCollateral);
    uint256 baseCollateralInQuoteUnits = basePrice.mul(baseCollateral);

    if (baseDebtInQuoteUnits > quoteCollateral) {
      setEmergencyMode(
        Mode.ShortEmergency,
        baseCollateral,
        baseDebt,
        _discountedBaseCollateral,
        quoteCollateral,
        quoteDebt
      );
      return;
    }

    if (quoteDebt > baseCollateralInQuoteUnits) {
      setEmergencyMode(
        Mode.LongEmergency,
        quoteCollateral,
        quoteDebt,
        _discountedQuoteCollateral,
        baseCollateral,
        baseDebt
      );
      return;
    }

    revert('NE'); // No emergency
  }

  ///@dev Set emergency mode and calc emergencyWithdrawCoeff
  function setEmergencyMode(
    Mode _mode,
    uint256 collateral,
    uint256 debt,
    uint256 _discountedCollateral,
    uint256 emergencyCollateral,
    uint256 emergencyDebt
  ) private {
    mode = _mode;

    uint256 newCollateral = collateral >= debt ? collateral - debt : 0;

    if (emergencyCollateral > emergencyDebt) {
      uint256 surplus = emergencyCollateral - emergencyDebt;

      uint256 collateralSurplus = _mode == Mode.ShortEmergency
        ? swapExactInput(true, surplus, 0)
        : swapExactInput(false, surplus, 0);

      newCollateral += collateralSurplus;
    }

    /**
      Explanation:
      emergencyCoeff = collatCoeff * (newCollateral/collateral) = 
        collatCoeff * newCollateral/ (discountedCollateral * collatCoeff) = 
        newCollateral / discountedCollateral
     */

    emergencyWithdrawCoeff = FP96.fromRatio(newCollateral, _discountedCollateral);

    emit Emergency(_mode);
  }

  /// @inheritdoc IMarginlyPoolOwnerActions
  function setRecoveryMode(bool set) external override onlyAdminOrManager {
    require(mode == Mode.Regular || mode == Mode.Recovery);
    mode = set ? Mode.Recovery : Mode.Regular;
  }

  /// @inheritdoc IMarginlyPool
  function emergencyWithdraw() external override lock {
    require(mode != Mode.Regular, 'SM'); // System should be in emergency mode

    Position memory position = positions[msg.sender];
    require(position._type != PositionType.Uninitialized, 'U'); // Uninitialized position

    address token;
    uint256 transferAmount;

    if (mode == Mode.ShortEmergency) {
      require(position._type != PositionType.Short, 'SE'); // Short positions in emergency mode

      transferAmount = emergencyWithdrawCoeff.mul(position.discountedAmount[1]);
      token = baseToken();
    } else {
      require(position._type != PositionType.Long, 'LE'); // Long positions in emergency mode

      transferAmount = emergencyWithdrawCoeff.mul(position.discountedAmount[0]);
      token = quoteToken();
    }

    delete positions[msg.sender];
    TransferHelper.safeTransfer(token, msg.sender, transferAmount);

    emit EmergencyWithdraw(msg.sender, token, transferAmount);
  }

  /// @inheritdoc IMarginlyPool
  function transferPosition(address newOwner) external override lock {
    require(msg.sender != newOwner, 'SO'); // same owner
    require(newOwner != address(0), 'WA'); // wrong address

    (bool callerMarginCalled, FP96.FixedPoint memory basePrice) = reinitInternal();
    if (callerMarginCalled) {
      return;
    }

    bool marginCallHappened = reinitAccount(msg.sender, basePrice);
    if (marginCallHappened) {
      return;
    }

    Position memory positionToTransfer = positions[msg.sender];
    require(positionToTransfer._type != PositionType.Uninitialized, 'U'); // Uninitialized position

    require(positions[newOwner]._type == PositionType.Uninitialized, 'PI'); // Position initialized

    if (positionToTransfer._type == PositionType.Long) {
      heaps[1].updateAccount(positionToTransfer.heapPosition - 1, newOwner);
    } else if (positionToTransfer._type == PositionType.Short) {
      heaps[0].updateAccount(positionToTransfer.heapPosition - 1, newOwner);
    }

    positions[newOwner] = positionToTransfer;
    delete positions[msg.sender];

    emit PositionTransfer(msg.sender, newOwner);
  }

  function updateSystemLeverage(bool isShortLeverageUpdate, FP96.FixedPoint memory basePrice) private {
    (uint256 collateralTokenIndex, uint256 debtTokenIndex) = isShortLeverageUpdate ? (0, 1) : (1, 0);

    if (discountedCollaterals[collateralTokenIndex] == 0) {
      leveragesX96[collateralTokenIndex] = uint128(FP96.Q96);
      return;
    }

    uint256 realCollateral = collateralCoeffs[collateralTokenIndex].mul(discountedCollaterals[collateralTokenIndex]);
    uint256 realDebt = debtCoeffs[debtTokenIndex].mul(discountedDebts[debtTokenIndex]);

    if (isShortLeverageUpdate) {
      realDebt = basePrice.mul(realDebt);
    } else {
      realCollateral = basePrice.mul(realCollateral);
    }

    leveragesX96[collateralTokenIndex] = uint128(Math.mulDiv(FP96.Q96, realCollateral, realCollateral.sub(realDebt)));
  }

  /// @dev for testing purposes
  function getShortHeapPosition(uint32 index) external view returns (bool success, MaxBinaryHeapLib.Node memory) {
    return heaps[0].getNodeByIndex(index);
  }

  /// @dev for testing purposes
  function getLongHeapPosition(uint32 index) external view returns (bool success, MaxBinaryHeapLib.Node memory) {
    return heaps[1].getNodeByIndex(index);
  }

  /// @dev Returns Uniswap SwapRouter address
  function getSwapRouter() private view returns (address) {
    return IMarginlyFactory(factory).swapRouter();
  }

  /// @dev Calculate swap price in Q96
  function getSwapPrice(uint256 quoteAmount, uint256 baseAmount) private pure returns (uint256) {
    return Math.mulDiv(quoteAmount, FP96.Q96, baseAmount);
  }

  /// @inheritdoc IMarginlyPool
  function quoteToken() public view override returns (address) {
    return tokens[0];
  }

  /// @inheritdoc IMarginlyPool
  function baseToken() public view override returns (address) {
    return tokens[1];
  }

  function discountedQuoteCollateral() public view returns (uint256) {
    return discountedCollaterals[0];
  }

  /// @notice Sum of  all base token collateral
  function discountedBaseCollateral() public view returns (uint256) {
    return discountedCollaterals[1];
  }

  /// @notice Sum of all quote token in debt
  function discountedQuoteDebt() public view returns (uint256) {
    return discountedDebts[0];
  }

  /// @dev Sum of all base token in debt
  function discountedBaseDebt() public view returns (uint256) {
    return discountedDebts[1];
  }

  function quoteCollateralCoeff() public view returns (FP96.FixedPoint memory) {
    return collateralCoeffs[0];
  }

  function baseCollateralCoeff() public view returns (FP96.FixedPoint memory) {
    return collateralCoeffs[1];
  }

  function quoteDebtCoeff() public view returns (FP96.FixedPoint memory) {
    return debtCoeffs[0];
  }

  function baseDebtCoeff() public view returns (FP96.FixedPoint memory) {
    return debtCoeffs[1];
  }

  function leverageShortX96() public view returns (uint128) {
    return leveragesX96[0];
  }

  function leverageLongX96() public view returns (uint128) {
    return leveragesX96[1];
  }

  function getPosition(address owner) public view returns (PositionType _type, uint32 heapPosition, uint256 discountedQuoteAmount, uint256 discountedBaseAmount){
    Position memory position = positions[owner];
    _type = position._type;
    heapPosition = position.heapPosition;
    discountedQuoteAmount = position.discountedAmount[0];
    discountedBaseAmount = position.discountedAmount[1];
  }
}
