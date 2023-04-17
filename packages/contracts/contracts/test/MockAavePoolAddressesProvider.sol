// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.17;

import '@aave/core-v3/contracts/interfaces/IPoolAddressesProvider.sol';

contract MockAavePoolAddressesProvider is IPoolAddressesProvider {
  address pool;

  constructor(address _pool) {
    pool = _pool;
  }

  function getMarketId() external pure returns (string memory) {
    return '';
  }

  function setMarketId(string calldata newMarketId) external {}

  function getAddress(bytes32) external pure returns (address) {
    return address(0);
  }

  function setAddressAsProxy(bytes32 id, address newImplementationAddress) external {}

  function setAddress(bytes32 id, address newAddress) external {}

  function getPool() external view returns (address) {
    return pool;
  }

  function setPoolImpl(address newPoolImpl) external {}

  function getPoolConfigurator() external pure returns (address) {
    return address(0);
  }

  function setPoolConfiguratorImpl(address newPoolConfiguratorImpl) external {}

  function getPriceOracle() external pure returns (address) {
    return address(0);
  }

  function setPriceOracle(address newPriceOracle) external {}

  function getACLManager() external pure returns (address) {
    return address(0);
  }

  function setACLManager(address newAclManager) external {}

  function getACLAdmin() external pure returns (address) {
    return address(0);
  }

  function setACLAdmin(address newAclAdmin) external {}

  function getPriceOracleSentinel() external pure returns (address) {
    return address(0);
  }

  function setPriceOracleSentinel(address newPriceOracleSentinel) external {}

  function getPoolDataProvider() external pure returns (address) {
    return address(0);
  }

  function setPoolDataProvider(address newDataProvider) external {}
}
