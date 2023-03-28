import { FC, FormEvent, useContext, useState } from 'react';
import { ContractMethodDescription } from '../contracts/calls';
import { ContractsContext, SignerContext } from '../connection';
import { ethers } from 'ethers';

type ContractMethodProps = {
  contract: ethers.Contract | undefined;
  call: ContractMethodDescription;
};

export const Method: FC<ContractMethodProps> = ({ contract, call }) => {
  const { methodName, argsNames, callHandler } = call;
  const [argsValues, setArgsValues] = useState<string[]>(argsNames.map((_) => ''));
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

  const doCall = () => {
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

    callHandler(
      contract,
      signerContext.signer,
      argsValues,
      signerContext.gasLimit,
      signerContext.gasPrice,
      contractsContext
    );
  };

  return (
    <div style={{ display: 'inline-block' }}>
      <b>{methodName}</b>
      <table>
        <tbody>
          <tr>
            <th>Arg name</th>
            <th>Arg value</th>
          </tr>
          {argsNames.map((argName, i) => {
            return (
              <tr key={`${methodName}-${argName}-tr`}>
                <td>
                  <label>{argName}</label>
                </td>
                <td style={{ width: '450px' }}>
                  <input
                    key={`${methodName}-${argName}-input`}
                    style={{ width: '97%' }}
                    onChange={(e) => updateArgValue(i, e)}
                  />
                </td>
              </tr>
            );
          })}
          <tr>
            <td />
            <td>
              <button onClick={(_) => doCall()}>Call</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};
