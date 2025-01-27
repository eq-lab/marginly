// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

interface ISpectraErc4626Wrapper {
  /// @dev Returns the address of the wrapped vault share.
  function vaultShare() external view returns (address);

  /// @dev Allows the owner to deposit vault shares into the wrapper.
  /// @param vaultShares The amount of vault shares to deposit.
  /// @param receiver The address to receive the wrapper shares.
  /// @return The amount of minted wrapper shares.
  function wrap(uint256 vaultShares, address receiver) external returns (uint256);

  /// @dev Allows the owner to deposit vault shares into the wrapper, with support for slippage protection.
  /// @param vaultShares The amount of vault shares to deposit.
  /// @param receiver The address to receive the wrapper shares.
  /// @param minShares The minimum allowed wrapper shares from this deposit.
  /// @return The amount of minted wrapper shares.
  function wrap(uint256 vaultShares, address receiver, uint256 minShares) external returns (uint256);

  /// @dev Allows the owner to withdraw vault shares from the wrapper.
  /// @param shares The amount of wrapper shares to redeem.
  /// @param receiver The address to receive the vault shares.
  /// @param owner The address of the owner of the wrapper shares.
  /// @return The amount of withdrawn vault shares.
  function unwrap(uint256 shares, address receiver, address owner) external returns (uint256);

  /// @dev Allows the owner to withdraw vault shares from the wrapper, with support for slippage protection.
  /// @param shares The amount of wrapper shares to redeem.
  /// @param receiver The address to receive the vault shares.
  /// @param owner The address of the owner of the wrapper shares.
  /// @param minVaultShares The minimum vault shares that should be returned.
  /// @return The amount of withdrawn vault shares.
  function unwrap(uint256 shares, address receiver, address owner, uint256 minVaultShares) external returns (uint256);

  /// @dev Allows to preview the amount of minted wrapper shares for a given amount of deposited vault shares.
  /// @param vaultShares The amount of vault shares to deposit.
  /// @return The amount of minted vault shares.
  function previewWrap(uint256 vaultShares) external view returns (uint256);

  /// @dev Allows to preview the amount of withdrawn vault shares for a given amount of redeemed wrapper shares.
  /// @param shares The amount of wrapper shares to redeem.
  /// @return The amount of withdrawn vault shares.
  function previewUnwrap(uint256 shares) external view returns (uint256);
}
