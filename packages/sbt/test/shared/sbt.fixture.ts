import '@nomicfoundation/hardhat-ethers';
import "@nomicfoundation/hardhat-chai-matchers";

import { Contract } from 'ethers';
import { ethers } from 'hardhat';

export async function deploySbt(): Promise<{ contract: Contract }> {
  const signers = await ethers.getSigners();
  const admin = signers[0];

  const factory = await ethers.getContractFactory('SBT', admin);
  const contract = await factory.deploy();
  await contract.waitForDeployment();

  return { contract };
}
