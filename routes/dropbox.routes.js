var File = require('../models/files.model');



module.exports.signin = function (app, passport) {
    app.get('/auth/dropbox', passport.authenticate('dropbox'));
    app.get('/auth/dropbox/callback',
        passport.authenticate('dropbox', {
            successRedirect: '/dashboard',
            failureRedirect: '/signin',
            failureFlash: true,
        }));
    app.get('/unlink/dropbox/:index', function(req, res) {
        var user = req.user;
        index = req.params.index; 
        driveID = user.dropbox[index]._id;
        File.deleteMany({
            $and : [
                {'driveID': {$size:1}}, 
                {'driveID': driveID}
            ]
        })
        .then(() => {
            File.find({'driveID': driveID}, function (err, listFile) {
                if (err){
                    return err;
                }
                
                listFile.map((file) => {
                    var indexDriveID = file.driveID.indexOf(driveID);
                    if (indexDriveID !== -1){
                        file.driveID.splice(indexDriveID, 1);
                        file.save(function (err) {
                            if (err) throw err;
                        });
                    }     
                });
            })

            user.dropbox.splice(index, 1);
            user.save( function(err) {
                req.session.user = user;
                res.redirect('/dashboard');
            });
        }, (err) => console.log('Can not delete file'));   
    });
}   