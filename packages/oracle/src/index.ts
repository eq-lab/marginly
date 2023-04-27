import {using} from '@marginly/common/resource';
import {CriticalError} from '@marginly/common/error';
import {timeoutRetry} from '@marginly/common/execution';
import {
    createRootLogger,
    interceptConsole,
    jsonFormatter,
    LogFormatter,
    textFormatter,
} from '@marginly/logger';
import {loadConfig, parseConfig} from "./config";
import {OracleWorker} from "./worker";
import { stdOutWriter } from '@marginly/logger-node';

function createLogFormatter(format: 'text' | 'json'): LogFormatter {
    return format === 'text' ? textFormatter : jsonFormatter;
}

// function experiments(logger: Logger) {
//     {
//         twapFromTickCumulatives([12384833891471n,12384845956271n], [60n,0n])
//     }
// }

async function main(): Promise<void> {
    const config = parseConfig(loadConfig());

    const rootLogger = createRootLogger(
        'marginlyOracle',
        stdOutWriter(createLogFormatter(config.log.format)),
        config.log.level
    );

    try {
        rootLogger.info('Starting service');

        let worker: OracleWorker | undefined;

        process.on('SIGTERM', () => {
            rootLogger.info('On sigterm');
            worker?.requestStop();
        });

        process.on('SIGINT', () => {
            rootLogger.info('On sigint');
            worker?.requestStop();
        });

        await using(rootLogger.scope('console'), async consoleLogger => {
            await using(interceptConsole(consoleLogger), async () => {
                const executor = timeoutRetry({
                    timeout: {
                        errorClass: CriticalError,
                    },
                    retry: {
                        errorClass: CriticalError,
                        logger: rootLogger
                    },
                });

                worker = new OracleWorker(config, rootLogger, executor);

                rootLogger.info('Service started');
                await worker.run();
                // experiments(rootLogger);

            });
        });
    } catch (error) {
        rootLogger.augmentError(error);
        rootLogger.fatal(error);
        process.exitCode = 1;
    } finally {
        rootLogger.info('Service stopped');
        rootLogger.close();
        process.exit();
    }
}

main();
