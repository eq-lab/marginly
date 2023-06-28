import * as ethers from 'ethers';
import { waitForTx } from '@marginly/common';
import { assertSignerHasOwnerRights } from '../common';

export async function setUriSbt(signer: ethers.Signer, sbtContract: ethers.Contract, tokenId: number, newUri: string) {
  const provider = signer.provider;
  if (provider === undefined) {
    throw new Error('Provider is not specified');
  }
  await assertSignerHasOwnerRights(signer, sbtContract);

  const tokensCount = (await sbtContract._tokensCount()).toNumber();

  if (tokenId >= tokensCount) {
    throw new Error(`TokenId too high. Token id: ${tokenId}, token count: ${tokensCount}`);
  }

  const uriBefore = (await sbtContract.uri(tokenId)).toString();
  console.log(`Current URI for token id ${tokenId}: ${uriBefore}`);

  if (uriBefore === newUri) {
    throw new Error(`Current URI === new URI`);
  }

  const tx = await sbtContract.setURI(tokenId, newUri);
  console.log(`Set URI tx hash: ${tx.hash}`);
  await waitForTx(provider, tx.hash);

  const uriAfter = (await sbtContract.uri(tokenId)).toString();

  if (uriAfter === newUri) {
    console.log(`Setting URI successfully finished!`);
  } else {
    throw new Error(`Setting URI failed!`);
  }
}
