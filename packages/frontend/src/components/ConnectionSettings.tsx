import { ChangeEvent, FC, useEffect, useState } from 'react';
import { ContractsParams, SignerParams } from '../connection';
import { BigNumber, ethers } from 'ethers';
import { approveCall, depositCall, mintCall } from '../contracts/calls/erc20';
import { parseUnits } from 'ethers/lib/utils';
const WETH = require('../contracts/abi/WETH9.json');
const USDC = require('../contracts/abi/FIatTokenV2_1.json');
const UniswapV3Pool = require('../contracts/abi/UniswapV3Pool.json');
const SwapRouter = require('../contracts/abi/SwapRouter.json');
const MarginlyFactory = require('@marginly/contracts/artifacts/contracts/MarginlyFactory.sol/MarginlyFactory.json');
const MarginlyPool = require('@marginly/contracts/artifacts/contracts/MarginlyPool.sol/MarginlyPool.json');
const Signers: { keys: SignerInfo[] } = require('../signers.json');

type SignerInfo = { type: string; name: string; key: string };

enum SignerType {
  PrivateKey = 'private key',
  Unlocked = 'unlocked',
  MetaMask = 'MetaMask'
}

type ConnectionProps = {
  signerParams: SignerParams | undefined;
  updateSignerParams: (newParams: SignerParams) => void;
  contractsParams: ContractsParams | undefined;
  updateContractsParams: (newParams: ContractsParams) => void;
  signers: ethers.Signer[];
  updateAllSigners: (signers: ethers.Signer[]) => void;
};

type ConnectionSettingsState = {
  nodeAddress: string;
  marginlyPoolAddress: string;
  gasLimit: string;
  gasPrice: string;
};

export const ConnectionSettings: FC<ConnectionProps> = ({
  signerParams,
  updateSignerParams,
  contractsParams,
  updateContractsParams,
  signers,
  updateAllSigners
}) => {
  const [settings, updateSettings] = useState<ConnectionSettingsState>({
    nodeAddress: 'https://ganache-node.equilab.io',
    marginlyPoolAddress: '0x47A958d263bBF7754CF8174F68286AA26D5495dA',
    gasLimit: '800000',
    gasPrice: '25000000000',
  });

  const [selectedSignerIndex, setSelectedSignerIndex] = useState<number>(-1);
  const [signerAddress, setSignerAddress] = useState<string>('-');


  useEffect(() => {
    updateSignerContext(selectedSignerIndex, settings);
  }, [selectedSignerIndex, settings]);

  useEffect(()=>{
    updateContractsContext(signerParams);
  },[signerParams]);


  const getTreasury = async (): Promise<ethers.Signer> =>{
    const signerInfo = Signers.keys.find((signerInfo) => signerInfo.name ==='Treasury');
    const treasury = await getSignerFromSignerInfo(signerInfo!);
    return treasury!;
  }

  const getAllSigners = async (): Promise<ethers.Signer[]> =>{
    const signers = [];
    for(let signerInfo of Signers.keys){
      if(signerInfo.type === SignerType.MetaMask){
        continue;
      }
      const signer = await getSignerFromSignerInfo(signerInfo);
      if(signer){
        signers.push(signer);
      }
    }

    return signers;
  }

  const getTestSigners = async (): Promise<ethers.Signer[]> =>{
    const signers = [];
    for(let signerInfo of Signers.keys){
      if(signerInfo.type === SignerType.MetaMask || signerInfo.name === "USDC minter"){
        continue;
      }
      const signer = await getSignerFromSignerInfo(signerInfo);
      if(signer){
        signers.push(signer);
      }
    }

    return signers;
  }

  const getQuoteMinter = async (): Promise<ethers.Signer> =>{
    const signerInfo = Signers.keys.find((signerInfo) => signerInfo.name ==='USDC minter');
    const signer = await getSignerFromSignerInfo(signerInfo!);
    return signer!
  }

  const initializeTestAccountBalances = async (
    baseTokenContract: ethers.Contract, 
    quoteTokenContract: ethers.Contract,
    marginlyContract: ethers.Contract): Promise<void>  =>{

      const treasury = await getTreasury();
      const treasuryAddress = await treasury.getAddress()
      const quoteMinter = await getQuoteMinter();
      
      const quoteMinterAddress = await quoteMinter.getAddress();
      await treasury.sendTransaction({to: quoteMinterAddress, value: parseUnits('10',18)});


      const signers = await getTestSigners();
      const gasLimit = Number.parseInt(settings.gasLimit);
      const gasPrice = Number.parseInt(settings.gasPrice);
    
      for(const signer of signers){
        const signerAddress = await signer.getAddress();
        console.log(`Depositing account ${signerAddress}`);
        let quoteAmount = "100000";
        let baseAmount = "50";
        if(signerAddress === treasuryAddress){
          quoteAmount = "1000000000";
          baseAmount = "50000000";
        }
        else{
          await treasury.sendTransaction({to: signerAddress, value: parseUnits('50',18)});
        }

        const spender = marginlyContract.address;
        console.log('approve for quoteToken');
        await approveCall.callHandler(quoteTokenContract, signer,[spender, quoteAmount], gasLimit, gasPrice,{} as any);

        console.log(`deposit call ${baseAmount}, ${signerAddress}`);
        await depositCall.callHandler(baseTokenContract, signer,[baseAmount], gasLimit, gasPrice,{} as any);
        console.log('approve for baseToken');
        await approveCall.callHandler(baseTokenContract, signer,[spender, baseAmount], gasLimit, gasPrice,{} as any);

        
        await mintCall.callHandler(quoteTokenContract, quoteMinter!, [signerAddress, quoteAmount], gasLimit, gasPrice, {} as any);
      }
  };

  const selectSigner = async (e: ChangeEvent<HTMLSelectElement>) => {
    setSelectedSignerIndex(Number(e.target.value));
    const signerInfo: SignerInfo = Signers.keys[Number(e.target.value)];
    const signer = await getSignerFromSignerInfo(signerInfo);
    let newSignerAddress: string;
    if (signer === undefined) {
      console.error(`invalid signer info`);
      return;
    }
    if (signerInfo.type === SignerType.Unlocked) {
      newSignerAddress = signerInfo.key;
    } else if (signerInfo.type === SignerType.PrivateKey) {
      const wallet = new ethers.Wallet(signerInfo.key);
      newSignerAddress = wallet.address;
    } else if (signerInfo.type === SignerType.MetaMask){
      newSignerAddress = await signer.getAddress();
    }
    else {
      console.error(`unknown signer type: ${signerInfo.type}`);
      return;
    }
    setSignerAddress(newSignerAddress);
  };

  const updateSignerContext = async (selectedSignerIndex: number, connectionSettings:ConnectionSettingsState) => {
    console.log(`new signer params:`);
    console.log(`nodeAddress: ${connectionSettings.nodeAddress}`);
    console.log(`signerAddress: ${signerAddress}`);

    if (selectedSignerIndex === -1) {
      console.error('signer not selected!');
      return;
    }

    const gasLimit = Number.parseInt(connectionSettings.gasLimit);
    const gasPrice = Number.parseInt(connectionSettings.gasPrice);

    if (gasLimit === undefined) {
      console.error(`invalid gasLimit`);
      return;
    }
    if (gasPrice === undefined) {
      console.error(`invalid gasPrice`);
      return;
    }

    const signerInfo = Signers.keys[selectedSignerIndex];
    const signer = await getSignerFromSignerInfo(signerInfo);
    if (signer === undefined) {
      console.error(`invalid signer info`);
      return;
    }

    if(!settings.nodeAddress){
      console.error(`invalid node address`);
      return;
    }
    const provider = new ethers.providers.JsonRpcProvider(settings.nodeAddress);
    console.log(`Provider selected`);

    updateSignerParams({
      provider,
      signer,
      gasLimit,
      gasPrice,
    });
  };

  const depositTestAccounts = async() =>{
    const { marginlyPoolAddress, nodeAddress } = settings;
    const provider = new ethers.providers.JsonRpcProvider(nodeAddress);


    const marginlyPoolContract = new ethers.Contract(marginlyPoolAddress, MarginlyPool.abi, provider);
    const [quoteAddress, baseAddress ]= await Promise.all([
      marginlyPoolContract.quoteToken(),
      marginlyPoolContract.baseToken(),
      marginlyPoolContract.uniswapPool(),
      marginlyPoolContract.factory(),
    ]);

    const quoteTokenContract = new ethers.Contract(quoteAddress, USDC.abi, provider);
    const baseTokenContract = new ethers.Contract(baseAddress, WETH.abi, provider);

    await initializeTestAccountBalances(
      baseTokenContract, 
      quoteTokenContract, 
      marginlyPoolContract);

    alert(`Deposit accounts completed!`);
  };

  const updateContractsContext = async (signerParams: SignerParams | undefined) => {
    if (signerParams === undefined) {
      console.warn(`Signer context not provided`);
      return;
    }
    const { marginlyPoolAddress } = settings;
    if(!marginlyPoolAddress){
      console.warn(`marginlyPoolAddress not provided`);
      return;
    }
    console.log(`new contracts params:`);
    console.log(`marginlyPoolAddress: ${marginlyPoolAddress}`);
    if (!ethers.utils.isAddress(marginlyPoolAddress)) {
      console.error(`invalid marginlyPoolAddress!`);
      return;
    }

    const marginlyPoolContract = new ethers.Contract(marginlyPoolAddress, MarginlyPool.abi, signerParams.provider);

    const [quoteAddress, baseAddress, uniswapPoolAddress, marginlyFactoryAddress ]= await Promise.all([
      marginlyPoolContract.quoteToken(),
      marginlyPoolContract.baseToken(),
      marginlyPoolContract.uniswapPool(),
      marginlyPoolContract.factory(),
    ]);
    
    const quoteTokenContract = new ethers.Contract(quoteAddress, USDC.abi, signerParams.provider);
    const baseTokenContract = new ethers.Contract(baseAddress, WETH.abi, signerParams.provider);
    const uniswapPoolContract = new ethers.Contract(uniswapPoolAddress, UniswapV3Pool.abi, signerParams.provider);
    const marginlyFactoryContract = new ethers.Contract(
      marginlyFactoryAddress,
      MarginlyFactory.abi,
      signerParams.provider
    );

    const signers = await getAllSigners();
    updateAllSigners(signers);


    const swapRouterAddress = await marginlyFactoryContract.swapRouter();
    const swapRouterContract = new ethers.Contract(swapRouterAddress, SwapRouter.abi, signerParams.provider);

    updateContractsParams({
      marginlyFactoryContract,
      marginlyPoolContract,
      uniswapPoolContract,
      swapRouterContract,
      quoteTokenContract,
      baseTokenContract,
    });
  };

  const updateGasParams = (gasLimitStr: string, gasPriceStr: string) => {
    updateSettings({
      ...settings,
      gasLimit: gasLimitStr,
      gasPrice: gasPriceStr,
    });
    if (signerParams !== undefined) {
      console.log(`gasLimit: ${gasLimitStr}, gasPrice: ${gasPriceStr} wei`);
      const gasLimit = Number.parseInt(settings.gasLimit);
      const gasPrice = Number.parseInt(settings.gasPrice);

      if (gasLimit === undefined) {
        console.error(`invalid gasLimit`);
        return;
      }
      if (gasPrice === undefined) {
        console.error(`invalid gasPrice`);
        return;
      }
      updateSignerParams({ ...signerParams, gasLimit, gasPrice });
    }
  };

  const getSignerFromSignerInfo = async (signerInfo: SignerInfo): Promise<ethers.Signer | undefined> => {
    const nodeAddress = settings.nodeAddress;
    if (nodeAddress.length === 0) {
      console.error(`node address must be set`);
      return;
    }
    const provider = new ethers.providers.JsonRpcProvider(nodeAddress);

    if (signerInfo.type === SignerType.Unlocked) {
      return provider.getSigner(signerInfo.key);
    } else if (signerInfo.type === SignerType.PrivateKey) {
      const wallet = new ethers.Wallet(signerInfo.key).connect(provider);
      return wallet;
    } else if (signerInfo.type === SignerType.MetaMask){
      if(!window.ethereum){
          alert('Metamask not installed');
          return;
      }

      await window.ethereum.request({method:'eth_requestAccounts'});
      return (new ethers.providers.Web3Provider(window.ethereum)).getSigner();
    }else {
      console.error(`unknown signer type: ${signerInfo.type}`);
      return;
    }
  };

  return (
    <div style={{ display: 'inline-block' }}>
      <b>Connection settings</b>
      <table>
        <tbody>
          <tr>
            <th>Param</th>
            <th>Value</th>
          </tr>
          <tr>
            <td>
              <label>Node address</label>
            </td>
            <td style={{ width: '450px' }}>
              <input
                value={settings.nodeAddress}
                style={{ width: '97%' }}
                onChange={(e) =>
                  updateSettings({
                    ...settings,
                    nodeAddress: e.target.value,
                  })
                }
              />
            </td>
          </tr>
          <tr>
            <td>Signer</td>
            <td>
              <select style={{ width: '450px' }} onChange={(e) => selectSigner(e)} value={selectedSignerIndex}>
                <option value={-1} disabled>
                  Choose a signer
                </option>
                {Signers.keys.map((x, i) => (
                  <option key={`option-${x.key}`} value={i}>
                    {`${x.name} (${x.type})`}
                  </option>
                ))}
              </select>
            </td>
          </tr>
          <tr>
            <td>Signer Address</td>
            <td>{signerAddress}</td>
          </tr>
          <tr>
            <td>
              <label>Gas limit</label>
            </td>
            <td style={{ width: '450px' }}>
              <input
                value={settings.gasLimit}
                style={{ width: '97%' }}
                type="number"
                onChange={(e) => updateGasParams(e.target.value, settings.gasPrice)}
              />
            </td>
          </tr>
          <tr>
            <td>
              <label>Gas price</label>
            </td>
            <td style={{ width: '450px' }}>
              <input
                value={settings.gasPrice}
                style={{ width: '97%' }}
                type="number"
                onChange={(e) => updateGasParams(settings.gasLimit, e.target.value)}
              />
            </td>
          </tr>
          {/* <tr>
            <td />
            <td>
              <button onClick={(_) => updateSignerContext()}>Connect to node</button>
            </td>
          </tr> */}
          <tr>
            <td>
              <label>Marginly pool address</label>
            </td>
            <td style={{ width: '450px' }}>
              <input
                value={settings.marginlyPoolAddress}
                style={{ width: '97%' }}
                onChange={(e) =>
                  updateSettings({
                    ...settings,
                    marginlyPoolAddress: e.target.value,
                  })
                }
              />
            </td>
          </tr>
          <tr>
            <td>
              <label>Uniswap pool address</label>
            </td>
            <td style={{ width: '450px' }}>{contractsParams ? contractsParams.uniswapPoolContract.address : ''}</td>
          </tr>
          <tr>
            <td>
              <label>Quote token address</label>
            </td>
            <td style={{ width: '450px' }}>{contractsParams ? contractsParams.quoteTokenContract.address : ''}</td>
          </tr>
          <tr>
            <td>
              <label>Base token address</label>
            </td>
            <td style={{ width: '450px' }}>{contractsParams ? contractsParams.baseTokenContract.address : ''}</td>
          </tr>
          {/* <tr>
            <td />
            <td>
              <button onClick={(_) => updateContractsContext()}>Connect to contracts</button>
            </td>
          </tr> */}
          <tr>
            <td></td>
            <td>
            <button onClick={(_) => depositTestAccounts()}>Deposit test accounts</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};
