import { task, types } from 'hardhat/config';
import { Network, TaskArguments } from 'hardhat/types';

// Example: npx hardhat router:addAdapter --network arbitrumSepolia --signer "" --router "" --dexindex "" --adapter ""

task('router:addAdapter')
  .addParam('signer', 'The signer private key.')
  .addParam('router', 'Address of marginly router.')
  .addParam('adapter', 'Address of adapter to add.')
  .addParam('dexindex', 'Dex identifier.')
  .setAction(async (args: TaskArguments, hre) => {
    const provider = new hre.ethers.providers.JsonRpcProvider((hre.network.config as any).url);
    const signer = new hre.ethers.Wallet(args.signer, provider);

    const router = await hre.ethers.getContractAt('MarginlyRouter', args.router, signer);

    const tx = await router.addDexAdapters([{ dexIndex: args.dexindex, adapter: args.adapter }]);
    await tx.wait();

    console.log(`Adapter ${args.adapter} dexIndex ${args.dexindex} added to router ${args.router}]`);
  });
