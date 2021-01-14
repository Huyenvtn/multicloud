var LocalStrategy = require('passport-local').Strategy;
var FacebookStrategy = require('passport-facebook').Strategy;
var GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;
var OIDCStrategy = require('passport-azure-ad').OIDCStrategy;
var User = require('../models/users.model');
var File = require('../models/files.model');
var config = require('../config');
var googleController = require('../controllers/google.controller');
const oneDriveController = require('../controllers/oneDrive.controller');
var DropboxOAuth2Strategy  = require('passport-dropbox-oauth2').Strategy;
const dropboxV2Api = require('dropbox-v2-api');
var dropboxController = require('../controllers/dropbox.controller');
var refresh = require('passport-oauth2-refresh');

module.exports.passportAuth = (passport, next) => {

    passport.serializeUser(function (user, done) { 
        done(null, user.id);
    });

    passport.deserializeUser(function (id, done) {
        User.findById(id, function (err, user) {
            done(err, user);
        });
    });

    // LOCAL SIGNUP ============================================================

    passport.use('local-signup', new LocalStrategy({
            usernameField: 'email',
            passwordField: 'password',
            passReqToCallback: true 
        },
        function (req, email, password, done) {
            process.nextTick(function () {
                User.findOne({'local.email': email}, function (err, user) {
                    if (err)
                        return done(err);
                    if (password !== req.body.passwordConfirm) {
                        return done(null, false, req.flash('signupMessage', 'Mật khẩu và Mật khẩu xác nhận không trùng khớp :(')); 
                    }   
                    if (user) {
                        return done(null, false, req.flash('signupMessage', 'Email này đã có tài khoản sử dụng :('));
                    } else {  
                        var newUser = new User();
                        newUser.local.email = email;
                        newUser.local.password = newUser.generateHash(password);
                        newUser.local.name    = req.body.name;
                        newUser.local.phoneNumber    = req.body.phoneNumber;
                        newUser.local.activeStatus = true;

                        newUser.save(function (err, newUser) {
                            if (err)
                                throw err;
                            return done(null, newUser);
                        });
                    }
                });
            });
        }));
    
    // LOCAL SIGNIN =============================================================
    passport.use('local-signin', new LocalStrategy({
        usernameField: 'username',
        passwordField: 'password',
        passReqToCallback: true
    },
        function (req, username, password, done) { 
            //process.nextTick(function () {
                User.findOne({ $or: [{'local.email': username},{'local.phoneNumber': username}]}, function (err, user) {
                    if (err) {
                        return done(err);
                    }
                    if (!user) {
                        return done(null, false, req.flash('signinMessage', 'Không tìm thấy người dùng với thông tin đã nhập :('));
                    }
                    if (!user.validPassword(password)) {
                        return done(null, false, req.flash('signinMessage', 'Ồ ! Sai mật khẩu :(')); 
                    }
                    req.session.user = user;
                    return done(null, user);
                });
        //});
    }));

    // FACEBOOK SIGNUP ============================================================
    passport.use(new FacebookStrategy({
        clientID: config.facebookAuth.clientID,
        clientSecret: config.facebookAuth.clientSecret,
        callbackURL: config.facebookAuth.callbackURL,
        profileFields: ['id','displayName','email','first_name','last_name','middle_name'],
        passReqToCallback: true
    },
    function (req, token, refreshToken, profile, done) {
        process.nextTick(function () {
                User.findOne({'facebook._id': profile.id}, function (err, user) {
                    if (err)
                        return done(err);
                    if (user) {
                        req.session.user = user
                        return done(null, user); 
                    } else {
                        var newUser = new User();
                        newUser.facebook.id = profile.id;
                        newUser.facebook.token = token;
                        newUser.facebook.name = profile.name.givenName + ' ' + profile.name.familyName; 
                        newUser.facebook.email = profile.emails[0].value; 
                        newUser.save(function (err) {
                            if (err) {
                                throw err;
                            }   
                        });
                        req.session.user = newUser
                        return done(null, newUser);
                    }
                });
        });
    }));

    // GOOGLE  ============================================================
    let googleStrategy = new GoogleStrategy({
        clientID: config.googleAuth.clientID,
        clientSecret: config.googleAuth.clientSecret,
        callbackURL: config.googleAuth.callbackURL,
        passReqToCallback: true,
        accessType: 'offline',
        prompt : 'consent'
    },
    function (req, token, refreshToken, profile, done) {
        process.nextTick(function () {
                User.findOne({'google._id': profile.id}, async function (err, user) {
                    if (err)
                        return done(err, req.flash('error', "Đăng nhập thất bại :("));
                    if (!user) { 
                        console.log(refreshToken);
                        //save files of drive to database
                        const listFiles = await googleController.getListFiles(token, refreshToken, req);
                        const infoDrive = await googleController.getInfoDrive(token, refreshToken, req);
                        //console.log(listFiles);
                        // refresh Files of drive 
                        await new File().refreshFilesSchema(listFiles, profile.id, "google-drive", infoDrive);

                        //create new user
                        newUser = await new User().createGoogleUser(profile.id, token, refreshToken, profile.displayName, profile.emails[0].value, infoDrive, req);

                        req.session.user = newUser;
                        return done(null, newUser, req.flash('success', "Đăng nhập thành công !"));
                    } else { // Have a user signed
                        //get index user in google[]
                        index = getIndexDriveUser(user.google, profile.id);

                        //update files of drive to database
                        const listFiles = await googleController.getListFiles(token, refreshToken, req);
                        driveID = user.google[index]._id;
                        await File.deleteMany({$and : [{'driveID': {$size:1}}, {'driveID': driveID}]}, function(err) {
                            File.find({'driveID': driveID}, async function (err, listFile) {
                                if (err){
                                    return err;
                                }
                                
                                //remove driveID from array
                                await listFile.map((file) => {
                                        var indexDriveID = file.driveID.indexOf(user.google[index]._id);
                                        if (indexDriveID !== -1){
                                            file.driveID.splice(indexDriveID, 1);
                                            file.save(function (err) {
                                                if (err) throw err;
                                            });
                                        }     
                                });
                                await new File().refreshFilesSchema(listFiles, profile.id, "google-drive");
                                
                                //save session user with new token
                                user.google[index].token = token; 
                                user.save(function (err) {
                                    if (err) throw err;
                                }); 

                                req.session.user = user;
                                return done(null, user, req.flash('success', "Đăng nhập thành công !")); 
                            });
                        });
                    }
                });
            }) 
    });
    passport.use('google', googleStrategy);
    refresh.use(googleStrategy);

    // DROPBOX  ============================================================
    passport.use('dropbox', new DropboxOAuth2Strategy({
        apiVersion: '2',
        clientID: config.dropboxAuth.clientID,
        clientSecret: config.dropboxAuth.clientSecret,
        callbackURL: config.dropboxAuth.callbackURL,
        noImplicitAny: false,
        passReqToCallback: true,
    },
    function (req, token, refreshToken, profile, done) {
        process.nextTick(function () {
            User.findOne({'dropbox._id': profile.id}, async function (err, user) {//989
                if (err)
                    return done(err);
                if (! user) {
                    console.log (token + "token nha");

                        const listFiles = await dropboxController.expData(token);
                        const infoDrive = await dropboxController.getInfoDrive(token);

                    console.log ("ghhj " + listFiles + "list fiel nha");

                        // refresh Files of drive 
                        new File().refreshFilesSchema(listFiles, profile.id, "dropbox");

                        //create new user

                        newUser = await new User().createDropboxUser(profile.id, token, refreshToken, profile.displayName, profile.emails[0].value, infoDrive, req);

                        req.session.user = newUser;
                        return done(null, newUser);
                            
                } else {
                    console.log (token + "fgh");
                        //get index user in google[]
                        index = getIndexDriveUser(user.dropbox, profile.id);

                        //update files of drive to database
                        const listFiles = await dropboxController.expData(token);
                        driveID = user.dropbox[index]._id;
                        await File.deleteMany({$and : [{'driveID': {$size:1}}, {'driveID': driveID}]}, function(err) {
                            File.find({'driveID': driveID}, async function (err, listFile) {
                                if (err){
                                    return err;
                                }
                                
                                //remove driveID from array
                                await listFile.map((file) => {
                                        var indexDriveID = file.driveID.indexOf(user.dropbox[index]._id);
                                        if (indexDriveID !== -1){
                                            file.driveID.splice(indexDriveID, 1);
                                            file.save(function (err) {
                                                if (err) throw err;
                                            });
                                        }     
                                });
                                new File().refreshFilesSchema(listFiles, profile.id, "dropbox");
                            });
                        });

                        //save session user with new token
                        user.dropbox[index].token = token; 
                        user.save(function (err) {
                            if (err) throw err;
                        }); 

                        req.session.user = user;
                        return done(null, user);              //save files of drive to database
                }
            });
        });
    }));


    // ONE_DRIVE  ============================================================
    passport.use('onedrive', new OIDCStrategy(
        {
          identityMetadata: `${config.oneDriveAuth.authority}${config.oneDriveAuth.idMetadata}`,
          clientID: config.oneDriveAuth.clientID,
          responseType: 'code id_token',
          responseMode: 'form_post',
        //   nonceLifetime: 86400000,  // state/nonce cookie expiration in seconds
        //   nonceMaxAmount: 5,   // max amount of state/nonce cookie you want to keep (cookie is deleted after validation so this can be very small)
        //   useCookieInsteadOfSession: true,  // use cookie, not session
        //   cookieEncryptionKeys: [ 
        //     { 'key': '12345678901234567890123456789012', 'iv': '123456789012' },
        //     { 'key': 'abcdefghijklmnopqrstuvwxyzabcdef', 'iv': 'abcdefghijkl' }
        //   ],
          redirectUrl: config.oneDriveAuth.callbackURL,
          allowHttpForRedirectUrl: true,
          clientSecret: config.oneDriveAuth.clientSecret,
          validateIssuer: false,
          passReqToCallback: true,
          scope: config.oneDriveAuth.scopes.split(' '),
          prompt : 'consent'
        },
        async function (req, iss, sub, profile, token, refreshToken, done) {
            if (!profile.oid) {
                return done(new Error("No OID found in user profile."));
            }
            
            try{
                const user = await oneDriveController.getUserDetails(token);
                console.log(user);
                if (user) {
                // Add properties to profile
                profile['email'] = user.mail ? user.mail : user.userPrincipalName;
                }
            } catch (err) {
                return done(err);
            }
            //console.log(profile);
            process.nextTick(function () {
                User.findOne({'onedrive._id': profile.oid}, async function (err, user) {
                if (err)
                    return done(err);
                if (!user) { 
                    console.log(refreshToken);
                    //save files of drive to database
                    
                    // Get the files
                    const listFiles = await oneDriveController.getAllItem(token);
                    const infoDrive = await oneDriveController.getInfoDrive(token);
                    //console.log(listFiles);
                    // refresh Files of drive 
                    await new File().refreshFilesSchema(listFiles, profile.oid, "onedrive");

                    //create new user
                    newUser = await new User().createOneDriveUser(profile.oid, token, refreshToken, profile.displayName, profile.email, infoDrive, req);

                    req.session.user = newUser;
                    return done(null, newUser);
                } else { // Have a user signed
                    //get index user in onedrive[]
                    index = getIndexDriveUser(user.onedrive, profile.oid);

                    //update files of drive to database
                    const listFiles = await oneDriveController.getAllItem(token);
                    driveID = user.onedrive[index]._id;
                    await File.deleteMany({$and : [{'driveID': {$size:1}}, {'driveID': driveID}]}, function(err) {
                        File.find({'driveID': driveID}, async function (err, listFile) {
                            if (err){
                                return err;
                            }
                            
                            //remove driveID from array
                            await listFile.map((file) => {
                                    var indexDriveID = file.driveID.indexOf(user.onedrive[index]._id);
                                    if (indexDriveID !== -1){
                                        file.driveID.splice(indexDriveID, 1);
                                        file.save(function (err) {
                                            if (err) throw err;
                                        });
                                    }     
                            });

                            await new File().refreshFilesSchema(listFiles, profile.oid, "onedrive");
                        });
                    });

                    //save session user with new token
                    user.onedrive[index].token = token; 
                    user.save(function (err) {
                        if (err) throw err;
                    }); 

                    req.session.user = user;
                    return done(null, user); 
                }
                });
            });
        }
    ));
}

function getIndexDriveUser(arr, id) {
    return arr.findIndex((account, index, array) => {
        if (account._id == id)
            return account;
        return false;
    });  
}

module.exports.isLoggedIn = (req, res, next) => {
    if (req.user) {
        return next();
    }
    res.redirect('/');
}