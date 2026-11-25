import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import routes from './routes/index.js';
import { notFound, errorHandler } from './middleware/error.js';

const app = express();

if (env.NODE_ENV === 'production') app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({ origin: env.FRONTEND_ORIGIN.split(',').map((origin) => origin.trim()) }));
app.use(express.json({ limit: '100kb' }));

if (env.NODE_ENV !== 'test') {
  app.use(
    '/api',
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 300,
      message: { error: { code: 'RATE_LIMITED', message: 'Too many requests, please try again later' } },
    })
  );
}

app.use('/api', routes);
app.use(notFound);
app.use(errorHandler);

export default app;
