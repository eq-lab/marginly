import * as ethers from 'ethers';
import { waitForTx } from '@marginly/common';
import { assertSignerHasOwnerRights } from '../common';

export async function setTokenBalanceLimitSbt(
  signer: ethers.Signer,
  sbtContract: ethers.Contract,
  tokenId: number,
  newLimit: number
) {
  const provider = signer.provider;
  if (provider === undefined) {
    throw new Error('Provider is not specified');
  }
  await assertSignerHasOwnerRights(signer, sbtContract);

  const tokensCount = (await sbtContract._tokensCount()).toNumber();

  if (tokenId >= tokensCount) {
    throw new Error(`TokenId too high. Token id: ${tokenId}, token count: ${tokensCount}`);
  }

  const limitBefore = (await sbtContract._tokenBalanceLimits(tokenId)).toNumber();
  console.log(`Current limit for token id ${tokenId}: ${limitBefore}`);

  if (limitBefore === newLimit) {
    throw new Error(`Current limit === new limit`);
  }

  const tx = await sbtContract.setTokenBalanceLimit(tokenId, newLimit);
  console.log(`Set limit tx hash: ${tx.hash}`);
  await waitForTx(provider, tx.hash);

  const limitAfter = (await sbtContract._tokenBalanceLimits(tokenId)).toNumber();

  if (limitAfter === newLimit) {
    console.log(`Setting limit successfully finished!`);
  } else {
    throw new Error(`Setting limit failed!`);
  }
}
