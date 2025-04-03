let express = require('express');
const router = express.Router();

let authMiddleware = require('../middlewares/authenticaion');

router.get('/', (req, res) => {
    res.status(200).send({
        status: 'ok'
    });
});

router.get('/api/config', authMiddleware, (req, res) => {
    res.status(200).send({
        mode: 'development'
    });
});


module.exports = router;
