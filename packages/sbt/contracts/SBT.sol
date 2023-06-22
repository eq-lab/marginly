// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import '@openzeppelin/contracts/token/ERC1155/IERC1155.sol';
import '@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol';
import '@openzeppelin/contracts/token/ERC1155/extensions/IERC1155MetadataURI.sol';
import '@openzeppelin/contracts/utils/Context.sol';
import '@openzeppelin/contracts/utils/introspection/ERC165.sol';

contract SBT is ERC165, IERC1155, IERC1155MetadataURI {
  // Mapping from token ID to account balances
  mapping(uint256 => mapping(address => uint256)) private _balances;

  // Used as the URI for each token types
  mapping(uint256 => string) private _uri;

  // address of owner SBT contract
  address public _owner;

  // amount of maximum token balance for each type
  mapping(uint256 => uint256) public _tokenBalanceLimits;

  /**
   * @dev Throws if called by any account other than the owner.
   */
  modifier onlyOwner() {
    require(msg.sender == _owner, 'not owner');
    _;
  }

  event TokenMinted(address indexed to, uint256 tokenId, uint256 newBalance);
  event TokenBurned(address indexed from, uint256 tokenId, uint256 newBalance);

  /**
   * @dev See {_setURI}.
   */
  constructor(uint256[] memory ids, uint256[] memory tokenBalanceLimits, string[] memory uri) {
    uint256 idLength = ids.length;
    require(tokenBalanceLimits.length == idLength, 'tokenBalanceLimits invalid len');
    require(uri.length == idLength, 'uri invalid len');

    for (uint256 i = 0; i < ids.length; i++) {
      uint256 id = ids[i];
      require(id == i, 'invalid id');
      require(_tokenBalanceLimits[id] == 0, 'id duplicate');
      _tokenBalanceLimits[id] = tokenBalanceLimits[i];
      _setURI(id, uri[i]);
    }

    _owner = msg.sender;
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
   * @dev See {IERC1155MetadataURI-uri}.
   *
   * This implementation returns the same URI for *all* token types. It relies
   * on the token type ID substitution mechanism
   * https://eips.ethereum.org/EIPS/eip-1155#metadata[defined in the EIP].
   *
   * Clients calling this function must replace the `\{id\}` substring with the
   * actual token type ID.
   */
  function uri(uint256 id) public view virtual returns (string memory) {
    //    string
    //      memory json = '{"name": "Testo","description":"desk2","image":"https://avatars.githubusercontent.com/u/43533945?v=4","external_url":"https://eips.ethereum.org/EIPS/eip-1155"}';
    //    return string.concat('data:application/json;utf8,', json);
    return _uri[id];
  }

  /**
   * @dev See {IERC1155-balanceOf}.
   *
   * Requirements:
   *
   * - `account` cannot be the zero address.
   */
  function balanceOf(address account, uint256 id) public view virtual returns (uint256) {
    return _balances[id][account];
  }

  /**
   * @dev See {IERC1155-balanceOfBatch}.
   *
   * Requirements:
   *
   * - `accounts` and `ids` must have the same length.
   */
  function balanceOfBatch(
    address[] memory accounts,
    uint256[] memory ids
  ) public view virtual returns (uint256[] memory) {
    require(accounts.length == ids.length, 'invalid array len');
    uint256[] memory batchBalances = new uint256[](accounts.length);

    for (uint256 i = 0; i < accounts.length; ++i) {
      batchBalances[i] = balanceOf(accounts[i], ids[i]);
    }

    return batchBalances;
  }

  /**
   * @dev See {IERC1155-setApprovalForAll}.
   */
  function setApprovalForAll(address operator, bool approved) public virtual {
    revert('SBT');
  }

  /**
   * @dev See {IERC1155-isApprovedForAll}.
   */
  function isApprovedForAll(address account, address operator) public view virtual returns (bool) {
    return false;
  }

  /**
   * @dev See {IERC1155-safeTransferFrom}.
   */
  function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes memory data) public virtual {
    revert('SBT');
  }

  /**
   * @dev See {IERC1155-safeBatchTransferFrom}.
   */
  function safeBatchTransferFrom(
    address from,
    address to,
    uint256[] memory ids,
    uint256[] memory amounts,
    bytes memory data
  ) public virtual {
    revert('SBT');
  }

  /**
   * @dev Sets a new URI for token type, by relying on the token type ID
   */
  function _setURI(uint256 id, string memory newUri) internal virtual {
    _uri[id] = newUri;
  }

  /**
   * @dev Creates `amount` tokens of token type `id`, and assigns them to `to`.
   *
   * Emits a {TransferSingle} event.
   *
   * Requirements:
   *
   * - `to` cannot be the zero address.
   * - If `to` refers to a smart contract, it must implement {IERC1155Receiver-onERC1155Received} and return the
   * acceptance magic value.
   */
  function _mint(address to, uint256 id) internal {
    require(_balances[id][to] < _tokenBalanceLimits[id], 'user balance max cap');
    _balances[id][to] += 1;
    emit TokenMinted(to, id, _balances[id][to]);
  }

  /**
   * @dev Destroys `amount` tokens of token type `id` from `from`
   *
   * Emits a {TransferSingle} event.
   *
   * Requirements:
   *
   * - `from` cannot be the zero address.
   * - `from` must have at least `amount` tokens of token type `id`.
   */
  function _burn(address from, uint256 id) internal {
    require(_balances[id][from] > 0, 'empty balance');
    _balances[id][from] -= 1;
    emit TokenBurned(from, id, _balances[id][from]);
  }

  /**
   * @dev Set maximum amount of token balance for one user
   */
  function setTokenBalanceLimit(uint256 id, uint256 newMax) public onlyOwner {
    _tokenBalanceLimits[id] = newMax;
  }

  /**
   * @dev Mint new tokens for accounts
   */
  function mint(address[] memory recipients, uint256[] memory ids) public onlyOwner {
    require(recipients.length == ids.length, 'invalid array len');
    for (uint256 i = 0; i < recipients.length; i++) {
      _mint(recipients[i], ids[i]);
    }
  }

  /**
   * @dev Burn tokens from users
   */
  function burn(address[] memory users, uint256[] memory ids) public onlyOwner {
    require(users.length == ids.length, 'invalid array len');
    for (uint256 i = 0; i < users.length; i++) {
      _burn(users[i], ids[i]);
    }
  }

  /**
   * @dev Set URI for token
   */
  function setURI(uint256 id, string memory newUri) public onlyOwner {
    _setURI(id, newUri);
  }

  /**
   * @dev Set new contract owner
   */
  function setNewOwner(address newOwner) public onlyOwner {
    require(newOwner != address(0));
    _owner = newOwner;
  }
}
