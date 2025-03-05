let express = require('express');
let router = express.Router();

let authMiddleware = require('../middlewares/authenticaion');
let modelsHandler = require('../handlers/models');

// router.get('/', authMiddleware, modelsHandler.getModelsForDropdown);
router.get('/all', authMiddleware, modelsHandler.getAllModels);
router.post('/', authMiddleware, modelsHandler.addModel);
router.delete('/:id', authMiddleware, modelsHandler.removeModel);

module.exports = router;