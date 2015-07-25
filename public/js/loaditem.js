(function (){

  var BOARD_STEP_FACTOR = 50;
  var BOARD_TILE_SIZE = 50;
  var HANDHOLDER_Y_OFFSET = 50;
  var BOARD_SIZE = 50;
  var UI_NUB_OFFSET = 22;
  var UI_NUB_RADIUS = 10;
  var GAME_FLAG_UPDATE = false;


  var token, username, room, game, scale;
  var stageOuter, background, stage, ui, handholder, canvas, grid, heldTile, board, hand, username;
  var mouse = {x: 100, y: 100};
  var uielements = {};
  var myname;
  var otherPlayers = [];

  var temp = [];
  for(var w = 0; w < BOARD_SIZE; w++){
    temp[w] = []
    for(var h = 0; h < BOARD_SIZE; h++){
      temp[w].push(0);
    }
  }
  board = temp;

  var popgom = new Popgom();

  $.post('api/whoami', popgom, function(res1){
    $.post('api/whoishere', popgom, function(res2){
      token = res1['token'];
      username = res1['user'];
      room = res1['room'];
      game = res1['game'];
      //socket = io('http://localhost:3002', {
      socket = io({
        multiplex: false,
        path: '/wordthing/socket.io',
        query: "token=" + token +
        "&username=" + username +
        "&room=" + room +
        "&game=" + game +
        "&players=" + res2});
      startGame();
    })
  });

  function startGame(){
    (function registerSocketEvents(){

      socket.on('initial-connect-success', function(data){
        username = data.me;
        otherPlayers = data.players;
        otherPlayers.splice(data.players.indexOf(username), 1);
        setTheStage(function(){
          socket.emit('ready-for-board');
        });
      });


      socket.on('board', function(board){
        socket.board = board;
        drawBoardGrid(socket);
      });



      socket.on('tiles-remaining', function(count){
        console.log("Tiles Left: " + count);
        uielements['remainingtiles'].text = "Tiles Left: " + count;
        stageOuter.update();
      })

      socket.on('player-tile-count', function(data){
        uielements[data.name].text = data.name.substr(0, 8) + ": " + data.count;
        stageOuter.update();
      });

      socket.on('winner-announcement', function(winner){
        console.log("Winner is: " + winner);
        uielements[winner].text = "WINNER";
        stageOuter.update();
        socket.emit('someone-won-response');
        stageOuter.removeAllChildren();
        stageOuter.update;
        stageOuter.off("stagemousemove");

        createjs.Ticker.removeEventListener("tick");

      })

      socket.on('give-tile', function(tile){


        if(!hand) hand = []

        var pos = null;

        hand.forEach(function(tih, index){
          if(!tih && pos === null){
            pos = index;
            console.log('setting pos to: ' + index);
          }
        });
        console.log("THE LENGTH OF THE HAND IS: " + hand.length);
        if (pos === null) { pos = hand.length }

        console.log("Position For New Tile: " + pos);

        if(typeof hand[pos] === "undefined"){
          hand.push(new createjs.Container());
        } else {
          hand[pos] = new createjs.Container();
        }
        var text = new createjs.Text(tile, "bold 40px Arial", "#FF7700");
        var shape = new createjs.Shape();

        shape.graphics.beginStroke("#000000").drawRect(
          0, 0, BOARD_TILE_SIZE, BOARD_TILE_SIZE
        );
        shape.graphics.beginFill("#CCCCCC").drawRect(
          0, 0, BOARD_TILE_SIZE, BOARD_TILE_SIZE
        );

        shape.cache(-2, -2, BOARD_TILE_SIZE + 4, BOARD_TILE_SIZE + 4);

        var tileInHand = hand[pos];




        tileInHand.x = (pos + 1) *BOARD_STEP_FACTOR;
        tileInHand.y = canvas.height - BOARD_TILE_SIZE - HANDHOLDER_Y_OFFSET;
        text.x = shape.x + (BOARD_TILE_SIZE/2 - text.getBounds().width/2);  //centering wizardry
        tileInHand.addChild(shape)
        tileInHand.addChild(text)

        tileInHand.addEventListener('mousedown', function(event){
          heldTile = event.target.parent;
          stageOuter.canvas.style.cursor = 'none';

          if(hand.indexOf(event.target.parent) == -1){

            var startX = event.target.parent.x / BOARD_TILE_SIZE;
            var startY = event.target.parent.y / BOARD_TILE_SIZE;;
            var startXAbs = startX + board.length/2;
            var startYAbs = startY;

            console.log("Lifting Square at: " + startXAbs + " | " + startYAbs);
            socket.emit('lift-square', {
              'letter': event.target.parent.getChildAt(1).text,
              'locationX': startXAbs,
              'locationY': startYAbs
            });
            board[startXAbs][startYAbs] = 0;
          }
        });

        tileInHand.addEventListener('pressup', function(event){

          GAME_FLAG_UPDATE = false;

          var garb = uielements['garbage'];

          stageOuter.canvas.style.cursor = 'auto';
          var origin = 'board';

          if(hand.indexOf(event.target.parent) != -1){
            hand[hand.indexOf(event.target.parent)] = null;
            origin = 'hand';
          }
          console.log(hand);

          var dropX = Math.round((event.stageX - grid.x)/BOARD_TILE_SIZE);
          var dropY = Math.round((event.stageY - grid.y)/BOARD_TILE_SIZE);
          var dropXAbs = dropX + Math.round(board.length/2);
          var dropYAbs = dropY;

          if(board[dropXAbs]){
            console.log("Dropping Square at: " + dropXAbs + " | " + dropYAbs);
            console.log("Currently Occupied By: " + board[dropXAbs][dropYAbs]);
          }
          heldTile = false;

          //If tile is over garbage...
          if(event.stageX > garb.x && event.stageX < garb.x + garb.image.width * garb.scaleX && event.stageY > garb.y && event.stageY < garb.y + garb.image.height){

            if(origin == 'hand'){
              hand[hand.indexOf(event.target.parent)] = null;
              ui.removeChild(event.target.parent);
            } else {
              grid.removeChild(event.target.parent);
            }
            socket.emit('recycle-letter', {'letter': event.target.parent.getChildAt(1).text, origin: origin})

            if(!GAME_FLAG_UPDATE) stageOuter.update();

          } else if(board[dropXAbs] && !board[dropXAbs][dropYAbs] && dropXAbs >= 0 && dropYAbs >= 0 && dropXAbs < BOARD_SIZE && dropYAbs < BOARD_SIZE){

            event.target.parent.x = dropX * BOARD_TILE_SIZE;
            event.target.parent.y = dropY * BOARD_TILE_SIZE;

            stageOuter.removeChild(event.target.parent);

            grid.addChild(event.target.parent);
            board[dropXAbs][dropYAbs] = event.target.parent;
            socket.emit('play-letter', {
              'letter': event.target.parent.getChildAt(1).text,
              'locationX': dropXAbs,
              'locationY': dropYAbs,
              origin: origin
            });
          } else {

            var pos = null;
            hand.forEach(function(tileInHand, index){
              if(!tileInHand && pos === null){
                pos = index;
              }
            });

            grid.removeChild(event.target.parent);
            ui.addChild(event.target.parent);
            event.target.parent.getChildAt(1).color = '#FF7700';
            event.target.parent.updateCache(-1, -1, BOARD_TILE_SIZE+2, BOARD_TILE_SIZE+2);
            console.log(pos);
            hand[pos] = event.target.parent;
            console.log(hand);
            socket.emit('return-to-hand', event.target.parent.getChildAt(1).text);
            tileInHand.x = (pos + 1) * BOARD_STEP_FACTOR;
            tileInHand.y = canvas.height - BOARD_TILE_SIZE - HANDHOLDER_Y_OFFSET;
          }

          if(!GAME_FLAG_UPDATE) stageOuter.update();
        });
        tileInHand.addEventListener('pressmove', function(event){
          updateHeldTile();
          GAME_FLAG_UPDATE = true;
        });
        tileInHand.cache(-1, -1, BOARD_TILE_SIZE+2, BOARD_TILE_SIZE+2);
        shape.cache(-1, -1, BOARD_TILE_SIZE+2, BOARD_TILE_SIZE+2)

        ui.addChild(tileInHand);
        if(!GAME_FLAG_UPDATE) stageOuter.update();
      });

      socket.on('play-letter-response', function(data){
        console.log(data);
        if(data.orientation == 'horizontal' && data.word.length > 1){
          for(var i = 0; i < data.word.length; i++){
            board[data.x + i][data.y].getChildAt(1).color = data.valid ? '#0F0' : '#F00';
            board[data.x + i][data.y]['valid'] = data.valid;
            board[data.x + i][data.y].updateCache(-1, -1, BOARD_TILE_SIZE+2, BOARD_TILE_SIZE+2);
            if(!GAME_FLAG_UPDATE) stageOuter.update();
          }
        } else if (data.word.length > 1) {
          for(var i = 0; i < data.word.length; i++){
            board[data.x][data.y + i].getChildAt(1).color = data.valid ? '#0F0' : '#F00';
            board[data.x][data.y + i]['valid'] = data.valid;
            board[data.x][data.y + i].updateCache(-1, -1, BOARD_TILE_SIZE+2, BOARD_TILE_SIZE+2);
            if(!GAME_FLAG_UPDATE) stageOuter.update();
          }
        } else {
          if(board[data.x-1] && board[data.x+1]){
            if(!board[data.x+1][data.y] && !board[data.x-1][data.y] && !board[data.x][data.y+1] && !board[data.x][data.y-1]){
              resetLetter(data.x, data.y);
            }
          } else if(board[data.x-1]){
              if(!board[data.x-1][data.y] && !board[data.x][data.y+1] && !board[data.x][data.y-1]){
                resetLetter(data.x, data.y);
              }
            } else if(board[data.x+1]){
              if(!board[data.x+1][data.y] && !board[data.x][data.y+1] && !board[data.x][data.y-1]){
                resetLetter(data.x, data.y);
              }
            }
          }

        if(!numTilesInHand() && !heldTile && data.orientation == "vertical"){
          if(isBoardValid()){
            console.log('attempting to validate board with server');
            socket.emit('validate-board');
          }
        }
      });

      function resetLetter(x, y){
        board[x][y].getChildAt(1).color = '#FF7700';
        board[x][y]['valid'] = false;
        board[x][y].updateCache(-1, -1, BOARD_TILE_SIZE+2, BOARD_TILE_SIZE+2);
        if(!GAME_FLAG_UPDATE) stageOuter.update();
      }

    })();
  }

  function numTilesInHand(){
    var num = 0;
    for(var i = 0; i < hand.length; i++){
      if(hand[i] != null){
        num++;
      }
    }
    return num;
  }

  function isBoardValid(){

    var start;
    var boardLetterCount = 0;
    var tempboard = [];

    for(var i = 0; i < board.length; i++){
      for(var j = 0; j < board[i].length; j++){
        if(board[i][j]){
          if(!board[i][j].valid)
            return false;
          if(!start)
            start = {x: i, y: j};
          if(!tempboard[i])
            tempboard[i] = [];
          tempboard[i][j] = board[i][j];
          boardLetterCount++;
        }
      }
    }

    var totalLetters = [];

    checkLetters(start);


    if(totalLetters.length == boardLetterCount){
      console.log("Board is Valid. Continue.");
      return true;
    }

    function checkLetters(start){
      if(tempboard[start.x + 1] && tempboard[start.x + 1][start.y] && tempboard[start.x + 1][start.y] != "CHECKED"){
        totalLetters.push(tempboard[start.x + 1][start.y]);
        tempboard[start.x + 1][start.y] = "CHECKED";
        checkLetters({x: start.x + 1, y: start.y});
      }
      if(tempboard[start.x - 1] && tempboard[start.x - 1][start.y] && tempboard[start.x - 1][start.y] != "CHECKED"){
        totalLetters.push(tempboard[start.x - 1][start.y]);
        tempboard[start.x - 1][start.y] = "CHECKED";
        checkLetters({x: start.x - 1, y: start.y});
      }
      if(tempboard[start.x][start.y + 1] && tempboard[start.x][start.y + 1] != "CHECKED"){
        totalLetters.push(tempboard[start.x][start.y + 1]);
        tempboard[start.x][start.y + 1] = "CHECKED";
        checkLetters({x: start.x, y: start.y + 1});
      }
      if(tempboard[start.x][start.y - 1] && tempboard[start.x][start.y - 1] != "CHECKED"){
        totalLetters.push(tempboard[start.x][start.y - 1]);
        tempboard[start.x][start.y - 1] = "CHECKED";
        checkLetters({x: start.x, y: start.y - 1});
      }

    }
  }

  function drawBoardGrid(socket){
    if(!grid) {
      grid = new createjs.Container();
    }
    for(var i = 0; i < socket.board.length; i++){
      console.log(socket.board.length);
      for(var j = 0; j < socket.board[i].length; j++){
        if(socket.board[i][j].uncache){
          socket.board[i][j].uncache();
          grid.removeChild(socket.board[i][j]);
        }
        socket.board[i][j] = new createjs.Shape();
        var ix = i < socket.board.length / 2 ? (Math.floor((socket.board.length)/2) - i) * -1  : i - Math.floor((socket.board.length)/2);
        socket.board[i][j].graphics.beginStroke("#000000").drawRect(
          Math.floor(ix*BOARD_STEP_FACTOR),
          Math.floor(j*BOARD_STEP_FACTOR),
          Math.floor(BOARD_TILE_SIZE),
          Math.floor(BOARD_TILE_SIZE));
          grid.addChild(socket.board[i][j]);
        socket.board[i][j].cache(ix*BOARD_STEP_FACTOR - 1, j*BOARD_STEP_FACTOR - 1, BOARD_TILE_SIZE + 2, BOARD_TILE_SIZE + 2)
      }
    }
    grid.x = (Math.floor(socket.board.length/2) * BOARD_TILE_SIZE)/2;
    grid.y = (Math.floor(socket.board[0].length/2) * BOARD_TILE_SIZE)/2 * -1;

    stage.addChild(grid);
    stage.addChild(ui);
    if(!GAME_FLAG_UPDATE) stageOuter.update();
  }
function setTheStage(cb){
  console.log('seting up');
    var RATIOWIDTH = 1600;
    var RATIOHEIGHT = 1000;

    $('#menuwrapper').append('<div id="gamewrapper"><canvas id="gamecanvas" width="1600" height="1000"></canvas></div>');
    $('#gamewrapper').css('width', $('#startgamemenu, #joingamemenu').width() - 450);
    $('#gamewrapper').css('height', $('#startgamemenu, #joingamemenu').height() - 100)
    canvas = document.getElementById("gamecanvas");
    canvas.width = $('#gamewrapper').width();
    canvas.height = $('#gamewrapper').height();

    window.addEventListener('resize', responsiveCanvas, false);

    stageOuter = new createjs.Stage('gamecanvas');
    background = new createjs.Shape();
    stage = new createjs.Container();
    stageOuter.addChild(stage);
    background.graphics.beginFill('white').drawRect(0, 0, 20000, 2000);
    stage.addChild(background);
    responsiveCanvas();

    ui = new createjs.Container();

    handholder = new createjs.Shape();
    handholder.graphics.beginFill('#ffcc00').drawRect(0, canvas.height - HANDHOLDER_Y_OFFSET - BOARD_TILE_SIZE, canvas.width, BOARD_TILE_SIZE);
    handholder.graphics.beginStroke('#aa0000').drawRect(-2, canvas.height - HANDHOLDER_Y_OFFSET - BOARD_TILE_SIZE-1, canvas.width+2, BOARD_TILE_SIZE+2);
    ui.addChild(handholder);
    handholder.cache(-2, canvas.height - HANDHOLDER_Y_OFFSET - BOARD_TILE_SIZE-2, canvas.width+2, BOARD_TILE_SIZE+4);

    createjs.Ticker.addEventListener("tick", function(event){
      updateGridLocation();
      if(GAME_FLAG_UPDATE){
        stageOuter.update();
      }
    });

    stageOuter.on("stagemousemove", function(event){
      if(stageOuter.mouseInBounds){
        mouse.x = event.stageX;
        mouse.y = event.stageY;
      }
    });


    createjs.Ticker.framerate = 60;

    return cb();


    function drawNames(){

      uielements['scoreboard'] = uielements['scoreboard'] || new createjs.Shape();
      uielements['scoreboard'].graphics.beginFill("#CCCCCC").drawRect(0, 0, 180, 30 * (otherPlayers.length + 2));
      uielements['scoreboard'].graphics.beginStroke("#000000").drawRect(1, 1, 181, 30 * (otherPlayers.length + 2));
      uielements['scoreboard'].cache(-1, -1, 184, 4 + (30 * (otherPlayers.length + 2)))
      stageOuter.addChild(uielements['scoreboard']);

      uielements['remainingtiles'] = uielements['remainingtiles'] || new createjs.Text("Tiles Left: ", "bold 24px Arial", "#000000");
      uielements['remainingtiles'].uncache();
      var b = uielements['remainingtiles'].getBounds();
      uielements['remainingtiles'].x = 20;
      stageOuter.addChild(uielements['remainingtiles']);

      uielements[username] = uielements[username] || new createjs.Text(username.substr(0, 8) + ": ", "normal 24px Arial", "#000000");
      uielements[username].uncache();
      var b = uielements[username].getBounds();
      uielements[username].x = 20;
      uielements[username].y = 30;
      stageOuter.addChild(uielements[username]);

      otherPlayers.forEach(function(player, index){
        uielements[player] = uielements[player] || new createjs.Text(player.substr(0, 8) + ": ", "normal 24px Arial", "#000000");
        uielements[player].uncache();
        var b = uielements[username].getBounds();
        uielements[player].x = 20;
        uielements[player].y = 60 + 30*index;
        stageOuter.addChild(uielements[player]);
      });
    }

    function updateGridLocation(){
      var updated = false;

      if(stageOuter.mouseInBounds && mouse.y < canvas.height - HANDHOLDER_Y_OFFSET && mouse.y > canvas.height - (HANDHOLDER_Y_OFFSET + handholder.getBounds().height)){
        if(mouse.x < 50){
          ui.x += 5;
          handholder.x -= 5;
          updated = true;
          highlightNub('handleft');
          highlightNub('gridleft', true);
          highlightNub('griddown', true);
        } else if (mouse.x > canvas.width - 50){
          ui.x -= 5;
          handholder.x += 5;
          updated = true;
          highlightNub('handright');
          highlightNub('gridright', true);
          highlightNub('griddown', true);
        } else {
          highlightNub('handleft', true);
          highlightNub('handright', true);
        }
        if (heldTile){
          updateHeldTile();
        }
      } else if(stageOuter.mouseInBounds){

          highlightNub('handleft', true);
          highlightNub('handright', true);

          if(mouse.x < 75){
            grid.x += 5;
            updated = true;
            highlightNub('gridleft');
          }
          if(mouse.x > canvas.width - 75){
            grid.x -= 5;
            updated = true;
            highlightNub('gridright');
          }
          if(mouse.y < 75){
            grid.y += 5;
            updated = true;
            highlightNub('gridup');
          }
          if(mouse.y > canvas.height - 50){
            grid.y -= 5;
            updated = true;
            highlightNub('griddown');
          }
          if(mouse.x > 75 && mouse.x < canvas.width - 75 && mouse.y > 75 && mouse.y < canvas.height - 50){
            highlightNub('gridleft', true);
            highlightNub('gridright', true);
            highlightNub('gridup', true);
            highlightNub('griddown', true);
          }
          if (heldTile){
            updateHeldTile();
          }
        } else {
          highlightNub('handleft', true);
          highlightNub('handright', true);
          highlightNub('gridleft', true);
          highlightNub('gridright', true);
          highlightNub('gridup', true);
          highlightNub('griddown', true);
        }
      if (updated) {
        if(!GAME_FLAG_UPDATE) stageOuter.update();
      }
    }

    function highlightNub(nub, dim){
      if(!dim){
        if(!uielements[nub]['highlighted']){
          if(nub == 'handleft' ){
            uielements['handleft'].graphics.c().beginFill('#ff9900').drawPolyStar(UI_NUB_RADIUS*2, canvas.height - HANDHOLDER_Y_OFFSET - 25, UI_NUB_RADIUS, 3, 0, 60)
            uielements['handleft'].graphics.beginStroke('#ff6600').drawPolyStar(UI_NUB_RADIUS*2, canvas.height - HANDHOLDER_Y_OFFSET - 25, UI_NUB_RADIUS, 3, 0, 60)
            uielements['handleft']['highlighted'] = true;
          } else if (nub == 'handright'){
            uielements['handright'].graphics.c().beginFill('#ff9900').drawPolyStar(canvas.width - UI_NUB_RADIUS*2, canvas.height - HANDHOLDER_Y_OFFSET - 25, UI_NUB_RADIUS, 3, 0, 120)
            uielements['handright'].graphics.beginStroke('#ff6600').drawPolyStar(canvas.width - UI_NUB_RADIUS*2, canvas.height - HANDHOLDER_Y_OFFSET - 25, UI_NUB_RADIUS, 3, 0, 120)
            uielements['handright']['highlighted'] = true;
          } else if (nub == 'gridleft'){
            uielements['gridleft'].graphics.c().beginFill('#DDDDDD').drawPolyStar(UI_NUB_OFFSET, (canvas.height/2) - UI_NUB_RADIUS/2, UI_NUB_RADIUS, 3, 0, 60);
            uielements['gridleft'].graphics.beginStroke('#000000').drawPolyStar(UI_NUB_OFFSET, (canvas.height/2) - UI_NUB_RADIUS/2, UI_NUB_RADIUS, 3, 0, 60);
            uielements['gridleft']['highlighted'] = true;
          } else if (nub == 'gridright'){
            uielements['gridright'].graphics.c().beginFill('#DDDDDD').drawPolyStar(canvas.width - UI_NUB_OFFSET,(canvas.height/2) - UI_NUB_RADIUS/2, UI_NUB_RADIUS, 3, 0, 120);
            uielements['gridright'].graphics.beginStroke('#000000').drawPolyStar(canvas.width - UI_NUB_OFFSET,(canvas.height/2) - UI_NUB_RADIUS/2, UI_NUB_RADIUS, 3, 0, 120);
            uielements['gridright']['highlighted'] = true;
          } else if (nub == 'gridup'){
            uielements['gridup'].graphics.c().beginFill('#DDDDDD').drawPolyStar(canvas.width/2 - UI_NUB_RADIUS/2 , UI_NUB_OFFSET, UI_NUB_RADIUS, 3, 0, 30);
            uielements['gridup'].graphics.beginStroke('#000000').drawPolyStar(canvas.width/2 - UI_NUB_RADIUS/2 , UI_NUB_OFFSET, UI_NUB_RADIUS, 3, 0, 30);
            uielements['gridup']['highlighted'] = true;
          } else if (nub == 'griddown'){
            uielements['griddown'].graphics.c().beginFill('#DDDDDD').drawPolyStar(canvas.width/2 - UI_NUB_RADIUS/2, canvas.height - UI_NUB_OFFSET, UI_NUB_RADIUS, 3, 0, 90);
            uielements['griddown'].graphics.beginStroke('#000000').drawPolyStar(canvas.width/2 - UI_NUB_RADIUS/2, canvas.height - UI_NUB_OFFSET, UI_NUB_RADIUS, 3, 0, 90);
            uielements['griddown']['highlighted'] = true;
          }
          uielements[nub].updateCache();
          if(!GAME_FLAG_UPDATE) stageOuter.update();
        }
      } else {
        if(uielements[nub]['highlighted']){
          if(nub == 'handleft'){
            uielements['handleft'].graphics.c().beginFill('#cc6600').drawPolyStar(UI_NUB_RADIUS*2, canvas.height - HANDHOLDER_Y_OFFSET - 25, UI_NUB_RADIUS, 3, 0, 60)
            uielements['handleft'].graphics.beginStroke('#ff6600').drawPolyStar(UI_NUB_RADIUS*2, canvas.height - HANDHOLDER_Y_OFFSET - 25, UI_NUB_RADIUS, 3, 0, 60)
            uielements['handleft']['highlighted'] = false;
          } else if (nub == 'handright'){
            uielements['handright'].graphics.c().beginFill('#cc6600').drawPolyStar(canvas.width - UI_NUB_RADIUS*2, canvas.height - HANDHOLDER_Y_OFFSET - 25, UI_NUB_RADIUS, 3, 0, 120)
            uielements['handright'].graphics.beginStroke('#ff6600').drawPolyStar(canvas.width - UI_NUB_RADIUS*2, canvas.height - HANDHOLDER_Y_OFFSET - 25, UI_NUB_RADIUS, 3, 0, 120)
            uielements['handright']['highlighted'] = false;
          } else if (nub == 'gridleft'){
            uielements['gridleft'].graphics.c().beginFill('#AAAAAA').drawPolyStar(UI_NUB_OFFSET, (canvas.height/2) - UI_NUB_RADIUS/2, UI_NUB_RADIUS, 3, 0, 60);
            uielements['gridleft'].graphics.beginStroke('#000000').drawPolyStar(UI_NUB_OFFSET, (canvas.height/2) - UI_NUB_RADIUS/2, UI_NUB_RADIUS, 3, 0, 60);
            uielements['gridleft']['highlighted'] = false;
          } else if (nub == 'gridright'){
            uielements['gridright'].graphics.c().beginFill('#AAAAAA').drawPolyStar(canvas.width - UI_NUB_OFFSET,(canvas.height/2) - UI_NUB_RADIUS/2, UI_NUB_RADIUS, 3, 0, 120);
            uielements['gridright'].graphics.beginStroke('#000000').drawPolyStar(canvas.width - UI_NUB_OFFSET,(canvas.height/2) - UI_NUB_RADIUS/2, UI_NUB_RADIUS, 3, 0, 120);
            uielements['gridright']['highlighted'] = false;
          } else if (nub == 'gridup'){
            uielements['gridup'].graphics.c().beginFill('#AAAAAA').drawPolyStar(canvas.width/2 - UI_NUB_RADIUS/2 , UI_NUB_OFFSET, UI_NUB_RADIUS, 3, 0, 30);
            uielements['gridup'].graphics.beginStroke('#000000').drawPolyStar(canvas.width/2 - UI_NUB_RADIUS/2 , UI_NUB_OFFSET, UI_NUB_RADIUS, 3, 0, 30);
            uielements['gridup']['highlighted'] = false;
          } else if (nub == 'griddown'){
            uielements['griddown'].graphics.c().beginFill('#AAAAAA').drawPolyStar(canvas.width/2 - UI_NUB_RADIUS/2, canvas.height - UI_NUB_OFFSET, UI_NUB_RADIUS, 3, 0, 90);
            uielements['griddown'].graphics.beginStroke('#000000').drawPolyStar(canvas.width/2 - UI_NUB_RADIUS/2, canvas.height - UI_NUB_OFFSET, UI_NUB_RADIUS, 3, 0, 90);
            uielements['griddown']['highlighted'] = false;
          }
          uielements[nub].updateCache();
          if(!GAME_FLAG_UPDATE) stageOuter.update();
        }
      }

    }
    function drawUINubs(){

      uielements['gridleft'] = uielements['gridleft'] || new createjs.Shape();
      uielements['gridright'] = uielements['gridright'] || new createjs.Shape();
      uielements['gridup'] = uielements['gridup'] || new createjs.Shape();
      uielements['griddown'] = uielements['griddown'] || new createjs.Shape();
      uielements['handleft'] = uielements['handleft'] || new createjs.Shape();
      uielements['handright'] = uielements['handright'] || new createjs.Shape();


      uielements['gridleft'].graphics.c().beginFill('#AAAAAA').drawPolyStar(UI_NUB_OFFSET, (canvas.height/2) - UI_NUB_RADIUS/2, UI_NUB_RADIUS, 3, 0, 60);
      uielements['gridleft'].graphics.beginStroke('#000000').drawPolyStar(UI_NUB_OFFSET, (canvas.height/2) - UI_NUB_RADIUS/2, UI_NUB_RADIUS, 3, 0, 60);

      uielements['gridright'].graphics.c().beginFill('#AAAAAA').drawPolyStar(canvas.width - UI_NUB_OFFSET,(canvas.height/2) - UI_NUB_RADIUS/2, UI_NUB_RADIUS, 3, 0, 120);
      uielements['gridright'].graphics.beginStroke('#000000').drawPolyStar(canvas.width - UI_NUB_OFFSET,(canvas.height/2) - UI_NUB_RADIUS/2, UI_NUB_RADIUS, 3, 0, 120);

      uielements['gridup'].graphics.c().beginFill('#AAAAAA').drawPolyStar(canvas.width/2 - UI_NUB_RADIUS/2 , UI_NUB_OFFSET, UI_NUB_RADIUS, 3, 0, 30);
      uielements['gridup'].graphics.beginStroke('#000000').drawPolyStar(canvas.width/2 - UI_NUB_RADIUS/2 , UI_NUB_OFFSET, UI_NUB_RADIUS, 3, 0, 30);

      uielements['griddown'].graphics.c().beginFill('#AAAAAA').drawPolyStar(canvas.width/2 - UI_NUB_RADIUS/2, canvas.height - UI_NUB_OFFSET, UI_NUB_RADIUS, 3, 0, 90);
      uielements['griddown'].graphics.beginStroke('#000000').drawPolyStar(canvas.width/2 - UI_NUB_RADIUS/2, canvas.height - UI_NUB_OFFSET, UI_NUB_RADIUS, 3, 0, 90);

      uielements['handleft'].graphics.c().beginFill('#cc6600').drawPolyStar(UI_NUB_RADIUS*2, canvas.height - HANDHOLDER_Y_OFFSET - 25, UI_NUB_RADIUS, 3, 0, 60)
      uielements['handleft'].graphics.beginStroke('#ff6600').drawPolyStar(UI_NUB_RADIUS*2, canvas.height - HANDHOLDER_Y_OFFSET - 25, UI_NUB_RADIUS, 3, 0, 60)

      uielements['handright'].graphics.c().beginFill('#cc6600').drawPolyStar(canvas.width - UI_NUB_RADIUS*2, canvas.height - HANDHOLDER_Y_OFFSET - 25, UI_NUB_RADIUS, 3, 0, 120)
      uielements['handright'].graphics.beginStroke('#ff6600').drawPolyStar(canvas.width - UI_NUB_RADIUS*2, canvas.height - HANDHOLDER_Y_OFFSET - 25, UI_NUB_RADIUS, 3, 0, 120)

      for(var key in uielements){
        uielements[key].uncache();
        uielements[key].cache(uielements[key].x, uielements[key].y, canvas.width, canvas.height);
        stageOuter.addChild(uielements[key]);
      }
      if(!GAME_FLAG_UPDATE) stageOuter.update();
    }

    function drawGarbage(img){
      var update;

      if(uielements['garbage']) { update = true }

      uielements['garbage'] = uielements['garbage'] || new createjs.Bitmap(img);

      uielements['garbage'].x = canvas.width - 150;
      uielements['garbage'].y = canvas.height - HANDHOLDER_Y_OFFSET - 60;
      uielements['garbage'].scaleX = uielements['garbage'].scaleY = .30;
      if(update){
        uielements['garbage'].uncache();
      }
      uielements['garbage'].cache(0, 0, 256, 256);
      stageOuter.addChild(uielements['garbage']);
      if(!GAME_FLAG_UPDATE) stageOuter.update();

    }

    function responsiveCanvas(){
      var container = $('#gamewrapper');
      container.css('width', $('#startgamemenu, #joingamemenu').width() - 450);
      container.css('height', $('#startgamemenu, #joingamemenu').height() - 100)

      var containerHeight = container.height();
      var containerWidth = container.width();

      /*
      if(containerWidth / RATIOWIDTH > containerHeight / RATIOHEIGHT){
        canvas.height = containerHeight;
        canvas.width = containerHeight * (RATIOWIDTH/RATIOHEIGHT);
      } else {
        canvas.width = containerWidth;
        canvas.height = containerWidth * (RATIOHEIGHT/RATIOWIDTH);
      }
      var scale = Math.min(canvas.width / RATIOWIDTH, canvas.height / RATIOHEIGHT);*/

      canvas.height = containerHeight;
      canvas.width = containerWidth;

      $('#gamecanvas').css('left', (container.width() - $('#gamecanvas').width())/2);
      $('#gamecanvas').css('top', (container.height() - $('#gamecanvas').height())/2);
      if(handholder){
        handholder.uncache();
        handholder.graphics.clear().beginFill('#ffcc00').drawRect(0, canvas.height - HANDHOLDER_Y_OFFSET - BOARD_TILE_SIZE, canvas.width, BOARD_TILE_SIZE);
        handholder.graphics.beginStroke('#aa0000').drawRect(-2, canvas.height - HANDHOLDER_Y_OFFSET - BOARD_TILE_SIZE-1, canvas.width+2, BOARD_TILE_SIZE+2);
        handholder.cache(-2, canvas.height - HANDHOLDER_Y_OFFSET - BOARD_TILE_SIZE-2, canvas.width, BOARD_TILE_SIZE+4);
        if(hand){
          hand.forEach(function(tile){
            if(tile){
              tile.y = canvas.height - BOARD_TILE_SIZE - HANDHOLDER_Y_OFFSET;
            }
          })
        }
      }
      drawUINubs();
      drawNames();

      /* PRELOAD */
      var img = new Image();
      img.onload = function(){
        drawGarbage(img);
      };
      img.src = "img/trash.png";
      /*END PRELOAD*/


      if(!GAME_FLAG_UPDATE) stageOuter.update();
    }
  }

  function updateHeldTile(){
    if(hand.indexOf(heldTile) != -1){
      heldTile.x = mouse.x - ui.x;
      heldTile.y = mouse.y;
    } else {
      heldTile.x = mouse.x - grid.x;
      heldTile.y = mouse.y - grid.y;
    }
  }
  return
})();
