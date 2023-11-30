// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import '@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol';
import '@marginly/contracts/contracts/interfaces/IMarginlyFactory.sol';
import '@marginly/contracts/contracts/interfaces/IMarginlyPool.sol';
import '@marginly/contracts/contracts/dataTypes/MarginlyParams.sol';
import '@marginly/contracts/contracts/libraries/Errors.sol';
import '@marginly/router/contracts/MarginlyRouter.sol';
import '@marginly/router/contracts/abstract/AdapterStorage.sol';

import './MarginlyAdminStorage.sol';

abstract contract PoolActions is MarginlyAdminStorage {
  /// @dev Create a new Marginly pool. The signer will be granted owner role for a new pool
  /// @param quoteToken Address of a quote token
  /// @param baseToken Address of a base token
  /// @param poolFee Amount of underlying pool fee
  /// @param params Marginly pool parameters
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
    emit NewPoolOwner(marginlyPoolAddress, msg.sender);
  }

  /// @dev Set new params for a Marginly pool. Allowed only for pool owner
  /// @param marginlyPool Address of a Marginly pool
  /// @param params Marginly pool parameters
  function setParameters(address marginlyPool, MarginlyParams calldata params) external {
    if (msg.sender != poolsOwners[marginlyPool]) revert Errors.NotOwner();
    IMarginlyPool(marginlyPool).setParameters(params);
  }

  /// @dev Switch Marginly pool to emergency mode when collateral of any side not enough to cover debt.
  /// @dev Allowed only for pool owner
  /// @param marginlyPool Address of a Marginly pool
  /// @param swapCalldata param of IMarginlyPool.shutDown method
  function shutDown(address marginlyPool, uint256 swapCalldata) external {
    if (msg.sender != poolsOwners[marginlyPool]) revert Errors.NotOwner();
    IMarginlyPool(marginlyPool).shutDown(swapCalldata);
  }

  /// @dev Sweep ETH balance of Marginly pool. Allowed only for pool owner
  /// @param marginlyPool Address of a Marginly pool
  function sweepETH(address marginlyPool) external returns (uint256 amount) {
    if (msg.sender != poolsOwners[marginlyPool]) revert Errors.NotOwner();
    amount = marginlyPool.balance;
    if (amount > 0) {
      IMarginlyPool(marginlyPool).sweepETH();
      TransferHelper.safeTransferETH(msg.sender, amount);
    }
  }

  /// @dev Set a new owner of a Marginly pool. Allowed only for Marginly pool owner
  /// @param marginlyPool Address of a Marginly pool
  /// @param to Address of a new Marginly pool owner
  function transferMarginlyPoolOwnership(address marginlyPool, address to) external {
    if (msg.sender != poolsOwners[marginlyPool]) revert Errors.NotOwner();
    poolsOwners[marginlyPool] = to;
    emit NewPoolOwner(marginlyPool, to);
  }

  /// @dev This function is required for the sweepETH successful execution
  receive() external payable {}
}
