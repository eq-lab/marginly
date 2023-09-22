// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.19;

import '@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol';
import '@uniswap/v2-periphery/contracts/interfaces/IERC20.sol';

contract RouterTestUniswapV2Pair is IUniswapV2Pair {
  uint public constant MINIMUM_LIQUIDITY = 10 ** 3;
  bytes4 private constant SELECTOR = bytes4(keccak256(bytes('transfer(address,uint256)')));

  address public factory;
  address public token0;
  address public token1;

  uint112 private reserve0; // uses single storage slot, accessible via getReserves
  uint112 private reserve1; // uses single storage slot, accessible via getReserves
  uint32 private blockTimestampLast; // uses single storage slot, accessible via getReserves

  uint public price0CumulativeLast;
  uint public price1CumulativeLast;
  uint public kLast; // reserve0 * reserve1, as of immediately after the most recent liquidity event

  function getReserves() public view returns (uint112 _reserve0, uint112 _reserve1, uint32 _blockTimestampLast) {
    _reserve0 = reserve0;
    _reserve1 = reserve1;
    _blockTimestampLast = blockTimestampLast;
  }

  function _safeTransfer(address token, address to, uint value) private {
    (bool success, bytes memory data) = token.call(abi.encodeWithSelector(SELECTOR, to, value));
    require(success && (data.length == 0 || abi.decode(data, (bool))), 'UniswapV2: TRANSFER_FAILED');
  }

  constructor() public {
    factory = msg.sender;
  }

  // called once by the factory at time of deployment
  function initialize(address _token0, address _token1) external {
    require(msg.sender == factory, 'UniswapV2: FORBIDDEN'); // sufficient check
    token0 = _token0;
    token1 = _token1;
  }

  function swap(uint amount0Out, uint amount1Out, address to, bytes calldata data) external {
    require(amount0Out > 0 || amount1Out > 0, 'UniswapV2: INSUFFICIENT_OUTPUT_AMOUNT');
    (uint112 _reserve0, uint112 _reserve1, ) = getReserves(); // gas savings
    require(amount0Out < _reserve0 && amount1Out < _reserve1, 'UniswapV2: INSUFFICIENT_LIQUIDITY');

    uint balance0;
    uint balance1;
    {
      // scope for _token{0,1}, avoids stack too deep errors
      address _token0 = token0;
      address _token1 = token1;
      require(to != _token0 && to != _token1, 'UniswapV2: INVALID_TO');
      if (amount0Out > 0) _safeTransfer(_token0, to, amount0Out); // optimistically transfer tokens
      if (amount1Out > 0) _safeTransfer(_token1, to, amount1Out); // optimistically transfer tokens
      // if (data.length > 0) IUniswapV2Callee(to).uniswapV2Call(msg.sender, amount0Out, amount1Out, data);
      balance0 = IERC20(_token0).balanceOf(address(this));
      balance1 = IERC20(_token1).balanceOf(address(this));
    }
    uint amount0In = balance0 > _reserve0 - amount0Out ? balance0 - (_reserve0 - amount0Out) : 0;
    uint amount1In = balance1 > _reserve1 - amount1Out ? balance1 - (_reserve1 - amount1Out) : 0;
    require(amount0In > 0 || amount1In > 0, 'UniswapV2: INSUFFICIENT_INPUT_AMOUNT');
    {
      // scope for reserve{0,1}Adjusted, avoids stack too deep errors
      uint balance0Adjusted = balance0 * 1000 - amount0In * 3;
      uint balance1Adjusted = balance1 * 1000 - amount1In * 3;
      require(balance0Adjusted * balance1Adjusted >= uint(_reserve0) * _reserve1 * (1000 ** 2), 'UniswapV2: K');
    }

    sync();
  }

  function sync() public {
    reserve0 = uint112(IERC20(token0).balanceOf(address(this)));
    reserve1 = uint112(IERC20(token1).balanceOf(address(this)));
  }

  function mint(address to) external returns (uint liquidity) {}

  function burn(address to) external returns (uint amount0, uint amount1) {}

  function skim(address to) external {}

  function DOMAIN_SEPARATOR() external view returns (bytes32) {}

  function PERMIT_TYPEHASH() external pure returns (bytes32) {}

  function allowance(address owner, address spender) external view returns (uint) {}

  function approve(address spender, uint value) external returns (bool) {}

  function balanceOf(address owner) external view returns (uint) {}

  function decimals() external pure returns (uint8) {}

  function name() external pure returns (string memory) {}

  function nonces(address owner) external view returns (uint) {}

  function permit(address owner, address spender, uint value, uint deadline, uint8 v, bytes32 r, bytes32 s) external {}

  function symbol() external pure returns (string memory) {}

  function totalSupply() external view returns (uint) {}

  function transfer(address to, uint value) external returns (bool) {}

  function transferFrom(address from, address to, uint value) external returns (bool) {}
}
