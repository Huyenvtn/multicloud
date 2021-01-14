module.exports.signin = function (app, passport) {
    app.get('/auth/facebook', passport.authenticate('facebook', {scope: ['email']}));
    app.get('/auth/facebook/callback',
        passport.authenticate('facebook', {
            successRedirect: '/dashboard',
            failureRedirect: '/'
        })
    );
}