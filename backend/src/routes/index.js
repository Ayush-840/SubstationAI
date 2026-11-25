import { Router } from 'express';
import { query } from '../db/pool.js';
import authRoutes from './auth.js';
import usersRoutes from './users.js';
import equipmentRoutes from './equipment.js';
import testsRoutes from './tests.js';
import chatRoutes from './chat.js';

const router = Router();

router.get('/health', (req, res) => res.json({ status: 'ok' }));

router.get('/ready', async (req, res) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'ready' });
  } catch {
    res.status(503).json({ error: { code: 'NOT_READY', message: 'Database unavailable' } });
  }
});

router.use('/auth', authRoutes);
router.use('/users', usersRoutes);
router.use('/equipment', equipmentRoutes);
router.use('/tests', testsRoutes);
router.use('/chat', chatRoutes);

export default router;
