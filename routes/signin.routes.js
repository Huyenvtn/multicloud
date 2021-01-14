var redirect = require('../controllers/redirect.controller')

module.exports.signin = function (app, passport) {
    app.get('/signin', redirect.signin);
    app.post('/signin', passport.authenticate('local-signin', {
        successRedirect: '/dashboard', 
        failureRedirect: '/signin', 
        failureFlash: true 
        }));
}