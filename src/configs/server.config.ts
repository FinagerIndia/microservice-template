import express, { Express } from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import Respond from '@/lib/respond';
import serveEmojiFavicon from '@/middlewares/serveEmojiFavicon';
import requestLogger from '@/middlewares/requestLogger';
import { errorHandler } from '@/middlewares/error-handler';
import jwksVerifier from '@/middlewares/jwks-verifier';
import router from '@/modules';

const allowedOrigins = ['http://localhost:3000'];

export function createRouter(): Express {
  return express();
}

export default function createApp() {
  const app = createRouter();

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'", "'unsafe-inline'", 'data:', 'https:', 'http:'],
          scriptSrc: ["'self'", "'unsafe-inline'", 'data:', 'https:', 'http:'],
          styleSrc: ["'self'", "'unsafe-inline'", 'data:', 'https:', 'http:'],
          imgSrc: ["'self'", 'data:', 'https:', 'http:', 'blob:'],
          connectSrc: [
            "'self'",
            ...allowedOrigins,
            'https:',
            'http:',
            'ws:',
            'wss:',
          ],
          fontSrc: ["'self'", 'https:', 'http:', 'data:'],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'", 'data:', 'https:', 'http:'],
          frameSrc: ["'self'", 'data:', 'https:', 'http:'],
          workerSrc: ["'self'", 'blob:'],
          childSrc: ["'self'", 'blob:'],
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginOpenerPolicy: { policy: 'unsafe-none' },
    })
  );
  app.use(cookieParser());
  app.use(express.json({ limit: '2048mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2048mb' }));
  app.use(requestLogger());
  app.use(
    cors({
      credentials: true,
      origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
    })
  );
  app.use(serveEmojiFavicon('🔥'));
  app.get('/', (_, res) => {
    Respond(res, { message: 'API services are nominal!!' }, 200);
  });
  app.use(jwksVerifier());
  app.use('/api/v1', router);

  app.use(errorHandler);
  return app;
}
