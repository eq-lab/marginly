// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

import '@aave/core-v3/contracts/interfaces/IPool.sol';
import '@aave/core-v3/contracts/flashloan/interfaces/IFlashLoanSimpleReceiver.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

contract MockAavePool is IPool {
  function mintUnbacked(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external {}

  function backUnbacked(address asset, uint256 amount, uint256 fee) external pure returns (uint256) {
    return 0;
  }

  function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external {}

  function supplyWithPermit(
    address asset,
    uint256 amount,
    address onBehalfOf,
    uint16 referralCode,
    uint256 deadline,
    uint8 permitV,
    bytes32 permitR,
    bytes32 permitS
  ) external {}

  function withdraw(address asset, uint256 amount, address to) external returns (uint256) {}

  function borrow(
    address asset,
    uint256 amount,
    uint256 interestRateMode,
    uint16 referralCode,
    address onBehalfOf
  ) external {}

  function repay(
    address asset,
    uint256 amount,
    uint256 interestRateMode,
    address onBehalfOf
  ) external returns (uint256) {
    return 0;
  }

  function repayWithPermit(
    address asset,
    uint256 amount,
    uint256 interestRateMode,
    address onBehalfOf,
    uint256 deadline,
    uint8 permitV,
    bytes32 permitR,
    bytes32 permitS
  ) external returns (uint256) {
    return 0;
  }

  function repayWithATokens(address asset, uint256 amount, uint256 interestRateMode) external pure returns (uint256) {
    return 0;
  }

  function swapBorrowRateMode(address asset, uint256 interestRateMode) external {}

  function rebalanceStableBorrowRate(address asset, address user) external {}

  function setUserUseReserveAsCollateral(address asset, bool useAsCollateral) external {}

  function liquidationCall(
    address collateralAsset,
    address debtAsset,
    address user,
    uint256 debtToCover,
    bool receiveAToken
  ) external {}

  function flashLoan(
    address receiverAddress,
    address[] calldata assets,
    uint256[] calldata amounts,
    uint256[] calldata interestRateModes,
    address onBehalfOf,
    bytes calldata params,
    uint16 referralCode
  ) external {}

  function flashLoanSimple(
    address receiverAddress,
    address asset,
    uint256 amount,
    bytes calldata params,
    uint16 referralCode
  ) external {
    uint256 balanceBefore = IERC20(asset).balanceOf(address(this));

    IFlashLoanSimpleReceiver receiver = IFlashLoanSimpleReceiver(receiverAddress);
    uint256 premium = (amount / 10000) * 9; // 0.09 %

    require(receiver.executeOperation(asset, amount, premium, msg.sender, params), 'Invalid flashloan return');
    IERC20(asset).transferFrom(msg.sender, address(this), amount + premium);

    uint256 balanceAfter = IERC20(asset).balanceOf(address(this));

    require(balanceAfter >= balanceBefore + premium, 'Payback amount not enough');
  }

  function getUserAccountData(
    address user
  )
    external
    view
    returns (
      uint256 totalCollateralBase,
      uint256 totalDebtBase,
      uint256 availableBorrowsBase,
      uint256 currentLiquidationThreshold,
      uint256 ltv,
      uint256 healthFactor
    )
  {}

  function initReserve(
    address asset,
    address aTokenAddress,
    address stableDebtAddress,
    address variableDebtAddress,
    address interestRateStrategyAddress
  ) external {}

  function dropReserve(address asset) external {}

  function setReserveInterestRateStrategyAddress(address, address) external {}

  function setConfiguration(address, DataTypes.ReserveConfigurationMap calldata) external {}

  function getConfiguration(address) external view returns (DataTypes.ReserveConfigurationMap memory) {}

  function getUserConfiguration(address) external view returns (DataTypes.UserConfigurationMap memory) {}

  function getReserveNormalizedIncome(address) external pure returns (uint256) {
    return 0;
  }

  function getReserveNormalizedVariableDebt(address) external pure returns (uint256) {
    return 0;
  }

  function getReserveData(address asset) external pure returns (DataTypes.ReserveData memory) {}

  function finalizeTransfer(
    address asset,
    address from,
    address to,
    uint256 amount,
    uint256 balanceFromBefore,
    uint256 balanceToBefore
  ) external {}

  function getReservesList() external pure returns (address[] memory) {}

  function getReserveAddressById(uint16) external pure returns (address) {
    return address(0);
  }

  function ADDRESSES_PROVIDER() external pure returns (IPoolAddressesProvider) {
    return IPoolAddressesProvider(address(0));
  }

  function updateBridgeProtocolFee(uint256) external {}

  function updateFlashloanPremiums(uint128, uint128) external {}

  function configureEModeCategory(uint8, DataTypes.EModeCategory memory) external {}

  function getEModeCategoryData(uint8) external pure returns (DataTypes.EModeCategory memory) {}

  function setUserEMode(uint8) external {}

  function getUserEMode(address) external pure returns (uint256) {
    return 0;
  }

  function resetIsolationModeTotalDebt(address) external {}

  function MAX_STABLE_RATE_BORROW_SIZE_PERCENT() external pure returns (uint256) {
    return 0;
  }

  function FLASHLOAN_PREMIUM_TOTAL() external pure returns (uint128) {
    return 0;
  }

  function BRIDGE_PROTOCOL_FEE() external pure returns (uint256) {
    return 0;
  }

  function FLASHLOAN_PREMIUM_TO_PROTOCOL() external pure returns (uint128) {
    return 0;
  }

  function MAX_NUMBER_RESERVES() external pure returns (uint16) {
    return 0;
  }

  function mintToTreasury(address[] calldata assets) external {}

  function rescueTokens(address token, address to, uint256 amount) external {}

  function deposit(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) external {}
}
