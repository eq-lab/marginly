import {expect} from 'chai';
import {SwapRouterMock} from "../typechain-types";
import {
    numberToFp
} from '@marginly/common/math';
import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import { Wallet, Provider, Contract } from 'zksync-web3';
import {
  createSwapRouterMock,
  createToken,
  createUniswapV3PoolMock,
  createWeth9,
  richWalletPks,
  setPrice,
} from './common';
import * as hre from 'hardhat';

interface CreateContractResultTokens {
    arb: Contract,
    weth: Contract
}

interface CreateContractsResult {
    router: Contract,
    pool: Contract,
    tokens: CreateContractResultTokens,
    owner: Wallet,
    oracle: Wallet,
    user: Wallet,
    fee: number
}

async function createContracts(provider: Provider, deployer: Deployer): Promise<CreateContractsResult> {
    const arbToken = await createToken(deployer, 'Arbitrum', 'ARB');
    const wethToken = await createWeth9(deployer);

    const fee = 500; // 0.05%

    const [owner, oracle, user] = richWalletPks.map(x => new Wallet(x, provider));

    const pool = await createUniswapV3PoolMock(deployer, oracle.address, arbToken.address, wethToken.address, fee);

    const router = await createSwapRouterMock(deployer, wethToken.address);

    await router.setPool(arbToken.address, wethToken.address, fee, pool.address);

    return {
        router,
        pool,
        tokens: {
            arb: arbToken,
            weth: wethToken
        },
        owner,
        oracle,
        user,
        fee
    };
}

const createTokensGenerator = (tokens: CreateContractResultTokens, owner: Wallet) => async (tokenKey: keyof CreateContractResultTokens, address: string, amount: number) => {
    if (tokenKey === 'weth') {
        const token = tokens[tokenKey];
        const amountFp = numberToFp(18, amount);
        await (await token.connect(owner).deposit({value: amountFp})).wait();
        await (await token.connect(owner).transfer(address, amountFp)).wait();
    } else {
        const token = tokens[tokenKey];
        const decimals = await token.decimals();
        await (await token.connect(owner).mint(address, numberToFp(decimals, amount))).wait();
    }
};

describe.skip('SwapRouterMock', () => {
    const blockNumberInADistantFuture = 1000000000000000000000n;

    const arbEthPrice = 0.0005;

    const inTokenKey: keyof CreateContractResultTokens = 'weth';
    const outTokenKey: keyof CreateContractResultTokens = 'arb';

    interface SwapCase {
        inAmount: number,
        inTokenKey: keyof CreateContractResultTokens,
        outAmount: number
        outTokenKey: keyof CreateContractResultTokens,
    }

    const swapCases: SwapCase[] = [
        {
            inAmount: 1,
            inTokenKey: 'weth',
            outAmount: 2000,
            outTokenKey: 'arb'
        },
        {
            inAmount: 1,
            inTokenKey: 'arb',
            outAmount: 0.0005,
            outTokenKey: 'weth'
        }
    ];

    type ExactSide = 'input' | 'output';

    const exactSides: ExactSide[] = ['input', 'output'];

    exactSides.forEach(exactSide =>
        swapCases.forEach(({inAmount, inTokenKey, outAmount, outTokenKey}) =>
            it(`should swap exact ${exactSide} of ${inTokenKey} correctly`, async () => {
              const provider = Provider.getDefaultProvider();
              const wallet = new Wallet(richWalletPks[0], provider);
              const deployer = new Deployer(hre, wallet);

              const {
                    router,
                    pool,
                    tokens,
                    owner,
                    oracle,
                    user,
                    fee
                } = await createContracts(provider, deployer);

                const {arb, weth} = tokens;
                await setPrice(pool, oracle, [arb, weth], arbEthPrice);

                const inToken = tokens[inTokenKey];
                const outToken = tokens[outTokenKey];

                const inDecimals = await inToken.decimals();
                const outDecimals = await outToken.decimals();

                const numToInTokenFp = (x: number) => numberToFp(inDecimals, x);
                const numToOutTokenFp = (x: number) => numberToFp(outDecimals, x);

                const generateTokens = createTokensGenerator(tokens, owner);

                await generateTokens(inTokenKey, user.address, inAmount);
                await generateTokens(outTokenKey, pool.address, outAmount);

                await (await inToken.connect(user).approve(router.address, numToInTokenFp(inAmount))).wait();

                const amountInBefore = (await inToken.balanceOf(user.address)).toBigInt();
                const amountOutBefore = (await outToken.balanceOf(user.address)).toBigInt();

                const inAmountFp = numToInTokenFp(inAmount);
                const outAmountFp = numToOutTokenFp(outAmount);

                if (exactSide === 'input') {
                    await (await router.connect(user).exactInputSingle({
                        tokenIn: inToken.address,
                        tokenOut: outToken.address,
                        fee,
                        recipient: user.address,
                        deadline: blockNumberInADistantFuture,
                        amountIn: inAmountFp,
                        amountOutMinimum: 0n,
                        sqrtPriceLimitX96: 0n
                    })).wait();
                } else if (exactSide == 'output') {
                    await (await router.connect(user).exactOutputSingle({
                        tokenIn: inToken.address,
                        tokenOut: outToken.address,
                        fee,
                        recipient: user.address,
                        deadline: blockNumberInADistantFuture,
                        amountOut: outAmountFp,
                        amountInMaximum: inAmountFp,
                        sqrtPriceLimitX96: 0n
                    })).wait();
                } else {
                    throw new Error('Unknown exact side');
                }

                const amountInAfter = (await inToken.balanceOf(user.address)).toBigInt();
                const amountOutAfter = (await outToken.balanceOf(user.address)).toBigInt();

                expect(inAmountFp).to.be.equal(amountInBefore - amountInAfter);
                expect(outAmountFp).to.be.equal(amountOutAfter - amountOutBefore);
            })
        )
    );
});