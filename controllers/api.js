var path = require('path');
var expressSession = require('express-session');
var bodyParser = require('body-parser');
var socketioJwt = require("socketio-jwt");
var Game = require('../models/game');
var crypto = require('crypto');
var cookieParser = require('cookie-parser');


module.exports = function(app, io, connections, subscribersOf, sockets){
  var keys = {"Roll, Dog": new Buffer('realkeyhere')}
  var developmentKey = new Buffer('realkeyhere');

  app.use(bodyParser.json());
  app.use(cookieParser());
  app.use(expressSession({secret: 'adkjsfalcmweoincawec', resave: false, saveUninitialized: true}));

  app.post('/api/whoami', function(req, res){
    if(req.body.user == req.session.username){
      var data = {'user': req.session.username, 'room': req.session.room, 'game': req.session.game}
      encryptProvidedKey(developmentKey, data, function(tkn){
        data['token'] = tkn;
        console.log(data);
        res.send(data);
      });
    } else {
      res.send("ERRRRRROR");
    }
  })

  app.post('/api/whoishere', function(req, res){
    if (req.body.user == req.session.username){
      var users = [];

      Game.findOne({title: req.body.game}, function(err, game){
        game.rooms[req.body.room].forEach(function(user){
          users.push(sockets[user]);
        })
        res.send(users);
      })
    }
  })

  app.post('/api/winner', function(req, res){
    encryptProvidedKey(developmentKey, req.body, function(c){
      if(c == req.body.token){
        Game.findOne({title: req.body.game}, function(err, game){
          game.rooms[req.body.room].forEach(function(user){
            connections[sockets[user]].forEach(function(socket){
              console.log("Sending " + connections[sockets[user]] + " aaway");
              socket.emit('back-to-lobby', req.body.user);
            })
          })
        })
      }
    })
    res.send("Nothing");
  })


  app.post('/updatesession', function(req, res){
    if(req.body.user == req.session.username){
      req.session.game = req.body.game;
      req.session.room = req.body.room;
      res.send("Ok")
    }
  })

  function encryptProvidedKey(key, data, cb){
    var cipher = crypto.createCipher('aes256', key);
    var crypted = cipher.update(data['user'].toString() + data['room'].toString(), 'utf-8', 'hex');
    crypted += cipher.final('hex');

    return cb(crypted);
  }

}
