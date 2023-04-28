// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity =0.7.6;

import '@openzeppelin/contracts/access/AccessControl.sol';

import '@uniswap/v3-core/contracts/libraries/Oracle.sol';
import '@uniswap/v3-core/contracts/libraries/TickMath.sol';
import '@uniswap/v3-core/contracts/libraries/TransferHelper.sol';
import '@uniswap/v3-core/contracts/interfaces/pool/IUniswapV3PoolEvents.sol';
import '@uniswap/v3-core/contracts/libraries/FullMath.sol';
import '@uniswap/v3-core/contracts/libraries/SafeCast.sol';
import '@uniswap/v3-core/contracts/interfaces/callback/IUniswapV3SwapCallback.sol';
import '@uniswap/v3-core/contracts/libraries/LowGasSafeMath.sol';

import './NoDelegateCall.sol';

contract UniswapV3PoolMock is AccessControl, NoDelegateCall, IUniswapV3PoolEvents {
    using LowGasSafeMath for uint256;
    using LowGasSafeMath for int256;
    using SafeCast for uint256;
    using SafeCast for int256;

    using Oracle for Oracle.Observation[65535];

    event SetPrice(uint256 price, uint160 sqrtPriceX96);

    bytes32 public constant ORACLE_ROLE = keccak256('ORACLE_ROLE');
    uint256 public constant PRICE_DENOMINATOR = 10 ** 18;

    address public immutable token0;
    address public immutable token1;
    uint24 public immutable fee;

    struct Slot0 {
        // the current price
        uint160 sqrtPriceX96;
        // the current tick
        int24 tick;
        // the most-recently updated index of the observations array
        uint16 observationIndex;
        // the current maximum number of observations that are being stored
        uint16 observationCardinality;
        // the next maximum number of observations to store, triggered in observations.write
        uint16 observationCardinalityNext;
        // the current protocol fee as a percentage of the swap fee taken on withdrawal
        // represented as an integer denominator (1/x)%
        uint8 feeProtocol;
        // whether the pool is locked
        bool unlocked;
    }

    Slot0 public slot0;

    Oracle.Observation[65535] public observations;

    uint256 public latestPrice;

    modifier lock() {
        require(slot0.unlocked, 'LOK');
        slot0.unlocked = false;
        _;
        slot0.unlocked = true;
    }

    constructor(address oracle, address tokenA, address tokenB, uint24 _fee) {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(ORACLE_ROLE, msg.sender);
        _setupRole(ORACLE_ROLE, oracle);

        (token0, token1) = sortTokens(tokenA, tokenB);
        fee = _fee;
    }

    function _blockTimestamp() internal virtual view returns (uint32) {
        return uint32(block.timestamp); // truncation is desired
    }

    /// @dev Get the pool's balance of token0
    /// @dev This function is gas optimized to avoid a redundant extcodesize check in addition to the returndatasize
    /// check
    function balance0() private view returns (uint256) {
        (bool success, bytes memory data) = token0.staticcall(
            abi.encodeWithSelector(IERC20Minimal.balanceOf.selector, address(this))
        );
        require(success && data.length >= 32);
        return abi.decode(data, (uint256));
    }

    /// @dev Get the pool's balance of token1
    /// @dev This function is gas optimized to avoid a redundant extcodesize check in addition to the returndatasize
    /// check
    function balance1() private view returns (uint256) {
        (bool success, bytes memory data) = token1.staticcall(
            abi.encodeWithSelector(IERC20Minimal.balanceOf.selector, address(this))
        );
        require(success && data.length >= 32);
        return abi.decode(data, (uint256));
    }

    function sortTokens(address tokenA, address tokenB) private pure returns (address, address) {
        if (tokenA > tokenB) (tokenA, tokenB) = (tokenB, tokenA);
        return (tokenA, tokenB);
    }

    modifier onlyOracle() {
        require(hasRole(ORACLE_ROLE, msg.sender), 'Caller is not an oracle');
        _;
    }

    function setPrice(uint256 price, uint160 sqrtPriceX96) external onlyOracle {
        latestPrice = price;

        int24 tick = TickMath.getTickAtSqrtRatio(sqrtPriceX96);

        if (slot0.sqrtPriceX96 == 0) {
            (uint16 cardinality, uint16 cardinalityNext) = observations.initialize(_blockTimestamp());

            slot0 = Slot0({
                sqrtPriceX96: sqrtPriceX96,
                tick: tick,
                observationIndex: 0,
                observationCardinality: cardinality,
                observationCardinalityNext: cardinalityNext,
                feeProtocol: 0,
                unlocked: true
            });
        } else {
            // update tick and write an oracle entry if the tick change
            if (tick != slot0.tick) {
                (uint16 observationIndex, uint16 observationCardinality) = observations.write(
                    slot0.observationIndex,
                    _blockTimestamp(),
                    slot0.tick,
                    0,
                    slot0.observationCardinality,
                    slot0.observationCardinalityNext
                );
                (slot0.sqrtPriceX96, slot0.tick, slot0.observationIndex, slot0.observationCardinality) = (
                sqrtPriceX96,
                tick,
                observationIndex,
                observationCardinality
                );
            } else {
                // otherwise just update the price
                slot0.sqrtPriceX96 = sqrtPriceX96;
            }
        }

        emit SetPrice(price, sqrtPriceX96);
    }

    function observe(
        uint32[] calldata secondsAgos
    ) external view returns (int56[] memory tickCumulatives, uint160[] memory secondsPerLiquidityCumulativeX128s) {
        return
        observations.observe(
            _blockTimestamp(),
            secondsAgos,
            slot0.tick,
            slot0.observationIndex,
            0,
            slot0.observationCardinality
        );
    }

    function increaseObservationCardinalityNext(uint16 observationCardinalityNext)
    external
    lock
    noDelegateCall
    {
        uint16 observationCardinalityNextOld = slot0.observationCardinalityNext;
        // for the event
        uint16 observationCardinalityNextNew =
        observations.grow(observationCardinalityNextOld, observationCardinalityNext);
        slot0.observationCardinalityNext = observationCardinalityNextNew;
        if (observationCardinalityNextOld != observationCardinalityNextNew)
            emit IncreaseObservationCardinalityNext(observationCardinalityNextOld, observationCardinalityNextNew);
    }

    function swap(
        address recipient,
        bool zeroForOne,
        int256 amountSpecified,
        uint160 sqrtPriceLimitX96,
        bytes calldata data
    ) external lock noDelegateCall returns (int256 amount0, int256 amount1) {
        require(amountSpecified != 0, 'AS');

        require(
            zeroForOne
            ? sqrtPriceLimitX96 < slot0.sqrtPriceX96 && sqrtPriceLimitX96 > TickMath.MIN_SQRT_RATIO
            : sqrtPriceLimitX96 > slot0.sqrtPriceX96 && sqrtPriceLimitX96 < TickMath.MAX_SQRT_RATIO,
            'SPL'
        );

        bool exactInput = amountSpecified > 0;
        uint256 amountSpecifiedAbs = uint256(amountSpecified >= 0 ? amountSpecified : - amountSpecified);

        if (exactInput) {
            if (zeroForOne) {
                amount0 = amountSpecified;
                amount1 = - FullMath.mulDiv(amountSpecifiedAbs, latestPrice, PRICE_DENOMINATOR).toInt256();
            } else {
                amount1 = amountSpecified;
                amount0 = - FullMath.mulDiv(amountSpecifiedAbs, PRICE_DENOMINATOR, latestPrice).toInt256();
            }
        } else {
            if (zeroForOne) {
                amount0 = FullMath.mulDiv(amountSpecifiedAbs, PRICE_DENOMINATOR, latestPrice).toInt256();
                amount1 = amountSpecified;
            } else {
                amount1 = FullMath.mulDiv(amountSpecifiedAbs, latestPrice, PRICE_DENOMINATOR).toInt256();
                amount0 = amountSpecified;
            }
        }

        // do the transfers and collect payment
        if (zeroForOne) {
            if (amount1 < 0) TransferHelper.safeTransfer(token1, recipient, uint256(- amount1));

            uint256 balance0Before = balance0();
            IUniswapV3SwapCallback(msg.sender).uniswapV3SwapCallback(amount0, amount1, data);
            require(balance0Before.add(uint256(amount0)) <= balance0(), 'IIA');
        } else {
            if (amount0 < 0) TransferHelper.safeTransfer(token0, recipient, uint256(- amount0));

            uint256 balance1Before = balance1();
            IUniswapV3SwapCallback(msg.sender).uniswapV3SwapCallback(amount0, amount1, data);
            require(balance1Before.add(uint256(amount1)) <= balance1(), 'IIA');
        }

        uint160 sqrtPriceX96 = slot0.sqrtPriceX96;
        int24 tick = TickMath.getTickAtSqrtRatio(sqrtPriceX96);
        emit Swap(msg.sender, recipient, amount0, amount1, sqrtPriceX96, 0, tick);
    }
}
