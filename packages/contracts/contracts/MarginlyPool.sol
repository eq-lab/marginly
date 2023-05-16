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
import './interfaces/IWETH9.sol';
import './dataTypes/MarginlyParams.sol';
import './dataTypes/Position.sol';
import './dataTypes/Mode.sol';
import './libraries/MaxBinaryHeapLib.sol';
import './libraries/OracleLib.sol';
import './libraries/FP48.sol';
import './libraries/FP96.sol';
import './dataTypes/Call.sol';

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

  /// @inheritdoc IMarginlyPool
  address public override quoteToken;
  /// @inheritdoc IMarginlyPool
  address public override baseToken;
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

  /// @dev Sum of all quote token in collateral
  uint256 public discountedQuoteCollateral;
  /// @dev Sum of all quote token in debt
  uint256 public discountedQuoteDebt;
  /// @dev Sum of  all base token collateral
  uint256 public discountedBaseCollateral;
  /// @dev Sum of all base token in debt
  uint256 public discountedBaseDebt;
  /// @dev Timestamp of last reinit execution
  uint256 public lastReinitTimestampSeconds;

  /// @dev Aggregate for base collateral time change calculations
  FP96.FixedPoint public baseCollateralCoeff;
  /// @dev Aggregate for base debt time change calculations
  FP96.FixedPoint public baseDebtCoeff;
  /// @dev Aggregate for quote collateral time change calculations
  FP96.FixedPoint public quoteCollateralCoeff;
  /// @dev Aggregate for quote debt time change calculations
  FP96.FixedPoint public quoteDebtCoeff;
  /// @dev Initial price. Used to sort key calculation.
  FP96.FixedPoint public initialPrice;
  /// @dev Ratio of best side collaterals before and after margin call of opposite side in shutdown mode
  FP96.FixedPoint public emergencyWithdrawCoeff;

  struct Leverage {
    /// @dev This is a leverage of all long positions in the system
    uint128 shortX96;
    /// @dev This is a leverage of all short positions in the system
    uint128 longX96;
  }

  Leverage public systemLeverage;

  ///@dev Heap of short positions, root - the worst short position. Sort key - leverage calculated with discounted collateral, debt
  MaxBinaryHeapLib.Heap private shortHeap;
  ///@dev Heap of long positions, root - the worst long position. Sort key - leverage calculated with discounted collateral, debt
  MaxBinaryHeapLib.Heap private longHeap;

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
    quoteToken = _quoteToken;
    baseToken = _baseToken;
    uniswapFee = _uniswapFee;
    quoteTokenIsToken0 = _quoteTokenIsToken0;
    uniswapPool = _uniswapPool;
    params = _params;

    baseCollateralCoeff = FP96.one();
    baseDebtCoeff = FP96.one();
    quoteCollateralCoeff = FP96.one();
    quoteDebtCoeff = FP96.one();
    lastReinitTimestampSeconds = block.timestamp;
    unlocked = true;
  }

  receive() external payable {
    require(msg.sender == IMarginlyFactory(factory).WETH9(), 'NW9'); // Not WETH9
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

  function _onlyFactoryOwner() private view {
    require(msg.sender == IMarginlyFactory(factory).owner(), 'AD'); // Access denied
  }

  modifier onlyFactoryOwner() {
    _onlyFactoryOwner();
    _;
  }

  /// @inheritdoc IMarginlyPoolOwnerActions
  function setParameters(MarginlyParams calldata _params) external override onlyFactoryOwner {
    params = _params;
  }

  /// @dev Swaps tokens to receive exact amountOut and send at most amountInMaximum
  function swapExactOutput(
    bool quoteIn,
    uint256 amountInMaximum,
    uint256 amountOut
  ) private returns (uint256 amountInActual) {
    address swapRouter = getSwapRouter();
    (address tokenIn, address tokenOut) = quoteIn ? (quoteToken, baseToken) : (baseToken, quoteToken);

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
    (address tokenIn, address tokenOut) = quoteIn ? (quoteToken, baseToken) : (baseToken, quoteToken);

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
      uint256 realQuoteCollateral = quoteCollateralCoeff.mul(position.discountedQuoteAmount);
      uint256 realBaseDebt = baseDebtCoeff.mul(position.discountedBaseAmount);

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
        baseCollateralCoeff = baseCollateralCoeff.add(FP96.fromRatio(baseDebtDelta, discountedBaseCollateral));
      } else {
        // Position's debt has been repaid by pool
        uint256 baseDebtDelta = realBaseDebt.sub(swappedBaseDebt);
        baseCollateralCoeff = baseCollateralCoeff.sub(FP96.fromRatio(baseDebtDelta, discountedBaseCollateral));
      }

      discountedQuoteCollateral = discountedQuoteCollateral.sub(position.discountedQuoteAmount);
      discountedBaseDebt = discountedBaseDebt.sub(position.discountedBaseAmount);

      //remove position
      shortHeap.remove(positions, 0);
    } else if (position._type == PositionType.Long) {
      uint256 realBaseCollateral = baseCollateralCoeff.mul(position.discountedBaseAmount);
      uint256 realQuoteDebt = quoteDebtCoeff.mul(position.discountedQuoteAmount);

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
        quoteCollateralCoeff = quoteCollateralCoeff.add(FP96.fromRatio(quoteDebtDelta, discountedQuoteCollateral));
      } else {
        // Position's debt has been repaid by pool
        uint256 quoteDebtDelta = realQuoteDebt.sub(swappedQuoteDebt);
        quoteCollateralCoeff = quoteCollateralCoeff.sub(FP96.fromRatio(quoteDebtDelta, discountedQuoteCollateral));
      }

      discountedBaseCollateral = discountedBaseCollateral.sub(position.discountedBaseAmount);
      discountedQuoteDebt = discountedQuoteDebt.sub(position.discountedQuoteAmount);

      //remove position
      longHeap.remove(positions, 0);
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

  /// @dev Initialize user position
  function initPosition(Position storage position) private {
    require(position._type == PositionType.Uninitialized, 'PI'); // Position initialized
    require(position.heapPosition == 0, 'HPE'); // Heap position exists

    position._type = PositionType.Lend;
  }

  /// @notice Deposit base token
  /// @param amount Amount of base token to deposit
  /// @param longAmount Amount of base token to open long position
  function depositBase(uint256 amount, uint256 longAmount) private {
    require(amount != 0, 'ZA'); // Zero amount

    (bool callerMarginCalled, FP96.FixedPoint memory basePrice) = reinit();
    if (callerMarginCalled) {
      return;
    }

    Position storage position = positions[msg.sender];
    bool marginCallHappened;
    if (position._type == PositionType.Uninitialized) {
      initPosition(position);
    } else {
      marginCallHappened = reinitAccount(msg.sender, basePrice);
      if (marginCallHappened) {
        return;
      }
    }

    FP96.FixedPoint memory _baseCollateralCoeff = baseCollateralCoeff;
    FP96.FixedPoint memory _baseDebtCoeff = baseDebtCoeff;
    uint256 _discountedBaseCollateral = discountedBaseCollateral;
    uint256 _discountedBaseDebt = discountedBaseDebt;

    uint256 poolBaseBalance = _baseCollateralCoeff.mul(_discountedBaseCollateral).sub(
      _baseDebtCoeff.mul(_discountedBaseDebt)
    );
    require(poolBaseBalance.add(amount) <= params.baseLimit, 'EL'); // exceeds limit

    if (position._type == PositionType.Short) {
      uint256 realBaseDebt = _baseDebtCoeff.mul(position.discountedBaseAmount);

      if (amount >= realBaseDebt) {
        // Short position debt <= depositAmount, increase collateral on delta, change position to Lend
        // discountedBaseCollateralDelta = (amount - realDebt)/ baseCollateralCoeff
        uint256 discountedBaseCollateralDelta = _baseCollateralCoeff.recipMul(amount.sub(realBaseDebt));
        uint256 discountedBaseDebtDelta = position.discountedBaseAmount;

        position._type = PositionType.Lend;
        position.discountedBaseAmount = discountedBaseCollateralDelta;

        // update aggregates
        discountedBaseCollateral = _discountedBaseCollateral.add(discountedBaseCollateralDelta);
        discountedBaseDebt = _discountedBaseDebt.sub(discountedBaseDebtDelta);
      } else {
        // Short position, debt > depositAmount, decrease debt
        // discountedBaseDebtDelta = (realDebt - amount) / coeff
        uint256 discountedBaseDebtDelta = _baseDebtCoeff.recipMul(realBaseDebt.sub(amount));
        position.discountedBaseAmount = position.discountedBaseAmount.sub(discountedBaseDebtDelta);

        // update aggregates
        discountedBaseDebt = _discountedBaseDebt.sub(discountedBaseDebtDelta);
      }
    } else {
      // Lend position, increase collateral on amount
      // discountedCollateralDelta = amount / baseCollateralCoeff
      uint256 discountedCollateralDelta = _baseCollateralCoeff.recipMul(amount);
      position.discountedBaseAmount = position.discountedBaseAmount.add(discountedCollateralDelta);

      // update aggregates
      discountedBaseCollateral = _discountedBaseCollateral.add(discountedCollateralDelta);
    }

    updateSystemLeverageLong(basePrice);

    marginCallHappened = reinitAccount(msg.sender, basePrice);
    require(!marginCallHappened, 'MC'); // Margin call

    wrapAndTransferFrom(baseToken, msg.sender, amount);
    emit DepositBase(msg.sender, amount, position._type, position.discountedBaseAmount);

    if (longAmount != 0) {
      long(longAmount);
    }
  }

  /// @notice Deposit quote token
  /// @param amount Amount of quote token
  /// @param shortAmount Amount of base token to open short position
  function depositQuote(uint256 amount, uint256 shortAmount) private {
    require(amount != 0, 'ZA'); //Zero amount

    (bool callerMarginCalled, FP96.FixedPoint memory basePrice) = reinit();
    if (callerMarginCalled) {
      return;
    }

    Position storage position = positions[msg.sender];
    bool marginCallHappened;
    if (position._type == PositionType.Uninitialized) {
      initPosition(position);
    } else {
      marginCallHappened = reinitAccount(msg.sender, basePrice);
      if (marginCallHappened) {
        return;
      }
    }

    FP96.FixedPoint memory _quoteCollateralCoeff = quoteCollateralCoeff;
    FP96.FixedPoint memory _quoteDebtCoeff = quoteDebtCoeff;
    uint256 _discountedQuoteCollateral = discountedQuoteCollateral;
    uint256 _discountedQuoteDebt = discountedQuoteDebt;

    uint256 poolQuoteBalance = _quoteCollateralCoeff.mul(_discountedQuoteCollateral).sub(
      _quoteDebtCoeff.mul(_discountedQuoteDebt)
    );
    require(poolQuoteBalance.add(amount) <= params.quoteLimit, 'EL'); // exceeds limit

    if (position._type == PositionType.Long) {
      uint256 realQuoteDebt = _quoteDebtCoeff.mul(position.discountedQuoteAmount);

      if (amount >= realQuoteDebt) {
        // Long position, debt <= depositAmount, increase collateral on delta, move position to Lend
        // quoteCollateralChange = (amount - discountedDebt)/ quoteCollateralCoef
        uint256 discountedQuoteCollateralDelta = _quoteCollateralCoeff.recipMul(amount.sub(realQuoteDebt));
        uint256 discountedQuoteDebtDelta = position.discountedQuoteAmount;

        position._type = PositionType.Lend;
        position.discountedQuoteAmount = discountedQuoteCollateralDelta;

        // update aggregates
        discountedQuoteCollateral = _discountedQuoteCollateral.add(discountedQuoteCollateralDelta);
        discountedQuoteDebt = _discountedQuoteDebt.sub(discountedQuoteDebtDelta);
      } else {
        // Long position, debt > depositAmount, decrease debt on delta
        // discountedQuoteDebtDelta -= (realDebt - amount) / coeff
        uint256 discountedQuoteDebtDelta = _quoteDebtCoeff.recipMul(realQuoteDebt.sub(amount));
        position.discountedQuoteAmount = position.discountedQuoteAmount.sub(discountedQuoteDebtDelta);

        // update aggregates
        discountedQuoteDebt = _discountedQuoteDebt.sub(discountedQuoteDebtDelta);
      }
    } else {
      // Lend position, increase collateral on amount
      // discountedQuoteCollateralDelta = amount / quoteCollateralCoeff
      uint256 discountedQuoteCollateralDelta = _quoteCollateralCoeff.recipMul(amount);
      position.discountedQuoteAmount = position.discountedQuoteAmount.add(discountedQuoteCollateralDelta);

      // update aggregates
      discountedQuoteCollateral = _discountedQuoteCollateral.add(discountedQuoteCollateralDelta);
    }

    updateSystemLeverageShort(basePrice);

    marginCallHappened = reinitAccount(msg.sender, basePrice);
    require(!marginCallHappened, 'MC'); // Margin call

    wrapAndTransferFrom(quoteToken, msg.sender, amount);
    emit DepositQuote(msg.sender, amount, position._type, position.discountedQuoteAmount);

    if (shortAmount != 0) {
      short(shortAmount);
    }
  }

  /// @notice Withdraw base token
  /// @param realAmount Amount of base token
  /// @param unwrapWETH flag to unwrap WETH to ETH
  function withdrawBase(uint256 realAmount, bool unwrapWETH) private {
    require(realAmount != 0, 'ZA'); // Zero amount

    Position storage position = positions[msg.sender];
    PositionType _type = position._type;
    require(_type != PositionType.Uninitialized, 'U'); // Uninitialized position
    require(_type != PositionType.Short);

    (bool callerMarginCalled, FP96.FixedPoint memory basePrice) = reinit();
    if (callerMarginCalled) {
      return;
    }

    bool marginCallHappened = reinitAccount(msg.sender, basePrice);
    if (marginCallHappened) {
      return;
    }

    FP96.FixedPoint memory _baseCollateralCoeff = baseCollateralCoeff;
    uint256 positionBaseAmount = position.discountedBaseAmount;

    uint256 realBaseAmount = _baseCollateralCoeff.mul(positionBaseAmount);
    uint256 realAmountToWithdraw;
    bool needToDeletePosition = false;
    uint256 discountedBaseCollateralDelta;
    if (realAmount >= realBaseAmount) {
      // full withdraw
      realAmountToWithdraw = realBaseAmount;
      discountedBaseCollateralDelta = positionBaseAmount;

      needToDeletePosition = position.discountedQuoteAmount == 0;
    } else {
      // partial withdraw
      realAmountToWithdraw = realAmount;
      discountedBaseCollateralDelta = _baseCollateralCoeff.recipMul(realAmountToWithdraw);
    }

    position.discountedBaseAmount = positionBaseAmount.sub(discountedBaseCollateralDelta);
    discountedBaseCollateral = discountedBaseCollateral.sub(discountedBaseCollateralDelta);

    updateSystemLeverageLong(basePrice);

    marginCallHappened = reinitAccount(msg.sender, basePrice);
    require(!marginCallHappened, 'MC'); // Margin call

    if (needToDeletePosition) {
      delete positions[msg.sender];
    }

    unwrapAndTransfer(unwrapWETH, baseToken, msg.sender, realAmountToWithdraw);

    emit WithdrawBase(msg.sender, realAmountToWithdraw, discountedBaseCollateralDelta);
  }

  /// @notice Withdraw quote token
  /// @param realAmount Amount of quote token
  /// @param unwrapWETH flag to unwrap WETH to ETH
  function withdrawQuote(uint256 realAmount, bool unwrapWETH) private {
    require(realAmount != 0, 'ZA'); // Zero amount

    Position storage position = positions[msg.sender];
    PositionType _type = position._type;
    require(_type != PositionType.Uninitialized, 'U'); // Uninitialized position
    require(_type != PositionType.Long);

    (bool callerMarginCalled, FP96.FixedPoint memory basePrice) = reinit();
    if (callerMarginCalled) {
      return;
    }

    bool marginCallHappened = reinitAccount(msg.sender, basePrice);
    if (marginCallHappened) {
      return;
    }

    FP96.FixedPoint memory _quoteCollateralCoeff = quoteCollateralCoeff;
    uint256 positionQuoteAmount = position.discountedQuoteAmount;

    uint256 realQuoteAmount = _quoteCollateralCoeff.mul(positionQuoteAmount);
    uint256 realAmountToWithdraw;
    bool needToDeletePosition = false;
    uint256 discountedQuoteCollateralDelta;
    if (realAmount >= realQuoteAmount) {
      // full withdraw
      realAmountToWithdraw = realQuoteAmount;
      discountedQuoteCollateralDelta = positionQuoteAmount;

      needToDeletePosition = position.discountedBaseAmount == 0;
    } else {
      // partial withdraw
      realAmountToWithdraw = realAmount;
      discountedQuoteCollateralDelta = _quoteCollateralCoeff.recipMul(realAmountToWithdraw);
    }

    position.discountedQuoteAmount = positionQuoteAmount.sub(discountedQuoteCollateralDelta);
    discountedQuoteCollateral = discountedQuoteCollateral.sub(discountedQuoteCollateralDelta);

    updateSystemLeverageShort(basePrice);

    marginCallHappened = reinitAccount(msg.sender, basePrice);
    require(!marginCallHappened, 'MC'); // Margin call

    if (needToDeletePosition) {
      delete positions[msg.sender];
    }

    unwrapAndTransfer(unwrapWETH, quoteToken, msg.sender, realAmountToWithdraw);

    emit WithdrawQuote(msg.sender, realAmountToWithdraw, discountedQuoteCollateralDelta);
  }

  /// @notice Close position
  function closePosition() private {
    Position storage position = positions[msg.sender];
    require(position._type != PositionType.Uninitialized, 'U'); // Uninitialized position
    require(position._type != PositionType.Lend, 'L'); // Lend, nothing to close

    (bool callerMarginCalled, FP96.FixedPoint memory basePrice) = reinit();
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
      uint256 realQuoteCollateral = quoteCollateralCoeff.mul(position.discountedQuoteAmount);
      uint256 realBaseDebt = baseDebtCoeff.mul(position.discountedBaseAmount);

      uint256 swappedQuoteCollateral = swapExactOutput(true, realQuoteCollateral, realBaseDebt);
      swapPriceX96 = getSwapPrice(swappedQuoteCollateral, realBaseDebt);

      //Check slippage below params.positionSlippage
      uint256 quoteInMaximum = FP96.fromRatio(WHOLE_ONE + params.positionSlippage, WHOLE_ONE).mul(
        getCurrentBasePrice().mul(realBaseDebt)
      );
      require(swappedQuoteCollateral <= quoteInMaximum, 'SL'); // Slippage above maximum

      uint256 realFeeAmount = Math.mulDiv(params.swapFee, swappedQuoteCollateral, WHOLE_ONE);
      chargeFee(realFeeAmount);

      swappedQuoteCollateral = swappedQuoteCollateral.add(realFeeAmount);
      uint256 discountedQuoteCollateralDelta = quoteCollateralCoeff.recipMul(swappedQuoteCollateral);

      discountedQuoteCollateral = discountedQuoteCollateral.sub(discountedQuoteCollateralDelta);
      discountedBaseDebt = discountedBaseDebt.sub(position.discountedBaseAmount);

      position.discountedQuoteAmount = position.discountedQuoteAmount.sub(discountedQuoteCollateralDelta);
      position.discountedBaseAmount = 0;
      position._type = PositionType.Lend;

      // update event data
      discountedCollateralDelta = discountedQuoteCollateralDelta;

      uint32 heapIndex = position.heapPosition - 1;
      shortHeap.remove(positions, heapIndex);

      updateSystemLeverageShort(basePrice);

      realCollateralDelta = swappedQuoteCollateral;
      collateralToken = quoteToken;
    } else if (position._type == PositionType.Long) {
      uint256 realBaseCollateral = baseCollateralCoeff.mul(position.discountedBaseAmount);
      uint256 realQuoteDebt = quoteDebtCoeff.mul(position.discountedQuoteAmount);

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

      uint256 discountedBaseCollateralDelta = baseCollateralCoeff.recipMul(swappedBaseCollateral);

      discountedBaseCollateral = discountedBaseCollateral.sub(discountedBaseCollateralDelta);
      discountedQuoteDebt = discountedQuoteDebt.sub(position.discountedQuoteAmount);

      position.discountedBaseAmount = position.discountedBaseAmount.sub(discountedBaseCollateralDelta);
      position.discountedQuoteAmount = 0;
      position._type = PositionType.Lend;

      // update event data
      discountedCollateralDelta = discountedBaseCollateralDelta;

      uint32 heapIndex = position.heapPosition - 1;
      longHeap.remove(positions, heapIndex);

      updateSystemLeverageLong(basePrice);

      realCollateralDelta = swappedBaseCollateral;
      collateralToken = baseToken;
    }

    emit ClosePosition(msg.sender, collateralToken, realCollateralDelta, swapPriceX96, discountedCollateralDelta);
  }

  /// @dev Charge swap fee in quote token
  function chargeFee(uint256 feeAmount) private {
    TransferHelper.safeTransfer(quoteToken, IMarginlyFactory(factory).feeHolder(), feeAmount);
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

  /// @notice Short with leverage
  /// @param realBaseAmount Amount of base token
  function short(uint256 realBaseAmount) private {
    require(realBaseAmount >= params.positionMinAmount, 'MA'); //Less than min amount

    (bool callerMarginCalled, FP96.FixedPoint memory basePrice) = reinit();
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
        (position._type == PositionType.Lend && position.discountedBaseAmount == 0),
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

    FP96.FixedPoint memory _quoteCollateralCoeff = quoteCollateralCoeff;
    uint256 _discountedQuoteCollateral = discountedQuoteCollateral;

    // use scope here to avoid "Stack too deep error"
    {
      uint256 poolQuoteBalance = _quoteCollateralCoeff.mul(_discountedQuoteCollateral).sub(
        quoteDebtCoeff.mul(discountedQuoteDebt)
      );
      require(poolQuoteBalance.add(realQuoteCollateralChange) <= params.quoteLimit, 'EL'); // exceeds limit
    }

    uint256 discountedQuoteChange = _quoteCollateralCoeff.recipMul(realQuoteCollateralChange);

    position.discountedQuoteAmount = position.discountedQuoteAmount.add(discountedQuoteChange);
    discountedQuoteCollateral = _discountedQuoteCollateral.add(discountedQuoteChange);
    chargeFee(realSwapFee);

    uint256 discountedBaseDebtChange = baseDebtCoeff.recipMul(realBaseAmount);
    position.discountedBaseAmount = position.discountedBaseAmount.add(discountedBaseDebtChange);
    discountedBaseDebt = discountedBaseDebt.add(discountedBaseDebtChange);

    if (position._type == PositionType.Lend) {
      //init heap with default value 1.0
      require(position.heapPosition == 0, 'WP'); // Wrong position heap index
      shortHeap.insert(positions, MaxBinaryHeapLib.Node({key: FP48.Q48, account: msg.sender}));
    }

    position._type = PositionType.Short;

    updateSystemLeverageShort(basePrice);

    marginCallHappened = reinitAccount(msg.sender, basePrice);
    require(!marginCallHappened, 'MC'); // Margin call

    emit Short(msg.sender, realBaseAmount, swapPriceX96, discountedQuoteChange, discountedBaseDebtChange);
  }

  /// @notice Long with leverage
  /// @param realBaseAmount Amount of base token
  function long(uint256 realBaseAmount) private {
    require(realBaseAmount >= params.positionMinAmount, 'MA'); //Less than min amount

    (bool callerMarginCalled, FP96.FixedPoint memory basePrice) = reinit();
    if (callerMarginCalled) {
      return;
    }

    bool marginCallHappened = reinitAccount(msg.sender, basePrice);
    if (marginCallHappened) {
      return;
    }

    FP96.FixedPoint memory _baseCollateralCoeff = baseCollateralCoeff;
    uint256 _discountedBaseCollateral = discountedBaseCollateral;

    {
      uint256 poolBaseBalance = _baseCollateralCoeff.mul(_discountedBaseCollateral) -
        baseDebtCoeff.mul(discountedBaseDebt);
      require(realBaseAmount.add(poolBaseBalance) <= params.baseLimit, 'EL'); // exceeds limit
    }

    Position storage position = positions[msg.sender];
    require(
      position._type == PositionType.Long ||
        (position._type == PositionType.Lend && position.discountedQuoteAmount == 0),
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
    position.discountedBaseAmount = position.discountedBaseAmount.add(discountedBaseCollateralChange);
    discountedBaseCollateral = _discountedBaseCollateral.add(discountedBaseCollateralChange);

    uint256 discountedQuoteDebtChange = quoteDebtCoeff.recipMul(realQuoteAmount);
    position.discountedQuoteAmount = position.discountedQuoteAmount.add(discountedQuoteDebtChange);
    discountedQuoteDebt = discountedQuoteDebt.add(discountedQuoteDebtChange);

    if (position._type == PositionType.Lend) {
      require(position.heapPosition == 0, 'WP'); // Wrong position heap index
      //init heap with default value 1.0
      longHeap.insert(positions, MaxBinaryHeapLib.Node({key: FP48.Q48, account: msg.sender}));
    }

    position._type = PositionType.Long;

    updateSystemLeverageLong(basePrice);

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
    if (discountedBaseCollateral != 0) {
      FP96.FixedPoint memory baseDebtCoeffMul = FP96.powTaylor(
        interestRate.mul(FP96.FixedPoint({inner: systemLeverage.shortX96})).div(secondsInYear).add(FP96.one()),
        secondsPassed
      );

      FP96.FixedPoint memory baseDebtCoeffOld = baseDebtCoeff;
      baseDebtCoeff = baseDebtCoeffOld.mul(baseDebtCoeffMul);
      baseCollateralCoeff = baseCollateralCoeff.add(
        FP96.fromRatio(baseDebtCoeff.sub(baseDebtCoeffOld).mul(discountedBaseDebt), discountedBaseCollateral)
      );
    }

    if (discountedQuoteCollateral != 0) {
      FP96.FixedPoint memory quoteDebtCoeffMul = FP96.powTaylor(
        interestRate.mul(FP96.FixedPoint({inner: systemLeverage.longX96})).div(secondsInYear).add(FP96.one()),
        secondsPassed
      );

      FP96.FixedPoint memory quoteDebtCoeffOld = quoteDebtCoeff;
      quoteDebtCoeff = quoteDebtCoeffOld.mul(quoteDebtCoeffMul);
      quoteCollateralCoeff = quoteCollateralCoeff.add(
        FP96.fromRatio(quoteDebtCoeff.sub(quoteDebtCoeffOld).mul(discountedQuoteDebt), discountedQuoteCollateral)
      );
    }

    emit Reinit(lastReinitTimestampSeconds);

    return true;
  }

  /// @dev Accrue interest and try to reinit riskiest accounts (accounts on top of both heaps)
  function reinit() private returns (bool callerMarginCalled, FP96.FixedPoint memory basePrice) {
    basePrice = getBasePrice();
    if (!accrueInterest()) {
      return (callerMarginCalled, basePrice); // (false, basePrice)
    }

    updateSystemLeverageLong(basePrice);
    updateSystemLeverageShort(basePrice);

    (bool success, MaxBinaryHeapLib.Node memory root) = shortHeap.getNodeByIndex(0);
    if (success) {
      bool marginCallHappened = reinitAccount(root.account, basePrice);
      callerMarginCalled = marginCallHappened && root.account == msg.sender;
    }

    (success, root) = longHeap.getNodeByIndex(0);
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

    uint256 maxLeverageX96 = uint256(params.maxLeverage) << FP96.RESOLUTION;
    if (position._type == PositionType.Short) {
      uint256 collateral = position.discountedQuoteAmount;
      uint256 debt = position.discountedBaseAmount;

      uint256 realTotalCollateral = quoteCollateralCoeff.mul(collateral);
      uint256 realTotalDebt = baseDebtCoeff.mul(basePrice.mul(debt));

      uint256 leverageX96 = calcLeverage(realTotalCollateral, realTotalDebt);
      if (leverageX96 > maxLeverageX96) {
        enactMarginCall(user, position);
        return true;
      }

      uint96 sortKey = calcSortKey(collateral, initialPrice.mul(debt));

      uint32 heapIndex = position.heapPosition - 1;
      shortHeap.update(positions, heapIndex, sortKey);
    } else if (position._type == PositionType.Long) {
      uint256 collateral = position.discountedBaseAmount;
      uint256 debt = position.discountedQuoteAmount;

      uint256 realTotalCollateral = baseCollateralCoeff.mul(basePrice.mul(collateral));
      uint256 realTotalDebt = quoteDebtCoeff.mul(debt);

      uint256 leverageX96 = calcLeverage(realTotalCollateral, realTotalDebt);
      if (leverageX96 > maxLeverageX96) {
        enactMarginCall(user, position);
        return true;
      }

      uint96 sortKey = calcSortKey(initialPrice.mul(collateral), debt);
      uint32 heapIndex = position.heapPosition - 1;
      longHeap.update(positions, heapIndex, sortKey);
    }
  }

  /// @notice Liquidate bad position and receive position collateral and debt
  /// @param badPositionAddress address of position to liquidate
  /// @param quoteAmount amount of quote token to be deposited
  /// @param baseAmount amount of base token to be deposited
  function receivePosition(address badPositionAddress, uint256 quoteAmount, uint256 baseAmount) private {
    require(positions[msg.sender]._type == PositionType.Uninitialized, 'PI'); // Position initialized

    accrueInterest();

    //cache to avoid extra reading
    FP96.FixedPoint memory _quoteCollateralCoeff = quoteCollateralCoeff;
    FP96.FixedPoint memory _baseCollateralCoeff = baseCollateralCoeff;

    uint256 discountedQuoteAmount = _quoteCollateralCoeff.recipMul(quoteAmount);
    uint256 discountedBaseAmount = _baseCollateralCoeff.recipMul(baseAmount);

    Position memory badPosition = positions[badPositionAddress];

    uint256 maxLeverageX96 = uint256(params.maxLeverage) << FP96.RESOLUTION;

    FP96.FixedPoint memory basePrice = getBasePrice();

    if (badPosition._type == PositionType.Short) {
      uint256 realCollateral = _quoteCollateralCoeff.mul(badPosition.discountedQuoteAmount);
      uint256 realDebt = baseDebtCoeff.mul(basePrice.mul(badPosition.discountedBaseAmount));

      uint256 leverageX96 = calcLeverage(realCollateral, realDebt);
      require(leverageX96 > maxLeverageX96, 'NL'); // Not liquidatable position

      discountedQuoteCollateral += discountedQuoteAmount;
      badPosition.discountedQuoteAmount += discountedQuoteAmount;

      uint32 heapIndex = badPosition.heapPosition - 1;
      if (discountedBaseAmount >= badPosition.discountedBaseAmount) {
        discountedBaseDebt -= badPosition.discountedBaseAmount;

        badPosition._type = PositionType.Lend;
        badPosition.heapPosition = 0;
        badPosition.discountedBaseAmount = discountedBaseAmount - badPosition.discountedBaseAmount;

        discountedBaseCollateral += badPosition.discountedBaseAmount;

        shortHeap.remove(positions, heapIndex);
      } else {
        badPosition.discountedBaseAmount = badPosition.discountedBaseAmount - discountedBaseAmount;
        discountedBaseDebt -= discountedBaseAmount;

        shortHeap.updateAccount(heapIndex, msg.sender);
      }
    } else if (badPosition._type == PositionType.Long) {
      uint256 realCollateral = _baseCollateralCoeff.mul(basePrice.mul(badPosition.discountedBaseAmount));
      uint256 realDebt = quoteDebtCoeff.mul(badPosition.discountedQuoteAmount);

      uint256 leverageX96 = calcLeverage(realCollateral, realDebt);
      require(leverageX96 > maxLeverageX96, 'NL'); // Not liquidatable position

      discountedBaseCollateral += discountedBaseAmount;
      badPosition.discountedBaseAmount += discountedBaseAmount;

      uint32 heapIndex = badPosition.heapPosition - 1;
      if (discountedQuoteAmount >= badPosition.discountedQuoteAmount) {
        discountedQuoteDebt -= badPosition.discountedQuoteAmount;

        badPosition._type = PositionType.Lend;
        badPosition.heapPosition = 0;
        badPosition.discountedQuoteAmount = discountedQuoteAmount - badPosition.discountedQuoteAmount;

        discountedQuoteCollateral += badPosition.discountedQuoteAmount;

        longHeap.remove(positions, heapIndex);
      } else {
        badPosition.discountedQuoteAmount = badPosition.discountedQuoteAmount - discountedQuoteAmount;
        discountedQuoteDebt -= discountedQuoteAmount;

        longHeap.updateAccount(heapIndex, msg.sender);
      }
    } else {
      revert('WPT'); // Wrong position type
    }

    updateSystemLeverageShort(basePrice);
    updateSystemLeverageLong(basePrice);

    // save new position under new key, remove old position
    positions[msg.sender] = badPosition;
    delete positions[badPositionAddress];

    bool marginCallHappened = reinitAccount(msg.sender, basePrice);
    require(!marginCallHappened, 'MC'); // Margin call

    TransferHelper.safeTransferFrom(baseToken, msg.sender, address(this), baseAmount);
    TransferHelper.safeTransferFrom(quoteToken, msg.sender, address(this), quoteAmount);

    emit ReceivePosition(
      msg.sender,
      badPositionAddress,
      badPosition._type,
      badPosition.discountedQuoteAmount,
      badPosition.discountedBaseAmount
    );
  }

  /// @inheritdoc IMarginlyPoolOwnerActions
  function shutDown() external onlyFactoryOwner lock {
    require(mode == Mode.Regular, 'EM'); // Emergency mode activated
    accrueInterest();

    FP96.FixedPoint memory basePrice = getBasePrice();
    uint256 _discountedQuoteCollateral = discountedQuoteCollateral;
    uint256 _discountedBaseCollateral = discountedBaseCollateral;

    /* We use Rounding.Up in baseDebt/quoteDebt calculation 
       to avoid case when "surplus = quoteCollateral - quoteDebt"
       a bit more than IERC20(quoteToken).balanceOf(address(this))
     */

    uint256 baseDebt = baseDebtCoeff.mul(discountedBaseDebt, Math.Rounding.Up);
    uint256 baseDebtInQuoteUnits = basePrice.mul(baseDebt);
    uint256 quoteCollateral = quoteCollateralCoeff.mul(_discountedQuoteCollateral);

    uint256 quoteDebt = quoteDebtCoeff.mul(discountedQuoteDebt, Math.Rounding.Up);
    uint256 baseCollateral = baseCollateralCoeff.mul(_discountedBaseCollateral);
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
    uint256 discountedCollateral,
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

    emergencyWithdrawCoeff = FP96.fromRatio(newCollateral, discountedCollateral);

    emit Emergency(_mode);
  }

  /// @notice Withdraw position collateral in emergency mode
  /// @param unwrapWETH flag to unwrap WETH to ETH
  function emergencyWithdraw(bool unwrapWETH) private {
    require(mode != Mode.Regular, 'SM'); // System should be in emergency mode

    Position memory position = positions[msg.sender];
    require(position._type != PositionType.Uninitialized, 'U'); // Uninitialized position

    address token;
    uint256 transferAmount;

    if (mode == Mode.ShortEmergency) {
      require(position._type != PositionType.Short, 'SE'); // Short positions in emergency mode

      transferAmount = emergencyWithdrawCoeff.mul(position.discountedBaseAmount);
      token = baseToken;
    } else {
      require(position._type != PositionType.Long, 'LE'); // Long positions in emergency mode

      transferAmount = emergencyWithdrawCoeff.mul(position.discountedQuoteAmount);
      token = quoteToken;
    }

    delete positions[msg.sender];
    unwrapAndTransfer(unwrapWETH, token, msg.sender, transferAmount);

    emit EmergencyWithdraw(msg.sender, token, transferAmount);
  }

  function updateSystemLeverageLong(FP96.FixedPoint memory basePrice) private {
    if (discountedBaseCollateral == 0) {
      systemLeverage.longX96 = uint128(FP96.Q96);
      return;
    }

    uint256 realBaseCollateral = baseCollateralCoeff.mul(basePrice).mul(discountedBaseCollateral);
    uint256 realQuoteDebt = quoteDebtCoeff.mul(discountedQuoteDebt);
    systemLeverage.longX96 = uint128(Math.mulDiv(FP96.Q96, realBaseCollateral, realBaseCollateral.sub(realQuoteDebt)));
  }

  function updateSystemLeverageShort(FP96.FixedPoint memory basePrice) private {
    if (discountedQuoteCollateral == 0) {
      systemLeverage.shortX96 = uint128(FP96.Q96);
      return;
    }

    uint256 realQuoteCollateral = quoteCollateralCoeff.mul(discountedQuoteCollateral);
    uint256 realBaseDebt = baseDebtCoeff.mul(basePrice).mul(discountedBaseDebt);
    systemLeverage.shortX96 = uint128(
      Math.mulDiv(FP96.Q96, realQuoteCollateral, realQuoteCollateral.sub(realBaseDebt))
    );
  }

  /// @dev Wraps ETH into WETH if need and makes transfer from `payer`
  function wrapAndTransferFrom(address token, address payer, uint256 value) private {
    address WETH9 = IMarginlyFactory(factory).WETH9();
    if (token == WETH9 && address(this).balance >= value) {
      IWETH9(WETH9).deposit{value: value}();
    } else {
      TransferHelper.safeTransferFrom(token, payer, address(this), value);
    }
  }

  /// @dev Unwraps WETH to ETH and makes transfer to `recipient`
  function unwrapAndTransfer(bool unwrapWETH, address token, address recipient, uint256 value) private {
    address WETH9 = IMarginlyFactory(factory).WETH9();
    if (unwrapWETH && token == WETH9) {
      IWETH9(WETH9).withdraw(value);
      TransferHelper.safeTransferETH(recipient, value);
    } else {
      TransferHelper.safeTransfer(token, recipient, value);
    }
  }

  /// @inheritdoc IMarginlyPoolOwnerActions
  function sweepETH() external override onlyFactoryOwner {
    if (address(this).balance > 0) {
      TransferHelper.safeTransferETH(msg.sender, address(this).balance);
    }
  }

  /// @dev for testing purposes
  function getShortHeapPosition(uint32 index) external view returns (bool success, MaxBinaryHeapLib.Node memory) {
    return shortHeap.getNodeByIndex(index);
  }

  /// @dev for testing purposes
  function getLongHeapPosition(uint32 index) external view returns (bool success, MaxBinaryHeapLib.Node memory) {
    return longHeap.getNodeByIndex(index);
  }

  /// @dev Returns Uniswap SwapRouter address
  function getSwapRouter() private view returns (address) {
    return IMarginlyFactory(factory).swapRouter();
  }

  /// @dev Calculate swap price in Q96
  function getSwapPrice(uint256 quoteAmount, uint256 baseAmount) private pure returns (uint256) {
    return Math.mulDiv(quoteAmount, FP96.Q96, baseAmount);
  }

  function execute(
    CallType call,
    uint256 amount1,
    uint256 amount2,
    bool unwrapWETH,
    address receivePositionAddress
  ) external payable override lock {
    if (call == CallType.DepositBase) {
      depositBase(amount1, amount2);
    }
    else if (call == CallType.DepositQuote) {
      depositQuote(amount1, amount2);
    }
    else if (call == CallType.WithdrawBase) {
      withdrawBase(amount1, unwrapWETH);
    }
    else if (call == CallType.WithdrawQuote) {
      withdrawQuote(amount1, unwrapWETH);
    }
    else if (call == CallType.Short) {
      short(amount1);
    }
    else if (call == CallType.Long) {
      long(amount1);
    }
    else if (call == CallType.ClosePosition) {
      closePosition();
    }
    else if (call == CallType.Reinit) {
      reinit();
    }
    else if (call == CallType.ReceivePosition) {
      receivePosition(receivePositionAddress, amount1, amount2);
    }
    else if (call == CallType.EmergencyWithdraw) {
      emergencyWithdraw(unwrapWETH);
    }
  }
}
