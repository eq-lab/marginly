import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import { Wallet, Provider, Contract } from 'zksync-web3';
import * as hre from 'hardhat';
import { BigNumberish } from 'ethers';
import * as originalEthers from 'ethers';

export function loadFixture<T>(func: () => T): T {
  return func();
}

export async function snapshotGasCost(tx: unknown): Promise<void> {
  await tx;
  return Promise.resolve();
}

const richAccounts = [
  {
    address: '0x36615Cf349d7F6344891B1e7CA7C72883F5dc049',
    privateKey: '0x7726827caac94a7f9e1b160f7ea819f172f7b6f9d2a97f992c38edeab82d4110',
  },
  {
    address: '0xa61464658AfeAf65CccaaFD3a512b69A83B77618',
    privateKey: '0xac1e735be8536c6534bb4f17f06f6afc73b2b5ba84ac2cfb12f7461b20c0bbe3',
  },
  {
    address: '0x0D43eB5B8a47bA8900d84AA36656c92024e9772e',
    privateKey: '0xd293c684d884d56f8d6abd64fc76757d3664904e309a0645baf8522ab6366d9e',
  },
  {
    address: '0xA13c10C0D5bd6f79041B9835c63f91de35A15883',
    privateKey: '0x850683b40d4a740aa6e745f889a6fdc8327be76e122f5aba645a5b02d0248db8',
  },
  {
    address: '0x8002cD98Cfb563492A6fB3E7C8243b7B9Ad4cc92',
    privateKey: '0xf12e28c0eb1ef4ff90478f6805b68d63737b7f33abfa091601140805da450d93',
  },
  {
    address: '0x4F9133D1d3F50011A6859807C837bdCB31Aaab13',
    privateKey: '0xe667e57a9b8aaa6709e51ff7d093f1c5b73b63f9987e4ab4aa9a5c699e024ee8',
  },
  {
    address: '0xbd29A1B981925B94eEc5c4F1125AF02a2Ec4d1cA',
    privateKey: '0x28a574ab2de8a00364d5dd4b07c4f2f574ef7fcc2a86a197f65abaec836d1959',
  },
  {
    address: '0xedB6F5B4aab3dD95C7806Af42881FF12BE7e9daa',
    privateKey: '0x74d8b3a188f7260f67698eb44da07397a298df5427df681ef68c45b34b61f998',
  },
  {
    address: '0xe706e60ab5Dc512C36A4646D719b889F398cbBcB',
    privateKey: '0xbe79721778b48bcc679b78edac0ce48306a8578186ffcb9f2ee455ae6efeace1',
  },
  {
    address: '0xE90E12261CCb0F3F7976Ae611A29e84a6A85f424',
    privateKey: '0x3eb15da85647edd9a1159a4a13b9e7c56877c4eb33f614546d4db06a51868b1c',
  },
];

interface ContractFactory {
  deploy(...args: unknown[]): Promise<Contract>;

  attach(address: unknown): Contract;
}

class Ethers {
  private readonly provider: Provider;
  private readonly signers: originalEthers.Wallet[];
  private readonly deployer: Deployer;

  public constructor(provider: Provider, privateKeys: string[]) {
    const signer = new Wallet(privateKeys[0], provider);
    const deployer = new Deployer(hre, signer);

    this.provider = provider;
    this.signers = privateKeys.map((x) => new originalEthers.Wallet(x, provider));
    this.deployer = deployer;
  }

  public async getContractFactory(contractName: string): Promise<ContractFactory> {
    const artifact = await this.deployer.loadArtifact(contractName);
    return {
      deploy: async (...args): Promise<Contract> => {
        // return wrapContract(await this.deployer.deploy(artifact, args));
        return await this.deployer.deploy(artifact, args);
      },
      attach: (address: string): Contract => {
        return new originalEthers.Contract(address, artifact.abi, this.signers[0]);
      },
    };
  }

  public async getSigners() {
    return this.signers;
  }

  public utils = {
    parseEther: hre.ethers.utils.parseEther,
  };
}

function createDefaultEthers(): Ethers {
  const provider = Provider.getDefaultProvider();

  return new Ethers(
    provider,
    richAccounts.map((x) => x.privateKey)
  );
}

export const ethers = createDefaultEthers();

export type SignerWithAddress = Wallet;

export type MarginlyFactory = Contract;
export type MarginlyPool = Contract;
export type TestUniswapFactory = Contract;
export type TestUniswapPool = Contract;
export type TestERC20 = Contract;
export type TestSwapRouter = Contract;
export type MockAavePool = Contract;
export type MockAavePoolAddressesProvider = Contract;
export type MockMarginlyPool = Contract;
export type MarginlyKeeper = Contract;
export type MockSwapRouter = Contract;
export type MockMarginlyFactory = Contract;

type MarginlyParamsStruct = {
  maxLeverage: BigNumberish;
  priceSecondsAgo: BigNumberish;
  interestRate: BigNumberish;
  swapFee: BigNumberish;
  fee: BigNumberish;
  positionSlippage: BigNumberish;
  mcSlippage: BigNumberish;
  positionMinAmount: BigNumberish;
  baseLimit: BigNumberish;
  quoteLimit: BigNumberish;
};

export async function getMarginlyPoolParams(marginlyPool: Contract): Promise<MarginlyParamsStruct> {
  const params = await marginlyPool.params();

  const {
    maxLeverage,
    priceSecondsAgo,
    interestRate,
    swapFee,
    fee,
    positionSlippage,
    mcSlippage,
    positionMinAmount,
    baseLimit,
    quoteLimit,
  } = params;

  return {
    maxLeverage,
    priceSecondsAgo,
    interestRate,
    swapFee,
    fee,
    positionSlippage,
    mcSlippage,
    positionMinAmount,
    baseLimit,
    quoteLimit,
  };
}
