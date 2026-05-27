import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

import express from 'express';
import authRoutes from './routes/auth_routes';
import './db/database';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/auth', authRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
