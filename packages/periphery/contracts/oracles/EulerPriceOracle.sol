// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@marginly/contracts/contracts/interfaces/IPriceOracle.sol";

interface IEulerPriceOracle {
    /// @notice One-sided price: How much quote token you would get for inAmount of base token, assuming no price spread.
    /// @param inAmount The amount of `base` to convert.
    /// @param base The token that is being priced.
    /// @param quote The token that is the unit of account.
    /// @return outAmount The amount of `quote` that is equivalent to `inAmount` of `base`.
    function getQuote(uint256 inAmount, address base, address quote) external view returns (uint256 outAmount);
}

/**
 * @title Adapter for EulerPriceOracle
 * @dev USD has the ISO code of 840, so address(840) which corresponds to 0x0000000000000000000000000000000000000348
 * https://github.com/euler-xyz/euler-price-oracle/blob/master/docs/whitepaper.md#euler-price-oracles
 */
contract EulerPriceOracle is IPriceOracle, Ownable2Step {
    uint256 private constant X96ONE = 2 ** 96;

    mapping(address quoteToken => mapping(address baseToken => address eulerPriceOracle)) public getParams;

    error EulerPriceOracle__ZeroPrice();
    error EulerPriceOracle__NotInitialized(address quoteToken, address baseToken);

    //@dev eulerPriceOracle must be bidirectional
    function addPair(address quoteToken, address baseToken, address eulerPriceOracle) public onlyOwner {
        uint256 priceX96 = IEulerPriceOracle(eulerPriceOracle).getQuote(X96ONE, baseToken, quoteToken);
        if (priceX96 == 0) revert EulerPriceOracle__ZeroPrice();

        uint256 priceX96Reverse = IEulerPriceOracle(eulerPriceOracle).getQuote(X96ONE, quoteToken, baseToken);
        if (priceX96Reverse == 0) revert EulerPriceOracle__ZeroPrice();

        getParams[quoteToken][baseToken] = eulerPriceOracle;
        getParams[baseToken][quoteToken] = eulerPriceOracle;
    }

    function getBalancePrice(address quoteToken, address baseToken) external view returns (uint256) {
        return _getPriceX96(quoteToken, baseToken);
    }

    function getMargincallPrice(address quoteToken, address baseToken) external view returns (uint256) {
        return _getPriceX96(quoteToken, baseToken);
    }

    function _getPriceX96(address quoteToken, address baseToken) private view returns (uint256 priceX96) {
        address eulerPriceOracle = getParams[quoteToken][baseToken];
        if (eulerPriceOracle == address(0)) revert EulerPriceOracle__NotInitialized(quoteToken, baseToken);

        priceX96 = IEulerPriceOracle(eulerPriceOracle).getQuote(X96ONE, baseToken, quoteToken);
        if (priceX96 == 0) revert EulerPriceOracle__ZeroPrice();
    }
}
