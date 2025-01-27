import { expect } from 'chai';
import { ethers } from 'hardhat';
import {
  ERC20,
  MarginlyRouter,
  MarginlyRouter__factory,
  SpectraAdapter,
  SpectraAdapter__factory,
} from '../../typechain-types';
import { constructSwap, delay, Dex, resetFork, showBalance, showGasUsage, SWAP_ONE } from '../shared/utils';
import { EthAddress } from '@marginly/common';
import { parseUnits } from 'ethers/lib/utils';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { EthereumMainnetERC20BalanceOfSlot, setTokenBalance } from '../shared/tokens';
import { BigNumber } from 'ethers';

const swapCallData = constructSwap([Dex.Spectra], [SWAP_ONE]);

type TestCase = {
  forkNumber: number;
  spectraPool: string;
  ptToken: string;
  ptSymbol: string;
  ptBalanceSlot: EthereumMainnetERC20BalanceOfSlot;
  ptInitialBalance: BigNumber;
  ibtToken: string;
  ibtSymbol: string;
  ibtBalanceSlot: EthereumMainnetERC20BalanceOfSlot;
  ibtInitialBalance: BigNumber;
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
};

const inwstETHs_TestCase: TestCase = {
  forkNumber: 21714750,

  spectraPool: '0xe119bad8a35b999f65b1e5fd48c626c327daa16b',
  ptToken: '0x4ae0154f83427a5864e5de6513a47dac9e5d5a69',
  ptSymbol: 'pt-sw-inwstETHs',
  ptBalanceSlot: EthereumMainnetERC20BalanceOfSlot.PTSWINWSTETHS,
  ptInitialBalance: parseUnits('1000', 18),

  ibtToken: '0x8e0789d39db454dbe9f4a77acef6dc7c69f6d552',
  ibtSymbol: 'inwstETHs',
  ibtBalanceSlot: EthereumMainnetERC20BalanceOfSlot.INWSTETHS,
  ibtInitialBalance: parseUnits('1000', 18),

  timeToMaturity: 180 * 24 * 60 * 60, // 180 days

  // swap params
  preMaturity: {
    swapExactIbtToPt: {
      ibtIn: parseUnits('1.5', 18),
      minPtOut: parseUnits('1.0', 18),
    },
    swapIbtToExactPt: {
      maxIbtIn: parseUnits('1.0', 18),
      ptOut: parseUnits('1.0', 18),
    },
    swapExactPtToIbt: {
      ptIn: parseUnits('10.75', 18),
      minIbtOut: parseUnits('10.0', 18),
    },
    swapPtToExactIbt: {
      maxPtIn: parseUnits('10.75', 18),
      ibtOut: parseUnits('10.2', 18),
    },
  },
  postMaturity: {
    swapExactPtToIbt: {
      ptIn: parseUnits('15.576', 18),
      minIbtOut: parseUnits('15.0', 18),
    },
    swapPtToExactIbt: {
      maxPtIn: parseUnits('20', 18),
      ibtOut: parseUnits('18.87', 18),
    },
  },
};

const wstUSR_TestCase: TestCase = {
  forkNumber: 21714750,

  spectraPool: '0x0d89f4583a6b5eceb76551d573ad49cd435f6064',
  ptToken: '0xd0097149aa4cc0d0e1fc99b8bd73fc17dc32c1e9',
  ptSymbol: 'pt-wstUSR',
  ptBalanceSlot: EthereumMainnetERC20BalanceOfSlot.PTSWINWSTETHS,
  ptInitialBalance: parseUnits('10000', 18),

  ibtToken: '0x1202f5c7b4b9e47a1a484e8b270be34dbbc75055',
  ibtSymbol: 'wstUSR',
  ibtBalanceSlot: EthereumMainnetERC20BalanceOfSlot.WSTUSR,
  ibtInitialBalance: parseUnits('10000', 18),

  timeToMaturity: 180 * 24 * 60 * 60, // 180 days

  // swap params
  preMaturity: {
    swapExactIbtToPt: {
      ibtIn: parseUnits('500', 18),
      minPtOut: parseUnits('500', 18),
    },
    swapExactPtToIbt: {
      ptIn: parseUnits('745.34', 18),
      minIbtOut: parseUnits('650', 18),
    },
    swapPtToExactIbt: {
      maxPtIn: parseUnits('15.75', 18),
      ibtOut: parseUnits('10.2', 18),
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

const sDOLA_TestCase: TestCase = {
  forkNumber: 21714750,

  spectraPool: '0x69ba1b7dba7eb3b7a73f4e35fd04a27ad06c55fe',
  ptToken: '0xf4ca2ce6eaa1b507570c4b340007f6266c7d5698',
  ptSymbol: 'pt-sDOLA',
  ptBalanceSlot: EthereumMainnetERC20BalanceOfSlot.PTSWINWSTETHS,
  ptInitialBalance: parseUnits('10000', 18),

  ibtToken: '0xb45ad160634c528cc3d2926d9807104fa3157305',
  ibtSymbol: 'sDOLA',
  ibtBalanceSlot: EthereumMainnetERC20BalanceOfSlot.SDOLA,
  ibtInitialBalance: parseUnits('10000', 18),

  timeToMaturity: 365 * 24 * 60 * 60, // 365 days

  // swap params
  preMaturity: {
    swapExactIbtToPt: {
      ibtIn: parseUnits('500', 18),
      minPtOut: parseUnits('500', 18),
    },
    swapExactPtToIbt: {
      ptIn: parseUnits('800.34', 18),
      minIbtOut: parseUnits('650', 18),
    },
    swapPtToExactIbt: {
      maxPtIn: parseUnits('15.75', 18),
      ibtOut: parseUnits('10.2', 18),
    },
    swapIbtToExactPt: {
      maxIbtIn: parseUnits('600', 18),
      ptOut: parseUnits('600', 18),
    },
  },
  postMaturity: {
    swapExactPtToIbt: {
      ptIn: parseUnits('600', 18),
      minIbtOut: parseUnits('500', 18),
    },
    swapPtToExactIbt: {
      maxPtIn: parseUnits('600', 18),
      ibtOut: parseUnits('500', 18),
    },
  },
};

const testCases = [wstUSR_TestCase, sDOLA_TestCase, inwstETHs_TestCase];

async function initializeRouter(testCase: TestCase): Promise<{
  ptToken: ERC20;
  ibtToken: ERC20;
  router: MarginlyRouter;
  spectraAdapter: SpectraAdapter;
  owner: SignerWithAddress;
  user: SignerWithAddress;
}> {
  const [owner, user] = await ethers.getSigners();

  const ptToken = await ethers.getContractAt('ERC20', testCase.ptToken);
  const ibtToken = await ethers.getContractAt('ERC20', testCase.ibtToken);
  const spectraPool = testCase.spectraPool;

  // pool wstUSR/PT-wstUSR
  const poolInput: SpectraAdapter.PoolInputStruct = {
    pt: ptToken.address,
    ibt: ibtToken.address,
    pool: spectraPool,
  };

  const spectraAdapter = await new SpectraAdapter__factory().connect(owner).deploy([poolInput]);

  const routerInput = {
    dexIndex: Dex.Spectra,
    adapter: spectraAdapter.address,
  };
  const router = await new MarginlyRouter__factory().connect(owner).deploy([routerInput]);

  await setTokenBalance(
    ibtToken.address,
    testCase.ibtBalanceSlot,
    EthAddress.parse(user.address),
    testCase.ibtInitialBalance
  );

  await setTokenBalance(
    ptToken.address,
    testCase.ptBalanceSlot,
    EthAddress.parse(user.address),
    testCase.ptInitialBalance
  );

  expect(await ptToken.balanceOf(user.address)).to.be.eq(
    testCase.ptInitialBalance,
    `Wrong initial ${testCase.ptSymbol} balance`
  );
  expect(await ibtToken.balanceOf(user.address)).to.be.eq(
    testCase.ibtInitialBalance,
    `Wrong initial ${testCase.ibtSymbol} balance`
  );

  return {
    ptToken,
    ibtToken,
    router,
    spectraAdapter,
    owner,
    user,
  };
}

describe.only('SpectraAdapter', async () => {
  for (const testCase of testCases) {
    // Tests for running in ethereum mainnet fork
    describe(`SpectraAdapter ${testCase.ptSymbol} - ${testCase.ibtSymbol}`, () => {
      before(async () => {
        await resetFork(testCase.forkNumber);
      });

      describe('Spectra swap pre maturity', () => {
        let ptToken: ERC20;
        let ibtToken: ERC20;
        let router: MarginlyRouter;
        let spectraAdapter: SpectraAdapter;
        let user: SignerWithAddress;

        beforeEach(async () => {
          ({ ptToken, ibtToken, router, spectraAdapter, user } = await initializeRouter(testCase));
        });

        it(`${testCase.ibtSymbol} to ${testCase.ptSymbol} exact input`, async () => {
          const ptBalanceBefore = await showBalance(ptToken, user.address, 'balance Before:');
          const ibtBalanceBefore = await showBalance(ibtToken, user.address, 'balance before:');

          const ibtTokenAmount = testCase.preMaturity.swapExactIbtToPt.ibtIn;
          await ibtToken.connect(user).approve(router.address, ibtTokenAmount);

          const minPTAmount = testCase.preMaturity.swapExactIbtToPt.minPtOut;

          const tx = await router
            .connect(user)
            .swapExactInput(swapCallData, ibtToken.address, ptToken.address, ibtTokenAmount, minPTAmount);
          await showGasUsage(tx);

          const ptBalanceAfter = await showBalance(ptToken, user.address, 'pt balance After:');
          expect(ptBalanceAfter).to.be.greaterThan(ptBalanceBefore);

          const ibtBalanceAfter = await showBalance(ibtToken, user.address, 'ibt balance After:');
          expect(ibtBalanceBefore.sub(ibtBalanceAfter)).to.be.lessThanOrEqual(ibtTokenAmount);
        });

        it(`${testCase.ibtSymbol} to ${testCase.ptSymbol} exact output`, async () => {
          const ptBalanceBefore = await showBalance(ptToken, user.address, 'balance Before:');
          const ibtBalanceBefore = await showBalance(ibtToken, user.address, 'balance before:');

          const exactPtOut = testCase.preMaturity.swapIbtToExactPt.ptOut;
          const ibtMaxAmountIn = testCase.preMaturity.swapIbtToExactPt.maxIbtIn;
          await ibtToken.connect(user).approve(router.address, ibtMaxAmountIn);
          const tx = await router
            .connect(user)
            .swapExactOutput(swapCallData, ibtToken.address, ptToken.address, ibtMaxAmountIn, exactPtOut);
          await showGasUsage(tx);

          const ptBalanceAfter = await showBalance(ptToken, user.address, 'pt balance After:');
          expect(ptBalanceAfter.sub(ptBalanceBefore)).to.be.eq(exactPtOut);

          const ibtBalanceAfter = await showBalance(ibtToken, user.address, 'ibt balance After: ');
          expect(ibtBalanceBefore).to.be.greaterThan(ibtBalanceAfter);
        });

        it(`${testCase.ptSymbol} to ${testCase.ibtSymbol} exact input`, async () => {
          const ptBalanceBefore = await showBalance(ptToken, user.address, 'balance Before:');
          const ibtBalanceBefore = await showBalance(ibtToken, user.address, 'balance before:');

          const ptIn = testCase.preMaturity.swapExactPtToIbt.ptIn;
          const minIbtOut = testCase.preMaturity.swapExactPtToIbt.minIbtOut;
          await ptToken.connect(user).approve(router.address, ptIn);
          const tx = await router
            .connect(user)
            .swapExactInput(swapCallData, ptToken.address, ibtToken.address, ptIn, minIbtOut);
          await showGasUsage(tx);

          const ptBalanceAfter = await showBalance(ptToken, user.address, 'pt BalanceAfter:');
          expect(ptBalanceBefore.sub(ptBalanceAfter)).to.be.eq(ptIn);

          const ibtBalanceAfter = await showBalance(ibtToken, user.address, 'ibt balance After:');
          expect(ibtBalanceAfter).to.be.greaterThan(ibtBalanceBefore);
        });

        it(`${testCase.ptSymbol} to ${testCase.ibtSymbol} exact output`, async () => {
          const ptBalanceBefore = await showBalance(ptToken, user.address, 'balance before:');
          const ibtBalanceBefore = await showBalance(ibtToken, user.address, 'balance before:');

          const ibtMinOut = testCase.preMaturity.swapPtToExactIbt.ibtOut;
          const maxPtIn = testCase.preMaturity.swapPtToExactIbt.maxPtIn;
          await ptToken.connect(user).approve(router.address, maxPtIn);
          const tx = await router
            .connect(user)
            .swapExactOutput(swapCallData, ptToken.address, ibtToken.address, maxPtIn, ibtMinOut);
          await showGasUsage(tx);

          const ptBalanceAfter = await showBalance(ptToken, user.address, 'pt balanceAfter:');
          expect(ptBalanceBefore).to.be.greaterThan(ptBalanceAfter);

          const ibtBalanceAfter = await showBalance(ibtToken, user.address, 'ibt balance After:');
          expect(ibtBalanceAfter.sub(ibtBalanceBefore)).to.be.eq(ibtMinOut);
        });
      });

      describe('Pendle swap post maturity', () => {
        let ptToken: ERC20;
        let ibtToken: ERC20;
        let router: MarginlyRouter;
        let spectraAdapter: SpectraAdapter;
        let user: SignerWithAddress;

        beforeEach(async () => {
          ({ ptToken, ibtToken, router, spectraAdapter, user } = await initializeRouter(testCase));

          // move time and make after maturity
          await ethers.provider.send('evm_increaseTime', [testCase.timeToMaturity]);
          await ethers.provider.send('evm_mine', []);
        });

        it(`${testCase.ibtSymbol} to ${testCase.ptSymbol} exact input, forbidden`, async () => {
          const ptBalanceBefore = await showBalance(ptToken, user.address, 'balance Before:');
          const ibtBalanceBefore = await showBalance(ibtToken, user.address, 'balance before:');

          await ibtToken.connect(user).approve(router.address, ibtBalanceBefore);
          const tx = router
            .connect(user)
            .swapExactInput(swapCallData, ibtToken.address, ptToken.address, ibtBalanceBefore, 0);

          await expect(tx).to.be.revertedWithCustomError(spectraAdapter, 'NotSupported');

          console.log('This swap is forbidden after maturity');

          const ptBalanceAfter = await showBalance(ptToken, user.address, 'pt Balance After:');
          expect(ptBalanceAfter).to.be.eq(ptBalanceBefore);

          const ibtBalanceAfter = await showBalance(ibtToken, user.address, 'ibt balance After:');
          expect(ibtBalanceAfter).to.be.eq(ibtBalanceBefore);
        });

        it(`${testCase.ibtSymbol} to ${testCase.ptSymbol} exact output, forbidden`, async () => {
          const ptBalanceBefore = await showBalance(ptToken, user.address, 'balance Before:');
          const ibtBalanceBefore = await showBalance(ibtToken, user.address, 'balance before:');

          await ibtToken.connect(user).approve(router.address, ibtBalanceBefore);
          const tx = router
            .connect(user)
            .swapExactOutput(swapCallData, ibtToken.address, ptToken.address, ibtBalanceBefore, 1);
          await expect(tx).to.be.revertedWithCustomError(spectraAdapter, 'NotSupported');

          console.log('This swap is forbidden after maturity');

          const ptBalanceAfter = await showBalance(ptToken, user.address, 'pt Balance After:');
          expect(ptBalanceAfter).to.be.eq(ptBalanceBefore);

          const ibtBalanceAfter = await showBalance(ibtToken, user.address, 'ibt balance After:');
          expect(ibtBalanceAfter).to.be.eq(ibtBalanceBefore);
        });

        it(`${testCase.ptSymbol} to ${testCase.ibtSymbol} exact input`, async () => {
          const ptBalanceBefore = await showBalance(ptToken, user.address, 'balance Before:');
          const ibtBalanceBefore = await showBalance(ibtToken, user.address, 'balance before:');

          const ptIn = testCase.postMaturity.swapExactPtToIbt.ptIn;
          const minIbtOut = testCase.postMaturity.swapExactPtToIbt.minIbtOut;
          await ptToken.connect(user).approve(router.address, ptIn);
          const tx = await router
            .connect(user)
            .swapExactInput(swapCallData, ptToken.address, ibtToken.address, ptIn, minIbtOut);
          await showGasUsage(tx);

          const ptBalanceAfter = await showBalance(ptToken, user.address, 'ptBalanceAfter:');
          expect(ptBalanceBefore.sub(ptBalanceAfter)).to.be.eq(ptIn);

          const ibtBalanceAfter = await showBalance(ibtToken, user.address, 'ibt balance After:');
          expect(ibtBalanceAfter).to.be.greaterThan(ibtBalanceBefore);
        });

        it(`${testCase.ptSymbol} to ${testCase.ibtSymbol} exact output`, async () => {
          const ptBalanceBefore = await showBalance(ptToken, user.address, 'pt balance Before:');
          const ibtBalanceBefore = await showBalance(ibtToken, user.address, 'ibt balance before:');

          const ibtOut = testCase.postMaturity.swapPtToExactIbt.ibtOut;
          await ptToken.connect(user).approve(router.address, ptBalanceBefore);
          const maxPtIn = testCase.postMaturity.swapPtToExactIbt.maxPtIn;
          const tx = await router
            .connect(user)
            .swapExactOutput(swapCallData, ptToken.address, ibtToken.address, maxPtIn, ibtOut);
          await showGasUsage(tx);

          const ptBalanceAfter = await showBalance(ptToken, user.address, 'pt Balance After:');
          expect(ptBalanceBefore).to.be.greaterThan(ptBalanceAfter);

          const ibtBalanceAfter = await showBalance(ibtToken, user.address, 'ibt balance After:');
          expect(ibtBalanceAfter.sub(ibtBalanceBefore)).to.be.eq(ibtOut);
        });
      });
    });

    await delay(3000);
  }
});
