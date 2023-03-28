import React, { useState } from 'react';
import './App.css';
import { Method } from './components/Method';
import { State } from './components/State';
import { AllSignersContext, ContractsContext, ContractsParams, SignerContext, SignerParams } from './connection';
import { ConnectionSettings } from './components/ConnectionSettings';
import { StateTable } from './components/StateTable';
import StyledGlobal from './styles/globalStyles';
import { erc20StatesWithArgs } from './contracts/states/erc20';
import { baseTokenMethods, quoteTokenMethods } from './contracts/calls/erc20';
import { marginlyPoolStatesWithoutArgs, positionsState } from './contracts/states/marginly-pool';
import { marginlyPoolMethods } from './contracts/calls/marginly-pool';
import { TimeShift } from './components/TimeShift';
import { StateMap } from './components/StateMap';
import { Deploy } from './components/Deploy';
import { TabSelector } from './components/TabSelector';
import { uniswapPoolStatesWithoutArgs } from './contracts/states/uniswap';
import { uniswapMethods } from './contracts/calls/uniswap';
import { ethers } from 'ethers';

function App() {
  const [signerParams, setSignerParams] = useState<SignerParams | undefined>(undefined);
  const [contractsParams, setContractsParams] = useState<ContractsParams | undefined>(undefined);
  const [signers, setSigners] = useState<ethers.Signer[]>([]);

  const tabs = ['marginly', 'uniswap', 'erc20', 'deploy', 'settings'];
  const [selectedTab, setSelectedTab] = useState<string>('settings');

  return (
    <div className="App">
      <StyledGlobal />
      <AllSignersContext.Provider value={signers}>
      <SignerContext.Provider value={signerParams}>
        <ContractsContext.Provider value={contractsParams}>
          <TabSelector tabs={tabs} selectedTab={selectedTab} setSelectedTab={setSelectedTab} />
          <br />
          <br />
          <div hidden={selectedTab !== 'marginly'}>
            <TimeShift />
            <br />
            <h3>Marginly pool methods</h3>
            {marginlyPoolMethods.map((method) => (
              <div key={`marginly-pool-method-${method.methodName}-div`}>
                <Method
                  key={`marginly-pool-method-${method.methodName}`}
                  contract={contractsParams?.marginlyPoolContract}
                  call={method}
                />
                <br />
                <br />
              </div>
            ))}
            <br />
            <h3>Marginly pool states</h3>
            <br />
            <StateTable contract={contractsParams?.marginlyPoolContract} states={marginlyPoolStatesWithoutArgs} />
            <br />
            <h3>Positions</h3>
            <StateMap
              contract={contractsParams?.marginlyPoolContract}
              state={positionsState}
              keysNames={positionsState.argsNames}
              valuesNames={['heapPos', 'type', 'discBase', 'discQuote','realBase','realQuote', 'leverage', 'net']}
            />
          </div>
          <div hidden={selectedTab !== 'uniswap'}>
            <h3>Uniswap pool methods</h3>
            {uniswapMethods.map((method) => (
              <div key={`uniswap-method-${method.methodName}-div`}>
                <Method
                  key={`uniswap-method-${method.methodName}`}
                  contract={contractsParams?.uniswapPoolContract}
                  call={method}
                />
                <br />
                <br />
              </div>
            ))}
            <StateTable contract={contractsParams?.uniswapPoolContract} states={uniswapPoolStatesWithoutArgs} />
          </div>
          <div hidden={selectedTab !== 'erc20'}>
            <h3>Quote token contract</h3>
            {quoteTokenMethods.map((method) => (
              <div key={`usdc-method-${method.methodName}-div`}>
                <Method
                  key={`usdc-method-${method.methodName}`}
                  contract={contractsParams?.quoteTokenContract}
                  call={method}
                />
                <br />
                <br />
              </div>
            ))}
            <br />
            <br />
            {erc20StatesWithArgs.map((state) => (
              <div key={`quote-state-with-args-${state.stateName}-div`}>
                <State
                  key={`quote-state-with-args-${state.stateName}`}
                  contract={contractsParams?.quoteTokenContract}
                  state={state}
                />
                <br />
                <br />
              </div>
            ))}

            <br />
            <h3>Base token contract</h3>
            {baseTokenMethods.map((method) => (
              <div key={`base-method-${method.methodName}-div`}>
                <Method
                  key={`base-method-${method.methodName}`}
                  contract={contractsParams?.baseTokenContract}
                  call={method}
                />
                <br />
                <br />
              </div>
            ))}
            <br />
            {erc20StatesWithArgs.map((state) => (
              <div key={`base-state-with-args-${state.stateName}-div`}>
                <State
                  key={`base-state-with-args-${state.stateName}`}
                  contract={contractsParams?.baseTokenContract}
                  state={state}
                />
                <br />
                <br />
              </div>
            ))}
          </div>
          <div hidden={selectedTab !== 'deploy'}>
            <Deploy />
          </div>
          <div hidden={selectedTab !== 'settings'}>
            <ConnectionSettings
              signerParams={signerParams}
              updateSignerParams={setSignerParams}
              contractsParams={contractsParams}
              updateContractsParams={setContractsParams}
              signers = {signers}
              updateAllSigners={setSigners}
            />
          </div>
        </ContractsContext.Provider>
      </SignerContext.Provider>
      </AllSignersContext.Provider>
    </div>
  );
}

export default App;
