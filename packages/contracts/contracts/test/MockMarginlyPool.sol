// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

import '../interfaces/IMarginlyPool.sol';
import '../dataTypes/Position.sol';
import '../dataTypes/Call.sol';

contract MockMarginlyPool is IMarginlyPool {
  address public override quoteToken;
  address public override baseToken;
  address public override factory;
  uint32 public override defaultSwapCallData;

  address private badPositionAddress;
  uint256 private quoteAmount;
  uint256 private baseAmount;
  uint256 private dust = 1000; // some sweep
  PositionType private positionType;

  constructor(address _factory, address _quoteToken, address _baseToken) {
    factory = _factory;
    quoteToken = _quoteToken;
    baseToken = _baseToken;
  }

  function setBadPosition(
    address _badPositionAddress,
    uint256 _quoteAmount,
    uint256 _baseAmount,
    PositionType _positionType
  ) external {
    badPositionAddress = _badPositionAddress;
    quoteAmount = _quoteAmount;
    baseAmount = _baseAmount;

    require(_positionType == PositionType.Short || _positionType == PositionType.Long, 'Wrong position type');
    positionType = _positionType;
  }

  function initialize(
    address _quoteToken,
    address _baseToken,
    address _priceOracle,
    uint32 _defaultSwapCallData,
    MarginlyParams memory _params,
    bytes memory priceOracleOptions
  ) external {}

  function setParameters(MarginlyParams calldata _params) external {}

  function shutDown(uint256 swapCalldata) external {}

  function setRecoveryMode(bool set) external {}

  function priceOracle() external pure returns (address) {}

  function execute(
    CallType call,
    uint256 amount1,
    uint256 amount2,
    uint256 limitPriceX96,
    bool unwrapWETH,
    address receivePositionAddress,
    uint256 swapCalldata
  ) external payable override {
    if (call == CallType.ReceivePosition) {
      require(receivePositionAddress == badPositionAddress);

      IERC20(quoteToken).transferFrom(msg.sender, address(this), amount1);
      IERC20(baseToken).transferFrom(msg.sender, address(this), amount2);
    } else if (call == CallType.WithdrawBase) {
      if (positionType == PositionType.Short) {
        IERC20(baseToken).transfer(msg.sender, dust);
      } else {
        IERC20(baseToken).transfer(msg.sender, baseAmount);
      }
    } else if (call == CallType.WithdrawQuote) {
      if (positionType == PositionType.Short) {
        IERC20(quoteToken).transfer(msg.sender, quoteAmount);
      } else {
        IERC20(quoteToken).transfer(msg.sender, dust);
      }
    }
  }

  function sweepETH() external {}
}
