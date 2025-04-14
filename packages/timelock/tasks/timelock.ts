import { task } from 'hardhat/config';
import { ethers } from 'ethers';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import {
  Ownable2Step__factory,
  TimelockWhitelist,
  TimelockWhitelist__factory,
  MockMarginlyPool__factory,
  MockMarginlyFactory__factory,
  TimelockController__factory,
  TimelockController,
} from '../typechain-types';

import { getSigner, saveDeploymentData, SignerArgs, taskWithSigner, verifyContract } from './utils';
import { MarginlyParamsStruct } from '../typechain-types/contracts/test/MockMarginlyFactory.sol/MockMarginlyFactory';

interface DeployArgs {
  signer: string;
}

//npx hardhat --network holesky --config hardhat.config.ts deploy-timelock-wl --keystore <keystore-file>
taskWithSigner('deploy-timelock-wl', 'Deploy timelock contract and transfer ownership from router').setAction(
  async (taskArgs: SignerArgs, hre: HardhatRuntimeEnvironment) => {
    const provider = hre.ethers.provider;
    let signer = await getSigner(taskArgs, provider);

    const configDir = `../deployment/${hre.network.name}`;

    const initialMinDelay = 0;
    const proposers = ['0x0562F16415fCf6fb5ACAF433e4796f8f328b7C7d', '0x29e3749A862D8eC96d5C055736117D2148A0004a'];
    const executors = ['0x0562F16415fCf6fb5ACAF433e4796f8f328b7C7d', '0x29e3749A862D8eC96d5C055736117D2148A0004a'];
    const admin = ethers.ZeroAddress;

    const marginlyFactoryInterface = MockMarginlyFactory__factory.createInterface();
    const marginlyPoolInterface = MockMarginlyPool__factory.createInterface();

    const createPoolSignature = marginlyFactoryInterface.getFunction('createPool').selector;
    const setParametersSignature = marginlyPoolInterface.getFunction('setParameters').selector;

    const whitelisted = [
      ['0x798A2FEb73E82D44b2148e37f02367CFb6ea3674', createPoolSignature], // factory trading
      ['0xE08Fa38f77041Aa8917CD5a5A758c18Ea54B5F62', setParametersSignature], // wS / USDC.e pool
      ['0x1768Faee0A63927FeB81100046f5D63BfE0f08dB', createPoolSignature], //factory farming
      ['0xb312d61915c878938fce09d13dd3006c6835b3e5', setParametersSignature], // PT-asonUSDC-14Aug2025/USDC.e
    ];

    const whitelistedTargets = whitelisted.map((x) => x[0]);
    const whitelistedMethods = whitelisted.map((x) => x[1]);

    const timelock = (await new TimelockWhitelist__factory(signer).deploy(
      initialMinDelay,
      proposers,
      executors,
      admin,
      whitelistedTargets,
      whitelistedMethods
    )) as any as TimelockWhitelist;
    const timelockAddress = await timelock.getAddress();
    await timelock.waitForDeployment();
    const deploymentTx = timelock.deploymentTransaction()!;
    const txReceipt = await deploymentTx.wait();
    const txHash = txReceipt!.hash;

    const deploymentData = {
      TimelockControllerWhitelist: {
        address: timelockAddress,
        txHash: txHash,
        blockNumber: txReceipt?.blockNumber,
      },
    };

    await saveDeploymentData('TimelockWhitelist', deploymentData, configDir);

    await verifyContract(hre, timelockAddress, [
      initialMinDelay,
      proposers,
      executors,
      admin,
      whitelistedTargets,
      whitelistedMethods,
    ]);
  }
);

//npx hardhat --network holesky --config hardhat.config.ts deploy-timelock --signer <private-key>
taskWithSigner('deploy-timelock', 'Deploy timelock contract and transfer ownership from router').setAction(
  async (taskArgs: SignerArgs, hre: HardhatRuntimeEnvironment) => {
    const provider = hre.ethers.provider;

    let signer = await getSigner(taskArgs, provider);

    const configDir = `../deployment/${hre.network.name}`;

    const initialMinDelay = 0;
    const proposers = ['0x0562F16415fCf6fb5ACAF433e4796f8f328b7C7d', '0x29e3749A862D8eC96d5C055736117D2148A0004a'];
    const executors = ['0x0562F16415fCf6fb5ACAF433e4796f8f328b7C7d', '0x29e3749A862D8eC96d5C055736117D2148A0004a'];
    const cancellers = [];
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

    const cancellerRole = await timelock.CANCELLER_ROLE();
    for (let i = 0; i < cancellers.length; i++) {
      const grantCancellerRole = await timelock.interface.encodeFunctionData('grantRole', [
        cancellerRole,
        cancellers[i],
      ]);

      await timelock.schedule(timelock, 0, grantCancellerRole, ethers.ZeroHash, ethers.ZeroHash, 0);
      await timelock.execute(timelock, 0, grantCancellerRole, ethers.ZeroHash, ethers.ZeroHash);
    }

    const deploymentData = {
      TimelockController: {
        address: timelockAddress,
        txHash: txHash,
        blockNumber: txReceipt?.blockNumber,
      },
    };

    await saveDeploymentData('TimelockController', deploymentData, configDir);
    await verifyContract(hre, timelockAddress, [initialMinDelay, proposers, executors, admin]);
  }
);

//npx hardhat --network holesky --config hardhat.config.ts timelock-grant-role --keystore <private-key>
taskWithSigner('timelock-grant-role').setAction(async (taskArgs: SignerArgs, hre: HardhatRuntimeEnvironment) => {
  const provider = hre.ethers.provider;

  let signer = await getSigner(taskArgs, provider);

  const cancellers = [];
  const timelockAddress = '';

  const timelock = TimelockController__factory.connect(timelockAddress, signer) as any as TimelockController;
  const role = await timelock.CANCELLER_ROLE();

  const delay = await timelock.getMinDelay();

  for (let i = 0; i < cancellers.length; i++) {
    const grantCancellerRole = await timelock.interface.encodeFunctionData('grantRole', [role, cancellers[i]]);

    const txReceipt = await timelock.schedule(timelock, 0, grantCancellerRole, ethers.ZeroHash, ethers.ZeroHash, delay);
    if (delay == 0n) {
      await txReceipt.wait();
      await timelock.execute(timelock, 0, grantCancellerRole, ethers.ZeroHash, ethers.ZeroHash);
    }
  }
});

//npx hardhat --network holesky --config hardhat.config.ts timelock-set-delay --signer <private-key>
taskWithSigner('timelock-set-delay').setAction(async (taskArgs: SignerArgs, hre: HardhatRuntimeEnvironment) => {
  const provider = hre.ethers.provider;

  let signer = await getSigner(taskArgs, provider);

  const timelockAddress = '';

  const timelock = TimelockController__factory.connect(timelockAddress, signer) as any as TimelockController;
  const delay = 259_200; // 3 * 24 * 60 * 60

  const updateDelayData = await timelock.interface.encodeFunctionData('updateDelay', [delay]);

  const txReceipt = await timelock.schedule(timelock, 0, updateDelayData, ethers.ZeroHash, ethers.ZeroHash, 0);
  await txReceipt.wait();

  await timelock.execute(timelock, 0, updateDelayData, ethers.ZeroHash, ethers.ZeroHash);
});

//npx hardhat --network holesky --config hardhat.config.ts timelock-accept-ownership --signer <private-key>
taskWithSigner('timelock-accept-ownership').setAction(async (taskArgs: SignerArgs, hre: HardhatRuntimeEnvironment) => {
  const provider = hre.ethers.provider;

  let signer = await getSigner(taskArgs, provider);

  const ownableContractAddress = '';
  const ownableContract = Ownable2Step__factory.connect(ownableContractAddress, signer);
  const timelockAddress = '';

  const timelock = TimelockController__factory.connect(timelockAddress, signer) as any as TimelockController;
  const acceptOwnershipCallData = await ownableContract.interface.encodeFunctionData('acceptOwnership');

  const delay = await timelock.getMinDelay();
  const txReceipt = await timelock.schedule(
    ownableContract,
    0,
    acceptOwnershipCallData,
    ethers.ZeroHash,
    ethers.ZeroHash,
    delay
  );

  if (delay == 0n) {
    await txReceipt.wait();
    await timelock.execute(ownableContract, 0, acceptOwnershipCallData, ethers.ZeroHash, ethers.ZeroHash);
  }
});

//npx hardhat --network holesky --config hardhat.config.ts timelock-transfer-ownership --signer <private-key>
taskWithSigner('timelock-transfer-ownership').setAction(
  async (taskArgs: SignerArgs, hre: HardhatRuntimeEnvironment) => {
    const provider = hre.ethers.provider;

    let signer = await getSigner(taskArgs, provider);

    const ownableContractAddress = '0xe8632C0BA276B245988885A37E3B1A3CeeD0D469';
    const ownableContract = Ownable2Step__factory.connect(ownableContractAddress, signer);
    const timelockAddress = '0xCF515e7cB2a636CDe81D63A37F2433100cbf982C';
    const newOwner = '0x63DE6d2ec4289339569250Dc000b658c7f1244c5';

    const timelock = TimelockController__factory.connect(timelockAddress, signer) as any as TimelockController;
    const transferOwnershipCallData = await ownableContract.interface.encodeFunctionData('transferOwnership', [
      newOwner,
    ]);

    const delay = await timelock.getMinDelay();
    const txReceipt = await timelock.schedule(
      ownableContract,
      0,
      transferOwnershipCallData,
      ethers.ZeroHash,
      ethers.ZeroHash,
      delay
    );

    if (delay == 0n) {
      await txReceipt.wait();
      await timelock.execute(ownableContract, 0, transferOwnershipCallData, ethers.ZeroHash, ethers.ZeroHash);
    }
  }
);

//npx hardhat --network holesky --config hardhat.config.ts factory-transfer-ownership --signer <private-key>
taskWithSigner('factory-transfer-ownership', 'Change factory owner to timelock').setAction(
  async (taskArgs: SignerArgs, hre: HardhatRuntimeEnvironment) => {
    const provider = hre.ethers.provider;

    let signer = await getSigner(taskArgs, provider);

    const timelockAddress = '0x8cDAf202eBe2f38488074DcFCa08c0B0cB7B8Aa5';
    const factoryAddress = '0xF8D88A292B0afa85E5Cf0d1195d0D3728Cfd7070';
    const minDelay = 259_200; //3 days, 3 * 24 * 60 * 60

    const factory = Ownable2Step__factory.connect(factoryAddress, signer);
    const timelock = TimelockWhitelist__factory.connect(timelockAddress, signer);

    await (await factory.connect(signer).transferOwnership(timelockAddress)).wait();
    console.log('\nTransfer ownership from factory to timelock');

    // Timelock accept ownership
    const acceptOwnershipCallData = factory.interface.encodeFunctionData('acceptOwnership');
    await (
      await timelock
        .connect(signer)
        .schedule(factoryAddress, 0n, acceptOwnershipCallData, ethers.ZeroHash, ethers.ZeroHash, 0)
    ).wait();
    console.log('Scheduled accept ownership from factory to timelock');

    await (
      await timelock
        .connect(signer)
        .execute(factoryAddress, 0n, acceptOwnershipCallData, ethers.ZeroHash, ethers.ZeroHash)
    ).wait();
    console.log('Executed accept ownership from factory to timelock');

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
  }
);

//npx hardhat --network holesky --config hardhat.config.ts timelock-execute --signer <private-key>
taskWithSigner('timelock-execute', 'Timelock schedule and execute operation').setAction(
  async (taskArgs: SignerArgs, hre: HardhatRuntimeEnvironment) => {
    const provider = hre.ethers.provider;
    const signer = await getSigner(taskArgs, provider);

    const timelockAddress = '0xc71968f413bF7EDa0d11629e0Cedca0831967cD3';
    const timelock = TimelockWhitelist__factory.connect(timelockAddress, signer);

    const predecessor = ethers.ZeroHash;
    const salt = ethers.ZeroHash;

    // Timelock execute
    const target = ''; // target address pool
    const parameters: MarginlyParamsStruct = {
      maxLeverage: 0n,
      interestRate: 0n,
      fee: 0n,
      swapFee: 0n,
      mcSlippage: 0n,
      positionMinAmount: 0n,
      quoteLimit: 0n,
    };

    const callData = new MockMarginlyPool__factory(signer).interface.encodeFunctionData('setParameters', [parameters]);
    const method = callData.slice(0, 10);
    const delay = await timelock.getMinDelay();

    const operationId = await timelock.hashOperation(target, 0n, callData, predecessor, salt);

    if (await timelock.isWhitelisted(target, method)) {
      console.log('Whitelisted method. Execute operation immediately');

      await (await timelock.execute(target, 0n, callData, predecessor, salt)).wait();
    } else if (!(await timelock.isOperation(operationId))) {
      console.log('Operation not existed. Schedule operation');

      await (await timelock.schedule(target, 0n, callData, predecessor, salt, delay)).wait();
    } else if (await timelock.isOperationDone(operationId)) {
      console.log('Operation done.');
    } else if (await timelock.isOperationReady(operationId)) {
      console.log('Operation ready for execution. Execute operation');

      await (await timelock.execute(target, 0n, callData, predecessor, salt)).wait();
    } else if (await timelock.isOperationPending(operationId)) {
      const readyTimestamp = await timelock.getTimestamp(operationId);
      console.log('Operation pending. Ready at ', new Date(Number(readyTimestamp) * 1000));
    }
  }
);
