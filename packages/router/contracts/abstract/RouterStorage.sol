// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/access/Ownable.sol';

import '../interfaces/IMarginlyAdapter.sol';
import '../interfaces/IMarginlyRouter.sol';

struct AdapterInput {
  uint256 dexIndex;
  address adapter;
}

abstract contract RouterStorage is IMarginlyRouter, Ownable {
  error UnknownDex();

  mapping(uint256 => address) public adapters;

  constructor(AdapterInput[] memory _adapters) {
    AdapterInput memory input;
    uint256 length = _adapters.length;
    for (uint256 i; i < length; ) {
      input = _adapters[i];
      adapters[input.dexIndex] = input.adapter;

      unchecked {
        ++i;
      }
    }
  }

  function addDexAdapters(AdapterInput[] calldata _adapters) external onlyOwner {
    AdapterInput memory input;
    uint256 length = _adapters.length;
    for (uint256 i; i < length; ) {
      input = _adapters[i];
      adapters[input.dexIndex] = input.adapter;

      unchecked {
        ++i;
      }
    }
  }

  function getAdapterSafe(uint256 dexIndex) internal view returns (IMarginlyAdapter) {
    address adapterAddress = adapters[dexIndex];
    if (adapterAddress == address(0)) revert UnknownDex();
    return IMarginlyAdapter(adapterAddress);
  }
}
