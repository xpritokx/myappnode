let express = require('express');
let router = express.Router();

let authMiddleware = require('../middlewares/authenticaion');
let stringersStylesHandler = require('../handlers/stringerStyles');

router.get('/', authMiddleware, stringersStylesHandler.getStringerStyles);

module.exports = router;