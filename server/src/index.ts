import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

import cors from 'cors';
import express from 'express';
import { getDatabase } from './db/database';
import authRoutes from './routes/auth_routes';
import bookmarkRoutes from './routes/bookmarks';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/auth', authRoutes);
app.use('/bookmarks', bookmarkRoutes);

app.listen(PORT, async () => {
  await getDatabase();
  console.log(`Server running on port ${PORT}`);
});
