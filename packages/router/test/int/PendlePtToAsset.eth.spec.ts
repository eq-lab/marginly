import { expect } from 'chai';
import { ethers } from 'hardhat';
import {
  constructSwap,
  delay,
  Dex,
  resetFork,
  showBalance,
  showBalanceDelta,
  showGasUsage,
  SWAP_ONE,
} from '../shared/utils';
import { EthAddress } from '@marginly/common';
import { parseUnits } from 'ethers/lib/utils';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { EthereumMainnetERC20BalanceOfSlot, setTokenBalance } from '../shared/tokens';
import { BigNumber } from 'ethers';
import {
  PendlePtToAssetAdapter__factory,
  PendlePtToAssetAdapter,
  ERC20,
  MarginlyRouter,
  MarginlyRouter__factory,
} from '../../typechain-types';

const swapCallData = constructSwap([Dex.PendlePtToAsset], [SWAP_ONE]);

interface TokenInfo {
  address: string;
  symbol: string;
  balanceSlot: EthereumMainnetERC20BalanceOfSlot;
  initialBalance: BigNumber;
}

interface TestCase {
  forkNumber: number;

  pendleMarket: string;

  ptToken: TokenInfo;
  assetToken: TokenInfo;
  syToken: TokenInfo;

  timeToMaturity: number;
  preMaturity: {
    swapExactIbtToPt: {
      ibtIn: BigNumber;
      minPtOut: BigNumber;
    };
    swapExactPtToIbt: {
      ptIn: BigNumber;
      minIbtOut: BigNumber;
    };
    swapIbtToExactPt: {
      maxIbtIn: BigNumber;
      ptOut: BigNumber;
    };
    swapPtToExactIbt: {
      maxPtIn: BigNumber;
      ibtOut: BigNumber;
    };
  };
  postMaturity: {
    swapPtToExactIbt: {
      maxPtIn: BigNumber;
      ibtOut: BigNumber;
    };
    swapExactPtToIbt: {
      ptIn: BigNumber;
      minIbtOut: BigNumber;
    };
  };
}

const USR_TestCase: TestCase = {
  forkNumber: 21830300,

  pendleMarket: '0x353d0b2efb5b3a7987fb06d30ad6160522d08426',
  ptToken: {
    address: '0xa8c8861b5ccf8cce0ade6811cd2a7a7d3222b0b8',
    symbol: 'pt-wstUSR-27MAR2025',
    balanceSlot: EthereumMainnetERC20BalanceOfSlot.PTSUSDE,
    initialBalance: parseUnits('100000', 18),
  },

  assetToken: {
    address: '0x66a1e37c9b0eaddca17d3662d6c05f4decf3e110',
    symbol: 'USR',
    balanceSlot: EthereumMainnetERC20BalanceOfSlot.WSTUSR,
    initialBalance: parseUnits('100000', 18),
  },

  syToken: {
    address: '0x6c78661c00d797c9c7fcbe4bcacbd9612a61c07f',
    symbol: 'SY-wstUSR',
    balanceSlot: EthereumMainnetERC20BalanceOfSlot.PTSUSDE,
    initialBalance: parseUnits('100000', 18),
  },

  timeToMaturity: 180 * 24 * 60 * 60, // 180 days

  // swap params
  preMaturity: {
    swapExactIbtToPt: {
      ibtIn: parseUnits('600', 18),
      minPtOut: parseUnits('400', 18),
    },
    swapExactPtToIbt: {
      ptIn: parseUnits('745.34', 18),
      minIbtOut: parseUnits('500', 18),
    },
    swapPtToExactIbt: {
      maxPtIn: parseUnits('15000.75', 18),
      ibtOut: parseUnits('10000', 18),
    },
    swapIbtToExactPt: {
      maxIbtIn: parseUnits('125', 18),
      ptOut: parseUnits('100', 18),
    },
  },
  postMaturity: {
    swapExactPtToIbt: {
      ptIn: parseUnits('150.576', 18),
      minIbtOut: parseUnits('120.0', 18),
    },
    swapPtToExactIbt: {
      maxPtIn: parseUnits('600', 18),
      ibtOut: parseUnits('500', 18),
    },
  },
};

const wstUSR_TestCase: TestCase = {
  forkNumber: 21830300,

  pendleMarket: '0x353d0b2efb5b3a7987fb06d30ad6160522d08426',
  ptToken: {
    address: '0xa8c8861b5ccf8cce0ade6811cd2a7a7d3222b0b8',
    symbol: 'pt-wstUSR-27MAR2025',
    balanceSlot: EthereumMainnetERC20BalanceOfSlot.PTSUSDE,
    initialBalance: parseUnits('100000', 18),
  },

  assetToken: {
    address: '0x1202F5C7b4B9E47a1A484E8B270be34dbbC75055',
    symbol: 'wstUSR',
    balanceSlot: EthereumMainnetERC20BalanceOfSlot.WSTUSR,
    initialBalance: parseUnits('100000', 18),
  },

  syToken: {
    address: '0x6c78661c00d797c9c7fcbe4bcacbd9612a61c07f',
    symbol: 'SY-wstUSR',
    balanceSlot: EthereumMainnetERC20BalanceOfSlot.PTSUSDE,
    initialBalance: parseUnits('100000', 18),
  },

  timeToMaturity: 180 * 24 * 60 * 60, // 180 days

  // swap params
  preMaturity: {
    swapExactIbtToPt: {
      ibtIn: parseUnits('600', 18),
      minPtOut: parseUnits('400', 18),
    },
    swapExactPtToIbt: {
      ptIn: parseUnits('745.34', 18),
      minIbtOut: parseUnits('500', 18),
    },
    swapPtToExactIbt: {
      maxPtIn: parseUnits('15000.75', 18),
      ibtOut: parseUnits('10000', 18),
    },
    swapIbtToExactPt: {
      maxIbtIn: parseUnits('125', 18),
      ptOut: parseUnits('100', 18),
    },
  },
  postMaturity: {
    swapExactPtToIbt: {
      ptIn: parseUnits('150.576', 18),
      minIbtOut: parseUnits('120.0', 18),
    },
    swapPtToExactIbt: {
      maxPtIn: parseUnits('600', 18),
      ibtOut: parseUnits('500', 18),
    },
  },
};

const usual_TestCase: TestCase = {
  forkNumber: 21830300,

  pendleMarket: '0xb9b7840ec34094ce1269c38ba7a6ac7407f9c4e3',
  ptToken: {
    address: '0x36f4ec0a7c46923c4f6508c404ee1c6fbe175e1c',
    symbol: 'pt-usualx-27MAR2025',
    balanceSlot: EthereumMainnetERC20BalanceOfSlot.PTSUSDE,
    initialBalance: parseUnits('100000', 18),
  },

  assetToken: {
    address: '0xc4441c2be5d8fa8126822b9929ca0b81ea0de38e',
    symbol: 'usual',
    balanceSlot: EthereumMainnetERC20BalanceOfSlot.WSTUSR,
    initialBalance: parseUnits('100000', 18),
  },

  syToken: {
    address: '0x86e2a16a5abc67467ce502e3dab511c909c185a8',
    symbol: 'SY-usual',
    balanceSlot: EthereumMainnetERC20BalanceOfSlot.PTSUSDE,
    initialBalance: parseUnits('100000', 18),
  },

  timeToMaturity: 180 * 24 * 60 * 60, // 180 days

  // swap params
  preMaturity: {
    swapExactIbtToPt: {
      ibtIn: parseUnits('600', 18),
      minPtOut: parseUnits('400', 18),
    },
    swapExactPtToIbt: {
      ptIn: parseUnits('745.34', 18),
      minIbtOut: parseUnits('500', 18),
    },
    swapPtToExactIbt: {
      maxPtIn: parseUnits('15000.75', 18),
      ibtOut: parseUnits('10000', 18),
    },
    swapIbtToExactPt: {
      maxIbtIn: parseUnits('125', 18),
      ptOut: parseUnits('100', 18),
    },
  },
  postMaturity: {
    swapExactPtToIbt: {
      ptIn: parseUnits('150.576', 18),
      minIbtOut: parseUnits('120.0', 18),
    },
    swapPtToExactIbt: {
      maxPtIn: parseUnits('600', 18),
      ibtOut: parseUnits('500', 18),
    },
  },
};

const testCases = [wstUSR_TestCase, USR_TestCase, usual_TestCase];

async function initializeRouter(testCase: TestCase): Promise<{
  ptToken: ERC20;
  assetToken: ERC20;
  syToken: ERC20;
  router: MarginlyRouter;
  adapter: PendlePtToAssetAdapter;
  owner: SignerWithAddress;
  user: SignerWithAddress;
}> {
  const [owner, user] = await ethers.getSigners();

  const ptToken = await ethers.getContractAt('ERC20', testCase.ptToken.address);
  const assetToken = await ethers.getContractAt('ERC20', testCase.assetToken.address);
  const syToken = await ethers.getContractAt('ERC20', testCase.syToken.address);

  const poolInput: PendlePtToAssetAdapter.PoolInputStruct = {
    ptToken: ptToken.address,
    asset: assetToken.address,
    pendleMarket: testCase.pendleMarket,
    slippage: 35,
  };

  const adapter = await new PendlePtToAssetAdapter__factory().connect(owner).deploy([poolInput]);
  console.log('Adapter initialized');
  const routerInput = {
    dexIndex: Dex.PendlePtToAsset,
    adapter: adapter.address,
  };
  const router = await new MarginlyRouter__factory().connect(owner).deploy([routerInput]);

  await setTokenBalance(
    assetToken.address,
    testCase.assetToken.balanceSlot,
    EthAddress.parse(user.address),
    testCase.assetToken.initialBalance
  );

  await setTokenBalance(
    ptToken.address,
    testCase.ptToken.balanceSlot,
    EthAddress.parse(user.address),
    testCase.ptToken.initialBalance
  );

  expect(await ptToken.balanceOf(user.address)).to.be.eq(
    testCase.ptToken.initialBalance,
    `Wrong initial ${testCase.ptToken.symbol} balance`
  );
  expect(await assetToken.balanceOf(user.address)).to.be.eq(
    testCase.assetToken.initialBalance,
    `Wrong initial ${testCase.assetToken.symbol} balance`
  );

  return {
    ptToken,
    assetToken,
    syToken,
    router,
    adapter,
    owner,
    user,
  };
}

// Tests for running in ethereum mainnet fork
describe.only('PendlePtToAssetAdapter', async () => {
  for (const testCase of testCases) {
    describe(`PendlePtToAssetAdapter ${testCase.ptToken.symbol} - ${testCase.assetToken.symbol}`, () => {
      before(async () => {
        await resetFork(testCase.forkNumber);
      });

      describe('Pendle swap pre maturity', () => {
        let ptToken: ERC20;
        let assetToken: ERC20;
        let syToken: ERC20;
        let router: MarginlyRouter;
        let user: SignerWithAddress;
        let adapter: PendlePtToAssetAdapter;

        beforeEach(async () => {
          ({ ptToken, assetToken, syToken, router, adapter, user } = await initializeRouter(testCase));
        });

        it(`${testCase.assetToken.symbol} to ${testCase.ptToken.symbol} exact input`, async () => {
          const ptBalanceBefore = await showBalance(ptToken, user.address, 'balance Before:');
          const ibtBalanceBefore = await showBalance(assetToken, user.address, 'balance before:');

          const ibtTokenAmount = testCase.preMaturity.swapExactIbtToPt.ibtIn;
          await assetToken.connect(user).approve(router.address, ibtTokenAmount);

          const minPTAmount = testCase.preMaturity.swapExactIbtToPt.minPtOut;

          const tx = await router
            .connect(user)
            .swapExactInput(swapCallData, assetToken.address, ptToken.address, ibtTokenAmount, minPTAmount);
          await showGasUsage(tx);

          const ptBalanceAfter = await showBalance(ptToken, user.address, 'pt balance After:');
          expect(ptBalanceAfter).to.be.greaterThan(ptBalanceBefore);

          const ibtBalanceAfter = await showBalance(assetToken, user.address, 'Asset balance After:');
          expect(ibtBalanceBefore.sub(ibtBalanceAfter)).to.be.lessThanOrEqual(ibtTokenAmount);

          await showBalanceDelta(ptBalanceBefore, ptBalanceAfter, ptToken, 'PT balance delta:');
          await showBalanceDelta(ibtBalanceBefore, ibtBalanceAfter, assetToken, 'Asset balance delta:');
          await showBalance(syToken, adapter.address, 'sy balance on adapter:');
          await showBalance(assetToken, adapter.address, 'asset balance on adapter:');
        });

        it(`${testCase.assetToken.symbol} to ${testCase.ptToken.symbol} exact output`, async () => {
          const ptBalanceBefore = await showBalance(ptToken, user.address, 'balance Before:');
          const ibtBalanceBefore = await showBalance(assetToken, user.address, 'balance before:');

          const exactPtOut = testCase.preMaturity.swapIbtToExactPt.ptOut;
          const ibtMaxAmountIn = testCase.preMaturity.swapIbtToExactPt.maxIbtIn;
          await assetToken.connect(user).approve(router.address, ibtMaxAmountIn);
          const tx = await router
            .connect(user)
            .swapExactOutput(swapCallData, assetToken.address, ptToken.address, ibtMaxAmountIn, exactPtOut);
          await showGasUsage(tx);

          const ptBalanceAfter = await showBalance(ptToken, user.address, 'pt balance After:');
          expect(ptBalanceAfter.sub(ptBalanceBefore)).to.be.eq(exactPtOut);

          const ibtBalanceAfter = await showBalance(assetToken, user.address, 'Asset balance After: ');
          expect(ibtBalanceBefore).to.be.greaterThan(ibtBalanceAfter);

          await showBalanceDelta(ptBalanceBefore, ptBalanceAfter, ptToken, 'PT balance delta:');
          await showBalanceDelta(ibtBalanceBefore, ibtBalanceAfter, assetToken, 'Asset balance delta:');
          await showBalance(syToken, adapter.address, 'sy balance on adapter:');
          await showBalance(assetToken, adapter.address, 'asset balance on adapter:');
        });

        it(`${testCase.ptToken.symbol} to ${testCase.assetToken.symbol} exact input`, async () => {
          const ptBalanceBefore = await showBalance(ptToken, user.address, 'balance Before:');
          const ibtBalanceBefore = await showBalance(assetToken, user.address, 'balance before:');

          const ptIn = testCase.preMaturity.swapExactPtToIbt.ptIn;
          const minIbtOut = testCase.preMaturity.swapExactPtToIbt.minIbtOut;
          await ptToken.connect(user).approve(router.address, ptIn);
          const tx = await router
            .connect(user)
            .swapExactInput(swapCallData, ptToken.address, assetToken.address, ptIn, minIbtOut);
          await showGasUsage(tx);

          const ptBalanceAfter = await showBalance(ptToken, user.address, 'pt BalanceAfter:');
          expect(ptBalanceBefore.sub(ptBalanceAfter)).to.be.eq(ptIn);

          const ibtBalanceAfter = await showBalance(assetToken, user.address, 'Asset balance After:');
          expect(ibtBalanceAfter).to.be.greaterThan(ibtBalanceBefore);

          await showBalanceDelta(ptBalanceBefore, ptBalanceAfter, ptToken, 'PT balance delta:');
          await showBalanceDelta(ibtBalanceBefore, ibtBalanceAfter, assetToken, 'Asset balance delta:');
          await showBalance(syToken, adapter.address, 'sy balance on adapter:');
          await showBalance(assetToken, adapter.address, 'asset balance on adapter:');
        });

        it(`${testCase.ptToken.symbol} to ${testCase.assetToken.symbol} exact output`, async () => {
          const ptBalanceBefore = await showBalance(ptToken, user.address, 'balance before:');
          const ibtBalanceBefore = await showBalance(assetToken, user.address, 'balance before:');

          const ibtMinOut = testCase.preMaturity.swapPtToExactIbt.ibtOut;
          const maxPtIn = testCase.preMaturity.swapPtToExactIbt.maxPtIn;
          await ptToken.connect(user).approve(router.address, maxPtIn);
          const tx = await router
            .connect(user)
            .swapExactOutput(swapCallData, ptToken.address, assetToken.address, maxPtIn, ibtMinOut);
          await showGasUsage(tx);

          const ptBalanceAfter = await showBalance(ptToken, user.address, 'pt balanceAfter:');
          expect(ptBalanceBefore).to.be.greaterThan(ptBalanceAfter);

          const ibtBalanceAfter = await showBalance(assetToken, user.address, 'Asset balance After:');
          expect(ibtBalanceAfter.sub(ibtBalanceBefore)).to.be.eq(ibtMinOut);

          await showBalanceDelta(ptBalanceBefore, ptBalanceAfter, ptToken, 'PT balance delta:');
          await showBalanceDelta(ibtBalanceBefore, ibtBalanceAfter, assetToken, 'Asset balance delta:');
          await showBalance(syToken, adapter.address, 'sy balance on adapter:');
          await showBalance(assetToken, adapter.address, 'asset balance on adapter:');
        });
      });

      describe('Pendle swap post maturity', () => {
        let ptToken: ERC20;
        let assetToken: ERC20;
        let syToken: ERC20;
        let router: MarginlyRouter;
        let adapter: PendlePtToAssetAdapter;
        let user: SignerWithAddress;

        beforeEach(async () => {
          ({ ptToken, assetToken, syToken, router, adapter, user } = await initializeRouter(testCase));

          // move time and make after maturity
          await ethers.provider.send('evm_increaseTime', [testCase.timeToMaturity]);
          await ethers.provider.send('evm_mine', []);
        });

        it(`${testCase.assetToken.symbol} to ${testCase.ptToken.symbol} exact input, forbidden`, async () => {
          const ptBalanceBefore = await showBalance(ptToken, user.address, 'balance Before:');
          const ibtBalanceBefore = await showBalance(assetToken, user.address, 'balance before:');

          await assetToken.connect(user).approve(router.address, ibtBalanceBefore);
          const tx = router
            .connect(user)
            .swapExactInput(swapCallData, assetToken.address, ptToken.address, ibtBalanceBefore, 0);

          await expect(tx).to.be.revertedWithCustomError(adapter, 'NotSupported');

          console.log('This swap is forbidden after maturity');

          const ptBalanceAfter = await showBalance(ptToken, user.address, 'pt Balance After:');
          expect(ptBalanceAfter).to.be.eq(ptBalanceBefore);

          const ibtBalanceAfter = await showBalance(assetToken, user.address, 'Asset balance After:');
          expect(ibtBalanceAfter).to.be.eq(ibtBalanceBefore);
        });

        it(`${testCase.assetToken.symbol} to ${testCase.ptToken.symbol} exact output, forbidden`, async () => {
          const ptBalanceBefore = await showBalance(ptToken, user.address, 'balance Before:');
          const ibtBalanceBefore = await showBalance(assetToken, user.address, 'balance before:');

          await assetToken.connect(user).approve(router.address, ibtBalanceBefore);
          const tx = router
            .connect(user)
            .swapExactOutput(swapCallData, assetToken.address, ptToken.address, ibtBalanceBefore, 1);
          await expect(tx).to.be.revertedWithCustomError(adapter, 'NotSupported');

          console.log('This swap is forbidden after maturity');

          const ptBalanceAfter = await showBalance(ptToken, user.address, 'pt Balance After:');
          expect(ptBalanceAfter).to.be.eq(ptBalanceBefore);

          const ibtBalanceAfter = await showBalance(assetToken, user.address, 'Asset balance After:');
          expect(ibtBalanceAfter).to.be.eq(ibtBalanceBefore);
        });

        it(`${testCase.ptToken.symbol} to ${testCase.assetToken.symbol} exact input`, async () => {
          const ptBalanceBefore = await showBalance(ptToken, user.address, 'balance Before:');
          const ibtBalanceBefore = await showBalance(assetToken, user.address, 'balance before:');

          const ptIn = testCase.postMaturity.swapExactPtToIbt.ptIn;
          const minIbtOut = testCase.postMaturity.swapExactPtToIbt.minIbtOut;
          await ptToken.connect(user).approve(router.address, ptIn);
          const tx = await router
            .connect(user)
            .swapExactInput(swapCallData, ptToken.address, assetToken.address, ptIn, minIbtOut);
          await showGasUsage(tx);

          const ptBalanceAfter = await showBalance(ptToken, user.address, 'ptBalanceAfter:');
          expect(ptBalanceBefore.sub(ptBalanceAfter)).to.be.eq(ptIn);

          const ibtBalanceAfter = await showBalance(assetToken, user.address, 'Asset balance After:');
          expect(ibtBalanceAfter).to.be.greaterThan(ibtBalanceBefore);

          await showBalanceDelta(ptBalanceBefore, ptBalanceAfter, ptToken, 'PT balance delta:');
          await showBalanceDelta(ibtBalanceBefore, ibtBalanceAfter, assetToken, 'Asset balance delta:');
          await showBalance(syToken, adapter.address, 'sy balance on adapter:');
          await showBalance(assetToken, adapter.address, 'asset balance on adapter:');
        });

        it(`${testCase.ptToken.symbol} to ${testCase.assetToken.symbol} exact output`, async () => {
          const ptBalanceBefore = await showBalance(ptToken, user.address, 'pt balance Before:');
          const ibtBalanceBefore = await showBalance(assetToken, user.address, 'Asset balance before:');

          const ibtOut = testCase.postMaturity.swapPtToExactIbt.ibtOut;
          await ptToken.connect(user).approve(router.address, ptBalanceBefore);
          const maxPtIn = testCase.postMaturity.swapPtToExactIbt.maxPtIn;
          const tx = await router
            .connect(user)
            .swapExactOutput(swapCallData, ptToken.address, assetToken.address, maxPtIn, ibtOut);
          await showGasUsage(tx);

          const ptBalanceAfter = await showBalance(ptToken, user.address, 'pt Balance After:');
          expect(ptBalanceBefore).to.be.greaterThan(ptBalanceAfter);

          const ibtBalanceAfter = await showBalance(assetToken, user.address, 'Asset balance After:');
          expect(ibtBalanceAfter.sub(ibtBalanceBefore)).to.be.eq(ibtOut);

          await showBalanceDelta(ptBalanceBefore, ptBalanceAfter, ptToken, 'PT balance delta:');
          await showBalanceDelta(ibtBalanceBefore, ibtBalanceAfter, assetToken, 'Asset balance delta:');
          await showBalance(syToken, adapter.address, 'sy balance on adapter:');
          await showBalance(assetToken, adapter.address, 'asset balance on adapter:');
        });
      });
    });

    await delay(3000);
  }
});
