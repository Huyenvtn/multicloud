const express = require('express');
const {google} = require('googleapis'); 
var aboutUsController= require('../controllers/aboutUs.controller');
var googleController= require('../controllers/google.controller');
var onedriveController= require('../controllers/oneDrive.controller');
var dropboxController= require('../controllers/dropbox.controller');var auth = require('../middlewares/auth.middle');
const fs = require('fs');
var async = require("async");

var router = express.Router();

router.get('/', aboutUsController.aboutUs);

module.exports = router;