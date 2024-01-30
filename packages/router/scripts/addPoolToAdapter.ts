import { task, types } from 'hardhat/config';
import { Network, TaskArguments } from 'hardhat/types';

// Example: npx hardhat adapter:addPool --network arbitrumSepolia --signer "" --adapter "" --token0 "" --token1 "" --pool ""

task('adapter:addPool')
  .addParam('signer', 'The signer private key.')
  .addParam('adapter', 'Address of adapter.')
  .addParam('token0', 'Address of token0')
  .addParam('token1', 'Address of token1')
  .addParam('pool', 'Address of poool')
  .setAction(async (args, hre) => {
    const provider = new hre.ethers.providers.JsonRpcProvider((hre.network.config as any).url);
    const signer = new hre.ethers.Wallet(args.signer, provider);

    const token0 = await hre.ethers.getContractAt('IERC20Metadata', args.token0, signer);
    const token0Symbol = await token0.symbol();

    const token1 = await hre.ethers.getContractAt('IERC20Metadata', args.token1, signer);
    const token1Symbol = await token1.symbol();

    const adapter = await hre.ethers.getContractAt('AdapterStorage', args.adapter, signer);
    const tx = await adapter.addPools([{ token0: args.token0, token1: args.token1, pool: args.pool }]);
    await tx.wait();

    console.log(`Pool ${args.pool} ${token0Symbol}/${token1Symbol} added to adapter ${args.adapter}`);
  });
