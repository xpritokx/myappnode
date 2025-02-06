let express = require('express');
let router = express.Router();

let authMiddleware = require('../middlewares/authenticaion');
let riserTypesHandler = require('../handlers/riserTypes');

router.get('/', authMiddleware, riserTypesHandler.getRiserTypes);

module.exports = router;