import { ethers } from 'ethers';

export async function createChainlinkAggregator(price: bigint, decimals: bigint): Promise<Aggregator> {
  const factory = await ethers.getContractFactory('Aggregator');
  return factory.deploy(price, decimals);
}

export async function createPriceAdapter(
  chainlinkAggregatorBase: string,
  chainlinkAggregatorQuote: string
): Promise<PriceAdapter> {
  const factory = await ethers.getContractFactory('PriceAdapter');
  return factory.deploy(chainlinkAggregatorBase, chainlinkAggregatorQuote);
}

export function createMarginlyPoolWithPriceAdapter(
  basePrice: { price: bigint; decimals: bigint },
  quotePrice: { price: bigint; decimals: bigint } | null
) {
  async function inner(): Promise<{
    chainlinkAggregatorBase: Aggregator;
    chainlinkAggregatorQuote: Aggregator | null;
    priceAdapter: PriceAdapter;
    marginlyPoolWithPriceAdapter: MockMarginlyPoolWithPriceAdapter;
  }> {
    const chainlinkAggregatorBase = await createChainlinkAggregator(basePrice.price, basePrice.decimals); // btc
    const chainlinkAggregatorQuote =
      quotePrice && (await createChainlinkAggregator(quotePrice.price, quotePrice.decimals)); // eth
    const priceAdapter = await createPriceAdapter(
      chainlinkAggregatorBase.address,
      chainlinkAggregatorQuote !== null ? chainlinkAggregatorQuote.address : ethers.constants.AddressZero
    );
    const factory = await ethers.getContractFactory('MockMarginlyPoolWithPriceAdapter');
    const marginlyPoolWithPriceAdapter = await factory.deploy(priceAdapter.address);
    return { chainlinkAggregatorBase, chainlinkAggregatorQuote, priceAdapter, marginlyPoolWithPriceAdapter };
  }

  return inner;
}
