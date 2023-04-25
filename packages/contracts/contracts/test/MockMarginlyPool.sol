// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

import '../interfaces/IMarginlyPool.sol';
import '../dataTypes/Position.sol';

contract MockMarginlyPool is IMarginlyPool {
  address public override quoteToken;
  address public override baseToken;
  address public override factory;

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
    uint24 _uniswapFee,
    bool _quoteTokenIsToken0,
    address _uniswapPool,
    MarginlyParams memory _params
  ) external {}

  function setParameters(MarginlyParams calldata _params) external {}

  function shutDown() external {}

  function setRecoveryMode(bool set) external {}

  function uniswapPool() external pure returns (address pool) {}

  function uniswapFee() external pure returns (uint24 fee) {}

  function quoteTokenIsToken0() external pure returns (bool) {}

  function depositBase(uint256 amount) external {}

  function depositQuote(uint256 amount) external {}

  function withdrawBase(uint256 amount) external {
    if (positionType == PositionType.Short) {
      IERC20(baseToken).transfer(msg.sender, dust);
    } else {
      IERC20(baseToken).transfer(msg.sender, baseAmount);
    }
  }

  function withdrawQuote(uint256 amount) external {
    if (positionType == PositionType.Short) {
      IERC20(quoteToken).transfer(msg.sender, quoteAmount);
    } else {
      IERC20(quoteToken).transfer(msg.sender, dust);
    }
  }

  function short(uint256 baseAmount) external {}

  function long(uint256 baseAmount) external {}

  function closePosition() external {}

  function reinit() external {}

  function increaseBaseCollateralCoeff(uint256 realBaseAmount) external {}

  function increaseQuoteCollateralCoeff(uint256 realQuoteAmount) external {}

  function receivePosition(address _badPositionAddress, uint256 _quoteAmount, uint256 _baseAmount) external {
    require(_badPositionAddress == badPositionAddress);

    IERC20(quoteToken).transferFrom(msg.sender, address(this), _quoteAmount);
    IERC20(baseToken).transferFrom(msg.sender, address(this), _baseAmount);
  }

  function emergencyWithdraw() external {}

  function transferPosition(address newOwner) external {}
}
