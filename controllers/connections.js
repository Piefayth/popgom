var path = require('path');
var expressSession = require('express-session');
var User = require('../models/user');
var bodyParser = require('body-parser');
var socketioJwt = require("socketio-jwt");
var games = require('./games');
var Game = require('../models/game');

module.exports = function(app, io, connections, subscribersOf, sockets){
  io.use(socketioJwt.authorize({
    secret: 'realsignaturehere',
    handshake: true
  }));

  io.on('connection', function(socket){

    socket.on('click', function(){
      sendToSubscribers(socket, 'friendclick', sockets[socket.id]);
    })

    socket.on('identify', function(username){
      if ( connections[username] && sockets[socket.id] != username ){
        if(connections[username].indexOf(socket) == -1){
          connections[username].push(socket);
        }
      } else {
        connections[username] = [socket]; //index of username = array of a single socket
      }
      if (sockets[socket.id] != username){
        sockets[socket.id] = username;
      }
      User.findOne({username: username}, function(err, user){
        if (err) console.log(err);
        user.getFriends(username, function(friends){
          friends.forEach(function(friend){
            User.findOne({username: friend}, function(err, frienduser){
              frienduser.getFriends(friend, function(friendfriends){
                if(friendfriends.indexOf(username) != -1){
                  console.log("---ADDRESSING " + username + "'s CONNECTION---");
                  console.log(friendfriends);
                  console.log(frienduser.username);
                  if(subscribersOf[friend]){
                    if(subscribersOf[friend].indexOf(username) == -1){
                      subscribersOf[friend].push(username);
                    }
                  } else {
                    subscribersOf[friend] = [username];
                  }
                  if(subscribersOf[username]){
                    if(subscribersOf[username].indexOf(friend) == -1){
                      subscribersOf[username].push(friend)
                    }
                  } else {
                    subscribersOf[username] = [friend];
                  }
                }
                if(connections[friend] && connections[friend].length > 0 && friendfriends.indexOf(username) != -1){
                  console.log(friend + " number of connections " + connections[friend].length);
                  socket.emit('friendconnect', friend);
                }
              })
            })
          });
          sendToSubscribers(socket, 'friendconnect', sockets[socket.id]);
        });
      });
    });

    socket.on('disconnect', function(msg){
      gameDisconnectHandler(socket, function(){
        if (sockets[socket.id]){
          var username = sockets[socket.id];
          console.log('User ' + username + ' has disconnected. ' + connections[username].length + ' connections remaining.')
          //If the user only has one connection left, send the disconnect event to his subscribers
          if (connections[username].length == 1){
            sendToSubscribers(socket, 'frienddisconnect', username);
          }

          //Get the friends of the user who disconnected and unsubscribe them
          User.findOne({username: username}, function(err, user){
            user.getFriends(username, function(friends){
              friends.forEach(function(friend){
                if(subscribersOf[friend]){
                  if(subscribersOf[friend].indexOf(username) != -1){
                    subscribersOf[friend].splice(subscribersOf[friend].indexOf(username), 1);
                  }
                }
              });
              //Remove the connection
              for(var key in connections){
                if(key != 0){
                  connections[key].forEach(function(socketInConnections, index){
                    if (socketInConnections.id == socket.id || socketInConnections == null){
                      connections[key].splice(index, 1);
                      delete sockets[socketInConnections.id];
                    }
                  });
                }
              }
            });
          });
        }
      })
    });

    socket.on('leavingroom', function(data){
      //data['username'], data['room'], data['game']
      Game.findOne({title: data['game']}).exec(function(err, game){
        game.removeUserFromOneRoom(socket.id, data['room'], function(err){
          if (err) console.log(err)
          io.sockets.in(data['room']).emit('userleft', data['username']);
          io.sockets.in(data['room']).emit('acknowledgehost', sockets[game.rooms[data['room']][0]]);
        })
      })
    })

    socket.on('friendmessage', function(data){
      generateMessageResponse('friendmessage', data, socket);
    })

    socket.on('invitemessage', function(data){
      generateMessageResponse('invitemessage', data, socket);
    })

  });

  function generateMessageResponse(messagetype, data, socket){
    var msg = data['message']
    var receiversockets = connections[data['receiver']];
    if(receiversockets.length > 0)console.log("Number of Recipient Connections: " + receiversockets.length);
    var sendersockets = connections[sockets[socket.id]];
    console.log("Number of Sender Connections: " + sendersockets.length);
    sendersockets.forEach(function(s){console.log(s.id)});
    if (msg && (receiversockets || sendersockets)){
      if(messagetype == 'friendmessage')
        var message = {msg: msg, receiver: data['receiver'], sender: sockets[socket.id]};
      else
        var message = {msg: msg, receiver: data['receiver'], sender: sockets[socket.id], gamename: data['gamename'], roomname: data['roomname']}

      if (sendersockets.length > 0){
        sendersockets.forEach(function(socket){
          socket.emit(messagetype + 'response', message);
        });
        if (! receiversockets.length > 0 ){
          sendersockets.forEach(function(socket){
            message['msg'] = "This user is offline and did not recieve your message.";
            socket.emit(messagetype + 'response', message);
          });
        }
      }
      if (receiversockets.length > 0){
        receiversockets.forEach(function(socket){
          socket.emit(messagetype + 'response', message);
        });
      }
    }
  }

  function usernameBySocket(socket, callback){
    return sockets[socket.id];
  }

  function sendToSubscribers(socket, event, data){
    if (usernameBySocket(socket)) {
      var username = usernameBySocket(socket);
      if (subscribersOf[username]){
        subscribersOf[username].forEach(function(friend){
          if (connections[friend]){
            connections[friend].forEach(function(socket){
              socket.emit(event, data);
            })
          }
        })
      }
    }
  }

  function gameDisconnectHandler(socket, callback){
    var socketid = socket.id;
    var leavingUser = sockets[socketid];
    console.log("User Who Is Leaving: ");
    console.log(sockets);
    i = 1;

    Game.find().exec(function(err, data){
      data.forEach(function(game){
        game.removeUserFromAllRooms(socketid, function(err, removedFrom){
          removedFrom.forEach(function(roomid){
            console.log("userlist before and after leave");
            console.log(io.sockets.adapter.rooms)
            socket.leave(roomid);
            console.log(io.sockets.adapter.rooms)
            io.sockets.in(roomid).emit('userleft', leavingUser);
            io.sockets.in(roomid).emit('acknowledgehost', sockets[game.rooms[roomid][0]]);
          });
          if(i >= data.length)
            callback();
          else
            i++;
        });
      });
    });
  }
}
