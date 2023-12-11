import '@nomicfoundation/hardhat-toolbox';
import { task } from 'hardhat/config';
import type { Network, TaskArguments } from 'hardhat/types';
import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import { Wallet as ZkWallet } from 'zksync-web3';
import * as fs from 'fs';

task('nft:deploy')
  .addParam('signer', 'The deployer private key.')
  .setAction(async function (args: TaskArguments, hre) {
    let txHash: string;
    let contractAddress: string;

    if (hre.network.zksync) {
      const signer = new ZkWallet(args.signer);
      const deployer = new Deployer(hre, signer);

      const artifact = await deployer.loadArtifact('ContestWinnerNFT');
      const contract = await deployer.deploy(artifact, []);
      const tx = contract.deployTransaction;
      await contract.deployed();

      txHash = tx!.hash;
      contractAddress = contract.address;
    } else {
      const provider = new hre.ethers.JsonRpcProvider((hre.network.config as any).url);
      const signer = new hre.ethers.Wallet(args.signer, provider);

      const factory = await hre.ethers.getContractFactory('ContestWinnerNFT', signer);
      const contract = await factory.deploy();
      const tx = contract.deploymentTransaction();
      await contract.waitForDeployment();

      txHash = tx!.hash;
      contractAddress = await contract.getAddress();
    }

    saveDeploymentState(hre.network, txHash, contractAddress);

    console.log('Contract has been successfully deployed to: ', contractAddress);
  });

task('nft:verify')
  .addParam('contract', 'The address of the verifying contract.')
  .setAction(async function (args: TaskArguments, hre) {
    if (hre.network.zksync) {
      await hre.run('verify:verify', {
        address: args.contract,
        contract: 'contracts/ContestWinnerNft.sol:ContestWinnerNFT',
        constructorArguments: [],
      });
    } else {
      await hre.run('verify:verify', {
        address: args.contract,
      });
    }
  });

function saveDeploymentState(network: Network, txHash: string, address: string) {
  const state = JSON.stringify(
    {
      address: address,
      txHash: txHash,
    },
    null,
    2
  );
  fs.writeFileSync(`./data/deployments/${network.name}-${new Date().toISOString()}`, state, { encoding: 'utf8' });
}
