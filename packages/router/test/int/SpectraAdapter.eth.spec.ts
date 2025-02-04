import { expect } from 'chai';
import { ethers } from 'hardhat';
import {
  ERC20,
  MarginlyRouter,
  MarginlyRouter__factory,
  SpectraAdapter,
  SpectraAdapter__factory,
} from '../../typechain-types';
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

const swapCallData = constructSwap([Dex.Spectra], [SWAP_ONE]);

interface TokenInfo {
  address: string;
  symbol: string;
  balanceSlot: EthereumMainnetERC20BalanceOfSlot;
  initialBalance: BigNumber;
}

// For testing case when somebody make direct IBT transfer to sw-IBT and change rate IBT/sw-IBT
interface SWToken {
  address: string;
  symbol: string;
  ibtTransferAmount: BigNumber;
}

interface TestCase {
  forkNumber: number;

  spectraPool: string;

  ptToken: TokenInfo;
  quoteToken: TokenInfo;
  swIbt?: SWToken;

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

const inwstETHs_TestCase: TestCase = {
  forkNumber: 21714750,

  spectraPool: '0xe119bad8a35b999f65b1e5fd48c626c327daa16b',
  ptToken: {
    address: '0x4ae0154f83427a5864e5de6513a47dac9e5d5a69',
    symbol: 'pt-sw-inwstETHs',
    balanceSlot: EthereumMainnetERC20BalanceOfSlot.PTSWINWSTETHS,
    initialBalance: parseUnits('1000', 18),
  },

  quoteToken: {
    address: '0x8e0789d39db454dbe9f4a77acef6dc7c69f6d552',
    symbol: 'inwstETHs',
    balanceSlot: EthereumMainnetERC20BalanceOfSlot.INWSTETHS,
    initialBalance: parseUnits('2000', 18),
  },

  // swIbt: {
  //   address: '0xd89fc47aacbb31e2bf23ec599f593a4876d8c18c',
  //   symbol: 'sw-inwstETHs',
  //   ibtTransferAmount: parseUnits('500', 18),
  // },

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

const USR_TestCase: TestCase = {
  forkNumber: 21714750,

  spectraPool: '0x0d89f4583a6b5eceb76551d573ad49cd435f6064',
  ptToken: {
    address: '0xd0097149aa4cc0d0e1fc99b8bd73fc17dc32c1e9',
    symbol: 'pt-wstUSR',
    balanceSlot: EthereumMainnetERC20BalanceOfSlot.PTSWINWSTETHS,
    initialBalance: parseUnits('10000', 18),
  },

  quoteToken: {
    address: '0x66a1e37c9b0eaddca17d3662d6c05f4decf3e110',
    symbol: 'USR',
    balanceSlot: EthereumMainnetERC20BalanceOfSlot.WSTUSR,
    initialBalance: parseUnits('10000', 18),
  },

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

const wstUSR_TestCase: TestCase = {
  forkNumber: 21714750,

  spectraPool: '0x0d89f4583a6b5eceb76551d573ad49cd435f6064',
  ptToken: {
    address: '0xd0097149aa4cc0d0e1fc99b8bd73fc17dc32c1e9',
    symbol: 'pt-wstUSR',
    balanceSlot: EthereumMainnetERC20BalanceOfSlot.PTSWINWSTETHS,
    initialBalance: parseUnits('10000', 18),
  },

  quoteToken: {
    address: '0x1202f5c7b4b9e47a1a484e8b270be34dbbc75055',
    symbol: 'wstUSR',
    balanceSlot: EthereumMainnetERC20BalanceOfSlot.WSTUSR,
    initialBalance: parseUnits('10000', 18),
  },

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

const DOLA_TestCase: TestCase = {
  forkNumber: 21714750,

  spectraPool: '0x69ba1b7dba7eb3b7a73f4e35fd04a27ad06c55fe',
  ptToken: {
    address: '0xf4ca2ce6eaa1b507570c4b340007f6266c7d5698',
    symbol: 'pt-sDOLA',
    balanceSlot: EthereumMainnetERC20BalanceOfSlot.PTSWINWSTETHS,
    initialBalance: parseUnits('10000', 18),
  },

  quoteToken: {
    address: '0x865377367054516e17014ccded1e7d814edc9ce4',
    symbol: 'DOLA',
    balanceSlot: EthereumMainnetERC20BalanceOfSlot.DOLA,
    initialBalance: parseUnits('10000', 18),
  },

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

const sDOLA_TestCase: TestCase = {
  forkNumber: 21714750,

  spectraPool: '0x69ba1b7dba7eb3b7a73f4e35fd04a27ad06c55fe',
  ptToken: {
    address: '0xf4ca2ce6eaa1b507570c4b340007f6266c7d5698',
    symbol: 'pt-sDOLA',
    balanceSlot: EthereumMainnetERC20BalanceOfSlot.PTSWINWSTETHS,
    initialBalance: parseUnits('10000', 18),
  },

  quoteToken: {
    address: '0xb45ad160634c528cc3d2926d9807104fa3157305',
    symbol: 'sDOLA',
    balanceSlot: EthereumMainnetERC20BalanceOfSlot.SDOLA,
    initialBalance: parseUnits('10000', 18),
  },

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

const testCases = [
  USR_TestCase, // PT/Underlying case
  DOLA_TestCase, //PT/Underlying case
  wstUSR_TestCase, // PT-IBT/IBT case
  sDOLA_TestCase, //PT-IBT/IBT case
  inwstETHs_TestCase, // PT-sw/IBT case
];

async function initializeRouter(testCase: TestCase): Promise<{
  ptToken: ERC20;
  ibtToken: ERC20;
  router: MarginlyRouter;
  spectraAdapter: SpectraAdapter;
  owner: SignerWithAddress;
  user: SignerWithAddress;
}> {
  const [owner, user] = await ethers.getSigners();

  const ptToken = await ethers.getContractAt('ERC20', testCase.ptToken.address);
  const ibtToken = await ethers.getContractAt('ERC20', testCase.quoteToken.address);
  const spectraPool = testCase.spectraPool;

  const poolInput: SpectraAdapter.PoolInputStruct = {
    pt: ptToken.address,
    quoteToken: ibtToken.address,
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
    testCase.quoteToken.balanceSlot,
    EthAddress.parse(user.address),
    testCase.quoteToken.initialBalance
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
  expect(await ibtToken.balanceOf(user.address)).to.be.eq(
    testCase.quoteToken.initialBalance,
    `Wrong initial ${testCase.quoteToken.symbol} balance`
  );

  if (testCase.swIbt) {
    await setTokenBalance(
      ibtToken.address,
      testCase.quoteToken.balanceSlot,
      EthAddress.parse(user.address),
      testCase.quoteToken.initialBalance.add(testCase.swIbt.ibtTransferAmount)
    );

    await ibtToken.connect(user).transfer(testCase.swIbt.address, testCase.swIbt.ibtTransferAmount);
  }

  return {
    ptToken,
    ibtToken,
    router,
    spectraAdapter,
    owner,
    user,
  };
}

// Tests for running in ethereum mainnet fork
describe('SpectraAdapter', async () => {
  for (const testCase of testCases) {
    describe(`SpectraAdapter ${testCase.ptToken.symbol} - ${testCase.quoteToken.symbol}`, () => {
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

        it(`${testCase.quoteToken.symbol} to ${testCase.ptToken.symbol} exact input`, async () => {
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

          await showBalanceDelta(ptBalanceBefore, ptBalanceAfter, ptToken, 'PT balance delta:');
          await showBalanceDelta(ibtBalanceBefore, ibtBalanceAfter, ibtToken, 'IBT balance delta:');
        });

        it(`${testCase.quoteToken.symbol} to ${testCase.ptToken.symbol} exact output`, async () => {
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

          await showBalanceDelta(ptBalanceBefore, ptBalanceAfter, ptToken, 'PT balance delta:');
          await showBalanceDelta(ibtBalanceBefore, ibtBalanceAfter, ibtToken, 'IBT balance delta:');
        });

        it(`${testCase.ptToken.symbol} to ${testCase.quoteToken.symbol} exact input`, async () => {
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

          await showBalanceDelta(ptBalanceBefore, ptBalanceAfter, ptToken, 'PT balance delta:');
          await showBalanceDelta(ibtBalanceBefore, ibtBalanceAfter, ibtToken, 'IBT balance delta:');
        });

        it(`${testCase.ptToken.symbol} to ${testCase.quoteToken.symbol} exact output`, async () => {
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

          await showBalanceDelta(ptBalanceBefore, ptBalanceAfter, ptToken, 'PT balance delta:');
          await showBalanceDelta(ibtBalanceBefore, ibtBalanceAfter, ibtToken, 'IBT balance delta:');
        });
      });

      describe('Spectra swap post maturity', () => {
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

        it(`${testCase.quoteToken.symbol} to ${testCase.ptToken.symbol} exact input, forbidden`, async () => {
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

        it(`${testCase.quoteToken.symbol} to ${testCase.ptToken.symbol} exact output, forbidden`, async () => {
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

        it(`${testCase.ptToken.symbol} to ${testCase.quoteToken.symbol} exact input`, async () => {
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

          await showBalanceDelta(ptBalanceBefore, ptBalanceAfter, ptToken, 'PT balance delta:');
          await showBalanceDelta(ibtBalanceBefore, ibtBalanceAfter, ibtToken, 'IBT balance delta:');
        });

        it(`${testCase.ptToken.symbol} to ${testCase.quoteToken.symbol} exact output`, async () => {
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

          await showBalanceDelta(ptBalanceBefore, ptBalanceAfter, ptToken, 'PT balance delta:');
          await showBalanceDelta(ibtBalanceBefore, ibtBalanceAfter, ibtToken, 'IBT balance delta:');
        });
      });
    });

    await delay(3000);
  }
});
