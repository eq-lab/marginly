// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

import '@pendle/core-v2/contracts/interfaces/IPPtLpOracle.sol';

contract TestPendlePtLpOracle is IPPtLpOracle {
  uint256 ptToAssetRate;
  uint256 lpToAssetRate;
  uint256 ptToSyRate;
  uint256 lpToSyRate;

  constructor(uint256 _ptToAssetRate, uint256 _lpToAssetRate, uint256 _ptToSyRate, uint256 _lpToSyRate) {
    ptToAssetRate = _ptToAssetRate;
    lpToAssetRate = _lpToAssetRate;
    ptToSyRate = _ptToSyRate;
    lpToSyRate = _lpToSyRate;
  }

  function getPtToAssetRate(address /* market */, uint32 /* duration */) external view returns (uint256) {
    return ptToAssetRate;
  }

  function getLpToAssetRate(address /* market */, uint32 /* duration */) external view returns (uint256) {
    return lpToAssetRate;
  }

  function getPtToSyRate(address /* market */, uint32 /* duration */) external view returns (uint256) {
    return ptToSyRate;
  }

  function getLpToSyRate(address /* market */, uint32 /* duration */) external view returns (uint256) {
    return lpToSyRate;
  }

  function getOracleState(
    address /* market */,
    uint32 /* duration */
  )
    external
    pure
    returns (bool increaseCardinalityRequired, uint16 cardinalityRequired, bool oldestObservationSatisfied)
  {
    increaseCardinalityRequired = false;
    cardinalityRequired = 0;
    oldestObservationSatisfied = true;
  }
}
