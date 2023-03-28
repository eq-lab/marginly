import { FC, FormEvent, useContext, useState } from 'react';
import { ContractStateDescription } from '../contracts/states';
import { ContractsContext, SignerContext } from '../connection';
import { ethers } from 'ethers';

type ContractStateProps = {
  contract: ethers.Contract | undefined;
  state: ContractStateDescription;
};

export const State: FC<ContractStateProps> = ({ contract, state }) => {
  const { stateName, argsNames, fetchValue } = state;
  const [argsValues, setArgsValues] = useState<string[]>(argsNames.map((_) => ''));
  const [stateValue, setStateValue] = useState<string>('-');
  const signerContext = useContext(SignerContext);
  const contractsContext = useContext(ContractsContext);

  const updateArgValue = (index: number, e: FormEvent<HTMLInputElement>) => {
    const value = e.currentTarget.value;
    const nextArgsValues = argsValues.map((v, i) => {
      if (i === index) {
        return value;
      } else {
        return v;
      }
    });
    setArgsValues(nextArgsValues);
  };

  const updateStateValue = (args: string[]) => {
    setStateValue('-');
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

    fetchValue(contract, signerContext.signer, args, contractsContext).then((result) => setStateValue(result[0]));
  };

  return (
    <div style={{ display: 'inline-block' }}>
      <b>{stateName}</b>
      <table>
        <tbody>
          <tr>
            <th>Arg name</th>
            <th>Arg value</th>
          </tr>
          {argsNames.map((argName, i) => {
            return (
              <tr key={`${stateName}-${argName}-tr`}>
                <td>
                  <label>{argName}</label>
                </td>
                <td style={{ width: '450px' }}>
                  <input
                    key={`${stateName}-${argName}-input`}
                    style={{ width: '97%' }}
                    onChange={(e) => updateArgValue(i, e)}
                  />
                </td>
              </tr>
            );
          })}
          <tr>
            <td>
              <label>Result</label>
            </td>
            <td>
              <label>{stateValue}</label>
            </td>
          </tr>
          <tr>
            <td />
            <td>
              <button onClick={(_) => updateStateValue(argsValues)}>Fetch</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};
