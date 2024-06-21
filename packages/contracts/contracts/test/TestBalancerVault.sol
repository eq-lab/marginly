// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

import '@openzeppelin/contracts/utils/math/Math.sol';
import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

interface IFlashLoanRecipient {
  function receiveFlashLoan(
    IERC20[] memory tokens,
    uint256[] memory amounts,
    uint256[] memory feeAmounts,
    bytes memory userData
  ) external;
}

contract TestBalancerVault {
  event FlashLoan(IFlashLoanRecipient indexed recipient, IERC20 indexed token, uint256 amount, uint256 feeAmount);

  function flashLoan(
    IFlashLoanRecipient recipient,
    IERC20[] memory tokens,
    uint256[] memory amounts,
    bytes memory userData
  ) external {
    uint256 feeAmount = 1000; //0.1% 1000/_1000_000 = 0.001
    uint256[] memory feeAmounts = new uint256[](tokens.length);
    uint256[] memory preLoanBalances = new uint256[](tokens.length);

    for (uint256 i = 0; i < tokens.length; ++i) {
      IERC20 token = tokens[i];
      uint256 amount = amounts[i];

      preLoanBalances[i] = token.balanceOf(address(this));
      feeAmounts[i] = Math.mulDiv(amount, feeAmount, 1e6, Math.Rounding.Up);

      require(preLoanBalances[i] >= amount, 'INSUFFICIENT_FLASH_LOAN_BALANCE');
      TransferHelper.safeTransfer(address(token), address(recipient), amount);
    }

    recipient.receiveFlashLoan(tokens, amounts, feeAmounts, userData);

    for (uint256 i = 0; i < tokens.length; ++i) {
      IERC20 token = tokens[i];
      uint256 preLoanBalance = preLoanBalances[i];

      // Checking for loan repayment first (without accounting for fees) makes for simpler debugging, and results
      // in more accurate revert reasons if the flash loan protocol fee percentage is zero.
      uint256 postLoanBalance = token.balanceOf(address(this));
      require(postLoanBalance >= preLoanBalance, 'INVALID_POST_LOAN_BALANCE');

      // No need for checked arithmetic since we know the loan was fully repaid.
      uint256 receivedFeeAmount = postLoanBalance - preLoanBalance;
      require(receivedFeeAmount >= feeAmounts[i], 'INSUFFICIENT_FLASH_LOAN_FEE_AMOUNT');

      emit FlashLoan(recipient, token, amounts[i], receivedFeeAmount);
    }
  }
}
