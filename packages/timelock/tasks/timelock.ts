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

import { saveDeploymentData, verifyContract } from './utils';
import { MarginlyParamsStruct } from '../typechain-types/contracts/test/MockMarginlyFactory.sol/MockMarginlyFactory';

interface DeployArgs {
  signer: string;
}

//npx hardhat --network holesky --config hardhat.config.ts deploy-timelock-wl --signer <private-key>
task('deploy-timelock-wl', 'Deploy timelock contract and transfer ownership from router')
  .addParam<string>('signer', 'Private key of contracts creator')
  .setAction(async (taskArgs: DeployArgs, hre: HardhatRuntimeEnvironment) => {
    const provider = hre.ethers.provider;

    let signer = new hre.ethers.Wallet(taskArgs.signer, provider);

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
      ['0xF8D88A292B0afa85E5Cf0d1195d0D3728Cfd7070', createPoolSignature], // factory
      ['0xa77C2275C1F403056c7F73B44df69E374C299dd7', setParametersSignature], //pt-weeth-26dec2024-weth
      ['0x4Cac44a1C50fea3F458f5F31529C0810AFcac497', setParametersSignature], //pt-weeth-26dec2024-weeth
      ['0xb34DfB03973e148ED800F369EdE84b92803116CA', setParametersSignature], //pt-ezeth-26dec2024-ezeth
      ['0x548F66BC804CB806ae5Ba3FeeE492a49FD8ef173', setParametersSignature], //pt-rseth-26dec2024-rseth
      ['0xafcC4F047a1012c4b51B69c7C1bB39C5F38F0305', setParametersSignature], //pt-ageth-26dec2024-ageth
      ['0xcAbAE9295e274c152b9DcCC124AB06cf78d079Eb', setParametersSignature], //pt-amphrlrt-26dec2024-amphrlrt
      ['0x2F06faF2A2EEFfBd44a796b8c6d2D04841c6488C', setParametersSignature], //pt-ebtc-26dec2024-ebtc
      ['0xee07F58A274Ebc50f79ccd1d67fF73426a317dAf', setParametersSignature], //pt-weeths-26dec2024-weeths
      ['0x1F1A9004F00571Ea0Ed79e51bfd2Cdc3954abc40', setParametersSignature], //pt-pufeth-26dec2024-pufeth
      ['0x530043876F37170468a9F366145E645BEE86da6C', setParametersSignature], //pt-amphreth-26dec2024-amphreth
      ['0x2Df52e18e0fcA1E8CEE272cD034368278a49125f', setParametersSignature], //pt-re7lrt-26dec2024-re7lrt
      ['0x32d850609FDc950bF6E23640d1EB0bbd60a5149c', setParametersSignature], //pt-cornlbtc-26dec2024-lbtc
      ['0x49755E70285dE0c624e0750543046131CB7163de', setParametersSignature], //pt-corn-unibtc-26dec2024-unibtc
      ['0x3D6f0097FA10f2e3855377daF2139dBeD66Fb343', setParametersSignature], //pt-cornlbtc-26dec2024-wbtc
      ['0x056888DD4B31cA090E2FC7ca87AF62B588dD8207', setParametersSignature], //pt-corn-unibtc-26dec2024-wbtc
      ['0xEe368c5014D218795F76DcDA58e8FD24D04E19Ff', setParametersSignature], //pt-corn-pumpbtc-26dec2024-wbtc
      ['0xB95b9f7763de009a4E6c739855faCDfA960eB893', setParametersSignature], //pt-lbtc-27mar2025-wbtc
      ['0xa692B4fb38f8e9aEA229DA05CC2FC9d748218CD3', setParametersSignature], //pt-pufeth-26dec2024-weth
      ['0xaE2e6412d5c47e23c55c87e65cb2721Fa799Cb96', setParametersSignature], //pt-weeths-26dec2024-weth
      ['0x49D7712f65B291E4574726d6e263a4E6Af2830F0', setParametersSignature], //pt-rseth-26dec2024-weth
      ['0xf7710a79F2440423e5865EB3a7DF3e47a430859F', setParametersSignature], //pt-lbtc-27mar2025-lbtc
      ['0xd88855292819e34388833A3cb5524eEDf25010AE', setParametersSignature], //pt-ebtc-27mar2025-ebtc
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
  });

//npx hardhat --network holesky --config hardhat.config.ts deploy-timelock --signer <private-key>
task('deploy-timelock', 'Deploy timelock contract and transfer ownership from router')
  .addParam<string>('signer', 'Private key of contracts creator')
  .setAction(async (taskArgs: DeployArgs, hre: HardhatRuntimeEnvironment) => {
    const provider = hre.ethers.provider;

    let signer = new hre.ethers.Wallet(taskArgs.signer, provider);

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
  });

//npx hardhat --network holesky --config hardhat.config.ts timelock-grant-role --signer <private-key>
task('timelock-grant-role')
  .addParam<string>('signer', 'Private key of contracts creator')
  .setAction(async (taskArgs: DeployArgs, hre: HardhatRuntimeEnvironment) => {
    const provider = hre.ethers.provider;

    let signer = new hre.ethers.Wallet(taskArgs.signer, provider);

    const cancellers = [];
    const timelockAddress = '';

    const timelock = TimelockController__factory.connect(timelockAddress, signer) as any as TimelockController;
    const role = await timelock.CANCELLER_ROLE();

    const delay = await timelock.getMinDelay();

    for (let i = 0; i < cancellers.length; i++) {
      const grantCancellerRole = await timelock.interface.encodeFunctionData('grantRole', [role, cancellers[i]]);

      const txReceipt = await timelock.schedule(
        timelock,
        0,
        grantCancellerRole,
        ethers.ZeroHash,
        ethers.ZeroHash,
        delay
      );
      if (delay == 0n) {
        await txReceipt.wait();
        await timelock.execute(timelock, 0, grantCancellerRole, ethers.ZeroHash, ethers.ZeroHash);
      }
    }
  });

//npx hardhat --network holesky --config hardhat.config.ts timelock-set-delay --signer <private-key>
task('timelock-set-delay')
  .addParam<string>('signer', 'Private key of contracts creator')
  .setAction(async (taskArgs: DeployArgs, hre: HardhatRuntimeEnvironment) => {
    const provider = hre.ethers.provider;

    let signer = new hre.ethers.Wallet(taskArgs.signer, provider);

    const timelockAddress = '';

    const timelock = TimelockController__factory.connect(timelockAddress, signer) as any as TimelockController;
    const delay = 259_200; // 3 * 24 * 60 * 60

    const updateDelayData = await timelock.interface.encodeFunctionData('updateDelay', [delay]);

    const txReceipt = await timelock.schedule(timelock, 0, updateDelayData, ethers.ZeroHash, ethers.ZeroHash, 0);
    await txReceipt.wait();

    await timelock.execute(timelock, 0, updateDelayData, ethers.ZeroHash, ethers.ZeroHash);
  });

//npx hardhat --network holesky --config hardhat.config.ts timelock-accept-ownership --signer <private-key>
task('timelock-accept-ownership')
  .addParam<string>('signer', 'Private key of contracts creator')
  .setAction(async (taskArgs: DeployArgs, hre: HardhatRuntimeEnvironment) => {
    const provider = hre.ethers.provider;

    let signer = new hre.ethers.Wallet(taskArgs.signer, provider);

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
task('timelock-transfer-ownership')
  .addParam<string>('signer', 'Private key of contracts creator')
  .setAction(async (taskArgs: DeployArgs, hre: HardhatRuntimeEnvironment) => {
    const provider = hre.ethers.provider;

    let signer = new hre.ethers.Wallet(taskArgs.signer, provider);

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
  });

//npx hardhat --network holesky --config hardhat.config.ts factory-transfer-ownership --signer <private-key>
task('factory-transfer-ownership', 'Change factory owner to timelock')
  .addParam<string>('signer', 'Private key of contracts creator')
  .setAction(async (taskArgs: DeployArgs, hre: HardhatRuntimeEnvironment) => {
    const provider = hre.ethers.provider;

    let signer = new hre.ethers.Wallet(taskArgs.signer, provider);

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
  });

//npx hardhat --network holesky --config hardhat.config.ts timelock-execute --signer <private-key>
task('timelock-execute', 'Timelock schedule and execute operation')
  .addParam<string>('signer', 'Private key of contracts creator')
  .setAction(async (taskArgs: DeployArgs, hre: HardhatRuntimeEnvironment) => {
    const provider = hre.ethers.provider;
    const signer = new hre.ethers.Wallet(taskArgs.signer, provider);

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
  });
