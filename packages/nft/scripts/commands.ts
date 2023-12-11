import '@nomicfoundation/hardhat-toolbox';
import { task } from 'hardhat/config';
import type { HardhatRuntimeEnvironment, Network, TaskArguments } from 'hardhat/types';
import { BigNumberish, ContractTransactionResponse } from 'ethers';
import * as fs from 'fs';

import { ContestWinnerNFT__factory, ContestWinnerNFT } from '../typechain-types';

task('nft:transfer-ownership')
  .addParam('contract', 'The contract address.')
  .addParam('signer', 'The signer private key.')
  .addParam('owner', 'The owner address.')
  .setAction(async function (args: TaskArguments, hre) {
    const contract = initContestWinnerNftContract(hre, args.signer, args.contract);

    const tx = await contract.transferOwnership(args.owner);
    await waitTransaction(hre.network, tx);

    const owner = await contract.owner();

    console.log('Ownership has been successfully transferred to: ', owner);
  });

task('nft:renounce-ownership')
  .addParam('contract', 'The contract address.')
  .addParam('signer', 'The signer private key.')
  .setAction(async function (args: TaskArguments, hre) {
    const contract = initContestWinnerNftContract(hre, args.signer, args.contract);

    const tx = await contract.renounceOwnership();
    await waitTransaction(hre.network, tx);

    const owner = await contract.owner();

    console.log('Ownership has been successfully transferred to: ', owner);
  });

task('nft:create-or-update')
  .addParam('contract', 'The contract address.')
  .addParam('signer', 'The signer private key.')
  .addParam('metadataFile', 'The file containing the following JSON structure [{id:number,metadata:string}].')
  .setAction(async function (args: TaskArguments, hre) {
    const contract = initContestWinnerNftContract(hre, args.signer, args.contract);

    const tokensMetadata: TokenMetadata[] = JSON.parse(fs.readFileSync(args.metadataFile, 'utf-8'));

    const tokens = tokensMetadata.map((tm) => tm.id);
    const metadata = tokensMetadata.map((tm) => tm.metadata);

    const tx = await contract.createOrUpdate(tokens, metadata);
    await waitTransaction(hre.network, tx);

    console.log('Tokens has been successfully created/updated.', tokensMetadata);
  });

task('nft:mint')
  .addParam('contract', 'The contract address.')
  .addParam('signer', 'The signer private key.')
  .addParam('recipientsFile', 'The file containing the following JSON structure [{to:string,id:number,amount:number}].')
  .setAction(async function (args: TaskArguments, hre) {
    const contract = initContestWinnerNftContract(hre, args.signer, args.contract);

    const recipients: TokenRecipient[] = JSON.parse(fs.readFileSync(args.recipientsFile, 'utf-8'));

    const to = recipients.map((w) => w.to);
    const ids = recipients.map((tm) => tm.id);
    const amounts = recipients.map((w) => w.amount);

    const tx = await contract.mint(to, ids, amounts);
    await waitTransaction(hre.network, tx);

    console.log(`The tokens has been successfully minted to the recipients.`, recipients);
  });

task('nft:burn-minted')
  .addParam('contract', 'The contract address.')
  .addParam('signer', 'The signer private key.')
  .addParam(
    'burnMintedFile',
    'The file containing the following JSON structure [{owner:string,id:number,amount:number}].'
  )
  .setAction(async function (args: TaskArguments, hre) {
    const contract = initContestWinnerNftContract(hre, args.signer, args.contract);

    const burnData: TokenOwner[] = JSON.parse(fs.readFileSync(args.burnMintedFile, 'utf-8'));

    const owners = burnData.map((bd) => bd.owner);
    const ids = burnData.map((bd) => bd.id);
    const amounts = burnData.map((bd) => bd.amount);

    const tx = await contract.burnMinted(owners, ids, amounts);
    await waitTransaction(hre.network, tx);

    console.log(`The tokens has been successfully burned.`, burnData);
  });

function initContestWinnerNftContract(hre: HardhatRuntimeEnvironment, pk: string, contract: string): ContestWinnerNFT {
  const provider = new hre.ethers.JsonRpcProvider((hre.network.config as any).url);
  const signer = new hre.ethers.Wallet(pk, provider);
  const contestWinnerNft = ContestWinnerNFT__factory.connect(contract, signer);

  return contestWinnerNft;
}

async function waitTransaction(network: Network, response: ContractTransactionResponse) {
  if (!network.zksync) {
    await response.wait();
  }
}

interface TokenMetadata {
  id: BigNumberish;
  metadata: string;
}

interface TokenRecipient {
  to: string;
  id: BigNumberish;
  amount: BigNumberish;
}

interface TokenOwner {
  owner: string;
  id: BigNumberish;
  amount: BigNumberish;
}
