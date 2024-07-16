import { Filter } from '@ethersproject/providers';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';
import bn from 'bignumber.js';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { formatUnits, parseUnits } from 'ethers/lib/utils';
const fs = require('node:fs');
const hre: HardhatRuntimeEnvironment = require('hardhat');

// Example: npx hardhat --network arbitrumOne run ./scripts/distributeRewards.ts
async function main() {
  const provider = new hre.ethers.providers.JsonRpcProvider((hre.network.config as any).url);

  const signerPrivateKey = '';
  const signer = new hre.ethers.Wallet(signerPrivateKey, provider);
  const rewardTokenAddress = '0x912ce59144191c1204e64559fe8253a0e49e6548'; //ARB
  const rewardTokenContract = await hre.ethers.getContractAt('ERC20', rewardTokenAddress, signer);

  const distributionFileName = ``;
  const stateFileName = `state_${distributionFileName}`;

  const distributionRecords = getDistributionRecords(distributionFileName);
  const distributionState = getDistributionState(stateFileName);

  const toDistribute = distributionRecords.filter(
    (r) => !distributionState.some((s) => s.userAddress.toLocaleLowerCase() == r.userAddress.toLocaleLowerCase())
  );

  let totalToDistribute = BigNumber.from(0);
  for (const item of toDistribute) {
    totalToDistribute = totalToDistribute.add(BigNumber.from(item.amount));
  }

  console.log(`Total users to distribute: ${toDistribute.length}`);
  console.log(`Total amount to distribute: ${formatUnits(totalToDistribute, 18)}`);

  for (let i = 0; i < toDistribute.length; i++) {
    const record = toDistribute[i];

    try {
      const tx = await rewardTokenContract.transfer(record.userAddress, record.amount);
      const txReceipt = await tx.wait();

      distributionState.push({
        userAddress: record.userAddress,
        txHash: txReceipt.transactionHash,
        amount: record.amount,
      });

      saveDistributionState(stateFileName, distributionState);
      console.log(
        `User ${record.userAddress} has been successfully distributed ${formatUnits(record.amount, 18)} ARB. Tx hash: ${
          txReceipt.transactionHash
        }`
      );
    } catch (e) {
      console.log(e);
      break;
    }
  }
}

type DistributionRecord = {
  userAddress: string;
  amount: string;
};

type DistributionState = {
  userAddress: string;
  txHash: string;
  amount: string;
};

/* Example of distribution file
[
  {
    "userAddress": "0x3ad4F88aF401bf5F4F2fE35718139cacC82410d7",
    "amount": "100000000000000000000"
  },
] 
*/
function getDistributionRecords(distrFileName: string): DistributionRecord[] {
  if (!fs.existsSync(distrFileName)) {
    throw new Error(`File ${distrFileName} not exists`);
  }

  const content = fs.readFileSync(distrFileName, { encoding: 'utf8' });
  return JSON.parse(content);
}

function getDistributionState(stateFileName: string): DistributionState[] {
  if (!fs.existsSync(stateFileName)) {
    return [];
  }

  const content = fs.readFileSync(stateFileName, { encoding: 'utf8' });
  return JSON.parse(content);
}

function saveDistributionState(stateFileName: string, distributionState: DistributionState[]) {
  fs.writeFileSync(stateFileName, JSON.stringify(distributionState, null, 2), { encoding: 'utf8' });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
