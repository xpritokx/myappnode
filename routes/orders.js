let express = require('express');
let router = express.Router();

let authMiddleware = require('../middlewares/authenticaion');
let ordersHandler = require('../handlers/orders');

router.get('/:id', authMiddleware, ordersHandler.getOrdersByNumber);
router.get('/', authMiddleware, ordersHandler.getOrders);
router.post('/', authMiddleware, ordersHandler.createOrder);
router.delete('/order/:orderNumber', authMiddleware, ordersHandler.deleteOrder);
router.delete('/stair/:stairNumber', authMiddleware, ordersHandler.deleteStair);

module.exports = router;