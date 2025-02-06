let express = require('express');
let router = express.Router();

let authMiddleware = require('../middlewares/authenticaion');
let stairTypesHandler = require('../handlers/stairTypes');

router.get('/', authMiddleware, stairTypesHandler.getStairTypes);

module.exports = router;