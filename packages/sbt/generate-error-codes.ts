import { resolve, extname, relative } from 'path';
import { readdirSync, readFileSync, writeFileSync } from 'fs';

const errorCodesFileName = 'error-codes.json';

const contractsDirectory = 'contracts';

const contractExtension = '.sol';

interface ErrorDefinition {
  code: string;
  description: string;
  fileNames: string[];
}

function* getFiles(dirName: string): IterableIterator<string> {
  const dirents = readdirSync(dirName, { withFileTypes: true });
  for (const dirent of dirents) {
    const res = resolve(dirName, dirent.name);
    if (dirent.isDirectory()) {
      yield* getFiles(res);
    } else {
      yield res;
    }
  }
}

function getErrorDefinitions(fileName: string): Map<string, string> {
  const definitions = new Map<string, string>();

  const content = readFileSync(fileName, 'utf-8');

  const regex = /^\s+(?:require|revert)\([^;']+?'([A-Z]{1,5})'[^;)]*?\);\s+\/\/(.*)$/gm;

  for (const match of content.matchAll(regex)) {
    const code = match[1];
    const description = match[2].trim();

    if (definitions.has(code)) {
      if (definitions.get(code) !== description) {
        throw new Error(`Multiple descriptions found for code ${code} in file ${fileName}`);
      }
    } else {
      definitions.set(code, description);
    }
  }

  return definitions;
}

function main() {
  const allFileNames = Array.from(getFiles(contractsDirectory));

  const solFileNames = allFileNames.filter((x) => extname(x) === contractExtension);

  const globalDefinitions = new Map<string, { description: string; fileNames: string[] }>();

  for (const fileName of solFileNames) {
    const fileDefinitions = getErrorDefinitions(fileName);
    for (const [code, description] of fileDefinitions) {
      const relativeFileName = relative(contractsDirectory, fileName);

      if (globalDefinitions.has(code)) {
        const globalDefinition = globalDefinitions.get(code)!;

        if (globalDefinition.description !== description) {
          throw new Error(
            `Description for error code ${code} in file ${fileName} does not match description for this code in files: ${globalDefinition.fileNames.join(
              ', '
            )}`
          );
        } else {
          globalDefinition.fileNames.push(relativeFileName);
        }
      } else {
        globalDefinitions.set(code, { description, fileNames: [relativeFileName] });
      }
    }
  }

  for (const [, data] of globalDefinitions) {
    data.fileNames.sort();
  }

  const sortedDefinitions: ErrorDefinition[] = [];

  for (const [code, data] of globalDefinitions) {
    sortedDefinitions.push({
      code,
      description: data.description,
      fileNames: data.fileNames,
    });
  }
  sortedDefinitions.sort((a, b) => a.code.localeCompare(b.code));

  writeFileSync(errorCodesFileName, JSON.stringify(sortedDefinitions, null, 2), 'utf-8');
}

main();
