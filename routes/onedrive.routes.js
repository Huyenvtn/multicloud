var File = require('../models/files.model');


module.exports.signin = function (app, passport) {
    app.get('/auth/onedrive', passport.authenticate('onedrive'));
    app.post('/auth/onedrive/callback',
        passport.authenticate('onedrive', {
            successRedirect: '/dashboard',
            failureRedirect: '/signin',
            failureFlash: true
        }));
    app.get('/unlink/onedrive/:index', function(req, res) {
        var user = req.user;
        index = req.params.index; 
        driveID = user.onedrive[index].id;
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

                user.onedrive.splice(index, 1);
                user.save( function(err) {
                    req.session.user = user;
                    res.redirect('/dashboard');
                });
            })

        }, (err) => console.log('Can not delete file'));   
    });  
}   