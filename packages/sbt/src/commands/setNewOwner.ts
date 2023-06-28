import * as ethers from 'ethers';
import { waitForTx } from '@marginly/common';
import { assertSignerHasOwnerRights } from '../common';

export async function setNewOwnerSbt(signer: ethers.Signer, sbtContract: ethers.Contract, newOwner: string) {
  const provider = signer.provider;
  if (provider === undefined) {
    throw new Error('Provider is not specified');
  }
  await assertSignerHasOwnerRights(signer, sbtContract);

  if (!ethers.utils.isAddress(newOwner)) {
    throw new Error(`Invalid owner eth address`);
  }
  const ownerBefore = (await sbtContract._owner()).toString();
  console.log(`Actual owner: ${ownerBefore}`);

  if (ownerBefore.toLowerCase() === newOwner.toLowerCase()) {
    throw new Error(`Owner already set`);
  }

  const tx = await sbtContract.setNewOwner(newOwner);
  console.log(`Setting owner tx hash: ${tx.hash}`);
  await waitForTx(provider, tx.hash);

  const ownerAfter = (await sbtContract._owner()).toString();
  if (ownerAfter.toLowerCase() === newOwner.toLowerCase()) {
    console.log(`Setting new owner successfully finished!`);
  } else {
    throw new Error(`Setting new owner failed! Expected: ${newOwner}, actual: ${ownerAfter}`);
  }
}
