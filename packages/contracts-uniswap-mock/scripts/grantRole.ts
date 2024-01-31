import { BigNumber } from 'ethers';
import { parseEther, parseUnits } from 'ethers/lib/utils';
import { task } from 'hardhat/config';
import { Network, TaskArguments } from 'hardhat/types';

// Example: npx hardhat token:grantRole --network arbitrumSepolia --signer <signerPk> --account <accountPK> --minter --burner

task('token:grantRole')
  .addParam('signer', 'The signer private key.')
  .addParam('token', 'Address of mintable token.')
  .addParam('account', 'Account to grant a role.')
  .addFlag('minter', 'Add minter role.')
  .addFlag('burner', 'Add burner role.')
  .setAction(async function (args: TaskArguments, hre) {
    const provider = new hre.ethers.providers.JsonRpcProvider((hre.network.config as any).url);
    const signer = new hre.ethers.Wallet(args.signer, provider);

    const factory = await hre.ethers.getContractFactory('MintableToken', signer);
    const tokenContract = factory.attach(args.token);

    if (!args.minter && !args.burner) {
      throw new Error(`Should be one of flag --minter or --burner`);
    }

    if (args.minter) {
      const minterRole = await tokenContract.MINTER_ROLE();
      const tx = await tokenContract.grantRole(minterRole, args.account);
      const txReceipt = await tx.wait();
      console.log(`Minter role granted to account ${args.account} txHash: ${txReceipt.transactionHash}`);
    }

    if (args.burner) {
      const burnerRole = await tokenContract.BURNER_ROLE();
      const tx = await tokenContract.grantRole(burnerRole, args.account);
      const txReceipt = await tx.wait();
      console.log(`Burner role granted to account ${args.account} txHash: ${txReceipt.transactionHash}`);
    }
  });
