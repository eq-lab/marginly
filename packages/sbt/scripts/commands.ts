import '@nomicfoundation/hardhat-toolbox';
import { task } from 'hardhat/config';
import type { HardhatRuntimeEnvironment, Network, TaskArguments } from 'hardhat/types';
import { BigNumberish, ContractTransactionResponse } from 'ethers';
import * as fs from 'fs';

import { SBT, SBT__factory } from '../typechain-types';

task('sbt:transfer-ownership')
  .addParam('contract', 'The signer private key.')
  .addParam('signer', 'The signer private key.')
  .addParam('owner', 'The owner address.')
  .setAction(async function (args: TaskArguments, hre) {
    const contract = initSbtContract(hre, args.signer, args.contract);

    const tx = await contract.transferOwnership(args.owner);
    await waitTransaction(hre.network, tx);

    const owner = await contract.owner();

    console.log('Ownership has been successfully transferred to: ', owner);
  });

task('sbt:renounce-ownership')
  .addParam('contract', 'The signer private key.')
  .addParam('signer', 'The signer private key.')
  .setAction(async function (args: TaskArguments, hre) {
    const contract = initSbtContract(hre, args.signer, args.contract);

    const tx = await contract.renounceOwnership();
    await waitTransaction(hre.network, tx);

    const owner = await contract.owner();

    console.log('Ownership has been successfully transferred to: ', owner);
  });

task('sbt:create-or-update')
  .addParam('contract', 'The signer private key.')
  .addParam('signer', 'The signer private key.')
  .addParam('metadataFile', 'The file containing the following JSON structure [{id:number,metadata:string}].')
  .setAction(async function (args: TaskArguments, hre) {
    const contract = initSbtContract(hre, args.signer, args.contract);

    const tokensMetadata: TokenMetadata[] = JSON.parse(fs.readFileSync(args.metadataFile, 'utf-8'));

    const tokens = tokensMetadata.map((tm) => tm.id);
    const metadata = tokensMetadata.map((tm) => tm.metadata);

    const tx = await contract.createOrUpdate(tokens, metadata);
    await waitTransaction(hre.network, tx);

    console.log('Tokens has been successfully created/updated.', tokensMetadata);
  });

task('sbt:mint')
  .addParam('contract', 'The signer private key.')
  .addParam('signer', 'The signer private key.')
  .addParam('recipientsFile', 'The file containing the following JSON structure [{to:string,id:number,amount:number}].')
  .setAction(async function (args: TaskArguments, hre) {
    const contract = initSbtContract(hre, args.signer, args.contract);

    const recipients: TokenRecipient[] = JSON.parse(fs.readFileSync(args.recipientsFile, 'utf-8'));

    const to = recipients.map((w) => w.to);
    const ids = recipients.map((tm) => tm.id);
    const amounts = recipients.map((w) => w.amount);

    const tx = await contract.mint(to, ids, amounts);
    await waitTransaction(hre.network, tx);

    console.log(`The tokens has been successfully minted to the recipients.`, recipients);
  });

task('sbt:burn-minted')
  .addParam('contract', 'The signer private key.')
  .addParam('signer', 'The signer private key.')
  .addParam(
    'burnMintedFile',
    'The file containing the following JSON structure [{owner:string,id:number,amount:number}].'
  )
  .setAction(async function (args: TaskArguments, hre) {
    const contract = initSbtContract(hre, args.signer, args.contract);

    const burnData: TokenOwner[] = JSON.parse(fs.readFileSync(args.burnMintedFile, 'utf-8'));

    const owners = burnData.map((bd) => bd.owner);
    const ids = burnData.map((bd) => bd.id);
    const amounts = burnData.map((bd) => bd.amount);

    const tx = await contract.burnMinted(owners, ids, amounts);
    await waitTransaction(hre.network, tx);

    console.log(`The tokens has been successfully burned.`, burnData);
  });

task('sbt:burn')
  .addParam('contract', 'The signer private key.')
  .addParam('signer', 'The signer private key.')
  .addParam('id', 'The token id being burned.')
  .addParam('amount', 'The amount of token being burned.')
  .setAction(async function (args: TaskArguments, hre) {
    const contract = initSbtContract(hre, args.signer, args.contract);

    const tx = await contract.burn(args.id, args.amount);
    await waitTransaction(hre.network, tx);

    console.log(`The amount of token ${args.id} has been successsfully decreased by ${args.amount}.`);
  });

function initSbtContract(hre: HardhatRuntimeEnvironment, pk: string, contract: string): SBT {
  const provider = new hre.ethers.JsonRpcProvider((hre.network.config as any).url);
  const signer = new hre.ethers.Wallet(pk, provider);
  const sbt = SBT__factory.connect(contract, signer);

  return sbt;
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
