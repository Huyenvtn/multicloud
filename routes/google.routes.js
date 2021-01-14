var File = require('../models/files.model');

module.exports.signin = function (app, passport) {
    // app.get('/auth/google', passport.authenticate('google', {scope: ['profile', "https://www.googleapis.com/auth/drive" , 'email']}));
    app.get('/auth/google', passport.authenticate('google', {
        scope: ['profile', "https://www.googleapis.com/auth/drive", 'email'], 
        accessType: 'offline',
        prompt: 'consent'
    }));
    app.get('/auth/google/callback',
        passport.authenticate('google', {
            successRedirect: '/dashboard',
            failureRedirect: '/signin'
        }));
    app.get('/unlink/google/:index', function (req, res) {
        var user = req.user;
        index = req.params.index;
        driveID = user.google[index].id;
        File.deleteMany({
            $and: [
                { 'driveID': { $size: 1 } },
                { 'driveID': driveID }
            ]
        }).then(() => {
                File.find({ 'driveID': driveID }, function (err, listFile) {
                    if (err) {
                        return err;
                    }

                    listFile.map((file) => {
                        var indexDriveID = file.driveID.indexOf(driveID);
                        if (indexDriveID !== -1) {
                            file.driveID.splice(indexDriveID, 1);
                            file.save(function (err) {
                                if (err) throw err;
                            });
                        }
                    });
                })

                user.google.splice(index, 1);
                user.save(function (err) {
                    res.redirect('/dashboard');
                });
                req.session.user = user;
            }, (err) => console.log('Can not delete file'));
    });
}   