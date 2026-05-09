import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import healthRoute from './routes/health.js';
import adminRoute from './routes/admin.js';
import lookupRoute from './routes/lookup.js';
import checkinRoute from './routes/checkin.js';
import registerRoute from './routes/register.js';

const app = express();
const PORT = process.env.PORT || 4000;
const EVENT_TOKEN = process.env.EVENT_TOKEN;

if (!EVENT_TOKEN) {
  throw new Error('Missing EVENT_TOKEN in environment');
}

// CLIENT_ORIGIN supports a comma-separated list, e.g.:
// https://ladiesconference-psi.vercel.app,http://localhost:5173
const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.set('trust proxy', true);
app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (curl, Postman, server-to-server)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
}));
app.use(express.json({ limit: '32kb' }));

app.use('/api', healthRoute);
app.use('/api', adminRoute);

app.use('/api', (req, res, next) => {
  const token = req.header('x-event-token');
  if (token !== EVENT_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
});

app.use('/api', lookupRoute);
app.use('/api', checkinRoute);
app.use('/api', registerRoute);

app.use((err, _req, res, _next) => {
  console.error('[server error]', err);
  res.status(500).json({
    error: 'server_error',
    message: 'Something went wrong. Please try again.'
  });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
