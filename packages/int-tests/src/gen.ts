import { readFileSync, writeFileSync } from 'fs';
import { genDefinitions } from './utils/api-gen';

const defsWETH = genDefinitions(
  require(`@uniswap/v2-periphery/build/WETH9.json`),
  `@uniswap/v2-periphery/build/WETH9.json`,
  { overrideName: `WETH9` }
);
writeFileSync(`./src/contract-api/WETH9.ts`, defsWETH);

const defsFiatToken = genDefinitions(
  JSON.parse(readFileSync(`./artifacts/contracts/usdc.sol/FiatTokenV2_1.json`).toString().trim()),
  `../../artifacts/contracts/usdc.sol/FiatTokenV2_1.json`,
  { ignoreImportError: true }
);
writeFileSync(`./src/contract-api/FiatTokenV2.ts`, defsFiatToken);

const defsERC20 = genDefinitions(
  require(`@openzeppelin/contracts/build/contracts/ERC20.json`),
  `@openzeppelin/contracts/build/contracts/ERC20.json`
);
writeFileSync(`./src/contract-api/ERC20.ts`, defsERC20);

const defsSwapRouter = genDefinitions(
  require(`@uniswap/v3-periphery/artifacts/contracts/interfaces/ISwapRouter.sol/ISwapRouter.json`),
  `@uniswap/v3-periphery/artifacts/contracts/SwapRouter.sol/SwapRouter.json`,
  { overrideName: `SwapRouter` }
);
writeFileSync(`./src/contract-api/SwapRouter.ts`, defsSwapRouter);

const defsUniswapPool = genDefinitions(
  require(`@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Pool.sol/IUniswapV3Pool.json`),
  `@uniswap/v3-core/artifacts/contracts/UniswapV3Pool.sol/UniswapV3Pool.json`,
  { overrideName: `UniswapV3Pool` }
);
writeFileSync(`./src/contract-api/UniswapV3Pool.ts`, defsUniswapPool);

const defsUniswapFactory = genDefinitions(
  require(`@uniswap/v3-core/artifacts/contracts/interfaces/IUniswapV3Factory.sol/IUniswapV3Factory.json`),
  `@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json`,
  { overrideName: `UniswapV3Factory` }
);
writeFileSync(`./src/contract-api/UniswapV3Factory.ts`, defsUniswapFactory);

const defsNonfungiblePositionManager = genDefinitions(
  require(`@uniswap/v3-periphery/artifacts/contracts/interfaces/INonfungiblePositionManager.sol/INonfungiblePositionManager.json`),
  `@uniswap/v3-periphery/artifacts/contracts/NonfungiblePositionManager.sol/NonfungiblePositionManager.json`,
  { overrideName: `NonfungiblePositionManager` }
);
writeFileSync(`./src/contract-api/NonfungiblePositionManager.ts`, defsNonfungiblePositionManager);

const defsMarginlyFactory = genDefinitions(
  require(`@marginly/contracts/artifacts/contracts/MarginlyFactory.sol/MarginlyFactory.json`),
  `@marginly/contracts/artifacts/contracts/MarginlyFactory.sol/MarginlyFactory.json`,
  { ignoreImportError: true }
);
writeFileSync(`./src/contract-api/MarginlyFactory.ts`, defsMarginlyFactory);

const defsMarginlyPool = genDefinitions(
  require(`@marginly/contracts/artifacts/contracts/MarginlyPool.sol/MarginlyPool.json`),
  `@marginly/contracts/artifacts/contracts/MarginlyPool.sol/MarginlyPool.json`,
  { ignoreImportError: true }
);
writeFileSync(`./src/contract-api/MarginlyPool.ts`, defsMarginlyPool);

const defsKeeperContract = genDefinitions(
  require(`@marginly/contracts/artifacts/contracts/MarginlyKeeper.sol/MarginlyKeeper.json`),
  `@marginly/contracts/artifacts/contracts/MarginlyKeeper.sol/MarginlyKeeper.json`,
  { ignoreImportError: true }
);
writeFileSync(`./src/contract-api/MarginlyKeeper.ts`, defsKeeperContract);

const defsMarginlyRouter = genDefinitions(
  require(`@marginly/router/artifacts/contracts/MarginlyRouter.sol/MarginlyRouter.json`),
  `@marginly/router/artifacts/contracts/MarginlyRouter.sol/MarginlyRouter.json`,
  { ignoreImportError: true }
);
writeFileSync(`./src/contract-api/MarginlyRouter.ts`, defsMarginlyRouter);

const defsUniswapV3MarginlyAdapter = genDefinitions(
  require(`@marginly/router/artifacts/contracts/adapters/UniswapV3Adapter.sol/UniswapV3Adapter.json`),
  `@marginly/router/artifacts/contracts/adapters/UniswapV3Adapter.sol/UniswapV3Adapter.json`,
  { ignoreImportError: true }
);
writeFileSync(`./src/contract-api/UniswapV3MarginlyAdapter.ts`, defsUniswapV3MarginlyAdapter);

const defsBalancerMarginlyAdapter = genDefinitions(
  require(`@marginly/router/artifacts/contracts/adapters/BalancerAdapter.sol/BalancerAdapter.json`),
  `@marginly/router/artifacts/contracts/adapters/BalancerAdapter.sol/BalancerAdapter.json`,
  { ignoreImportError: true }
);
writeFileSync(`./src/contract-api/BalancerMarginlyAdapter.ts`, defsBalancerMarginlyAdapter);

const defsKyberClassicMarginlyAdapter = genDefinitions(
  require(`@marginly/router/artifacts/contracts/adapters/KyberSwapClassicAdapter.sol/KyberSwapClassicAdapter.json`),
  `@marginly/router/artifacts/contracts/adapters/KyberSwapClassicAdapter.sol/KyberSwapClassicAdapter.json`,
  { ignoreImportError: true }
);
writeFileSync(`./src/contract-api/KyberClassicMarginlyAdapter.ts`, defsKyberClassicMarginlyAdapter);

const defsUniswapV2MarginlyAdapter = genDefinitions(
  require(`@marginly/router/artifacts/contracts/adapters/UniswapV2Adapter.sol/UniswapV2Adapter.json`),
  `@marginly/router/artifacts/contracts/adapters/UniswapV2Adapter.sol/UniswapV2Adapter.json`,
  { ignoreImportError: true }
);
writeFileSync(`./src/contract-api/UniswapV2MarginlyAdapter.ts`, defsUniswapV2MarginlyAdapter);

const defsDodoV1MarginlyAdapter = genDefinitions(
  require(`@marginly/router/artifacts/contracts/adapters/DodoV1Adapter.sol/DodoV1Adapter.json`),
  `@marginly/router/artifacts/contracts/adapters/DodoV1Adapter.sol/DodoV1Adapter.json`,
  { ignoreImportError: true }
);
writeFileSync(`./src/contract-api/DodoV1MarginlyAdapter.ts`, defsDodoV1MarginlyAdapter);

const defsDodoV2MarginlyAdapter = genDefinitions(
  require(`@marginly/router/artifacts/contracts/adapters/DodoV2Adapter.sol/DodoV2Adapter.json`),
  `@marginly/router/artifacts/contracts/adapters/DodoV2Adapter.sol/DodoV2Adapter.json`,
  { ignoreImportError: true }
);
writeFileSync(`./src/contract-api/DodoV2MarginlyAdapter.ts`, defsDodoV2MarginlyAdapter);


// const defsAavePoolAddressesProvider = genDefinitions(
//   require(`@aave/core-v3/artifacts/contracts/protocol/configuration/PoolAddressesProvider.sol/PoolAddressesProvider.json`),
//   `@aave/core-v3/artifacts/contracts/protocol/configuration/PoolAddressesProvider.sol/PoolAddressesProvider.json`,
//   { ignoreImportError: true }
// );
// writeFileSync(`./src/contract-api/PoolAddressesProvider.ts`, defsAavePoolAddressesProvider);
