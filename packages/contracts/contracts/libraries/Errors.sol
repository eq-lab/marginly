// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library Errors {
  error AccessDenied();
  error ExceedsLimit();
  error EmergencyMode();
  error Forbidden();
  error LongEmergency();
  error Locked();
  error LessThanMinimalAmount();
  error BadLeverage();
  error NotLiquidatable();
  error NotOwner();
  error NotWETH9();
  error PoolAlreadyCreated();
  error PositionInitialized();
  error ShortEmergency();
  error SlippageLimit();
  error NotEmergency();
  error UninitializedPosition();
  error UniswapPoolNotFound();
  error UnknownCall();
  error WrongIndex();
  error WrongPositionType();
  error WrongValue();
  error ZeroAmount();
  error InvalidUnderlyingPool();
}
