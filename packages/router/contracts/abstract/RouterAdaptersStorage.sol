// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/access/Ownable.sol';

import '../interfaces/IMarginlyAdapter.sol';

struct AdapterInput {
  uint256 dexIndex;
  address adapter;
}

abstract contract RouterAdaptersStorage is Ownable {
  error UnknownDex();

  mapping(uint256 => address) public adapters;

  constructor(AdapterInput[] memory _adapters) {
    AdapterInput memory input;
    for (uint256 i; i < _adapters.length; ++i) {
      input = _adapters[i];
      adapters[input.dexIndex] = input.adapter;
    }
  }

  function addDexAdapters(AdapterInput[] calldata _adapters) external onlyOwner {
    AdapterInput memory input;
    for (uint256 i; i < _adapters.length; ++i) {
      input = _adapters[i];
      adapters[input.dexIndex] = input.adapter;
    }
  }

  function getAdapterSafe(uint256 dexIndex) internal view returns (IMarginlyAdapter) {
    address adapterAddress = adapters[dexIndex];
    if (adapterAddress == address(0)) revert UnknownDex();
    return IMarginlyAdapter(adapterAddress);
  }
}
