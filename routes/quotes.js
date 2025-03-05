let express = require('express');
let router = express.Router();

let authMiddleware = require('../middlewares/authenticaion');
let quotesHandler = require('../handlers/quotes');

router.get('/', authMiddleware, quotesHandler.getQuotes);

module.exports = router;