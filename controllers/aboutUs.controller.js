var googleController= require('../controllers/google.controller');
var onedriveController= require('../controllers/oneDrive.controller');
var dropboxController= require('../controllers/dropbox.controller');
const {google} = require('googleapis'); 
var File = require('../models/files.model');
var User = require('../models/users.model');
var fs = require('fs');
const os = require('os');
var path = require('path');
const nodemailer = require('nodemailer');
var config = require('../config');
var refresh = require('passport-oauth2-refresh');

module.exports = {
    aboutUs: async (req, res) => {

        res.render('about_us');
    },
}
