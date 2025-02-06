let express = require('express');
let router = express.Router();

let authMiddleware = require('../middlewares/authenticaion');
let materialsHandler = require('../handlers/materials');

router.get('/', authMiddleware, materialsHandler.getMaterials);

module.exports = router;