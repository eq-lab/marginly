// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';

contract TestWooPPV2 {
  struct DecimalInfo {
    uint64 priceDec;
    uint64 quoteDec;
    uint64 baseDec;
  }

  struct TokenInfo {
    uint192 reserve;
    uint16 feeRate;
  }

  struct State {
    uint128 price;
    uint64 spread;
    uint64 coeff;
    bool woFeasible;
  }

  address constant ETH_PLACEHOLDER_ADDR = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

  uint256 public unclaimedFee;

  mapping(address => bool) public isAdmin;

  mapping(address => TokenInfo) public tokenInfos;

  address[] tokenList;

  address public immutable quoteToken;

  constructor(address _quoteToken) {
    quoteToken = _quoteToken;
  }

  function tryQuery(address fromToken, address toToken, uint256 fromAmount) external view returns (uint256 toAmount) {
    if (fromToken == quoteToken) {
      toAmount = _tryQuerySellQuote(toToken, fromAmount);
    } else if (toToken == quoteToken) {
      toAmount = _tryQuerySellBase(fromToken, fromAmount);
    } else {
      (toAmount, ) = _tryQueryBaseToBase(fromToken, toToken, fromAmount);
    }
  }

  function query(address fromToken, address toToken, uint256 fromAmount) external view returns (uint256 toAmount) {
    if (fromToken == quoteToken) {
      toAmount = _tryQuerySellQuote(toToken, fromAmount);
    } else if (toToken == quoteToken) {
      toAmount = _tryQuerySellBase(fromToken, fromAmount);
    } else {
      uint256 swapFee;
      (toAmount, swapFee) = _tryQueryBaseToBase(fromToken, toToken, fromAmount);
      require(swapFee <= tokenInfos[quoteToken].reserve, 'WooPPV2: INSUFF_QUOTE_FOR_SWAPFEE');
    }
    require(toAmount <= tokenInfos[toToken].reserve, 'WooPPV2: INSUFF_BALANCE');
  }

  function swap(
    address fromToken,
    address toToken,
    uint256 fromAmount,
    uint256 minToAmount,
    address to,
    address rebateTo
  ) external returns (uint256 realToAmount) {
    if (fromToken == quoteToken) {
      realToAmount = _sellQuote(toToken, fromAmount, minToAmount, to, rebateTo);
    } else if (toToken == quoteToken) {
      realToAmount = _sellBase(fromToken, fromAmount, minToAmount, to, rebateTo);
    } else {
      realToAmount = _swapBaseToBase(fromToken, toToken, fromAmount, minToAmount, to, rebateTo);
    }
  }

  function sync(address token) external {
    tokenInfos[token].reserve = uint192(IERC20(token).balanceOf(address(this)));
    tokenList.push(token);
  }

  function _tryQuerySellBase(address baseToken, uint256 baseAmount) private view returns (uint256 quoteAmount) {
    State memory state = getTokenState(baseToken);
    (quoteAmount, ) = _calcQuoteAmountSellBase(baseToken, baseAmount, state);
    uint256 fee = (quoteAmount * tokenInfos[baseToken].feeRate) / 1e5;
    quoteAmount = quoteAmount - fee;
  }

  function _tryQuerySellQuote(address baseToken, uint256 quoteAmount) private view returns (uint256 baseAmount) {
    uint256 swapFee = (quoteAmount * tokenInfos[baseToken].feeRate) / 1e5;
    quoteAmount = quoteAmount - swapFee;
    State memory state = getTokenState(baseToken);
    (baseAmount, ) = _calcBaseAmountSellQuote(baseToken, quoteAmount, state);
  }

  function _tryQueryBaseToBase(
    address baseToken1,
    address baseToken2,
    uint256 base1Amount
  ) private view returns (uint256 base2Amount, uint256 swapFee) {
    if (baseToken1 == address(0) || baseToken2 == address(0) || baseToken1 == quoteToken || baseToken2 == quoteToken) {
      return (0, 0);
    }

    State memory state1 = getTokenState(baseToken1);
    State memory state2 = getTokenState(baseToken2);

    uint64 spread = _maxUInt64(state1.spread, state2.spread) / 2;
    uint16 feeRate = _maxUInt16(tokenInfos[baseToken1].feeRate, tokenInfos[baseToken2].feeRate);

    state1.spread = spread;
    state2.spread = spread;

    (uint256 quoteAmount, ) = _calcQuoteAmountSellBase(baseToken1, base1Amount, state1);

    swapFee = (quoteAmount * feeRate) / 1e5;
    quoteAmount = quoteAmount - swapFee;

    (base2Amount, ) = _calcBaseAmountSellQuote(baseToken2, quoteAmount, state2);
  }

  function _sellBase(
    address baseToken,
    uint256 baseAmount,
    uint256 minQuoteAmount,
    address to,
    address rebateTo
  ) private returns (uint256 quoteAmount) {
    require(baseToken != address(0), 'WooPPV2: !baseToken');
    require(to != address(0), 'WooPPV2: !to');
    require(baseToken != quoteToken, 'WooPPV2: baseToken==quoteToken');

    require(
      IERC20(baseToken).balanceOf(address(this)) - tokenInfos[baseToken].reserve >= baseAmount,
      'WooPPV2: BASE_BALANCE_NOT_ENOUGH'
    );

    {
      uint256 newPrice;
      State memory state = getTokenState(baseToken);
      (quoteAmount, newPrice) = _calcQuoteAmountSellBase(baseToken, baseAmount, state);
    }

    uint256 swapFee = (quoteAmount * tokenInfos[baseToken].feeRate) / 1e5;
    quoteAmount = quoteAmount - swapFee;
    require(quoteAmount >= minQuoteAmount, 'WooPPV2: quoteAmount_LT_minQuoteAmount');

    unclaimedFee = unclaimedFee + swapFee;

    tokenInfos[baseToken].reserve = uint192(tokenInfos[baseToken].reserve + baseAmount);
    tokenInfos[quoteToken].reserve = uint192(tokenInfos[quoteToken].reserve - quoteAmount - swapFee);

    if (to != address(this)) {
      TransferHelper.safeTransfer(quoteToken, to, quoteAmount);
    }
  }

  function _sellQuote(
    address baseToken,
    uint256 quoteAmount,
    uint256 minBaseAmount,
    address to,
    address rebateTo
  ) private returns (uint256 baseAmount) {
    require(baseToken != address(0), 'WooPPV2: !baseToken');
    require(to != address(0), 'WooPPV2: !to');
    require(baseToken != quoteToken, 'WooPPV2: baseToken==quoteToken');

    require(
      IERC20(quoteToken).balanceOf(address(this)) - tokenInfos[quoteToken].reserve >= quoteAmount,
      'WooPPV2: QUOTE_BALANCE_NOT_ENOUGH'
    );

    uint256 swapFee = (quoteAmount * tokenInfos[baseToken].feeRate) / 1e5;
    quoteAmount = quoteAmount - swapFee;
    unclaimedFee = unclaimedFee + swapFee;

    {
      uint256 newPrice;
      State memory state = getTokenState(baseToken);
      (baseAmount, newPrice) = _calcBaseAmountSellQuote(baseToken, quoteAmount, state);
      // console.log('Post new price:', newPrice, newPrice/1e8);
      require(baseAmount >= minBaseAmount, 'WooPPV2: baseAmount_LT_minBaseAmount');
    }

    tokenInfos[baseToken].reserve = uint192(tokenInfos[baseToken].reserve - baseAmount);
    tokenInfos[quoteToken].reserve = uint192(tokenInfos[quoteToken].reserve + quoteAmount);

    if (to != address(this)) {
      TransferHelper.safeTransfer(baseToken, to, baseAmount);
    }
  }

  function _swapBaseToBase(
    address baseToken1,
    address baseToken2,
    uint256 base1Amount,
    uint256 minBase2Amount,
    address to,
    address rebateTo
  ) private returns (uint256 base2Amount) {
    require(baseToken1 != address(0) && baseToken1 != quoteToken, 'WooPPV2: !baseToken1');
    require(baseToken2 != address(0) && baseToken2 != quoteToken, 'WooPPV2: !baseToken2');
    require(to != address(0), 'WooPPV2: !to');

    // require(
    //   IERC20(baseToken1).balanceOf(address(this)) - tokenInfos[baseToken1].reserve >= base1Amount,
    //   'WooPPV2: !BASE1_BALANCE'
    // );

    State memory state1 = getTokenState(baseToken1);
    State memory state2 = getTokenState(baseToken2);

    uint256 swapFee;
    uint256 quoteAmount;
    {
      uint64 spread = _maxUInt64(state1.spread, state2.spread) / 2;
      uint16 feeRate = _maxUInt16(tokenInfos[baseToken1].feeRate, tokenInfos[baseToken2].feeRate);

      state1.spread = spread;
      state2.spread = spread;

      uint256 newBase1Price;
      (quoteAmount, newBase1Price) = _calcQuoteAmountSellBase(baseToken1, base1Amount, state1);

      swapFee = (quoteAmount * feeRate) / 1e5;
    }

    quoteAmount = quoteAmount - swapFee;
    unclaimedFee = unclaimedFee + swapFee;

    tokenInfos[quoteToken].reserve = uint192(tokenInfos[quoteToken].reserve - swapFee);
    tokenInfos[baseToken1].reserve = uint192(tokenInfos[baseToken1].reserve + base1Amount);

    {
      uint256 newBase2Price;
      (base2Amount, newBase2Price) = _calcBaseAmountSellQuote(baseToken2, quoteAmount, state2);
      require(base2Amount >= minBase2Amount, 'WooPPV2: base2Amount_LT_minBase2Amount');
    }

    tokenInfos[baseToken2].reserve = uint192(tokenInfos[baseToken2].reserve - base2Amount);

    if (to != address(this)) {
      TransferHelper.safeTransfer(baseToken2, to, base2Amount);
    }
  }

  /// @dev Get the pool's balance of the specified token
  /// @dev This function is gas optimized to avoid a redundant extcodesize check in addition to the returndatasize
  /// @dev forked and curtesy by Uniswap v3 core
  function _rawBalance(address token) private view returns (uint256) {
    (bool success, bytes memory data) = token.staticcall(
      abi.encodeWithSelector(IERC20.balanceOf.selector, address(this))
    );
    require(success && data.length >= 32, 'WooPPV2: !BALANCE');
    return abi.decode(data, (uint256));
  }

  function _calcQuoteAmountSellBase(
    address baseToken,
    uint256 baseAmount,
    State memory state
  ) private view returns (uint256 quoteAmount, uint256 newPrice) {
    require(state.woFeasible, 'WooPPV2: !ORACLE_FEASIBLE');

    DecimalInfo memory decs = defaultDecs(); // = decimalInfo(baseToken);

    // quoteAmount = baseAmount * oracle.price * (1 - oracle.k * baseAmount * oracle.price - oracle.spread)
    {
      uint256 coef = uint256(1e18) -
        ((uint256(state.coeff) * baseAmount * state.price) / decs.baseDec / decs.priceDec) -
        state.spread;
      quoteAmount = (((baseAmount * decs.quoteDec * state.price) / decs.priceDec) * coef) / 1e18 / decs.baseDec;
    }

    // newPrice = oracle.price * (1 - 2 * k * oracle.price * baseAmount)
    newPrice =
      ((uint256(1e18) - (uint256(2) * state.coeff * state.price * baseAmount) / decs.priceDec / decs.baseDec) *
        state.price) /
      1e18;
  }

  function _calcBaseAmountSellQuote(
    address baseToken,
    uint256 quoteAmount,
    State memory state
  ) private view returns (uint256 baseAmount, uint256 newPrice) {
    require(state.woFeasible, 'WooPPV2: !ORACLE_FEASIBLE');

    DecimalInfo memory decs = defaultDecs(); // = decimalInfo(baseToken);

    // baseAmount = quoteAmount / oracle.price * (1 - oracle.k * quoteAmount - oracle.spread)
    {
      uint256 coef = uint256(1e18) - (quoteAmount * state.coeff) / decs.quoteDec - state.spread;
      baseAmount = (((quoteAmount * decs.baseDec * decs.priceDec) / state.price) * coef) / 1e18 / decs.quoteDec;
    }

    // new_price = oracle.price * (1 + 2 * k * quoteAmount)
    newPrice =
      ((uint256(1e18) * decs.quoteDec + uint256(2) * state.coeff * quoteAmount) * state.price) /
      decs.quoteDec /
      1e18;
  }

  function _maxUInt16(uint16 a, uint16 b) private pure returns (uint16) {
    return a > b ? a : b;
  }

  function _maxUInt64(uint64 a, uint64 b) private pure returns (uint64) {
    return a > b ? a : b;
  }

  function getTokenState(address token) public view returns (State memory) {
    uint128 price;
    if (tokenList[0] == token) {
      price = 100;
    } else if (tokenList[1] == token) {
      price = 10;
    } else revert();
    return State({price: price, spread: 0, coeff: 1, woFeasible: true});
  }

  function defaultDecs() private pure returns (DecimalInfo memory) {
    return DecimalInfo({priceDec: 1, quoteDec: 1, baseDec: 1});
  }
}
