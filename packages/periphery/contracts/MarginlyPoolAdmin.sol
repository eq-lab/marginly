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
  address public immutable marginlyFactoryAddress;
  uint256 public constant UNISWAPV3_ADAPTER_INDEX = 0;

  error InvalidUnderlyingPool();

  constructor(address marginlyFactory) {
    if (marginlyFactory == address(0)) revert Errors.Forbidden();
    marginlyFactoryAddress = marginlyFactory;
  }

  function createPool(
    address quoteToken,
    address baseToken,
    uint24 poolFee,
    MarginlyParams calldata params
  ) external returns (address marginlyPoolAddress) {
    if (baseToken == address(0)) revert Errors.Forbidden();
    if (quoteToken == address(0)) revert Errors.Forbidden();

    marginlyPoolAddress = IMarginlyFactory(marginlyFactoryAddress).createPool(quoteToken, baseToken, poolFee, params);
    MarginlyRouter marginlyRouter = MarginlyRouter(IMarginlyFactory(marginlyFactoryAddress).swapRouter());
    address adapterAddress = marginlyRouter.adapters(UNISWAPV3_ADAPTER_INDEX);
    if (adapterAddress == address(0)) revert Errors.Forbidden();

    AdapterStorage adapterStorage = AdapterStorage(adapterAddress);
    address poolAddressFromAdapter = adapterStorage.getPool(baseToken, quoteToken);
    address underlyingPoolAddress = IMarginlyPool(marginlyPoolAddress).uniswapPool();

    if (poolAddressFromAdapter == address(0)) {
      PoolInput[] memory poolInput = new PoolInput[](1);
      poolInput[0] = PoolInput(baseToken, quoteToken, underlyingPoolAddress);
      adapterStorage.addPools(poolInput);
    } else if (poolAddressFromAdapter != underlyingPoolAddress) {
      revert InvalidUnderlyingPool();
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

  function sweepETH(address marginlyPool) external returns (uint256 amount){
    if (msg.sender != poolsOwners[marginlyPool]) revert Errors.NotOwner();
    amount = marginlyPool.balance;
    if (amount > 0) {
      IMarginlyPool(marginlyPool).sweepETH();
      TransferHelper.safeTransferETH(msg.sender, amount);
    }
  }

  function addPools(PoolInput[] calldata pools) external onlyOwner {
    address marginlyRouterAddress = IMarginlyFactory(marginlyFactoryAddress).swapRouter();
    if (marginlyRouterAddress == address(0)) revert Errors.Forbidden();
    address adapterAddress = MarginlyRouter(marginlyRouterAddress).adapters(UNISWAPV3_ADAPTER_INDEX);
    if (adapterAddress == address(0)) revert Errors.Forbidden();

    AdapterStorage adapterStorage = AdapterStorage(adapterAddress);
    adapterStorage.addPools(pools);
  }

  receive() external payable {}
}
