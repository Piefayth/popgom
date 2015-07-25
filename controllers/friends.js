var path = require('path');
var expressSession = require('express-session');
var User = require('../models/user');
var bodyParser = require('body-parser');

module.exports = function(app, io, connections, subscribersOf, sockets){

  app.use(expressSession({secret: 'adkjsfalcmweoincawec', resave: false, saveUninitialized: true}));
  app.use(bodyParser.json({limit: '50mb'}));

  app.get('/friendslist', function(req, res){
    if (req.session !== undefined){
      User.findOne({username: req.session.username}, function(err, user){
        user.getFriends(req.session.username, function(friends){
          res.render('friendslist.ejs', {root: path.join(__dirname, '../views'), friends: friends});
        });
      });
    }
  })

  app.post('/addfriend', function(req, res){
    if (req.session !== undefined){
      addFriend(req.session.username, req.body[0]['value'], function(err, success, addedfriend){
        res.json({success: success, addedfriend: addedfriend, response: err});
      })
    } else {
        res.json({success: false, addedfriend: null, response: "Unable to add friend. Please log in."});
      }
  })


  function addFriend(username, friendToAdd, callback){
    if (username == friendToAdd) { return callback("You can't be friends with yourself!", false, null) }
    User.findOne({username: username}, function(err, user){
      if (err) console.log(err);
      User.findOne({username: friendToAdd}, function(err, friend){
        if (err) console.log(err);
        if (friend === null) {
          return callback("User does not exist.", false, null);
        } else if (user.friends.indexOf(friend.username) != -1) {
          return callback("User " + friend.username + " is already on your friends list.", false, null);
        } else {
          user.addFriend(friendToAdd, function(err){
            if (err) console.log(err);
            if(connections[friendToAdd]){
              connections[friendToAdd].forEach(function(socket){
                console.log("Sending Connect Message To: " + friendToAdd);
                socket.emit('friendconnect', username);
              });
            }
            return callback("", true, friendToAdd);
          });
        }
      })
    })
  }

}
