let express = require('express');
let router = express.Router();

let authMiddleware = require('../middlewares/authenticaion');
let ordersHandler = require('../handlers/orders');

router.get('/', authMiddleware, ordersHandler.getOrders);

module.exports = router;