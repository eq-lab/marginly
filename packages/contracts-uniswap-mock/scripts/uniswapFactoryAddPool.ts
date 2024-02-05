import { task } from 'hardhat/config';
import { TaskArguments } from 'hardhat/types';

// Example: npx hardhat factory:addPool --network arbitrumSepolia --signer <signerPk> --factory <address> --pool <address>
task('factory:addPool')
  .addParam('signer', 'The signer private key.')
  .addParam('factory', 'Address of uniswapV3Mock factory.')
  .addParam('pool', 'Address of uniswapV3MockPool.')
  .setAction(async function (args: TaskArguments, hre) {
    const provider = new hre.ethers.providers.JsonRpcProvider((hre.network.config as any).url);
    const signer = new hre.ethers.Wallet(args.signer, provider);

    const factory = await hre.ethers.getContractAt('UniswapV3FactoryMock', args.factory, signer);
    const tx = await factory.addPool(args.pool);
    const txReceipt = await tx.wait();
    console.log(`UniswapV3 pool added to mock factory ${args.pool} txHash: ${txReceipt.transactionHash}`);
  });
