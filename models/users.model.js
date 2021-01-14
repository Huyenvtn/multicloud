var mongoose = require('mongoose');
var bcrypt = require('bcrypt-nodejs');

var userSchema = mongoose.Schema({
    local: {
        email: {type:String, default: ""},
        password: {type:String, default: ""},
        name: {type:String, default: ""},
        phoneNumber: { type:String, default: "" },
        activeStatus: {type:Boolean, default: false}
    },
    facebook: {
        _id: {type:String},
        token: {type:String, default: ""},
        email: {type:String, default: ""},
        name: {type:String, default: ""}
    },
    google: [{
        _id: {type:String},
        token: {type:String, default: ""},
        refreshToken: {type:String, default: ""},
        email: {type:String, default: ""},
        name: {type:String, default: ""},
        typeCloud: {type:String, default: "google_drive"},
        limit:{type:String, default: ""},
        usage:{type:String, default: ""},
    }],
    onedrive: [{
        _id: {type:String},
        token: {type:String, default: ""},
        refreshToken: {type:String, default: ""},
        email: {type:String, default: ""},
        name: {type:String, default: ""},
        typeCloud: {type:String, default: "onedrive"},
        limit:{type:String, default: ""},
        usage:{type:String, default: ""},
    }],
    
    dropbox: [{
        _id: {type:String},
        token: {type:String, default: ""},
        refreshToken: {type:String, default: ""},
        email: {type:String, default: ""},
        name: {type:String, default: ""},
        typeCloud: {type:String, default: "dropbox"},
        limit:{type:String, default: ""},
        usage:{type:String, default: ""},
    }],
    createDate : { type:Date, default:Date.now },
    modifiedDate : { type:Date, default:Date.now },
});

// methods ======================
// create hash chain
userSchema.methods.generateHash = function (password) {
    return bcrypt.hashSync(password, bcrypt.genSaltSync(8), null);
};
// compare password
userSchema.methods.validPassword = function (password) {
    return bcrypt.compareSync(password, this.local.password);
};

// create Google User
userSchema.methods.createGoogleUser = function (_id, token, refreshToken, name, email, infoDrive, req) {
    var newUser = (req.user) ? req.user : new mongoose.model('User', userSchema)();
    const length = (newUser.google.length) ? newUser.google.length : 0;
    var limit = infoDrive.limit ? infoDrive.limit : "Unlimited";
    var usage = infoDrive.usage;
    newUser.google[length] = { _id, token, refreshToken, name, email, limit, usage};

    newUser.save(function (err) {
        if (err) throw err;
    });
    
    return newUser;
};

// create Dropbox User
userSchema.methods.createDropboxUser = function (_id, token, refreshToken, name, email, infoDrive, req) {
    var newUser = (req.user) ? req.user : new mongoose.model('User', userSchema)();
    const length = (newUser.dropbox.length) ? newUser.dropbox.length : 0;

    var limit = infoDrive.allocation.allocated ? infoDrive.allocation.allocated : "Unlimited";
    var usage = infoDrive.used;
    newUser.dropbox[length] = { _id, token, refreshToken, name, email, limit, usage };

    newUser.save(function (err) {
        if (err) throw err;
    });
    
    return newUser;
};

// create OneDrive User
userSchema.methods.createOneDriveUser = function (_id, token, refreshToken, name, email, infoDrive, req) {
    var newUser = (req.user) ? req.user : new mongoose.model('User', userSchema)();
    const length = (newUser.onedrive.length) ? newUser.onedrive.length : 0;
    var limit = infoDrive.total ? infoDrive.total : "Unlimited";
    var usage = infoDrive.used;
    newUser.onedrive[length] = { _id, token, refreshToken, name, email, limit, usage };

    newUser.save(function (err) {
        if (err) throw err;
    });
    
    return newUser;
};
module.exports = mongoose.model('User', userSchema);