const express = require('express');
const trainerController = require('../controllers/trainerController');
const workoutController = require('../controllers/workoutController');
const { requireAuth } = require('../middleware/auth');
const { requireTrainer } = require('../middleware/roles');
const { validateRequest } = require('../middleware/validation');
const { workoutPlanValidator } = require('../validators/workoutValidators');

const router = express.Router();

router.use(requireAuth, requireTrainer);

router.get('/dashboard', trainerController.dashboard);
router.get('/clients', trainerController.listClients);
router.get('/clients/:id', trainerController.viewClient);

router.get('/plans/create', workoutController.showCreatePlan);
router.post('/plans/create', workoutPlanValidator, validateRequest, workoutController.createPlan);

module.exports = router;
