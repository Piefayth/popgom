var express = require('express');
var app = express();
var path = require('path');
var server = require('http').Server(app);
//var io = require('socket.io')(server);
var io = require('socket.io')(server, {resource: '/popgom/socket.io'});
var connections = [];
var subscribersOf = [];
var sockets = new Object;

require('./controllers/main')(app);
require('./controllers/authenticate')(app);
require('./controllers/friends')(app, io, connections, subscribersOf, sockets);
require('./controllers/connections')(app, io, connections, subscribersOf, sockets);
require('./controllers/games')(app, io, connections, subscribersOf, sockets);
require('./controllers/api')(app, io, connections, subscribersOf, sockets);

app.use(express.static(path.join(__dirname, 'public')));

app.set('view engine', 'ejs');



server.listen(3001, function(){
	console.log('My app cums on u');
})

app.use(function(err, req, res, next){
	res.status(500);
	res.send(err.message);
})
