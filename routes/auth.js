let express = require('express');
let router = express.Router();

let authHandler = require('../handlers/auth');

router.post('/', authHandler.check);

module.exports = router;