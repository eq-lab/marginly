// SPDX-License-Identifier: BUSL-1.1
pragma solidity 0.8.19;

// a library for performing various math operations

library Math {
    // Copied from uniswap v2 Math.sol https://github.com/Uniswap/v2-core/blob/v1.0.1/contracts/libraries/Math.sol
    // babylonian method (https://en.wikipedia.org/wiki/Methods_of_computing_square_roots#Babylonian_method)
    function sqrt(uint y) internal pure returns (uint z) {
        if (y > 3) {
            z = y;
            uint x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
}