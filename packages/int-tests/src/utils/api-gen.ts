import { logger } from '../utils/logger';

export type PromiseOrValue<V> = V | Promise<V>;

type Arg = {
  components?: Arg[];
  name?: string;
  type: string;
  jsType: string;
};
type Function = {
  payable?: boolean;
  inputs: Arg[];
  outputs?: Arg[];
};
type Functions = { [name: string]: Function & { type: `r` | `w` } };
type AbiEntry = {
  name: string;
  type: `constructor` | `event` | `function` | `fallback` | `receive`;
  stateMutability: `view` | `pure` | `nonpayable` | `payable`;
  inputs: Arg[];
  outputs?: Arg[];
};

export function genDefinitions(
  contract: {
    contractName: string;
    abi: AbiEntry[];
  },
  contractPath: string,
  {
    noCode,
    overrideName,
    ignoreImportError,
  }: { noCode?: boolean; overrideName?: string; ignoreImportError?: boolean } = {}
): string {
  function convertType(arg: Arg, inputs: boolean): Arg {
    let jsType = `void`;
    if (arg.type?.startsWith(`uint8`)) {
      jsType = inputs ? `BigNumberish` : `number`;
    } else if (arg.type?.startsWith(`uint`) || arg.type?.startsWith(`int`)) {
      jsType = inputs ? `BigNumberish` : `BigNumber`;
    } else if (arg.type == `bool`) {
      jsType = `boolean`;
    } else if (arg.type == `address` || arg.type == `string`) {
      jsType = `string`;
    } else if (arg.type?.startsWith(`bytes`)) {
      jsType = `BytesLike`;
    } else if (arg.type == `tuple`) {
      const components = arg.components!;
      jsType = `{${stringifyInputs(components.map((x) => convertType(x, inputs))).reduce((a, b) => `${a}${b},`, ``)}}`;
    } else if (arg.type == `tuple[]`) {
      const components = arg.components!;
      jsType = `{${stringifyInputs(components.map((x) => convertType(x, inputs))).reduce((a, b) => `${a}${b},`, ``)}}[]`;
    }
    return {
      name: arg.name != `` ? arg.name : undefined,
      type: arg.type,
      jsType,
    };
  }

  const functions: Functions = {};
  const deploy: Function = { inputs: [] };

  contract.abi.sort((a, b) => (a.name || ``).localeCompare(b.name || ``));
  for (const entry of contract.abi) {
    if (entry.type == `fallback` || entry.type === `receive`) continue;
    logger.debug(`${contract.contractName}::${entry.name} => ${entry.type}`);
    const outputs = entry.outputs?.map((x) => convertType(x, false));
    const inputs = entry.inputs.map((x) => convertType(x, true));

    switch (entry.type) {
      case `constructor`:
        deploy.inputs = inputs;
        break;
      case `event`:
        // events[entry.name] = {
        //   inputs,
        // };
        break;
      case `function`:
        switch (entry.stateMutability) {
          case `view`:
          case `pure`:
            functions[entry.name] = {
              inputs: inputs.map(({ name, type, jsType }) => {
                return { name, type, jsType: `PromiseOrValue<${jsType}>` };
              }),
              outputs,
              type: `r`,
            };
            break;
          case `nonpayable`:
            functions[entry.name] = {
              inputs: inputs.map(({ name, type, jsType }) => {
                return { name, type, jsType: `PromiseOrValue<${jsType}>` };
              }),
              outputs,
              type: `w`,
            };
            break;
          case `payable`:
            functions[entry.name] = {
              inputs,
              outputs,
              payable: true,
              type: `w`,
            };
            break;
        }
        break;
    }
  }

  function stringifyInputs(inputs: Arg[]): string[] {
    return inputs.map(({ name, jsType }, idx) => {
      return `${name && name != `` ? name : `arg${idx}`}:${jsType}`;
    });
  }

  function stringifyOutputs(outputs?: Arg[], stictOutput?: boolean): string {
    if (!stictOutput) {
      if (outputs == undefined || outputs.length == 0) {
        return `void`;
      } else if (outputs.length == 1) {
        return `${outputs[0].jsType}`;
      } else if (outputs.find(({ name }) => name == undefined || name == ``)) {
        return `[${outputs.map(({ jsType }) => `${jsType}`)}]`;
      } else {
        return `{${outputs.map(({ name, jsType }) => `${name}:${jsType};`).reduce((a, b) => a + b, ``)}}`;
      }
    } else {
      outputs = outputs || [];
      if (outputs.find(({ name }) => name == undefined || name == ``)) {
        return `[${outputs.map(({ jsType }) => `${jsType}`)}]`;
      } else {
        return `{${outputs.map(({ name, jsType }) => `${name}:${jsType};`).reduce((a, b) => a + b, ``)}}`;
      }
    }
  }

  const contractName = `${overrideName ?? contract.contractName}Contract`;
  const interfaceName = `${overrideName ?? contract.contractName}Interface`;
  const deployerName = `deploy${overrideName ?? contract.contractName}`;
  const connectorName = `connect${overrideName ?? contract.contractName}`;
  const all = Object.entries(functions);
  const readOnly = all.filter(([, { type }]) => type == `r`);
  const write = all.filter(([, { type }]) => type == `w`);

  const defMethods = all.map(([name, { type, inputs, outputs, payable }]) => {
    const override = { name: `override?`, type: ``, jsType: `` };
    let output = ``;
    if (type == `w`) {
      override.jsType = `${payable ? `PayableOverrides` : `Overrides`} & { from?: PromiseOrValue<string> }`;
      output = `ContractTransaction`;
    } else {
      override.jsType = `CallOverrides`;
      output = stringifyOutputs(outputs);
    }
    return `${name}(${stringifyInputs([...inputs, override])}): Promise<${output}>;`;
  });
  const defFunctions = readOnly.map(([name, { type, inputs, outputs }]) => {
    const override = { name: `override?`, type: ``, jsType: `CallOverrides` };
    return `${name}(${stringifyInputs([...inputs, override])}): Promise<${stringifyOutputs(outputs, true)}>;`;
  });
  const defCallStatic = write.map(([name, { inputs, outputs, payable }]) => {
    const override = {
      name: `override?`,
      jsType: `${payable ? `PayableOverrides` : `Overrides`} & { from?: PromiseOrValue<string> }`,
      type: ``,
    };
    return `${name}(${stringifyInputs([...inputs, override])}): Promise<${stringifyOutputs(outputs)}>;`;
  });
  const defEstimateGas = write.map(([name, { inputs, payable }]) => {
    const override = {
      name: `override?`,
      jsType: `${payable ? `PayableOverrides` : `Overrides`} & { from?: PromiseOrValue<string> }`,
      type: ``,
    };
    return `${name}(${stringifyInputs([...inputs, override])}): Promise<BigNumber>;`;
  });
  const defPopulateTransaction = write.map(([name, { inputs, outputs, payable }]) => {
    const override = {
      name: `override?`,
      jsType: `${payable ? `PayableOverrides` : `Overrides`} & { from?: PromiseOrValue<string> }`,
      type: ``,
    };
    return `${name}(${stringifyInputs([...inputs, override])}): Promise<PopulatedTransaction>;`;
  });

  return `import {
  BaseContract,
  BytesLike,
  Signer,
  providers,
  utils,
  CallOverrides,
  BigNumberish,
  Overrides,
  ContractTransaction,
  PayableOverrides,
  BigNumber,
  PopulatedTransaction,
  ContractFactory,
} from 'ethers';
${ignoreImportError ? `// @ts-ignore\n` : ``}import { ${noCode ? `abi` : `abi, bytecode`} } from "${contractPath}";
import { PromiseOrValue } from '../utils/api-gen';

export interface ${interfaceName} extends utils.Interface {
  functions: {${all
    .map(([name, { inputs }]) => `"${name}(${inputs.map(({ type }) => type)})": utils.FunctionFragment;`)
    .reduce((a, b) => `${a}${b}\n`, `\n`)}}

  getFunction(nameOrSignatureOrTopic: ${all
    .map(([name]) => `"${name}"`)
    .reduce((a, b) => `${a} | ${b}`)}): utils.FunctionFragment;
}

export interface ${contractName} extends BaseContract {
  connect(signerOrProvider: Signer | providers.Provider | string): this;
  attach(addressOrName: string): this;
  deployed(): Promise<this>;
  
  interface: ${interfaceName};
  ${defMethods.reduce((a, b) => `${a}${b}\n`, `\n`)}
  functions: {${defFunctions.reduce((a, b) => `${a}${b}\n`, `\n`)}}
  estimateGas: {${defEstimateGas.reduce((a, b) => `${a}${b}\n`, `\n`)}}
  populateTransaction: {${defPopulateTransaction.reduce((a, b) => `${a}${b}\n`, `\n`)}}
  callStatic: {${defCallStatic.reduce((a, b) => `${a}${b}\n`, `\n`)}}
}

${
  noCode
    ? ``
    : `export async function deploy(${[
        ...stringifyInputs(deploy.inputs),
        `signer?:Signer`,
      ]}): Promise<${contractName}> {
  const factory = new ContractFactory(abi, bytecode, signer);
  const contract = await factory.deploy(${deploy.inputs.map(({ name }) => name)});
  return (await contract.deployed()) as any;
}`
}

export function connect(addressOrName: string, signerOrProvider?: Signer | providers.Provider): ${contractName} {
  return new BaseContract(addressOrName, abi, signerOrProvider) as any;
}

export default {
  connect, ${noCode ? `` : `deploy,`}
}
`;
}
