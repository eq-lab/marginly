// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

interface IMarginlyPoolWrapper {
    function long(uint256 depositQuoteAmount, uint256 longBaseAmount) external;
    
    function short(uint256 depositBaseAmount, uint256 shortBaseAmount) external;
}