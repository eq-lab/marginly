// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

import '@openzeppelin/contracts/token/ERC1155/ERC1155.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol';
import '@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol';

contract ContestWinnerNFT is ERC1155, Ownable, ERC1155Burnable, ERC1155Supply {
  // The URI for all tokens metadata
  mapping(uint256 => string) private _uris;

  constructor() ERC1155('') {}

  /**
   * @notice Allows admin to create or update NFTs.
   * @param ids The token ids being minted.
   * @param uris The URIs of the ERC1155 JSON metadata files.
   */
  function createOrUpdate(uint256[] calldata ids, string[] calldata uris) external onlyOwner {
    require(ids.length == uris.length, 'args invalid length');

    for (uint256 i = 0; i < ids.length; i++) {
      require(bytes(uris[i]).length > 0, 'invalid uri');

      _uris[ids[i]] = uris[i];

      emit URI(uris[i], ids[i]);
    }
  }

  /**
   * @notice Allows admin to burn the given amounts of the NFTs.
   * @param owners The owners of tokens being burned.
   * @param ids The token ids being burned.
   * @param amounts The amounts of tokens being burned.
   */
  function burnMinted(
    address[] calldata owners,
    uint256[] calldata ids,
    uint256[] calldata amounts
  ) external onlyOwner {
    require(ids.length == amounts.length && ids.length == owners.length, 'args invalid length');

    for (uint256 i = 0; i < ids.length; i++) {
      require(owners[i] != address(0), 'address zero is not a valid owner');
      require(amounts[i] > 0, 'invalid amount');

      _burn(owners[i], ids[i], amounts[i]);
    }
  }

  /**
   * @notice Allows admin to mint the NFTs.
   * @param to The recipients account addresses.
   * @param ids The token ids being minted.
   * @param amounts The amounts of the tokens being minted.
   */
  function mint(address[] calldata to, uint256[] calldata ids, uint256[] calldata amounts) external onlyOwner {
    require(to.length == ids.length && to.length == amounts.length, 'args invalid length');

    for (uint256 i = 0; i < to.length; i++) {
      require(to[i] != address(0), 'address zero is not a valid owner');
      require(amounts[i] > 0, 'invalid amount');

      _mint(to[i], ids[i], amounts[i], '');
    }
  }

  /**
   * @dev See {_setURI}.
   */
  function uri(uint256 id) public view virtual override returns (string memory) {
    return _uris[id];
  }

  function _beforeTokenTransfer(
    address operator,
    address from,
    address to,
    uint256[] memory ids,
    uint256[] memory amounts,
    bytes memory data
  ) internal override(ERC1155, ERC1155Supply) {
    super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
  }
}
