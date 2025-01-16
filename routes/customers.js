let express = require('express');
let router = express.Router();

let authMiddleware = require('../middlewares/authenticaion');
let customersHandler = require('../handlers/customers');

router.get('/', authMiddleware, customersHandler.getCustomers);

module.exports = router;