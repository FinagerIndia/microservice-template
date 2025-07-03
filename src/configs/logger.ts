import * as fs from 'fs';
import * as path from 'path';
import * as log4js from 'log4js';

const logDir = path.resolve(__dirname, '../../logs');

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

log4js.configure({
  appenders: {
    out: { type: 'stdout', layout: { type: 'colored' } },
    errorlogs: {
      type: 'file',
      filename: path.join(logDir, 'error.log'),
      layout: { type: 'colored' },
    },
    warnlogs: {
      type: 'file',
      filename: path.join(logDir, 'warn.log'),
      layout: { type: 'colored' },
    },
    debuglogs: {
      type: 'file',
      filename: path.join(logDir, 'debug.log'),
      layout: { type: 'colored' },
    },
    fatallogs: {
      type: 'file',
      filename: path.join(logDir, 'fatal.log'),
      layout: { type: 'colored' },
    },
    infologs: {
      type: 'file',
      filename: path.join(logDir, 'info.log'),
      layout: { type: 'colored' },
    },
  },
  categories: {
    default: {
      appenders: [
        'out',
        'errorlogs',
        'warnlogs',
        'debuglogs',
        'fatallogs',
        'infologs',
      ],
      level: 'debug',
    },
  },
});

const logger = log4js.getLogger();
export default logger;
