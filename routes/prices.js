let express = require('express');
let router = express.Router();

let authMiddleware = require('../middlewares/authenticaion');
let pricesHandler = require('../handlers/prices');

router.get('/', authMiddleware, pricesHandler.getAllPrices);
router.get('/:orderNum', authMiddleware, pricesHandler.getPricesByOrderNum);
router.put('/:id', authMiddleware, pricesHandler.changePrice);

module.exports = router;