import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';
import { HardhatRuntimeEnvironment } from 'hardhat/types';

const hre: HardhatRuntimeEnvironment = require('hardhat');

enum CallType {
  DepositBase = 0,
  DepositQuote = 1,
  WithdrawBase = 2,
  WithdrawQuote = 3,
  Short = 4,
  Long = 5,
  ClosePosition = 6,
  Reinit = 7,
  ReceivePosition = 8,
  EmergencyWithdraw = 9,
}

// Example: npx hardhat --network arbitrumSepolia run ./scripts/callExecute.ts

async function main() {
  const signerPrivateKey = '';
  const marginlyPoolAddress = '';

  if (signerPrivateKey === '') {
    throw new Error('Signer privateKey not provided');
  }

  if (marginlyPoolAddress === '') {
    throw new Error('MarginlyPool address not provided');
  }

  const provider = new hre.ethers.providers.JsonRpcProvider((hre.network.config as any).url);
  const signer = new hre.ethers.Wallet(signerPrivateKey, provider);

  const marginlyPool = await hre.ethers.getContractAt('MarginlyPool', marginlyPoolAddress, signer);

  const call = CallType.Reinit;
  const amount1 = BigNumber.from(0);
  const amount2 = BigNumber.from(0);
  const limitPriceX96: BigNumber = BigNumber.from(0);
  const flag: boolean = false;
  const receivePositionAddress: string = ethers.constants.AddressZero;
  const swapCalldata: BigNumber = BigNumber.from(0);

  const tx = await marginlyPool.execute(
    call,
    amount1,
    amount2,
    limitPriceX96,
    flag,
    receivePositionAddress,
    swapCalldata
  );
  const txReceipt = await tx.wait();

  console.log(`Execute tx completed txHash: ${txReceipt.transactionHash}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
