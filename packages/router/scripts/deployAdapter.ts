import { task, types } from 'hardhat/config';
import { Network, TaskArguments } from 'hardhat/types';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Example: npx hardhat adapter:deploy --network arbitrumSepolia --signer "" --config hardhat-configs/hardhat.config.ts
task('adapter:deploy')
  .addParam('signer', 'The signer private key')
  .setAction(async (args: any, hre) => {
    const provider = new hre.ethers.providers.JsonRpcProvider((hre.network.config as any).url);
    const signer = new hre.ethers.Wallet(args.signer, provider);

    const adapterFactory = await hre.ethers.getContractFactory('PendleCurveNgAdapter', signer);
    const adapter = await adapterFactory.deploy([]);
    const tx = await adapter.deployTransaction.wait();

    console.log('Contract deployed at tx' + tx.transactionHash);
    console.log('Deployed address ' + adapter.address);

    // wait 5 sec
    await delay(5000);

    console.log('Start verification');
    await hre.run('verify:verify', {
      address: adapter.address,
    });

    console.log('Contract verified');
  });
