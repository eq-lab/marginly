// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import '@openzeppelin/contracts/access/Ownable2Step.sol';
import '@openzeppelin/contracts/utils/math/Math.sol';
import '@marginly/contracts/contracts/interfaces/IPriceOracle.sol';
import './CompositeOracle.sol';

///@dev Composition of two IPriceOracles
contract MarginlyCompositeOracle is IPriceOracle, Ownable2Step {
  error ZeroPrice();
  error ZeroAddress();
  error NotInitialized();
  error PairAlreadyExists();

  uint256 private constant X96ONE = 79228162514264337593543950336;

  struct OracleParams {
    address intermediateToken;
    IPriceOracle quoteIntermediateOracle;
    IPriceOracle interMediateBaseOracle;
  }

  mapping(address => mapping(address => OracleParams)) public getParams;

  function setPair(
    address quoteToken,
    address intermediateToken,
    address baseToken,
    IPriceOracle quoteIntermediateOracle,
    IPriceOracle interMediateBaseOracle
  ) external onlyOwner {
    if (quoteToken == address(0)) revert ZeroAddress();
    if (intermediateToken == address(0)) revert ZeroAddress();
    if (baseToken == address(0)) revert ZeroAddress();
    if (address(quoteIntermediateOracle) == address(0)) revert ZeroAddress();
    if (address(interMediateBaseOracle) == address(0)) revert ZeroAddress();

    OracleParams memory params = getParams[quoteToken][baseToken];
    if (params.intermediateToken != address(0)) revert PairAlreadyExists();

    if (quoteIntermediateOracle.getBalancePrice(quoteToken, intermediateToken) == 0) revert ZeroPrice();
    if (quoteIntermediateOracle.getBalancePrice(intermediateToken, quoteToken) == 0) revert ZeroPrice();

    if (quoteIntermediateOracle.getMargincallPrice(quoteToken, intermediateToken) == 0) revert ZeroPrice();
    if (quoteIntermediateOracle.getMargincallPrice(intermediateToken, quoteToken) == 0) revert ZeroPrice();

    if (interMediateBaseOracle.getBalancePrice(intermediateToken, baseToken) == 0) revert ZeroPrice();
    if (interMediateBaseOracle.getBalancePrice(baseToken, intermediateToken) == 0) revert ZeroPrice();

    if (interMediateBaseOracle.getMargincallPrice(intermediateToken, baseToken) == 0) revert ZeroPrice();
    if (interMediateBaseOracle.getMargincallPrice(baseToken, intermediateToken) == 0) revert ZeroPrice();

    getParams[quoteToken][baseToken] = OracleParams({
      intermediateToken: intermediateToken,
      quoteIntermediateOracle: quoteIntermediateOracle,
      interMediateBaseOracle: interMediateBaseOracle
    });

    getParams[baseToken][quoteToken] = OracleParams({
      intermediateToken: intermediateToken,
      quoteIntermediateOracle: interMediateBaseOracle,
      interMediateBaseOracle: quoteIntermediateOracle
    });
  }

  function getBalancePrice(address quoteToken, address baseToken) external view override returns (uint256) {
    OracleParams memory params = getParams[quoteToken][baseToken];
    if (params.intermediateToken == address(0)) revert NotInitialized();

    uint256 firstPrice = params.quoteIntermediateOracle.getBalancePrice(quoteToken, params.intermediateToken);
    uint256 secondPrice = params.interMediateBaseOracle.getBalancePrice(params.intermediateToken, baseToken);
    if (firstPrice == 0 || secondPrice == 0) revert ZeroPrice();

    return Math.mulDiv(firstPrice, secondPrice, X96ONE);
  }

  function getMargincallPrice(address quoteToken, address baseToken) external view override returns (uint256) {
    OracleParams memory params = getParams[quoteToken][baseToken];
    if (params.intermediateToken == address(0)) revert NotInitialized();

    uint256 firstPrice = params.quoteIntermediateOracle.getMargincallPrice(quoteToken, params.intermediateToken);
    uint256 secondPrice = params.interMediateBaseOracle.getMargincallPrice(params.intermediateToken, baseToken);
    if (firstPrice == 0 || secondPrice == 0) revert ZeroPrice();

    return Math.mulDiv(firstPrice, secondPrice, X96ONE);
  }
}
