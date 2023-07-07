import * as os from 'os';
import { LogFormatter, LogRecordBase } from '@marginly/logger';

export const stdOutWriter =
    (format: LogFormatter) =>
        (logRecord: { eql: LogRecordBase & Record<string, unknown> }): void => {
            process.stdout.write(format(logRecord));
            process.stdout.write(os.EOL);
        };
