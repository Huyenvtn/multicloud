var redirect = require('../controllers/redirect.controller')

module.exports.signup = function (app, passport) {
    app.get('/signup', redirect.signup);
    app.post('/signup', passport.authenticate('local-signup', {
        successRedirect: '/signin', 
        failureRedirect: '/signup', 
        failureFlash: true 
    }));
}
