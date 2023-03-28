import { FC, useContext, useState } from 'react';
import { ContractStateDescription } from '../contracts/states';
import { ContractsContext, SignerContext } from '../connection';
import { ethers } from 'ethers';

type StateTableProps = {
  contract: ethers.Contract | undefined;
  states: ContractStateDescription[];
};

export const StateTable: FC<StateTableProps> = ({ contract, states }) => {
  const [statesValues, setStatesValues] = useState<string[]>(states.map((_) => '-'));

  const signerContext = useContext(SignerContext);
  const contractsContext = useContext(ContractsContext);

  const updateStatesValues = () => {
    setStatesValues(states.map((_) => '-'));
    if (signerContext === undefined) {
      console.warn(`signerContext is not set`);
      return;
    }
    if (contractsContext === undefined) {
      console.warn(`contractsContext is not set`);
      return;
    }
    if (contract === undefined) {
      console.warn(`contract is not set`);
      return;
    }
    const values = states.map((x) => x.fetchValue(contract, signerContext.signer, [], contractsContext));
    Promise.all(values).then((vals) => setStatesValues(vals.map((x) => x[0])));
  };

  return (
    <div style={{ display: 'inline-block' }}>
      <table>
        <tbody>
          <tr>
            <th>Name</th>
            <th style={{ width: '450px' }}>Value</th>
            <th>Units</th>
          </tr>
          {states.map((state, i) => {
            return (
              <tr key={`${state.stateName}-state-table-tr`}>
                <td>
                  <label>{state.stateName}</label>
                </td>
                <td>
                  <label>{statesValues[i]}</label>
                </td>
                <td>
                  <label>{state.valueUnits}</label>
                </td>
              </tr>
            );
          })}
          <tr>
            <td />
            <td />
            <td>
              <button onClick={(_) => updateStatesValues()}>Fetch</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};
