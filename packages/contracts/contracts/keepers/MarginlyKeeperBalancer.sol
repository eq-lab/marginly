// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import '../dataTypes/Call.sol';
import './MarginlyKeeper.sol';

interface IVault {
  function flashLoan(
    IFlashLoanRecipient recipient,
    IERC20[] memory tokens,
    uint256[] memory amounts,
    bytes memory userData
  ) external;
}

interface IFlashLoanRecipient {
  function receiveFlashLoan(
    IERC20[] memory tokens,
    uint256[] memory amounts,
    uint256[] memory feeAmounts,
    bytes memory userData
  ) external;
}

contract MarginlyKeeperBalancer is MarginlyKeeper, IFlashLoanRecipient {
  using SafeERC20 for IERC20;

  error ZeroAddress();
  error WrongAmount();
  error WrongCaller();

  struct LiquidationParams {
    address marginlyPool;
    address positionToLiquidate;
    address liquidator;
    uint256 minProfit;
    uint256 swapCallData;
  }

  IVault public balancerVault;

  constructor(IVault _balancerVault) {
    if (address(_balancerVault) == address(0)) revert ZeroAddress();

    balancerVault = _balancerVault;
  }

  /// @notice Takes flashloan in uniswap v3 pool to liquidate position in Marginly
  /// @param token Token to borrow
  /// @param amount amount to borrow
  /// @param params encoded LiquidationParams
  function liquidatePosition(address token, uint256 amount, bytes calldata params) external {
    if (amount == 0) revert WrongAmount();
    if (address(token) == address(0)) revert ZeroAddress();

    IERC20[] memory tokens = new IERC20[](1);
    tokens[0] = IERC20(token);

    uint256[] memory amounts = new uint256[](1);
    amounts[0] = amount;

    balancerVault.flashLoan(this, tokens, amounts, params);
  }

  function receiveFlashLoan(
    IERC20[] memory tokens,
    uint256[] memory amounts,
    uint256[] memory feeAmounts,
    bytes memory data
  ) external {
    if (msg.sender != address(balancerVault)) revert WrongCaller();

    LiquidationParams memory liquidateionParams = abi.decode(data, (LiquidationParams));

    _liquidateAndTakeProfit(
      address(tokens[0]),
      amounts[0],
      amounts[0] + feeAmounts[0],
      liquidateionParams.marginlyPool,
      liquidateionParams.positionToLiquidate,
      liquidateionParams.minProfit,
      liquidateionParams.liquidator,
      liquidateionParams.swapCallData
    );
  }
}
