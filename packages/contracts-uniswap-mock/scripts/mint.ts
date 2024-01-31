import { BigNumber } from 'ethers';
import { task } from 'hardhat/config';
import { TaskArguments } from 'hardhat/types';

// Example: npx hardhat token:mint --network x1Testnet --signer <signerPk> --account <accountPK> --token <tokenAddress> --amount <amountRaw>
task('token:mint')
  .addParam('signer', 'The signer private key.')
  .addParam('token', 'Address of mintable token.')
  .addParam('account', 'Account to grant a role.')
  .addParam('amount', 'Amount of token')
  .setAction(async function (args: TaskArguments, hre) {
    const provider = new hre.ethers.providers.JsonRpcProvider((hre.network.config as any).url);
    const signer = new hre.ethers.Wallet(args.signer, provider);

    const factory = await hre.ethers.getContractFactory('MintableToken', signer);
    const tokenContract = factory.attach(args.token);
    const tx = await tokenContract.mint(args.account, BigNumber.from(args.amount));
    const txReceipt = await tx.wait();
    console.log(`Token minted ${args.account} txHash: ${txReceipt.transactionHash}`);
  });
