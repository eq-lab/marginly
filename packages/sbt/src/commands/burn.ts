import * as ethers from 'ethers';
import { assertSignerHasOwnerRights, balanceOfBatch, SbtBalance } from '../common';
import { waitForTx } from '@marginly/common';

export async function burnSbt(signer: ethers.Signer, sbtContract: ethers.Contract, balances: SbtBalance[]) {
  const provider = signer.provider;
  if (provider === undefined) {
    throw new Error('Provider is not specified');
  }
  await assertSignerHasOwnerRights(signer, sbtContract);

  const addresses = balances.map((x) => x.address);
  const tokenIds = balances.map((x) => x.tokenId);
  const amounts = balances.map((x) => x.amount);

  const balancesBefore = await balanceOfBatch(sbtContract, addresses, tokenIds);

  for (let i = 0; i < balances.length; i++) {
    if (balancesBefore[i] < balances[i].amount) {
      throw new Error(
        `Account balance < burn amount. ` +
          `Account: ${balances[i].address}, tokenId: ${balances[i].tokenId}, ` +
          `balance: ${balancesBefore[i]}, burn amount: ${balances[i].amount}`
      );
    }
  }

  const tx = await sbtContract.burn(addresses, tokenIds, amounts);
  console.log(`Burn tx hash: ${tx.hash}`);
  await waitForTx(provider, tx.hash);

  const balancesAfter = await balanceOfBatch(
    sbtContract,
    balances.map((x) => x.address),
    balances.map((x) => x.tokenId)
  );

  let ok = true;
  for (let i = 0; i < balances.length; i++) {
    const expected = balancesBefore[i] - balances[i].amount;
    if (balancesAfter[i] != expected) {
      console.log(
        `Balance after tx != balance before tx - mint amount. ` +
          `Address: ${balances[i].address}, tokenId: ${balances[i].tokenId}, ` +
          `balanceBefore: ${balancesBefore[i]}, balanceAfter: ${balancesAfter[i]}, ` +
          `expected balance: ${expected}`
      );
      ok = false;
    }
  }
  if (ok) {
    console.log(`Burn successfully finished!`);
  } else {
    throw new Error(`Burn failed!`);
  }
}
