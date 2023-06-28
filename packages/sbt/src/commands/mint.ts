import * as ethers from 'ethers';
import { balanceOfBatch, SbtBalance, SbtDeployment } from '../common';
import { waitForTx } from '@marginly/common';

export interface MintParam {
  address: string;
  tokenId: number;
  amount: number;
}

export async function mintSbt(signer: ethers.Signer, sbtContract: ethers.Contract, balances: SbtBalance[]) {
  const provider = signer.provider;
  if (provider === undefined) {
    throw new Error('Provider is not specified');
  }
  const tokensCount = await sbtContract._tokensCount();
  console.log(`Tokens count: ${tokensCount}`);

  const balancesBefore = await balanceOfBatch(
    sbtContract,
    balances.map((x) => x.address),
    balances.map((x) => x.tokenId)
  );
  // console.log(`Address: ${balance.address}, tokenId: ${balance.tokenId}, amount: ${balance.amount}`);

  const addresses = balances.map((x) => x.address);
  const tokenIds = balances.map((x) => x.tokenId);
  const amounts = balances.map((x) => x.amount);
  const tx = await sbtContract.mint(addresses, tokenIds, amounts);
  console.log(`Mint tx hash: ${tx.hash}`);
  await waitForTx(provider, tx.hash);

  const balancesAfter = await balanceOfBatch(
    sbtContract,
    balances.map((x) => x.address),
    balances.map((x) => x.tokenId)
  );

  let ok = true;
  for (let i = 0; i < balances.length; i++) {
    const expected = balancesBefore[i] + balances[i].amount;
    if (balancesAfter[i] != expected) {
      console.log(
        `Balance after tx != balance before tx + mint amount. ` +
          `Address: ${balances[i].address}, tokenId: ${balances[i].tokenId}, ` +
          `balanceBefore: ${balancesBefore[i]}, balanceAfter: ${balancesAfter[i]}, ` +
          `expected balance: ${expected}`
      );
      ok = false;
    }
  }
  if (ok) {
    console.log(`Mint successfully finished!`);
  } else {
    throw new Error(`Mint failed!`);
  }
}
