var Game = require('../models/game');
var path = require('path');
var bodyParser = require('body-parser');
var expressSession = require('express-session');
var cookieParser = require('cookie-parser');
var socketioJwt = require("socketio-jwt");

module.exports = function(app, io, connections, subscribersOf, sockets){

  io.use(socketioJwt.authorize({
    secret: 'realsignaturehere',
    handshake: true
  }));

  /* DEVELOPMENT ONLY - EMPTY ROOMS */

  Game.find().find(function(err, games){
    console.log(games);
    games.forEach(function(game){
      game['rooms'] = {};
      game.markModified('rooms');
      game['maxSize'] = 3;
      game.save();
    })
  })
  /*Game.find().find(function(err, games){
    games.forEach(function(game){
      game.roomCount = 1;
    })
  })*/
  /* DEVELOPMENT ONLY - REMOVE AND REPOPULATE SAMPLE GAMES
  Game.find().remove(function(err, callback){
    if (err) console.log(err);
  });*/

  //Roll, Dog | Additional Game Name | Delete These | Awesome Game | Possum Game | Digman's Digging | Cool Snowman Goes to College

  app.use(bodyParser.urlencoded({extended: false}));
  app.use(cookieParser());
  app.use(expressSession({secret: 'adkjsfalcmweoincawec', resave: false, saveUninitialized: true}));

  app.get('/mainmenu', function(req, res){
    res.render('mainmenu.ejs', {root: path.join(__dirname, '../views')})
  });

  app.get('/gamescarousel', function(req, res){
    Game.find().exec(function(err, data){
      var games = [];
      data.forEach(function(item){
        games.push(item['title']);
      });
      res.render('gamescarousel.ejs', {root: path.join(__dirname, '../views'), games: games})
    })
  })

  app.post('/startgame', function(req, res){
    Game.findOne({title: req.body.title}, function(err, game){
      if (game && !err){
        res.render('startgame.ejs', {root: path.join(__dirname, '../views'), game: game.title})
      }
    });
  });

  app.post('/joingame', function(req, res){
    Game.findOne({title: req.body.title}, function(err, game){
      if (game && !err){
        res.render('joingame.ejs', {root: path.join(__dirname, '../views'), game: game.title})
      }
    })
  })

  app.post('/joinroom', function(req, res){
    Game.findOne({title: req.body.title}, function(err, game){
      if (game && !err){
        if(game.rooms[req.body.roomname]){
          res.render('joingame.ejs', {root: path.join(__dirname, '../views'), game: game.title})
        }
      }
    })
  })

  io.on('connection', function(socket){

    socket.on('startgame', function(gamename){
      Game.findOne({title: gamename}, function(err, game){
        game.generateNewRoomKey(function(err, key){
          game.addRoom(key, socket.id, function(){
            if (err) {
              socket.emit('starterror', err);
            } else {
              socket.join(key);
              socket.emit('startsuccess', {gamename: gamename, roomname: key});
              io.sockets.in(key).emit('userjoined', sockets[socket.id]);
              socket.emit('acknowledgehost', sockets[game.rooms[key][0]]);
            }
          });
        })
      })
    });

    //TODO: Shift duplicate user handling into Game model by tracking User attendance within the model
    socket.on('joingame', function(gamename){
      Game.findOne({title: gamename}, function(err, game){
        game.pairUserToRoom(socket.id, function(err, room){
          var amIHereTwice = 0;
          if(!err){
            game.rooms[room].forEach(function(socketid){
              if(sockets[socketid] && (sockets[socketid] == sockets[socket.id])){
                amIHereTwice++;
              }
            })
            if(amIHereTwice == 2){
              game.rooms[room].splice(game.rooms[room].indexOf(socket.id), 1);
              game.markModified('rooms');
              game.save(function(err){
                if(!err) err = "You are already in this room.";
                socket.emit('joinerror', err);
              });
            }
          }
          if (err) {
              socket.emit('joinerror', err);
            } else if (amIHereTwice < 2) {
              socket.join(room);
              console.log("Joining: " + room);
              socket.emit('joinsuccess', {gamename: gamename, roomname: room});
              io.sockets.in(room).emit('userjoined', sockets[socket.id]);
              socket.emit('acknowledgehost', sockets[game.rooms[room][0]]);
            }
        })
      });
    })

    socket.on('joinroom', function(data){
      Game.findOne({title: data['gamename']}, function(err, game){
        game.rooms[data['roomname']].forEach(function(socketid){
          if(sockets[socketid] && (sockets[socketid] == sockets[socket.id])){
            err = "You are already in this room.";
            socket.emit('joinerror', err);
          }
        })
        if(!err){
          game.addUserToRoom(socket.id, data['roomname'], function(err, room){
            if(err){
              socket.emit('joinerror', err);
            } else {
              socket.join(room);
              socket.emit('joinsuccess', {gamename: data['gamename'], roomname: data['roomname']});
              io.sockets.in(room).emit('userjoined', sockets[socket.id]);
              socket.emit('acknowledgehost', sockets[game.rooms[room][0]]);
            }
          })
        }
      })
    });


    socket.on('whoshere', function(){
      var userlist = []
      socket.rooms.forEach(function(room){
        var clients_in_the_room = io.sockets.adapter.rooms[room];
        for (var clientId in clients_in_the_room){
          if(userlist.indexOf(sockets[clientId]) == -1){
            userlist.push(sockets[clientId]);
          }
        }
      })
      console.log("Userlist: " + userlist);
      socket.emit('wearehere', userlist);
    })

    socket.on('gamechatmessage', function(data){
      if(data['username'] == socket.decoded_token.username){
        if(verifySocketInRoom(socket, data['room'])){
          response = {username: data['username'], message: data['message']}
          io.sockets.in(data['room']).emit('gamechatresponse', response);
        }
      }
    });

    socket.on('timechange', function(data){
      Game.findOne({title: data['game']}, function(err, game){
        if(game.rooms[data['room']][0] == socket.id){
          io.sockets.in(data['room']).emit('timeupdate', {time: data['time']});
        }
      })
    })

    socket.on('opengame', function(data){
      Game.findOne({title: data['game']}, function(err, game){
        if(game.rooms[data['room']] == socket.id || game.rooms[data['room']][0] == socket.id){
          io.sockets.in(data['room']).emit('game_begin_event', {game: game.title, room: data['room']});
        }
      })
    })

  })

  function verifySocketInRoom(socket, room){
    console.log(room);
    var res = false;
    var theseSockets = io.sockets.adapter.rooms[room];
    for (var index in theseSockets){
        console.log(index);
        if(index == socket.id){ res = true; }
    }
    return res;
  }
}
