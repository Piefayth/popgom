var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var bcrypt = require('bcrypt');

var UserSchema = new Schema({
  username: {type: String, required: true, index: {unique: true}},
  password: {type: String, required: true},
  email: {type: String, required: true},
  friends: [],
  rankings: {} //format: gamename: ranking
});

UserSchema.pre('save', function(next){

  var user = this;

  if (!user.isModified('password')) return next();

  bcrypt.genSalt(10, function(err, salt){
    if (err) return next(err);

    bcrypt.hash(user.password, salt, function(err, hash){
      if(err) return next(err);

      user.password = hash;
      next();
    });
  });
});

UserSchema.methods.comparePassword = function(inputPassword, callback){
  bcrypt.compare(inputPassword, this.password, function(err, isMatch){
    if (err) return callback(err);
    callback(null, isMatch);
  });
};

UserSchema.methods.getFriends = function (username, callback){
  return callback(this.friends);
}

UserSchema.methods.addFriend = function (friendToAdd, callback){
  this.friends.push(friendToAdd);
  this.save(function(err){
    return callback(err);
  });
}

UserSchema.methods.getRanking = function(game, callback){
  return callback(this.rankings[game]);
}

UserSchema.methods.updateRanking = function(game, data, callback){
  this.rankings[game] = data;
  this.save(function(err){
    return callback(err);
  });
}


module.exports = mongoose.model('User', UserSchema);
