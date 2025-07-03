import { Request, Response, NextFunction, RequestHandler } from 'express';
import logger from '@/configs/logger';
import chalk from 'chalk';
import env from '@/configs/env';

const ignorePaths = ['/favicon.ico', '/health'];

const requestLogger = (): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (ignorePaths.includes(req.path) || env.NODE_ENV === 'production') {
      return next();
    }
    const start = Date.now();
    const requestId = Math.random().toString(36).substring(7);

    // Capture response
    const originalSend = res.send;
    res.send = function (body) {
      const responseTime = Date.now() - start;
      const statusColor =
        res.statusCode >= 400
          ? chalk.red
          : res.statusCode >= 300
            ? chalk.yellow
            : chalk.green;
      const contentType = res.getHeader('content-type')?.toString() || '';

      // Format the log message for CLI
      const logMessage = [
        '\n' +
          chalk.cyan(
            '┌─────────────────────────────────────────────────────────────'
          ),
        chalk.cyan('│') +
          '  ' +
          chalk.bold('Request ID: ') +
          chalk.gray(requestId),
        chalk.cyan('│') + '  ' + chalk.bold('PID: ') + chalk.gray(process.pid),
        chalk.cyan(
          '├─────────────────────────────────────────────────────────────'
        ),
        chalk.cyan('│') + '  ' + chalk.bold('Request Details:'),
        chalk.cyan('│') +
          '  ' +
          chalk.bold('  Method: ') +
          chalk.blue(req.method),
        chalk.cyan('│') + '  ' + chalk.bold('  URL: ') + chalk.blue(req.url),
        chalk.cyan('│') + '  ' + chalk.bold('  IP: ') + chalk.blue(req.ip),
        chalk.cyan('│') +
          '  ' +
          chalk.bold(
            '  Headers: ' + chalk.yellow(JSON.stringify(req.headers, null, 2))
          ),
        chalk.cyan('│') +
          '  ' +
          chalk.bold(
            '  Query: ' + chalk.yellow(JSON.stringify(req.query, null, 2))
          ),
        chalk.cyan('│') +
          '  ' +
          chalk.bold(
            '  Body: ' + chalk.yellow(JSON.stringify(req.body, null, 2))
          ),
        chalk.cyan(
          '├─────────────────────────────────────────────────────────────'
        ),
        chalk.cyan('│') + '  ' + chalk.bold('Response Details:'),
        chalk.cyan('│') +
          '  ' +
          chalk.bold('  Status: ') +
          statusColor(res.statusCode),
        chalk.cyan('│') +
          '  ' +
          chalk.bold('  Time: ') +
          chalk.yellow(`${responseTime}ms`),
        chalk.cyan('│') +
          '  ' +
          chalk.bold(
            '  Headers: ' +
              chalk.yellow(JSON.stringify(res.getHeaders(), null, 2))
          ),
        chalk.cyan('│') +
          '  ' +
          chalk.bold('  Body: ' + chalk.yellow(JSON.stringify(body, null, 2))),
        chalk.cyan(
          '└─────────────────────────────────────────────────────────────\n'
        ),
      ].join('\n');

      logger.info(logMessage);

      return originalSend.call(this, body);
    };

    next();
  };
};

export default requestLogger;
