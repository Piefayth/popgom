var path = require('path');
var expressSession = require('express-session');

module.exports = function(app){

  app.use(expressSession({secret: 'adkjsfalcmweoincawec', resave: false, saveUninitialized: true}));

  app.get('/', function(req, res){
    var auth = false;
    if (req.session !== undefined) auth = req.session.authenticated;
    res.render('index.ejs', {root: path.join(__dirname, '../views'), auth: auth, username: req.session.username});
  })

  app.get('/homebar', function(req, res){
    res.render('homebar.ejs', {root: path.join(__dirname, '../views'), username: req.session.username})
  })

}
