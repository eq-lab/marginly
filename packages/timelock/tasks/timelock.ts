import { task } from 'hardhat/config';
import { ethers } from 'ethers';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { Ownable2Step__factory, TimelockController, TimelockController__factory } from '../typechain-types';

import { delay, saveDeploymentData, verifyContract } from './utils';

interface DeployArgs {
  signer: string;
}

interface DeploymentData {
  [key: string]: {
    address: string;
    txHash: string;
    blockNumber: number;
  };
}

//npx hardhat --network holesky --config hardhat.config.ts deploy-time-lock --signer <private-key>
task('deploy-time-lock', 'Deploy timelock contract and transfer ownership from router')
  .addParam<string>('signer', 'Private key of contracts creator')
  .setAction(async (taskArgs: DeployArgs, hre: HardhatRuntimeEnvironment) => {
    const provider = hre.ethers.provider;

    let signer = new hre.ethers.Wallet(taskArgs.signer, provider);

    const configDir = `../deployment/${hre.network.name}`;

    const initialMinDelay = 0;
    const proposers = ['0x0562F16415fCf6fb5ACAF433e4796f8f328b7C7d', '0x29e3749A862D8eC96d5C055736117D2148A0004a'];
    const executors = ['0x0562F16415fCf6fb5ACAF433e4796f8f328b7C7d', '0x29e3749A862D8eC96d5C055736117D2148A0004a'];
    const admin = ethers.ZeroAddress;

    const timelock = (await new TimelockController__factory(signer).deploy(
      initialMinDelay,
      proposers,
      executors,
      admin
    )) as any as TimelockController;
    const timelockAddress = await timelock.getAddress();
    await timelock.waitForDeployment();
    const deploymentTx = timelock.deploymentTransaction()!;
    const txReceipt = await deploymentTx.wait();
    const txHash = txReceipt!.hash;

    const deploymentData = {
      TimelockController: {
        address: timelockAddress,
        txHash: txHash,
        blockNumber: txReceipt?.blockNumber,
      },
    };

    await saveDeploymentData('TimelockController', deploymentData, configDir);

    await delay(12_000); //wait 12 seconds
    await verifyContract(hre, timelockAddress, [initialMinDelay, proposers, executors, admin]);
  });

//npx hardhat --network holesky --config hardhat.config.ts router-transfer-ownership --signer <private-key>
task('router-transfer-ownership', 'Transfer ownership from router owner to timelock')
  .addParam<string>('signer', 'Private key of contracts creator')
  .setAction(async (taskArgs: DeployArgs, hre: HardhatRuntimeEnvironment) => {
    const provider = hre.ethers.provider;

    let signer = new hre.ethers.Wallet(taskArgs.signer, provider);

    const timelockAddress = '0x54DA69E2c91a1886Fd9C36F0E7f16f015cD052eF';
    const routerAddress = '0x6eC48569A33E9465c5325ff205Afa81209C33F31'; //https://etherscan.io/address/0x6eC48569A33E9465c5325ff205Afa81209C33F31
    const minDelay = 259_200; //3 days, 3 * 24 * 60 * 60

    const router = Ownable2Step__factory.connect(routerAddress, signer);
    const timelock = TimelockController__factory.connect(timelockAddress, signer);

    await (await router.connect(signer).transferOwnership(timelockAddress)).wait();
    console.log('\nTransfer ownership from router to timelock');

    // Timelock accept ownership
    const acceptOwnershipCallData = router.interface.encodeFunctionData('acceptOwnership');
    await (
      await timelock
        .connect(signer)
        .schedule(routerAddress, 0n, acceptOwnershipCallData, ethers.ZeroHash, ethers.ZeroHash, 0)
    ).wait();
    console.log('Scheduled accept ownership from router to timelock');

    await (
      await timelock
        .connect(signer)
        .execute(routerAddress, 0n, acceptOwnershipCallData, ethers.ZeroHash, ethers.ZeroHash)
    ).wait();
    console.log('Executed accept ownership from router to timelock');

    // Timelock update minDelay
    const updateMinDelay = timelock.interface.encodeFunctionData('updateDelay', [minDelay]);
    await (
      await timelock.connect(signer).schedule(timelock, 0n, updateMinDelay, ethers.ZeroHash, ethers.ZeroHash, 0)
    ).wait();
    console.log('Scheduled update minDelay from 0 to 3 days');

    await (
      await timelock.connect(signer).execute(timelock, 0n, updateMinDelay, ethers.ZeroHash, ethers.ZeroHash)
    ).wait();
    console.log('Executed update minDelay from 0 to 3 days');
  });

//npx hardhat --network holesky --config hardhat.config.ts router-transfer-ownership --signer <private-key>
task('timelock-execute', 'Timelock schedule and execute operation')
  .addParam<string>('signer', 'Private key of contracts creator')
  .setAction(async (taskArgs: DeployArgs, hre: HardhatRuntimeEnvironment) => {
    const provider = hre.ethers.provider;
    const signer = new hre.ethers.Wallet(taskArgs.signer, provider);

    const timelockAddress = '0xc71968f413bF7EDa0d11629e0Cedca0831967cD3';
    const timelock = TimelockController__factory.connect(timelockAddress, signer);

    // Timelock grant role
    const executorRole = await timelock.EXECUTOR_ROLE();
    const additionalExecutor = '0xBa7475dD02c618c8cB87b871B2cf806DDcF36B9b';
    const target = await timelock.getAddress();
    const predecessor = ethers.ZeroHash;
    const salt = ethers.ZeroHash;
    const grantRoleCallData = timelock.interface.encodeFunctionData('grantRole', [executorRole, additionalExecutor]);
    const delay = await timelock.getMinDelay();

    const operationId = await timelock.hashOperation(target, 0n, grantRoleCallData, predecessor, salt);
    if (!(await timelock.isOperation(operationId))) {
      console.log('Operation not existed. Schedule operation');

      await (await timelock.schedule(target, 0n, grantRoleCallData, predecessor, salt, delay)).wait();
    } else if (await timelock.isOperationDone(operationId)) {
      console.log('Operation done.');
    } else if (await timelock.isOperationReady(operationId)) {
      console.log('Operation ready for execution. Execute operation');

      await (await timelock.execute(target, 0n, grantRoleCallData, predecessor, salt)).wait();
    } else if (await timelock.isOperationPending(operationId)) {
      const readyTimestamp = await timelock.getTimestamp(operationId);
      console.log('Operation pending. Ready at ', new Date(Number(readyTimestamp) * 1000));
    }
  });
