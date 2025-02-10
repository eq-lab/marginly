// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.19;

interface ISpectraPrincipalToken {
  /**
   * @notice Returns the unix timestamp (uint256) at which the PT contract expires
   * @return The unix timestamp (uint256) when PTs become redeemable
   */
  function maturity() external view returns (uint256);

  /**
   * @notice Burns owner's shares (PTs and YTs before expiry, PTs after expiry)
   * and sends IBTs to receiver
   * @param shares The amount of shares to burn
   * @param receiver The address that will receive the IBTs
   * @param owner The owner of the shares
   * @return ibts The actual amount of IBT received for burning the shares
   */
  function redeemForIBT(uint256 shares, address receiver, address owner) external returns (uint256 ibts);

  /**
   * @notice Burns owner's shares (PTs and YTs before expiry, PTs after expiry)
   * and sends IBTs to receiver
   * @param shares The amount of shares to burn
   * @param receiver The address that will receive the IBTs
   * @param owner The owner of the shares
   * @param minIbts The minimum IBTs that should be returned to user
   * @return ibts The actual amount of IBT received for burning the shares
   */
  function redeemForIBT(
    uint256 shares,
    address receiver,
    address owner,
    uint256 minIbts
  ) external returns (uint256 ibts);

  /**
   * @notice Burns owner's shares (before expiry : PTs and YTs) and sends IBTs to receiver
   * @param ibts The amount of IBT to be received
   * @param receiver The address that will receive the IBTs
   * @param owner The owner of the shares (PTs and YTs)
   * @return shares The actual amount of shares burnt for receiving the IBTs
   */
  function withdrawIBT(uint256 ibts, address receiver, address owner) external returns (uint256 shares);

  /**
   * @notice Burns owner's shares (before expiry : PTs and YTs) and sends IBTs to receiver
   * @param ibts The amount of IBT to be received
   * @param receiver The address that will receive the IBTs
   * @param owner The owner of the shares (PTs and YTs)
   * @param maxShares The maximum shares allowed to be burnt
   * @return shares The actual amount of shares burnt for receiving the IBTs
   */
  function withdrawIBT(
    uint256 ibts,
    address receiver,
    address owner,
    uint256 maxShares
  ) external returns (uint256 shares);

  /**
   * @notice Burns owner's shares (PTs and YTs before expiry, PTs after expiry)
   * and sends assets to receiver
   * @param shares The amount of shares to burn
   * @param receiver The address that will receive the assets
   * @param owner The owner of the shares
   * @return assets The actual amount of assets received for burning the shares
   */
  function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets);

  /**
   * @notice Burns owner's shares (before expiry : PTs and YTs) and sends assets to receiver
   * @param assets The amount of assets to be received
   * @param receiver The address that will receive the assets
   * @param owner The owner of the shares (PTs and YTs)
   * @return shares The actual amount of shares burnt for receiving the assets
   */
  function withdraw(uint256 assets, address receiver, address owner) external returns (uint256 shares);
}
