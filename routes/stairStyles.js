let express = require('express');
let router = express.Router();

let authMiddleware = require('../middlewares/authenticaion');
let stairStylesHandler = require('../handlers/stairStyles');

router.get('/', authMiddleware, stairStylesHandler.getStairStyles);

module.exports = router;