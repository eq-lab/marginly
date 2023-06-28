import * as ethers from 'ethers';
import { waitForTx } from '@marginly/common';
import { assertSignerHasOwnerRights } from '../common';

export async function createTokensSbt(signer: ethers.Signer, sbtContract: ethers.Contract, tokensCount: number) {
  const provider = signer.provider;
  if (provider === undefined) {
    throw new Error('Provider is not specified');
  }
  await assertSignerHasOwnerRights(signer, sbtContract);

  const tokensBefore = (await sbtContract._tokensCount()).toNumber();
  console.log(`Actual Tokens count: ${tokensCount}`);

  const tx = await sbtContract.createTokens(tokensCount);
  console.log(`Create tokens tx hash: ${tx.hash}`);
  await waitForTx(provider, tx.hash);

  const tokensAfter = (await sbtContract._tokensCount()).toNumber();

  const expected = tokensBefore + tokensCount;
  if (tokensAfter === expected) {
    console.log(`Creating tokens successfully finished!`);
  } else {
    throw new Error(`Creating tokens failed! Expected: ${expected}, actual: ${tokensAfter}`);
  }
}
