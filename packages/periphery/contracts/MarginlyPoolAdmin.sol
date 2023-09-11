// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';
import '@marginly/contracts/contracts/interfaces/IMarginlyFactory.sol';
import '@marginly/contracts/contracts/interfaces/IMarginlyPool.sol';
import '@marginly/contracts/contracts/dataTypes/MarginlyParams.sol';
import '@marginly/contracts/contracts/libraries/Errors.sol';
import '@marginly/router/contracts/MarginlyRouter.sol';
import '@marginly/router/contracts/abstract/AdapterStorage.sol';

contract MarginlyPoolAdmin is Ownable {
  // mapping MarginlyPoolAddress => pool owner
  mapping(address => address) public poolsOwners;
  address public marginlyFactoryAddress;
  address public marginlyRouterAddress;

  constructor(address factory) {
    marginlyFactoryAddress = factory;
    marginlyRouterAddress = IMarginlyFactory(marginlyFactoryAddress).swapRouter();
  }

  function createPool(
    address quoteToken,
    address baseToken,
    uint256 dexIndex,
    uint24 uniswapFee,
    MarginlyParams calldata params
  ) external {
    address marginlyPoolAddress = IMarginlyFactory(marginlyFactoryAddress).createPool(
      quoteToken,
      baseToken,
      uniswapFee,
      params
    );
    MarginlyRouter marginlyRouter = MarginlyRouter(marginlyRouterAddress);
    address adapterAddress = marginlyRouter.adapters(dexIndex);
    if (adapterAddress == address(0)) revert Errors.Forbidden();

    AdapterStorage adapterStorage = AdapterStorage(adapterAddress);
    if (adapterStorage.getPool(baseToken, quoteToken) == address(0)) {
      address uniswapPoolAddress = IMarginlyPool(marginlyPoolAddress).uniswapPool();
      PoolInput[] memory poolInput = new PoolInput[](1);
      poolInput[0] = PoolInput(baseToken, quoteToken, uniswapPoolAddress);
      adapterStorage.addPools(poolInput);
    }
    poolsOwners[marginlyPoolAddress] = msg.sender;
  }

  function setParameters(address marginlyPool, MarginlyParams calldata params) external {
    if (msg.sender != poolsOwners[marginlyPool]) revert Errors.NotOwner();
    IMarginlyPool(marginlyPool).setParameters(params);
  }

  function shutDown(address marginlyPool) external {
    if (msg.sender != poolsOwners[marginlyPool]) revert Errors.NotOwner();
    IMarginlyPool(marginlyPool).shutDown();
  }

  function sweepETH(address marginlyPool) external {
    if (msg.sender != poolsOwners[marginlyPool]) revert Errors.NotOwner();
    uint256 poolBalance = marginlyPool.balance;
    if (poolBalance > 0) {
      IMarginlyPool(marginlyPool).sweepETH();
      TransferHelper.safeTransferETH(msg.sender, poolBalance);
    }
  }
}
