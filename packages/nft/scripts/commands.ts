import '@nomicfoundation/hardhat-toolbox';
import { task } from 'hardhat/config';
import type { HardhatRuntimeEnvironment, Network, TaskArguments } from 'hardhat/types';
import { BigNumberish, ContractTransactionResponse, isAddress, ZeroAddress } from 'ethers';
import * as fs from 'fs';

import { ContestWinnerNFT__factory, ContestWinnerNFT } from '../typechain-types';

task('nft:transfer-ownership')
  .addParam('contract', 'The contract address.')
  .addParam('signer', 'The signer private key.')
  .addParam('owner', 'The owner address.')
  .setAction(async function (args: TaskArguments, hre) {
    if (!isAddress(args.owner)) {
      throw new Error(`Invalid input owner address: ${args.owner}`);
    }

    const contract = initContestWinnerNftContract(hre, args.signer, args.contract);

    const tx = await contract.transferOwnership(args.owner);
    console.log(`Tx hash: ${tx.hash}`);
    await waitTransaction(hre.network, tx);

    const owner = await contract.owner();

    if (owner.toLowerCase() !== args.owner.toLowerCase()) {
      throw new Error(
        `Contract has invalid owner after tx. Expected: ${args.owner.toLowerCase()}, actual: ${owner.toLowerCase()}`
      );
    }
    console.log('Ownership has been successfully transferred to: ', owner);
  });

task('nft:renounce-ownership')
  .addParam('contract', 'The contract address.')
  .addParam('signer', 'The signer private key.')
  .setAction(async function (args: TaskArguments, hre) {
    const contract = initContestWinnerNftContract(hre, args.signer, args.contract);

    const tx = await contract.renounceOwnership();
    console.log(`Tx hash: ${tx.hash}`);
    await waitTransaction(hre.network, tx);

    const owner = await contract.owner();

    if (owner.toLowerCase() !== ZeroAddress) {
      throw new Error(`Contract has invalid owner after tx. Expected: ${ZeroAddress}, actual: ${owner.toLowerCase()}`);
    }
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

    if (tokens.some((x) => x < 0)) {
      throw new Error(`Metadata file contains token id < 0`);
    }

    const tokenDuplicates = tokens.filter((x, i) => i !== tokens.lastIndexOf(x));
    if (tokenDuplicates.length !== 0) {
      throw new Error(`Metadata file contains token id duplicates: [${tokenDuplicates}]`);
    }

    const metadataDuplicates = metadata.filter((x, i) => i !== metadata.lastIndexOf(x));
    if (metadataDuplicates.length !== 0) {
      throw new Error(`Metadata file contains token id duplicates: [${metadataDuplicates}]`);
    }

    const tx = await contract.createOrUpdate(tokens, metadata);
    console.log(`Tx hash: ${tx.hash}`);
    await waitTransaction(hre.network, tx);

    let ok = true;

    for (const token of tokensMetadata) {
      const uriFromChain = await contract.uri(token.id);
      if (uriFromChain !== token.metadata) {
        ok = false;
        console.log(`Invalid uri for tokenId ${token.id}!. Expected: ${token.metadata}, actual: ${uriFromChain}`);
      }
    }
    if (!ok) {
      throw new Error(`Validation error! Check above.`);
    }
    console.log('Tokens has been successfully created/updated.', tokensMetadata);
  });

task('nft:mint')
  .addParam('contract', 'The contract address.')
  .addParam('signer', 'The signer private key.')
  .addParam('recipientsFile', 'The file containing the following JSON structure [{to:string,id:number,amount:number}].')
  .setAction(async function (args: TaskArguments, hre) {
    const contract = initContestWinnerNftContract(hre, args.signer, args.contract);

    const recipients: TokenRecipient[] = JSON.parse(fs.readFileSync(args.recipientsFile, 'utf-8'));
    const duplicates = recipients.filter((r, i) => i !== recipients.findIndex((x) => x.id === r.id && x.to === r.to));
    if (duplicates.length !== 0) {
      throw new Error(`Token recipient file contains duplicates: [${JSON.stringify(duplicates, null, 2)}]`);
    }

    const wrongAddresses = recipients.filter((x) => !isAddress(x.to)).map((x) => x.to);
    if (wrongAddresses.length !== 0) {
      throw new Error(`Token recipient file contains invalid addresses: ${wrongAddresses}`);
    }

    if (recipients.filter((x) => x.amount === 0).length !== 0) {
      throw new Error(`Token recipient file contains zero amounts`);
    }

    const to = recipients.map((w) => w.to);
    const ids = recipients.map((tm) => tm.id);
    const amounts = recipients.map((w) => w.amount);

    const balancesBefore = new Map<string, Map<BigNumberish, BigNumberish>>();

    for (const r of recipients) {
      const balance = await contract.balanceOf(r.to, r.id);
      let bMap = balancesBefore.get(r.to);
      if (bMap === undefined) {
        bMap = new Map<BigNumberish, BigNumberish>();
      }
      bMap.set(r.id, balance);
      balancesBefore.set(r.to, bMap);
    }

    console.log('GO!');

    // const tx = await contract.mint(to, ids, amounts);
    // console.log(`Tx hash: ${tx.hash}`);
    // await waitTransaction(hre.network, tx);

    let ok = true;
    for (const r of recipients) {
      const actualBalance = Number(await contract.balanceOf(r.to, r.id));
      const oldBalance = Number(balancesBefore.get(r.to)!.get(r.id));
      const expectedBalance = oldBalance + Number(r.amount);
      if (expectedBalance !== actualBalance) {
        console.log(
          `Invalid balance amount after tx. Address: ${r.to}, token id: ${r.id}.` +
            `Expected balance: ${expectedBalance}, actual: ${actualBalance}`
        );
        ok = false;
      }
    }

    if (!ok) {
      throw new Error(`Validation error! Check above.`);
    }
    console.log(`The tokens has been successfully minted to the recipients.`, JSON.stringify(recipients, null, 2));
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

    const duplicates = burnData.filter(
      (bd, i) => i !== burnData.findIndex((x) => x.id === bd.id && x.owner === bd.owner)
    );
    if (duplicates.length !== 0) {
      throw new Error(`Burn minted file contains duplicates: [${JSON.stringify(duplicates, null, 2)}]`);
    }

    const wrongAddresses = burnData.filter((x) => !isAddress(x.owner)).map((x) => x.owner);
    if (wrongAddresses.length !== 0) {
      throw new Error(`Burn minted file contains invalid addresses: ${wrongAddresses}`);
    }

    if (burnData.filter((x) => x.amount === 0).length !== 0) {
      throw new Error(`Burn minted file contains zero amounts`);
    }

    const owners = burnData.map((bd) => bd.owner);
    const ids = burnData.map((bd) => bd.id);
    const amounts = burnData.map((bd) => bd.amount);

    const balancesBefore = new Map<string, Map<BigNumberish, BigNumberish>>();

    for (const b of burnData) {
      const balance = await contract.balanceOf(b.owner, b.id);
      let bMap = balancesBefore.get(b.owner);
      if (bMap === undefined) {
        bMap = new Map<BigNumberish, BigNumberish>();
      }
      bMap.set(b.id, balance);
      balancesBefore.set(b.owner, bMap);
    }

    const tx = await contract.burnMinted(owners, ids, amounts);
    console.log(`Tx hash: ${tx.hash}`);

    await waitTransaction(hre.network, tx);

    let ok = true;
    for (const bd of burnData) {
      const actualBalance = Number(await contract.balanceOf(bd.owner, bd.id));
      const oldBalance = Number(balancesBefore.get(bd.owner)!.get(bd.id));
      const expectedBalance = oldBalance - Number(bd.amount);
      if (expectedBalance !== actualBalance) {
        console.log(
          `Invalid balance amount after tx. Address: ${bd.owner}, token id: ${bd.id}.` +
            `Expected balance: ${expectedBalance}, actual: ${actualBalance}`
        );
        ok = false;
      }
    }

    if (!ok) {
      throw new Error(`Validation error! Check above.`);
    }

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
