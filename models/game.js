var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var GameSchema = new Schema({
  title: {type: String, required: true, index: {unique: true}},
  rooms: {},
  maxSize: {type: Number, min: 1, max: 16},
  roomCount: {type: Number}
})

GameSchema.methods.addRoom = function (room, socketid, callback){
  if(!this.rooms) this.rooms = {};
  this.rooms[room] = [socketid]; //user joins
  console.log("New Room of ID: " + room);
  this.markModified('rooms');
  this.save(function(err){
    return callback(err);
  });
}

GameSchema.methods.pairUserToRoom = function(socketid, callback){
  var roomToJoin;
  console.log(this.rooms);
  for(var key in this.rooms){

    if(!this.rooms[key] || this.rooms[key].length == 0){
      delete this.rooms[key];
    } else if (this.rooms[key].length < this.maxSize){
      roomToJoin = key
      console.log("About to Join: " + roomToJoin + " with these participants: " + this.rooms[roomToJoin])
      this.rooms[roomToJoin].push(socketid);
      console.log("Room To Join: " + roomToJoin);
    }
  }
  this.markModified('rooms');
  this.save(function(err){
    if(!roomToJoin){
      err = "There was no available room.";
      roomToJoin = false;
    }
    callback(err, roomToJoin);
  })
}

GameSchema.methods.addUserToRoom = function(socketid, roomname, callback){
  var thiserr;

  if(this.rooms[roomname].length < this.maxSize){
    this.rooms[roomname].push(socketid);
  } else { thiserr = "The room you are attempting to join is full."}
  this.markModified('rooms');
  this.save(function(err){
    if(thiserr){
      callback(thiserr)
    } else{
      callback(err, roomname);
    }
  })
}

GameSchema.methods.removeUserFromAllRooms = function(socketid, callback){
  var removedFrom = [];

  for(var key in this.rooms){
    console.log("Checking room " + key + " for user " + socketid);
    var index = this.rooms[key].indexOf(socketid)
    if(index != -1){
      console.log("Removing User From Room: " + key);
      this.rooms[key].splice(index, 1);
      this.markModified('rooms');
      removedFrom.push(key);
    } else if (this.rooms[key] == socketid){
      console.log("Removing User From Room: " + this.rooms[key]);
      removedFrom.push(key);
      delete this.rooms[key];
      this.markModified('rooms');
    }
  }
  this.save(function(err){
    callback(err, removedFrom);
  });
}

GameSchema.methods.removeUserFromOneRoom = function(socketid, room, callback){
  this.rooms[room].splice(this.rooms[room].indexOf(socketid), 1);
  if(this.rooms[room] == []) { delete this.rooms[room] };
  this.markModified('rooms');
  this.save(function(err){
    callback(err);
  })
}

GameSchema.methods.generateNewRoomKey = function(callback){
  if(!this.roomCount) {
    this.roomCount = 1;
    console.log(this.roomCount);
  } else {
    this.roomCount += 1;
    console.log(this.roomCount);
  }
  var key = this.title + '' + this.roomCount;
  this.save(function(err){
    callback(err, key);
  });
}

module.exports = mongoose.model('Game', GameSchema);
