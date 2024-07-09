import { Filter } from '@ethersproject/providers';
import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';
import bn from 'bignumber.js';
import { HardhatRuntimeEnvironment } from 'hardhat/types';
const fs = require('node:fs');
const hre: HardhatRuntimeEnvironment = require('hardhat');

// when amount > 0 is deposit, amount < 0 is withdraw
type Deposit = { amount: string; timestamp: number; blockNumber: number };

/// Get quote lenders and their time weighted balances between two dates for ARB distribution
/// Example: npx hardhat --network arbitrumOne run ./scripts/getQuoteLenders.ts
// Marginly pools for Arb distribution:
//"0x44579419E975f4d59eaA0876f2EdCA7F2531821A" PT-ezETH 26SEP2024 / ezETH
//"0x3ad4F88aF401bf5F4F2fE35718139cacC82410d7" PT-weETH 26SEP2024 / weETH
async function main() {
  const provider = new hre.ethers.providers.JsonRpcProvider((hre.network.config as any).url);

  const startBlockNumber = 220388330; // 10-Jun-2024
  const finishBlockNumber = 230330681; // 9-July-2024 //TODO: could be block number on finishTime

  const startTime = 1718841600; //20-Jun-2024T00:00:00Z
  const finishTime = 1720656000; // 11-July-2024T00:00:00Z
  const timeRange = finishTime - startTime;

  const marginlyPoolAddress = '0x3ad4F88aF401bf5F4F2fE35718139cacC82410d7';
  const lendersFileName = `lenders_${marginlyPoolAddress}_${startBlockNumber}_${finishBlockNumber}.json`;
  const distributionFileName = `distribution_${marginlyPoolAddress}_${startBlockNumber}_${finishBlockNumber}.json`;

  const marginlyPool = await hre.ethers.getContractAt('MarginlyPool', marginlyPoolAddress);
  marginlyPool.filters.DepositQuote();

  const lenders = new Map<string, Deposit[]>();

  const depositQuoteTopic = '0x674eb50a563a8d71e963ec32b215164a31e83cb53940ef8198fcf8f2e3a0e0be';
  const withdrawQuoteTopic = '0x487ff9253eff8d6ffd939875dc7caf988054404b5f75882a7ce9dc690b6a97bd';

  if (fs.existsSync(lendersFileName)) {
    console.log(`File ${lendersFileName} exists. Working with existing data`);

    const data: [string, Deposit[]][] = JSON.parse(fs.readFileSync(lendersFileName, 'utf8'));
    for (const [user, deposits] of data) {
      lenders.set(user, deposits);
    }
  } else {
    console.log(`File ${lendersFileName} not exists. Request data from web3 node`);
    console.log(
      `Scan marginly pool ${marginlyPoolAddress} for deposit events from block ${startBlockNumber} to ${finishBlockNumber}`
    );
    const step = 200_000;
    let currentBlockNumber = startBlockNumber;
    while (currentBlockNumber < finishBlockNumber) {
      const toBlockNumber =
        currentBlockNumber + step > finishBlockNumber ? finishBlockNumber : currentBlockNumber + step;

      const eventFilter: Filter = {
        fromBlock: currentBlockNumber,
        toBlock: toBlockNumber,
        address: marginlyPoolAddress,
        topics: [[depositQuoteTopic, withdrawQuoteTopic]],
      };

      const logs = await provider.getLogs(eventFilter);
      for (const log of logs) {
        const blockTimestamp = (await provider.getBlock(log.blockNumber)).timestamp;
        const logDescr = marginlyPool.interface.parseLog(log);
        let user;
        let amount;

        if (logDescr.name === 'DepositQuote') {
          user = logDescr.args[0];
          amount = BigNumber.from(logDescr.args[1]);
          //console.log(`DepositQuote bn ${log.blockNumber} ${user} ${amount.toString()} ${blockTimestamp}`);
        } else if (logDescr.name === 'WithdrawQuote') {
          user = logDescr.args[0];
          amount = -BigNumber.from(logDescr.args[1]);
          //console.log(`WithdrawQuote bn ${log.blockNumber} ${user} ${amount.toString()} ${blockTimestamp}`);
        } else {
          continue;
        }

        const deposit = { amount: amount.toString(), timestamp: blockTimestamp, blockNumber: log.blockNumber };
        const existed = lenders.get(user);
        if (existed) {
          existed.push(deposit);
        } else {
          lenders.set(user, [deposit]);
        }
      }
      //await sleep(1000);
      currentBlockNumber += step + 1;
    }

    const jsonData = JSON.stringify(Array.from(lenders.entries()), null, 2);
    fs.writeFileSync(lendersFileName, jsonData, 'utf8');
  }

  console.log(`Process lenders. Count ${lenders.size}`);

  let totalTimeWeightedBalance = BigNumber.from(0);
  const distribution: any = {};
  for (const [user, deposits] of lenders) {
    let balance: BigNumber = BigNumber.from(deposits[0].amount);
    let timeWeightedBalance: BigNumber = BigNumber.from(0);
    let lastDepositTime: number = Math.max(deposits[0].timestamp, startTime);

    for (let i = 1; i < deposits.length; i++) {
      const holdTime = deposits[i].timestamp - lastDepositTime;
      if (holdTime > 0) {
        timeWeightedBalance = timeWeightedBalance.add(balance.mul(holdTime).div(timeRange));
      }
      balance = balance.add(deposits[i].amount);
      lastDepositTime = Math.max(deposits[i].timestamp, finishTime);
    }

    if (balance.gt(0)) {
      const holdTime = finishTime - lastDepositTime;
      timeWeightedBalance = timeWeightedBalance.add(balance.mul(holdTime).div(timeRange));
    }

    if (timeWeightedBalance.gt(0)) {
      totalTimeWeightedBalance = totalTimeWeightedBalance.add(timeWeightedBalance);
      distribution[user] = timeWeightedBalance.toString();
    }
  }

  fs.writeFileSync(distributionFileName, JSON.stringify(distribution, null, 2), 'utf8');
  console.log(`Distribution file ${distributionFileName} saved`);

  const distributionDebug: any = {};
  for (const user of Object.keys(distribution)) {
    const share = bn(distribution[user]).div(totalTimeWeightedBalance.toString()).toFixed(4);
    distributionDebug[user] = share;
  }
  const distributionDebugFile = `distribution_debug_${marginlyPoolAddress}.json`;
  fs.writeFileSync(distributionDebugFile, JSON.stringify(distributionDebug, null, 2), 'utf8');
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
