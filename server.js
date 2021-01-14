'use strict';

require('dotenv').config()

var createError = require('http-errors');
var express = require('express');
var app = express();
var path = require('path');
var mongoose = require('mongoose');
var passport = require('passport');
var flash = require('connect-flash');  
const cookieSession = require('cookie-session') 

var morgan = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var session = require('express-session');

const mongoStore = require('connect-mongo')(session);

var indexRoute = require('./routes/index.routes');
var logoutRoute = require('./routes/logout.routes');
var dashboardRoute = require('./routes/dashboard.routes');
var aboutUsRoute = require('./routes/aboutUs.routes');
var auth = require('./middlewares/auth.middle');
const fileUpload = require('express-fileupload')

var server = require('http').createServer(app);

//connect to mongodb database
mongoose.connect(process.env.MONGO_URL, {useNewUrlParser: true});
mongoose.connection.once('open', () => {
    console.log("Database Connection Established Successfully!");
});


// configuration ===============================================================

// parse application/json
app.use(morgan('dev')); 
app.use(cookieParser());
app.use(bodyParser()); 
// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '/public')));

// app.use(cookieSession({
//     keys: [process.env.SECRET]
// }))

//CONFIG APP
app.set('view engine', 'ejs');
app.set('views', './views')

app.use(session({
    name : 'userCookie',
    secret : process.env.SECRET,
    resave : true,
    saveUninitialized: false,
    store : new mongoStore({mongooseConnection : mongoose.connection})
})); 

app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions
app.use(flash()); // use connect-flash for flash messages stored in session 

//file upload
app.use(fileUpload({
    useTempFiles: true
}));
//app.use(fileUpload());

//authentication
auth.passportAuth(passport);

// routes ======================================================================
app.use('/', indexRoute);
app.use('/dashboard', auth.isLoggedIn, dashboardRoute);
app.use('/aboutUs', aboutUsRoute);
app.use('/logout', logoutRoute);
require('./routes/signin.routes').signin(app, passport); 
require('./routes/signup.routes').signup(app, passport);
require('./routes/facebook.routes').signin(app, passport); 
require('./routes/google.routes').signin(app, passport); 
require('./routes/onedrive.routes').signin(app, passport); 
require('./routes/dropbox.routes').signin(app, passport); 
// catch 404 and forward to error handler
app.use(function(req, res, next) {
    next(createError(404));
});
  
app.use(function(req, res, next){
    res.locals.messages = req.flash();
    next();
});

// error handler
app.use(function(err, req, res, next) {
// set locals, only providing error in development
    res.locals.error = req.app.get('env') === 'development' ? err : {};
    // render the error page
    res.status(err.status || 500);
    res.render('error');
});
  
server.listen(process.env.PORT || 3000, () => console.log('Server is listening on ' + process.env.PORT || 3000));
