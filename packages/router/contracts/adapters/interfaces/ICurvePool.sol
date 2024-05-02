// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

interface ICurvePool {
    /*
        @notice Perform an exchange between two coins
        @dev Index values can be found via the `coins` public getter method
        @param i Index value for the coin to send
        @param j Index value of the coin to receive
        @param _dx Amount of `i` being exchanged
        @param _min_dy Minimum amount of `j` to receive
        @param _receiver Receiver address
        @return Actual amount of `j` received
    */
    function exchange(
        int128 i,
        int128 j,
        uint256 _dx,
        uint256 _min_dy,
        address _receiver
    ) external returns (uint256);

    /*
        @notice Get address of coin with `i` index
        @param i Index of coin
        @return Address of coin with `i` index
      */
    function coins(uint256 i) external returns (address);

    /*
        @notice Calculate the current output dy given input `dx`
        @dev Index values can be found via the `coins` public getter method
        @param i Index value for the coin to send
        @param j Index value of the coin to receive
        @param dx Amount of `i` being exchanged
        @return Amount of `j` predicted
      */
    function get_dy(int128 i, int128 j, uint256 dx) external view returns (uint256);

    /*
        @notice price have 18 decimals even if the tokens have different decimals,
        or both tokens have same decimals != 18
     */
    function price_oracle() external view returns (uint256);

    function last_price() external view returns (uint256);
}