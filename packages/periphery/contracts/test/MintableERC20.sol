// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

import './IMintableERC20.sol';

contract MintableERC20 is IMintableERC20 {
  mapping(address => uint256) private _balances;

  mapping(address => mapping(address => uint256)) private _allowances;

  uint256 private _totalSupply;

  string private _name;
  string private _symbol;
  uint8 private _decimals;
  bool private _isValidTokenIn = true;
  bool private _isValidTokenOut = true;

  constructor(string memory symbol, string memory name, uint8 decimals_) {
    _name = name;
    _symbol = symbol;
    _decimals = decimals_;
  }

  function totalSupply() public view virtual override returns (uint256) {
    return _totalSupply;
  }

  function balanceOf(address account) public view virtual override returns (uint256) {
    return _balances[account];
  }

  function transfer(address to, uint256 amount) public virtual override returns (bool) {
    address owner = msg.sender;
    _transfer(owner, to, amount);
    return true;
  }

  function transferFrom(address from, address to, uint256 amount) public virtual override returns (bool) {
    address spender = msg.sender;
    _spendAllowance(from, spender, amount);
    _transfer(from, to, amount);
    return true;
  }

  function _spendAllowance(address owner, address spender, uint256 amount) internal virtual {
    uint256 currentAllowance = allowance(owner, spender);
    if (currentAllowance != type(uint256).max) {
      require(currentAllowance >= amount, 'ERC20: insufficient allowance');
      unchecked {
        _approve(owner, spender, currentAllowance - amount);
      }
    }
  }

  function _approve(address owner, address spender, uint256 amount) internal virtual {
    require(owner != address(0), 'ERC20: approve from the zero address');
    require(spender != address(0), 'ERC20: approve to the zero address');

    _allowances[owner][spender] = amount;
    emit Approval(owner, spender, amount);
  }

  function allowance(address owner, address spender) public view virtual override returns (uint256) {
    return _allowances[owner][spender];
  }

  function approve(address spender, uint256 amount) public virtual override returns (bool) {
    address owner = msg.sender;
    require(owner != address(0), 'ERC20: approve from the zero address');
    require(spender != address(0), 'ERC20: approve to the zero address');

    _allowances[owner][spender] = amount;
    return true;
  }

  function mint(address _to, uint256 _amount) external {
    _totalSupply += _amount;
    _balances[_to] += _amount;
  }

  function decimals() public view virtual returns (uint8) {
    return _decimals;
  }

  function _transfer(address from, address to, uint256 amount) internal virtual {
    require(from != address(0), 'ERC20: transfer from the zero address');
    require(to != address(0), 'ERC20: transfer to the zero address');

    uint256 fromBalance = _balances[from];
    require(fromBalance >= amount, 'ERC20: transfer amount exceeds balance');
    unchecked {
      _balances[from] = fromBalance - amount;
    }
    _balances[to] += amount;
  }

  // part of Pendle IStandardizedYield interface
  function setIsValidTokenInOut(bool isValidTokenInArg, bool isValidTokenOutArg) external {
    _isValidTokenIn = isValidTokenInArg;
    _isValidTokenOut = isValidTokenOutArg;
  }

  function isValidTokenIn(address) public view virtual returns (bool) {
    return _isValidTokenIn;
  }

  function isValidTokenOut(address) public view virtual returns (bool) {
    return _isValidTokenOut;
  }
}
