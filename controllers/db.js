var mongoose = require('mongoose');
mongoose.connect('mongodb://localhost/test');
var db = mongoose.connection;
module.exports = db;

db.on('error', console.error.bind(console, 'Connection Error:'));
db.once('open', function(cb){
  console.log("Successfully opened.");
})
