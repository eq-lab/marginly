import { readSensitiveData } from './sensitive';
import { Command } from 'commander';

export interface SystemContext {
  defaults: Record<string, string | undefined>;
  args: { [key: string]: string | undefined };
  env: { [key: string]: string | undefined };
  reader: (label: string) => Promise<string>;
}

export interface Parameter {
  name: string[];
  description: string;
  env?: string;
}

const toUpperFirst = (str: string) => str[0].toUpperCase() + str.slice(1);

export const parameterOperations = {
  getArgForm: (p: Parameter): string => '--' + p.name.join('-'),
  getEnvForm: (p: Parameter): string => p.env ?? p.name.map((x) => x.toUpperCase()).join('_'),
  getJsForm: (p: Parameter): string =>
    p.name[0] +
    p.name
      .slice(1)
      .map((x) => toUpperFirst(x))
      .join(''),
};

export const getCommanderForm = (p: Parameter): string =>
  `${parameterOperations.getArgForm(p)} <${parameterOperations.getJsForm(p)}>`;

export const getCommanderFlagForm = (p: Parameter): string => `${parameterOperations.getArgForm(p)}`;

export const readParameter = (parameter: Parameter, systemContext: SystemContext): string | undefined => {
  return (
    systemContext.args[parameterOperations.getJsForm(parameter)] ||
    systemContext.env[parameterOperations.getEnvForm(parameter)] ||
    systemContext.defaults[parameterOperations.getJsForm(parameter)]
  );
};

export const readFlag = (parameter: Parameter, systemContext: SystemContext): boolean => {
  return systemContext.args[parameterOperations.getJsForm(parameter)] !== undefined;
};

export async function askParameter(parameter: Parameter, systemContext: SystemContext): Promise<string> {
  return await systemContext.reader(parameterOperations.getJsForm(parameter));
}

export const readParameterInteractive = async (parameter: Parameter, systemContext: SystemContext): Promise<string> => {
  return readParameter(parameter, systemContext) || (await askParameter(parameter, systemContext));
};

export const createSystemContext = (
  command: Command,
  defaults: Record<string, string | undefined> = {}
): SystemContext => {
  const args = command.opts();

  return {
    defaults,
    args,
    env: process.env,
    reader: readSensitiveData,
  };
};
