import '@nomicfoundation/hardhat-toolbox';
import { task } from 'hardhat/config';
import type { TaskArguments } from 'hardhat/types';
import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import { Wallet as ZkWallet } from 'zksync-web3';

task('deploy:sbt:arb')
  .addParam('signer', 'The deployer private key.')
  .setAction(async function (args: TaskArguments, { ethers, network }) {
    const provider = new ethers.JsonRpcProvider((network.config as any).url);
    const signer = new ethers.Wallet(args.signer, provider);

    const factory = await ethers.getContractFactory('SBT', signer);
    const contract = await factory.deploy();
    await contract.waitForDeployment();

    console.log('Contract deployed to: ', await contract.getAddress());
  });

task('deploy:sbt:zks')
  .addParam('signer', 'The deployer private key.')
  .setAction(async function (args: TaskArguments, hre) {
    const signer = new ZkWallet(args.signer);
    const deployer = new Deployer(hre, signer);

    const artifact = await deployer.loadArtifact('SBT');
    const contract = await deployer.deploy(artifact, []);
    await contract.deployed();

    console.log('Greeter deployed to: ', await contract.address);
  });

task('verify:sbt:arb')
  .addParam('contract', 'The address of the verifying contract.')
  .setAction(async function (args: TaskArguments, { run }) {
    await run('verify:verify', {
      address: args.contract,
    });
  });

task('verify:sbt:zks')
  .addParam('contract', 'The address of the verifying contract.')
  .setAction(async function (args: TaskArguments, { run }) {
    await run('verify:verify', {
      address: args.contract,
      contract: 'contracts/SBT.sol:SBT',
      constructorArguments: [],
    });
  });
