// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/token/ERC1155/extensions/IERC1155MetadataURI.sol';
import '@openzeppelin/contracts/token/ERC1155/IERC1155.sol';
import '@openzeppelin/contracts/utils/introspection/ERC165.sol';

contract SBT is Ownable, ERC165, IERC1155, IERC1155MetadataURI {
  // Mapping from token ID to account balances
  mapping(uint256 => mapping(address => uint256)) private _balances;

  // The URI for all tokens metadata
  mapping(uint256 => string) private _uris;

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

    address operator = _msgSender();

    for (uint256 i = 0; i < ids.length; i++) {
      require(owners[i] != address(0), 'address zero is not a valid owner');
      require(amounts[i] > 0, 'invalid amount');

      uint256 balance = _balances[ids[i]][owners[i]];

      require(balance >= amounts[i], 'burn amount exceeds balance');

      _balances[ids[i]][owners[i]] = balance - amounts[i];

      emit TransferSingle(operator, owners[i], address(0), ids[i], amounts[i]);
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

    address operator = _msgSender();

    for (uint256 i = 0; i < to.length; i++) {
      require(to[i] != address(0), 'address zero is not a valid owner');
      require(amounts[i] > 0, 'invalid amount');

      _balances[ids[i]][to[i]] += amounts[i];

      emit TransferSingle(operator, address(0), to[i], ids[i], amounts[i]);
    }
  }

  /**
   * @notice Allows owner to burn the given amount of the NFT.
   * @param id The token id being burned.
   * @param amount The amount of tokens being burned.
   */
  function burn(uint256 id, uint256 amount) external {
    require(amount > 0, 'invalid amount');

    address operator = _msgSender();
    uint256 balance = _balances[id][operator];

    require(balance >= amount, 'burn amount exceeds balance');

    _balances[id][operator] = balance - amount;

    emit TransferSingle(operator, operator, address(0), id, amount);
  }

  /**
   * @dev See {IERC165-supportsInterface}.
   */
  function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165, IERC165) returns (bool) {
    return
      interfaceId == type(IERC1155).interfaceId ||
      interfaceId == type(IERC1155MetadataURI).interfaceId ||
      super.supportsInterface(interfaceId);
  }

  /**
   * @dev See {_setURI}.
   */
  function uri(uint256 id) external view virtual returns (string memory) {
    return _uris[id];
  }

  /**
   * @dev See {IERC1155-balanceOf}.
   */
  function balanceOf(address account, uint256 id) public view virtual returns (uint256) {
    return _balances[id][account];
  }

  /**
   * @dev See {IERC1155-balanceOfBatch}.
   */
  function balanceOfBatch(
    address[] calldata accounts,
    uint256[] calldata ids
  ) external view virtual returns (uint256[] memory) {
    require(accounts.length == ids.length, 'args invalid length');

    uint256[] memory balances = new uint256[](accounts.length);

    for (uint256 i = 0; i < accounts.length; ++i) {
      balances[i] = balanceOf(accounts[i], ids[i]);
    }

    return balances;
  }

  /**
   * @dev See {IERC1155-isApprovedForAll}.
   */
  function isApprovedForAll(address, address) public pure returns (bool) {
    return false;
  }

  /**
   * @dev See {IERC1155-setApprovalForAll}. Unimplemented for SBT.
   */
  function setApprovalForAll(address, bool) external pure {
    revert('invalid operation');
  }

  /**
   * @dev See {IERC1155-safeTransferFrom}. Unimplemented for SBT.
   */
  function safeTransferFrom(address, address, uint256, uint256, bytes calldata) external pure {
    revert('invalid operation');
  }

  /**
   * @dev See {IERC1155-safeBatchTransferFrom}. Unimplemented for SBT.
   */
  function safeBatchTransferFrom(
    address,
    address,
    uint256[] calldata,
    uint256[] calldata,
    bytes calldata
  ) external pure {
    revert('invalid operation');
  }
}
