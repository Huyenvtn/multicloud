const express = require('express');

var redirect = require('../controllers/redirect.controller');

var router = express.Router();

router.get('/', redirect.logout);

module.exports = router;