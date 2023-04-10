import { loadFixture, time } from '@nomicfoundation/hardhat-network-helpers';
import { parseUnits } from 'ethers/lib/utils';
import { ethers } from 'hardhat';
import { createMarginlyPoolWithWrapper } from './shared/fixtures';

describe('MarginlyPoolWrapper', () => {
  it('long, should pass', async () => {
    const { marginlyPoolWrapper, marginlyPool, uniswapPoolInfo } = await loadFixture(createMarginlyPoolWithWrapper);
    const [_, signer, lender] = await ethers.getSigners();

    // await marginlyPool.connect(lender).depositBase(1000);
    // await marginlyPool.connect(lender).depositQuote(1000);

    // await marginlyPool.connect(signer).depositBase(1000);
    // await marginlyPool.connect(signer).long(20);

    // await marginlyPoolWrapper.connect(signer).long(1000, 20);

    // console.log(`signer: ${signer.address}`);
    // console.log(`wrapper: ${marginlyPoolWrapper.address}`);
  
    // await marginlyPool.connect(signer).debugSender();
    // console.log(`direct sender: ${await marginlyPool.debugSenderAddress()}`);

    // await marginlyPoolWrapper.connect(signer).debugSender();
    // console.log(`via wrapper sender: ${await marginlyPool.debugSenderAddress()}`);
  })
})