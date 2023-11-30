import { EthAddress, RationalNumber } from '@marginly/common';
import { priceToPriceFp27, priceToSqrtPriceX96, sortUniswapPoolTokens } from '@marginly/common/math';
import { MarginlyDeployer } from '../deployer';
import { printDeployState, using } from '../common';
import { TokenRepository } from '../token-repository';
import {
  isMarginlyConfigSwapPoolRegistry,
  isMarginlyConfigUniswapGenuine,
  isMarginlyConfigUniswapMock,
  MarginlyConfigSwapPoolRegistry,
  MarginlyConfigUniswap,
  MarginlyConfigUniswapGenuine,
  MarginlyConfigUniswapMock,
} from '../deployer/configs';

export async function deploySwapPools(
  uniswapConfig: MarginlyConfigUniswap,
  tokenRepository: TokenRepository,
  marginlyDeployer: MarginlyDeployer
): Promise<EthAddress> {
  if (isMarginlyConfigUniswapGenuine(uniswapConfig)) {
    return deployGenuineUniswapPool(uniswapConfig, tokenRepository, marginlyDeployer);
  } else if (isMarginlyConfigUniswapMock(uniswapConfig)) {
    return deployMockUniswapPool(uniswapConfig, tokenRepository, marginlyDeployer);
  } else if (isMarginlyConfigSwapPoolRegistry(uniswapConfig)) {
    return deploySwapPoolRegistry(uniswapConfig, tokenRepository, marginlyDeployer);
  } else {
    throw new Error('Unknown Uniswap type');
  }
}

export async function deployGenuineUniswapPool(
  uniswapConfig: MarginlyConfigUniswapGenuine,
  tokenRepository: TokenRepository,
  marginlyDeployer: MarginlyDeployer
): Promise<EthAddress> {
  await using(marginlyDeployer.logger.beginScope('Create uniswap pools'), async () => {
    for (const pool of uniswapConfig.pools) {
      const uniswapPoolDeploymentResult = await marginlyDeployer.getOrCreateUniswapPoolGenuine(
        uniswapConfig.factory,
        pool,
        tokenRepository
      );
      printDeployState(`Uniswap Pool '${pool.id}'`, uniswapPoolDeploymentResult, marginlyDeployer.logger);
    }
  });
  return uniswapConfig.factory;
}

export async function deployMockUniswapPool(
  uniswapConfig: MarginlyConfigUniswapMock,
  tokenRepository: TokenRepository,
  marginlyDeployer: MarginlyDeployer
): Promise<EthAddress> {
  const uniswapRouterDeploymentResult = await marginlyDeployer.deployUniswapRouterMock(
    uniswapConfig.weth9Token,
    tokenRepository
  );
  const uniswapRouterContract = uniswapRouterDeploymentResult.contract;
  await uniswapRouterContract.setRejectArbitraryRecipient(true);
  for (const pool of uniswapConfig.pools) {
    const uniswapPoolDeploymentResult = await marginlyDeployer.deployUniswapPoolMock(
      uniswapConfig.oracle,
      pool,
      tokenRepository
    );
    const { address: tokenAAddress } = tokenRepository.getTokenInfo(pool.tokenA.id);
    const { address: tokenBAddress } = tokenRepository.getTokenInfo(pool.tokenB.id);
    const uniswapFee = marginlyDeployer.toUniswapFee(pool.fee);
    await uniswapRouterContract.setPool(
      tokenAAddress.toString(),
      tokenBAddress.toString(),
      uniswapFee,
      uniswapPoolDeploymentResult.address
    );

    const [token0, token1] = sortUniswapPoolTokens(
      [tokenAAddress.toString(), tokenBAddress.toString()],
      [pool.tokenA, pool.tokenB]
    );

    const priceToken = pool[pool.priceBaseTokenKey];
    let price: number;
    if (token0.id === priceToken.id) {
      price = pool.price;
    } else {
      price = 1 / pool.price;
    }

    const { decimals: token0Decimals } = tokenRepository.getTokenInfo(token0.id);
    const { decimals: token1Decimals } = tokenRepository.getTokenInfo(token1.id);

    const priceFp27 = priceToPriceFp27(price, token0Decimals, token1Decimals);
    const sqrtPriceX96 = priceToSqrtPriceX96(price, token0Decimals, token1Decimals);

    const uniswapPoolContract = uniswapPoolDeploymentResult.contract;

    await uniswapPoolContract.setPrice(priceFp27, sqrtPriceX96);
    await uniswapPoolContract.increaseObservationCardinalityNext(uniswapConfig.priceLogSize);

    await uniswapPoolContract.setAllowListEnabled(true);
    await uniswapPoolContract.addToAllowList(uniswapRouterDeploymentResult.address);

    const uniswapPoolAddress = EthAddress.parse(uniswapPoolDeploymentResult.address);

    if (pool.tokenABalance !== undefined) {
      await marginlyDeployer.ensureTokenAmount(pool.tokenA, uniswapPoolAddress, pool.tokenABalance, tokenRepository);
    }
    if (pool.tokenBBalance !== undefined) {
      await marginlyDeployer.ensureTokenAmount(pool.tokenB, uniswapPoolAddress, pool.tokenBBalance, tokenRepository);
    }
    const ownerAddress = EthAddress.parse(await marginlyDeployer.signer.getAddress());
    await marginlyDeployer.ensureTokenAmount(
      pool.tokenA,
      ownerAddress,
      RationalNumber.parse('1_000_000'),
      tokenRepository
    );
    await marginlyDeployer.ensureTokenAmount(
      pool.tokenB,
      ownerAddress,
      RationalNumber.parse('1_000_000'),
      tokenRepository
    );
  }

  return EthAddress.parse(uniswapRouterDeploymentResult.address);
}

export async function deploySwapPoolRegistry(
  swapPoolRegistryConfig: MarginlyConfigSwapPoolRegistry,
  tokenRepository: TokenRepository,
  marginlyDeployer: MarginlyDeployer
): Promise<EthAddress> {
  const priceAdapters: EthAddress[] = [];
  const priceProvidersMockDeployAddresses = new Map<string, string>();
  for (const pool of swapPoolRegistryConfig.pools) {
    if (pool.priceAdapter.priceProvidersMock !== undefined) {
      const { basePriceProviderMock, quotePriceProviderMock } = pool.priceAdapter.priceProvidersMock;
      for (const { priceProviderMock, tag } of [
        { priceProviderMock: basePriceProviderMock, tag: 'base' },
        { priceProviderMock: quotePriceProviderMock, tag: 'quote' },
      ]) {
        if (priceProviderMock !== undefined) {
          await using(marginlyDeployer.logger.beginScope('Deploy PriceProviderMock'), async () => {
            const deployResult = await marginlyDeployer.deployPriceProviderMock(priceProviderMock, `${tag}_${pool.id}`);
            printDeployState(`PriceProviderMock`, deployResult, marginlyDeployer.logger);
            priceProvidersMockDeployAddresses.set(tag, deployResult.address);
          });
        }
      }
    }

    const basePriceProviderMockAddress = priceProvidersMockDeployAddresses.get('base');
    const basePriceProvider =
      basePriceProviderMockAddress === undefined
        ? pool.priceAdapter.basePriceProvider!
        : EthAddress.parse(basePriceProviderMockAddress);

    const quotePriceProviderMockAddress = priceProvidersMockDeployAddresses.get('quote');
    const quotePriceProvider =
      quotePriceProviderMockAddress === undefined
        ? pool.priceAdapter.quotePriceProvider || EthAddress.parse('0x0000000000000000000000000000000000000000')
        : EthAddress.parse(quotePriceProviderMockAddress);

    const priceAdapterDeployResult = await using(
      marginlyDeployer.logger.beginScope('Deploy PriceAdapter'),
      async () => {
        const deployResult = await marginlyDeployer.deployMarginlyPriceAdapter(
          basePriceProvider,
          quotePriceProvider,
          pool.id
        );
        printDeployState(`PriceAdapter`, deployResult, marginlyDeployer.logger);
        return deployResult;
      }
    );
    priceAdapters.push(EthAddress.parse(priceAdapterDeployResult.address));
  }

  const swapPoolDeploymentResult = await using(
    marginlyDeployer.logger.beginScope('Deploy SwapPoolRegistry'),
    async () => {
      const deployResult = await marginlyDeployer.deploySwapPoolRegistry(
        tokenRepository,
        swapPoolRegistryConfig.factory,
        swapPoolRegistryConfig.pools,
        priceAdapters
      );
      printDeployState(`SwapPoolRegistry`, deployResult, marginlyDeployer.logger);
      return deployResult;
    }
  );

  return EthAddress.parse(swapPoolDeploymentResult.address);
}
