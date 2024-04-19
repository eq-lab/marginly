// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

import '@pendle/core-v2/contracts/interfaces/IPMarketV3.sol';

contract MockPendleMarket is IPMarketV3 {
  error NotImplemented();

  uint256 _expiry;
  address pt;
  address sy;
  address yt;

  constructor(address _pt, address _sy, address _yt, uint256 expiry_) {
    pt = _pt;
    sy = _sy;
    yt = _yt;
    _expiry = expiry_;
  }

  function getNonOverrideLnFeeRateRoot() external pure returns (uint80) {
    return 0;
  }

  function mint(
    address /* receiver */,
    uint256 /* netSyDesired */,
    uint256 /* netPtDesired */
  ) external pure returns (uint256 netLpOut, uint256 netSyUsed, uint256 netPtUsed) {
    netLpOut = 0;
    netSyUsed = 0;
    netPtUsed = 0;
  }

  function burn(
    address /* receiverSy */,
    address /* receiverPt */,
    uint256 /* netLpToBurn */
  ) external pure returns (uint256 netSyOut, uint256 netPtOut) {
    netSyOut = 0;
    netPtOut = 0;
  }

  function swapExactPtForSy(
    address /* receiver */,
    uint256 /* exactPtIn */,
    bytes calldata /* data */
  ) external pure returns (uint256 netSyOut, uint256 netSyFee) {
    netSyOut = 0;
    netSyFee = 0;
  }

  function swapSyForExactPt(
    address /* receiver */,
    uint256 /* exactPtOut */,
    bytes calldata /* data */
  ) external pure returns (uint256 netSyIn, uint256 netSyFee) {
    netSyIn = 0;
    netSyFee = 0;
  }

  function redeemRewards(address /* user */) external pure returns (uint256[] memory) {
    return new uint256[](0);
  }

  function readState(address /* router */) external pure returns (MarketState memory /* market */) {
    revert NotImplemented();
  }

  function observe(uint32[] memory /* secondsAgos */) external pure returns (uint216[] memory lnImpliedRateCumulative) {
    return new uint216[](0);
  }

  function increaseObservationsCardinalityNext(uint16 /* cardinalityNext */) external pure {}

  function readTokens()
    external
    view
    returns (IStandardizedYield _SY, IPPrincipalToken _PT, IPYieldToken _YT)
  {
    _SY = IStandardizedYield(sy);
    _PT = IPPrincipalToken(pt);
    _YT = IPYieldToken(yt);
  }

  function getRewardTokens() external pure returns (address[] memory) {
    revert NotImplemented();
  }

  function isExpired() external view returns (bool) {
    return _expiry <= block.timestamp;
  }

  function expiry() external view returns (uint256) {
    return _expiry;
  }

  function observations(
    uint256 /* index */
  ) external pure returns (uint32 blockTimestamp, uint216 lnImpliedRateCumulative, bool initialized) {
    blockTimestamp = 0;
    lnImpliedRateCumulative = 0;
    initialized = true;
  }

  function _storage()
    external
    pure
    returns (
      int128 totalPt,
      int128 totalSy,
      uint96 lastLnImpliedRate,
      uint16 observationIndex,
      uint16 observationCardinality,
      uint16 observationCardinalityNext
    )
  {
    totalPt = 0;
    totalSy = 0;
    lastLnImpliedRate = 0;
    observationIndex = 0;
    observationCardinality = 0;
    observationCardinalityNext = 0;
  }

  function totalActiveSupply() external pure returns (uint256) {
    return 0;
  }

  function activeBalance(address /* user */) external pure returns (uint256) {
    return 0;
  }

  function name() external pure returns (string memory) {
    return 'Pendle LPT';
  }

  function symbol() external pure returns (string memory) {
    return 'P-LPT';
  }

  function decimals() external pure returns (uint8) {
    return 18;
  }

  function totalSupply() external pure returns (uint256) {
    return 0;
  }

  function balanceOf(address /* account */) external pure returns (uint256) {
    return 0;
  }

  function transfer(address /* to */, uint256 /* amount */) external pure returns (bool) {
    return true;
  }

  function allowance(address /* owner */, address /* spender */) external pure returns (uint256) {
    return 0;
  }

  function approve(address /* spender */, uint256 /* amount */) external pure returns (bool) {
    return true;
  }

  function transferFrom(address /* from */, address /* to */, uint256 /* amount */) external pure returns (bool) {
    return true;
  }
}
