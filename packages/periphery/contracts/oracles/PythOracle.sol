// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import '@openzeppelin/contracts/access/Ownable2Step.sol';
import '@openzeppelin/contracts/utils/math/Math.sol';
import '@openzeppelin/contracts/security/Pausable.sol';
import '@pythnetwork/pyth-sdk-solidity/IPyth.sol';
import '@pythnetwork/pyth-sdk-solidity/PythStructs.sol';

import '@marginly/contracts/contracts/interfaces/IPriceOracle.sol';

import './CompositeOracle.sol';

contract PythOracle is IPriceOracle, CompositeOracle, Ownable2Step, Pausable {
  error WrongValue();
  struct OracleParams {
    bytes32 tokenPriceId;
    uint32 maxPriceAge;
  }

  IPyth public immutable pyth;
  mapping(address => mapping(address => OracleParams)) public getParams;

  constructor(address _pyth) {
    pyth = IPyth(_pyth);
  }

  /// @notice Set up oracle for pair of tokens
  /// @param quoteToken - address of quote token, address(0) if token is not erc-20 (e.g. USD)
  /// @param baseToken - address of base token, address(0) if token is not erc-20 (e.g. USD)
  /// @param tokenPriceId - pyth price id
  /// @param maxPriceAge - max age of price, if price is older than max age, price is stale and cannot be used
  function setPair(address quoteToken, address baseToken, bytes32 tokenPriceId, uint32 maxPriceAge) external onlyOwner {
    if (maxPriceAge == 0) revert WrongValue();

    _setCommonPair(quoteToken, baseToken);

    getParams[quoteToken][baseToken] = OracleParams({tokenPriceId: tokenPriceId, maxPriceAge: maxPriceAge});
    getParams[baseToken][quoteToken] = OracleParams({tokenPriceId: tokenPriceId, maxPriceAge: maxPriceAge});
  }

  /// @notice Set up oracle for composition quoteToken/intermediateToken and baseToken/intermediateToken to get the final price baseToken/quoteToken
  /// @param quoteToken - should be address of erc-20 token
  /// @param intermediateToken - address of erc-20 token or address(0)
  /// @param baseToken - should be address of erc-20 token
  /// @dev quoteToken / intermediateToken and baseToken / intermediateToken should be configured before calling this function    function setCompositePair(
  function setCompositePair(address quoteToken, address intermediateToken, address baseToken) external onlyOwner {
    _setCompositePair(quoteToken, intermediateToken, baseToken);
  }

  function getBalancePrice(address quoteToken, address baseToken) external view whenNotPaused returns (uint256) {
    return _getPrice(quoteToken, baseToken);
  }

  function getMargincallPrice(address quoteToken, address baseToken) external view whenNotPaused returns (uint256) {
    return _getPrice(quoteToken, baseToken);
  }

  function getRationalPrice(address quoteToken, address baseToken) internal view override returns (uint256, uint256) {
    OracleParams memory params = getParams[quoteToken][baseToken];

    PythStructs.Price memory currentPrice = pyth.getPriceNoOlderThan(params.tokenPriceId, params.maxPriceAge);

    int expo = currentPrice.expo;
    bool isNegativeExpo = expo < 0;
    uint absExpo = uint(expo < 0 ? -expo : expo);

    if (currentPrice.price < 0) revert InvalidPrice();
    uint price = uint(int(currentPrice.price));

    uint priceNom = isNegativeExpo ? price : price * 10 ** absExpo;
    uint priceDenom = isNegativeExpo ? 10 ** absExpo : 1;

    return (priceNom, priceDenom);
  }

  function pause() external onlyOwner {
    _pause();
  }

  function unpause() external onlyOwner {
    _unpause();
  }
}
