// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import '@openzeppelin/contracts/access/Ownable2Step.sol';

import '../interfaces/IBlast.sol';
import '../interfaces/IMarginlyAdapter.sol';

struct PoolInput {
  address token0;
  address token1;
  address pool;
}

abstract contract AdapterStorage is IMarginlyAdapter, Ownable2Step {
  /// @notice Emitted when new pool is added
  event NewPool(address indexed token0, address indexed token1, address indexed pool);

  error UnknownPool();

  error Forbidden();

  IBlast private constant BLAST = IBlast(0x4300000000000000000000000000000000000002);

  mapping(address => mapping(address => address)) public getPool;

  constructor(PoolInput[] memory pools) {
    PoolInput memory input;
    uint256 length = pools.length;
    for (uint256 i; i < length; ) {
      input = pools[i];
      getPool[input.token0][input.token1] = input.pool;
      getPool[input.token1][input.token0] = input.pool;
      emit NewPool(input.token0, input.token1, input.pool);

      unchecked {
        ++i;
      }
    }

    BLAST.configureClaimableGas();
  }

  function addPools(PoolInput[] calldata pools) external onlyOwner {
    PoolInput memory input;
    uint256 length = pools.length;
    for (uint256 i; i < length; ) {
      input = pools[i];
      getPool[input.token0][input.token1] = input.pool;
      getPool[input.token1][input.token0] = input.pool;
      emit NewPool(input.token0, input.token1, input.pool);

      unchecked {
        ++i;
      }
    }
  }

  function claimContractsGas(address feeHolder) external onlyOwner {
    BLAST.claimAllGas(address(this), feeHolder);
  }

  function getPoolSafe(address tokenA, address tokenB) internal view returns (address pool) {
    pool = getPool[tokenA][tokenB];
    if (pool == address(0)) revert UnknownPool();
  }

  function renounceOwnership() public override onlyOwner {
    revert Forbidden();
  }
}
