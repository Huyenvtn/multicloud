module.exports = {
    index: (req, res) => {
        res.render('home_Page');
    },
    signin: (req, res) => {
        res.render('signin_Page', {message: req.flash('signinMessage')});
    },

    signup: (req, res) => {
        res.render('signup_Page', {message: req.flash('signupMessage')});
    },
    logout: (req, res) => {
        res.clearCookie('userCookie');
        req.logout();
        res.redirect('/');
    }
}


