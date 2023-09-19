// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

import '@openzeppelin/contracts/token/ERC1155/IERC1155.sol';
import '@openzeppelin/contracts/token/ERC1155/extensions/IERC1155MetadataURI.sol';
import '@openzeppelin/contracts/utils/introspection/ERC165.sol';

contract SBT is ERC165, IERC1155, IERC1155MetadataURI {
  // Amount of tokens types
  uint256 public _tokensCount;

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
    _onlyOwner();
    _;
  }

  function _onlyOwner() private view {
    require(msg.sender == _owner, 'not owner'); // Access denied
  }

  event TokenMinted(address indexed to, uint256 tokenId, uint256 newBalance);
  event TokenBurned(address indexed from, uint256 tokenId, uint256 newBalance);

  constructor(uint256[] memory tokenBalanceLimits, string[] memory tokenUris) {
    uint256 tokensLen = tokenBalanceLimits.length;
    require(tokenUris.length == tokensLen, 'uri invalid len');

    for (uint256 id = 0; id < tokensLen; id++) {
      _tokenBalanceLimits[id] = tokenBalanceLimits[id];
      _setURI(id, tokenUris[id]);
    }

    _owner = msg.sender;
    _tokensCount = tokensLen;
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
    address[] calldata accounts,
    uint256[] calldata ids
  ) public view virtual returns (uint256[] memory) {
    uint256 accountsLen = accounts.length;
    require(accountsLen == ids.length, 'invalid array len');
    uint256[] memory batchBalances = new uint256[](accountsLen);
    for (uint256 i = 0; i < accountsLen; ++i) {
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
  function _setURI(uint256 id, string memory newUri) private {
    _uri[id] = newUri;
  }

  /**
   * @dev Creates token with token type `id`, and assigns them to `to`.
   *
   * Emits a {TokenMinted} event.
   *
   * Requirements:
   *
   * - `to` cannot be the zero address.
   * - If `to` refers to a smart contract, it must implement {IERC1155Receiver-onERC1155Received} and return the
   * acceptance magic value.
   * - `amount` cannot be the zero
   */
  function _mint(address to, uint256 id, uint256 amount) private {
    require(id < _tokensCount, 'id too high');
    require(to != address(0), 'zero address');
    require(amount != 0, 'zero amount');
    uint256 balance = _balances[id][to] + amount;
    require(balance <= _tokenBalanceLimits[id], 'user balance max cap');
    _balances[id][to] = balance;
    emit TokenMinted(to, id, balance);
  }

  /**
   * @dev Destroys token with type `id` from `from`
   *
   * Emits a {TokenBurned} event.
   *
   * Requirements:
   *
   * - `from` cannot be the zero address.
   * - `from` must have at least 1 token of token type `id`.
   * - `amount` cannot be the zero
   */
  function _burn(address from, uint256 id, uint256 amount) private {
    require(from != address(0), 'zero address');
    require(amount != 0, 'zero amount');
    uint256 balance = _balances[id][from];
    require(amount <= balance, 'burn amount > balance');
    balance -= amount;
    _balances[id][from] = balance;
    emit TokenBurned(from, id, balance);
  }

  /**
   * @dev Set maximum amount of token balance for one user
   */
  function setTokenBalanceLimit(uint256 id, uint256 newMax) external onlyOwner {
    require(id < _tokensCount, 'id too high');
    _tokenBalanceLimits[id] = newMax;
  }

  /**
   * @dev Mint new tokens for accounts
   */
  function mint(address[] calldata recipients, uint256[] calldata ids, uint256[] calldata amounts) external onlyOwner {
    uint256 recipientsLen = recipients.length;
    require(recipientsLen == ids.length, 'invalid array len');
    require(recipientsLen == amounts.length, 'invalid array len');
    for (uint256 i = 0; i < recipientsLen; i++) {
      _mint(recipients[i], ids[i], amounts[i]);
    }
  }

  /**
   * @dev Burn tokens from users
   */
  function burn(address[] calldata users, uint256[] calldata ids, uint256[] calldata amounts) external onlyOwner {
    uint256 usersLen = users.length;
    require(usersLen == ids.length, 'invalid array len');
    require(usersLen == amounts.length, 'invalid array len');
    for (uint256 i = 0; i < usersLen; i++) {
      _burn(users[i], ids[i], amounts[i]);
    }
  }

  /**
   * @dev Set URI for token
   */
  function setURI(uint256 id, string calldata newUri) external onlyOwner {
    require(id < _tokensCount, 'id too high');
    _setURI(id, newUri);
  }

  /**
   * @dev Increase _tokensCount
   */
  function createTokens(uint256 increment) external onlyOwner {
    _tokensCount += increment;
  }

  /**
   * @dev Set new contract owner
   */
  function setNewOwner(address newOwner) external onlyOwner {
    require(newOwner != address(0));
    _owner = newOwner;
  }
}
