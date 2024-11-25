// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.27;

import '@openzeppelin/contracts/access/Ownable2Step.sol';

struct MarginlyParams {
  uint8 maxLeverage;
  uint24 interestRate;
  uint24 fee;
  uint24 swapFee;
  uint24 mcSlippage;
  uint184 positionMinAmount;
  uint184 quoteLimit;
}

contract MockMarginlyFactory is Ownable2Step {
  address public swapRouter;

  constructor(address initialOwner) Ownable(initialOwner) {}

  function createPool(
    address quoteToken,
    address baseToken,
    address priceOracle,
    uint32 defaultSwapCallData,
    MarginlyParams calldata params
  ) external onlyOwner returns (address pool) {}

  function changeSwapRouter(address newSwapRouter) external onlyOwner {
    swapRouter = newSwapRouter;
  }
}

contract MockMarginlyPool {
  address public factory;

  MarginlyParams public params;

  constructor(address _factory) {
    factory = _factory;
  }

  function _onlyFactoryOwner() private view {
    if (msg.sender != Ownable2Step(factory).owner()) revert('Access denied');
  }

  modifier onlyFactoryOwner() {
    _onlyFactoryOwner();
    _;
  }

  function setParameters(MarginlyParams calldata _params) external onlyFactoryOwner {
    params = _params;
  }

  function shutDown(uint256 swapCalldata) external onlyFactoryOwner {}

  function sweepETH() external onlyFactoryOwner {}

  /// @dev Returns Uniswap SwapRouter address
  function getSwapRouter() private view returns (address) {
    return MockMarginlyFactory(factory).swapRouter();
  }
}
