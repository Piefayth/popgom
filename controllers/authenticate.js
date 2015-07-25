var LOGIN_REJECT_TEXT = "Hm, I don't see that on here - Are you sure your username and password are correct?";
var path = require('path');
var db = require('../controllers/db');
var User = require('../models/user');
var bodyParser = require('body-parser');
var expressSession = require('express-session');
var cookieParser = require('cookie-parser');
var jwt = require('jsonwebtoken');

module.exports = function(app){

  app.use(bodyParser.json({limit: '50mb'}));
  app.use(cookieParser());
  app.use(expressSession({secret: 'adkjsfalcmweoincawec', resave: false, saveUninitialized: true}));

  function rejectLogin(req, res){
    req.session.authenticated = false;
    res.status(200).send({"auth": false, "text": LOGIN_REJECT_TEXT});
  }

  app.post('/login', function(req, res){

    var myParser = bodyParser.json();
    if(req.body[0]['value'] !== '' && req.body[1]['value'] !== ''){
      User.findOne({username: req.body[0]['value'] }, function(err, user){
        if (err) console.log(err);

        if (user !== null){
          user.comparePassword(req.body[1]['value'], function(err, isMatch){
            if (err) console.log(err);
            if (isMatch){
              req.session.username = req.body[0]['value'];
              req.session.authenticated = true;
              var response = {
                username: req.session.username,
                auth: true
              };
              var token = jwt.sign(response, 'realsignaturehere');
              res.status(200).send({"auth": true, "text": "Welcome, " + req.session.username + "!", token: token });
            } else {   rejectLogin(req, res); }
          });
        } else {   rejectLogin(req, res); }
      })
    } else { rejectLogin(req, res); }
  })



  app.post('/register', function(req, res){

    req.session.authenticated = false;

    var myparser = bodyParser.json();
    var incUser = new User({
      username: req.body[0]['value'],
      password: req.body[1]['value'],
      email: req.body[3]['value']
    });
    console.log(incUser);
    if (req.body[1]['value'] != req.body[2]['value']){
      res.status(200).send({"auth": false, "text": "Double check that your passwords match."});
    } else{
    incUser.save(function(err){
        if (err) {
          res.status(200).send({"auth": false, "text": "That didn't save due to " + err});
        } else {
          req.session.username = req.body[0]['value'];
          req.session.authenticated = true;
          var response = {
            username: req.session.username,
            auth: true
          };
          var token = jwt.sign(response, 'realsignaturehere');
          res.status(200).send({"auth": true, "text": "Thanks for signing up, " + req.session.username + "!", token: token });
        }
      })
    }
  })

  app.get('/logout', function(req, res){
    req.session.destroy();
    res.render('loginform.ejs', {root: path.join(__dirname, '../views')})
  })

  app.get('/register', function(req, res){
    res.render('register.ejs', {root: path.join(__dirname, '../views')})
  })

  app.get('/auth', function(req, res){
    console.log(req.session);
    if (req.session !== null) {
      var response = {
        username: req.session.username,
        auth: true
      };
      var token = jwt.sign(response, 'realsignaturehere');
      res.send({auth: req.session.authenticated, token: token});
    }
  })

  app.get('/whoami', function(req, res){
    if (req.session !== null){
      res.send(req.session.username);
    }
  })

}
