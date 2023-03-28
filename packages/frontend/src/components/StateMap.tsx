import { FC, useContext, useState } from 'react';
import { ContractStateDescription } from '../contracts/states';
import { AllSignersContext, ContractsContext } from '../connection';
import { ethers } from 'ethers';

type StateMapProps = {
  contract: ethers.Contract | undefined;
  state: ContractStateDescription;
  keysNames: string[];
  valuesNames: string[];
};

type MapElem = {
  keys: string[];
  values: string[];
};

export const StateMap: FC<StateMapProps> = ({ contract, state, keysNames, valuesNames }) => {
  const [elems, setElems] = useState<MapElem[]>([]);

  const contractsContext = useContext(ContractsContext);
  const signers = useContext(AllSignersContext);


  const fetchStates = () => {
    if (contractsContext === undefined) {
      console.warn(`contractsContext is not set`);
      return;
    }
    if (contract === undefined) {
      console.warn(`contract is not set`);
      return;
    }



    const emptyValues: MapElem[] = [];

    for(let elem of elems){
      const dummyValues: string[] =[];
      dummyValues.push(elem.values[0]);
      for(let _valueName of valuesNames){
        dummyValues.push('-');
      }
      emptyValues.push({keys:[], values:dummyValues});
      
    }
    setElems(emptyValues);
    

    const values = signers.map(signer => state.fetchValue(contract, signer, keysNames, contractsContext));
    const newElems: MapElem[] = [];
    Promise.all(values).then((vals) => {
      for (let i = 0; i < vals.length; i++) {
        newElems.push({ keys: [], values: vals[i] });
      }
      setElems(newElems);
    });
  };

  return (
    <div style={{ display: 'inline-block' }}>
      <br />
      <table>
        <tbody>
          <tr>
            {keysNames.map((key) => (
              <th key={`state-map-new-elem-${state.stateName}-header-key-${key}`}>{key}</th>
            ))}
            {valuesNames.map((valueName) => (
              <th key={`state-map-new-elem-${state.stateName}-header-value-${valueName}`}>{valueName}</th>
            ))}
          </tr>

          {elems.map((elem, elemIndex) => (
            <tr key={`${state.stateName}-row-${elemIndex}`}>
              {elem.values.map((valName, valIndex) => (
                <td key={`${state.stateName}-elem-${elemIndex}-${valIndex}-value-${valName}`}>
                  <label>{elem.values[valIndex]}</label>
                </td>
              ))}
            </tr>
          ))}
          <tr>
            <td />
            <td />
            <td>
              <button onClick={(_) => fetchStates()}>Fetch</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};
