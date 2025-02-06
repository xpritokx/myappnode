let express = require('express');
let router = express.Router();

let authMiddleware = require('../middlewares/authenticaion');
let ordersHandler = require('../handlers/orders');

router.get('/:id', authMiddleware, ordersHandler.getOrdersByNumber);
router.get('/', authMiddleware, ordersHandler.getOrders);
router.post('/', authMiddleware, ordersHandler.createOrder);
router.post('/stair', authMiddleware, ordersHandler.createOrder);
router.post('/image/:id', authMiddleware, ordersHandler.uploadImage);
router.delete('/image/:id', authMiddleware, ordersHandler.removeImage);
router.delete('/order/:orderNumber', authMiddleware, ordersHandler.deleteOrder);
router.delete('/stair/:stairNumber', authMiddleware, ordersHandler.deleteStair);
router.put('/stair/:id', authMiddleware, ordersHandler.updateStair);

module.exports = router;