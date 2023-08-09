import { Closable } from '../common';
import { LogFormatter, LogRecordBase } from '@marginly/logger';

export interface Logger {
  log(message: string): void;

  beginScope(name: string): Closable;
}

export function adapterWriter(logger: Logger, format: LogFormatter) {
  return (logRecord: { eql: LogRecordBase & Record<string, unknown> }): void => {
    logger.log(format(logRecord));
  };
}

type LoggerOutput = (message: string) => void;

export class SimpleLogger implements Logger {
  private readonly scopeStack: SimpleLoggerScope[] = [];
  private readonly output;

  public constructor(output: LoggerOutput) {
    this.output = output;
  }

  public beginScope(name: string): Closable {
    const scope = new SimpleLoggerScope(name, (scope) => this.endScope(scope));
    this.scopeStack.push(scope);

    this.log('');
    this.log(`${'#'.repeat(this.scopeStack.length)} ${name}`);
    this.log('');

    return scope;
  }

  private endScope(scope: SimpleLoggerScope): void {
    if (scope !== this.scopeStack[this.scopeStack.length - 1]) {
      throw new Error('Wrong scope closing order');
    }
    this.scopeStack.pop();
  }

  public log(message: string): void {
    this.output(message);
  }
}

export class SimpleLoggerScope implements Closable {
  public readonly name;
  private readonly endScope: (scope: SimpleLoggerScope) => void;

  constructor(name: string, endScope: (scope: SimpleLoggerScope) => void) {
    this.name = name;
    this.endScope = endScope;
  }

  close(): void {
    this.endScope(this);
  }
}
