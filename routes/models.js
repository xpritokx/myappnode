let express = require('express');
let router = express.Router();

let authMiddleware = require('../middlewares/authenticaion');
let modelsHandler = require('../handlers/models');

router.get('/', authMiddleware, modelsHandler.getModels);

module.exports = router;