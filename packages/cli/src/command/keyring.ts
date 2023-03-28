import { Command } from 'commander';
import fs from 'fs';
import {
    createSystemContext,
    getCommanderForm,
    Parameter,
    readParameterInteractive,
} from '../system-context';
import * as ethers from 'ethers';

const ethKeyParameter: Parameter = {
    name: ['eth', 'key'],
    description: 'Eth Private Key',
};

const passwordParameter: Parameter = {
    name: ['password'],
    description: 'JSON wallet password',
};

const exportToJsonCommand = new Command('export-to-json')
    .requiredOption('--file-name <fileName>')
    .option(getCommanderForm(ethKeyParameter), ethKeyParameter.description)
    .option(getCommanderForm(passwordParameter), passwordParameter.description)
    .action(async ({ fileName }: { fileName: string }, command: Command) => {
        const systemContext = createSystemContext(command);
        const ethKey = await readParameterInteractive(
            ethKeyParameter,
            systemContext
        );
        const wallet = new ethers.Wallet(ethKey);
        const password = await readParameterInteractive(
            passwordParameter,
            systemContext
        );

        const encryptedWallet = await wallet.encrypt(password);

        fs.writeFileSync(fileName, encryptedWallet);
    });

const checkWalletPassword = new Command('check-wallet-password')
    .requiredOption('--file-name <fileName>')
    .option(getCommanderForm(passwordParameter), passwordParameter.description)
    .action(async ({ fileName }: { fileName: string }, command: Command) => {
        const systemContext = createSystemContext(command);
        const walletJson = fs.readFileSync(fileName, 'utf-8');
        const password = await readParameterInteractive(
            passwordParameter,
            systemContext
        );
        const wallet = await ethers.Wallet.fromEncryptedJson(
            walletJson,
            password
        );

        console.log(wallet.address);
    });

export const ethereumKeyringCommand = new Command('ethereum-keyring')
    .addCommand(exportToJsonCommand)
    .addCommand(checkWalletPassword);
