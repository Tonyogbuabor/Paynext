import express from 'express';
import { router as apiRouter } from '../server/routes.ts';

const app = express();

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Mount all API routes under /api
app.use('/api', apiRouter);

export default app;
