let express = require('express');
let router = express.Router();

let authMiddleware = require('../middlewares/authenticaion');
let customersHandler = require('../handlers/customers');

router.get('/', authMiddleware, customersHandler.getCustomersForDropdown);
router.get('/all', authMiddleware, customersHandler.getAllCustomers);
router.post('/', authMiddleware, customersHandler.addCustomer);
router.put('/:id', authMiddleware, customersHandler.updateCustomer);
router.delete('/:id', authMiddleware, customersHandler.deleteCustomer);

module.exports = router;