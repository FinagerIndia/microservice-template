import express, { Express } from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import Respond from '@/lib/respond';
import serveEmojiFavicon from '@/middlewares/serveEmojiFavicon';
import requestLogger from '@/middlewares/requestLogger';
import { errorHandler } from '@/middlewares/error-handler';
import jwksVerifier from '@/middlewares/jwks-verifier';
import compression from 'compression';
import router from '@/modules';
import { toNodeHandler } from 'better-auth/node';
import { auth } from '@/lib/auth';
import { sessionDeserializer } from '@/middlewares/sessionDeserializer';
import requireUser from '@/middlewares/requireUser';

const allowedOrigins = [
  // Development
  'exp://192.168.29.36:8081',
  'exp://localhost:8081',
  'http://localhost:8081',
  'http://10.0.2.2:8081',
  'http://localhost:3000',
  'http://localhost:3030',
];

export function createRouter(): Express {
  return express();
}

export default function createApp() {
  const app = createRouter();

  app.use(compression());
  app.use(requestLogger());
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
  app.use(cookieParser());
  app.all('/api/auth/*splat', toNodeHandler(auth));
  app.use(express.json({ limit: '2048mb' }));

  // Apply urlencoded middleware to all routes except file uploads
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/v1/files/upload')) {
      // Skip urlencoded middleware for file upload routes
      next();
    } else {
      express.urlencoded({ extended: true, limit: '2048mb' })(req, res, next);
    }
  });

  app.use(serveEmojiFavicon('🔥'));
  app.get('/', (_, res) => {
    Respond(res, { message: 'API services are nominal!!' }, 200);
  });
  app.use(sessionDeserializer);
  app.use('/api/v1', requireUser, router);

  app.use(errorHandler);
  return app;
}
