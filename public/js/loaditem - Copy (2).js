(function(){
  var BOARD_STEP_FACTOR = 50;
  var BOARD_TILE_SIZE = 50;
  var HANDHOLDER_Y_OFFSET = 50;
  var BOARD_TILE_SIZE = 50;

  var token, username, room, game, socket, scale;
  var stageOuter, background, stage, ui, handholder, canvas, grid, heldTile, board, hand;
  var mouse = {x: 100, y: 100};

  var temp = [];
  for(var w = 0; w < BOARD_TILE_SIZE; w++){
    temp[w] = []
    for(var h = 0; h < BOARD_TILE_SIZE; h++){
      temp[w].push(0);
    }
  }
  board = temp;

  //socket = io('http://localhost:3002', {multiplex: false, query: 'token=' + token, path: '/popgom/socket.io'});

  var popgom = new Popgom();

  $.post('api/whoami', popgom, function(res1){
    $.post('api/whoishere', popgom, function(res2){
      token = res1['token'];
      username = res1['user'];
      room = res1['room'];
      game = res1['game'];
      socket = io('http://localhost:3002', {
        multiplex: false,
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

      socket.on('initial-connect-success', function(){
        setTheStage(function(){
          socket.emit('ready-for-board');
        });
      });


      socket.on('board', function(board){
        socket.board = board;
        drawBoardGrid(socket);
      });

      socket.on('give-tile', function(tile){
        if(!hand) hand = []

        var pos = null;

        hand.forEach(function(tih, index){
          if(!tih && pos === null){
            pos = index;
            console.log('setting pos to: ' + index);
          }
        });

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

        var tileInHand = hand[pos];




        tileInHand.x = (pos + 1) *BOARD_STEP_FACTOR;
        tileInHand.y = canvas.height - BOARD_TILE_SIZE - HANDHOLDER_Y_OFFSET;
        text.x = shape.x + (BOARD_TILE_SIZE/2 - text.getBounds().width/2);  //centering wizardry
        tileInHand.addChild(shape)
        tileInHand.addChild(text)

        function roundToNearestFifty(num){
          return Math.round(num/50) * 50;
        }

        tileInHand.addEventListener('mousedown', function(event){
          heldTile = event.target.parent;
          stageOuter.canvas.style.cursor = 'none';

          if(hand.indexOf(event.target.parent) == -1){
            console.log(event.target.parent.x);
            console.log("Lifting From StageX: " + event.stageX);
            console.log("Lifting From StageY: " + event.stageY);
            console.log("Lifting From GridX: " + grid.x);
            console.log("Lifting From GridY: " + grid.y);
            console.log("StageX - GridX = " + (event.stageX - grid.x));
            console.log("StageY - GridY = " + (event.stageY - grid.y));

            var startX = Math.floor((event.stageX - grid.x)/BOARD_TILE_SIZE);

            console.log("StartX: " + startX);


            var startY = Math.floor((event.stageY - grid.y)/BOARD_TILE_SIZE);

            console.log("StartY: " + startY);
            var startXAbs = startX + Math.round(board.length/2);

            console.log("StartXAbs: " + startXAbs);

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

          if(board[dropXAbs] && !board[dropXAbs][dropYAbs] && dropXAbs >= 0 && dropYAbs >= 0){

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

          stageOuter.update();
        });
        tileInHand.addEventListener('pressmove', function(event){
          updateHeldTile();
          stageOuter.update();
        });
        tileInHand.cache(-1, -1, BOARD_TILE_SIZE+2, BOARD_TILE_SIZE+2);
        shape.cache(-1, -1, BOARD_TILE_SIZE+2, BOARD_TILE_SIZE+2)

        ui.addChild(tileInHand);
        stageOuter.update();
      });

      socket.on('play-letter-response', function(data){
        console.log(data);
        if(data.orientation == 'horizontal' && data.word.length > 1){
          for(var i = 0; i < data.word.length; i++){
            board[data.x + i][data.y].getChildAt(1).color = data.valid ? '#0F0' : '#F00';
            board[data.x + i][data.y]['valid'] = data.valid;
            board[data.x + i][data.y].updateCache(-1, -1, BOARD_TILE_SIZE+2, BOARD_TILE_SIZE+2);
            stageOuter.update();
          }
        } else if (data.word.length > 1) {
          for(var i = 0; i < data.word.length; i++){
            board[data.x][data.y + i].getChildAt(1).color = data.valid ? '#0F0' : '#F00';
            board[data.x][data.y + i]['valid'] = data.valid;
            board[data.x][data.y + i].updateCache(-1, -1, BOARD_TILE_SIZE+2, BOARD_TILE_SIZE+2);
            stageOuter.update();
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
        stageOuter.update();
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
    stageOuter.update();
  }
  function setTheStage(cb){
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
    handholder.graphics.beginFill('#ffcc00').drawRect(-10000, canvas.height - HANDHOLDER_Y_OFFSET - BOARD_TILE_SIZE, 20000, BOARD_TILE_SIZE);
    handholder.graphics.beginStroke('#aa0000').drawRect(-10000, canvas.height - HANDHOLDER_Y_OFFSET - BOARD_TILE_SIZE-1, 20000, BOARD_TILE_SIZE+2);
    ui.addChild(handholder);
    handholder.cache(-10000, canvas.height - HANDHOLDER_Y_OFFSET - BOARD_TILE_SIZE-2, 20000, BOARD_TILE_SIZE+4);

    createjs.Ticker.addEventListener("tick", function(event){
      updateGridLocation();
    });

    stageOuter.on("stagemousemove", function(event){
      if(stageOuter.mouseInBounds){
        mouse.x = event.stageX;
        mouse.y = event.stageY;
      }
    });

    stageOuter.on("mouseleave", function(event){
    })


    createjs.Ticker.framerate = 60;

    return cb();

    function snapHandToGrid(){
      /*
      ui.x = ui.x - (ui.x % 50 - grid.x % 50);
      stageOuter.update();
      */
    }

    var needSnapped;

    function updateGridLocation(){
      var updated = false;

      if(stageOuter.mouseInBounds && mouse.y < canvas.height - HANDHOLDER_Y_OFFSET && mouse.y > canvas.height - (HANDHOLDER_Y_OFFSET + handholder.getBounds().height)){
        if(mouse.x < 50){
          ui.x += 5;
          updated = true;
          needSnapped = true;
        } else if (mouse.x > canvas.width - 50){
          ui.x -= 5;
          updated = true;
          needSnapped = true;
        }
      } else if(stageOuter.mouseInBounds){
          if(mouse.x < 75){
            grid.x += 5;
            updated = true;
            needSnapped = true;
          }
          if(mouse.x > canvas.width - 75){
            grid.x -= 5;
            updated = true;
            needSnapped = true;
          }
          if(mouse.y < 75){
            grid.y += 5;
            updated = true;
            needSnapped = true;
          }
          if(mouse.y > canvas.height - 50){
            grid.y -= 5;
            updated = true;
            needSnapped = true;
          }
          if (heldTile){
            updateHeldTile();
          }
        } else if(needSnapped){
          snapHandToGrid();
        }
      if (updated) { stageOuter.update(); }
    }

    function responsiveCanvas(){
      var container = $('#gamewrapper');
      container.css('width', $('#startgamemenu, #joingamemenu').width() - 450);
      container.css('height', $('#startgamemenu, #joingamemenu').height() - 100)

      var containerHeight = container.height();
      var containerWidth = container.width();

      if(containerWidth / RATIOWIDTH > containerHeight / RATIOHEIGHT){
        canvas.height = containerHeight;
        canvas.width = containerHeight * (RATIOWIDTH/RATIOHEIGHT);
      } else {
        canvas.width = containerWidth;
        canvas.height = containerWidth * (RATIOHEIGHT/RATIOWIDTH);
      }
      var scale = Math.min(canvas.width / RATIOWIDTH, canvas.height / RATIOHEIGHT);

      $('#gamecanvas').css('left', (container.width() - $('#gamecanvas').width())/2);
      $('#gamecanvas').css('top', (container.height() - $('#gamecanvas').height())/2);
      if(handholder){
        handholder.uncache();
        handholder.graphics.clear().beginFill('#ffcc00').drawRect(-10000, canvas.height - HANDHOLDER_Y_OFFSET - BOARD_TILE_SIZE, 20000, BOARD_TILE_SIZE);
        handholder.graphics.beginStroke('#aa0000').drawRect(-10000, canvas.height - HANDHOLDER_Y_OFFSET - BOARD_TILE_SIZE-1, 20000, BOARD_TILE_SIZE+2);
        handholder.cache(-10000, canvas.height - HANDHOLDER_Y_OFFSET - BOARD_TILE_SIZE-2, 20000, BOARD_TILE_SIZE+4);
        if(hand){
          hand.forEach(function(tile){
            if(tile){
              tile.y = canvas.height - BOARD_TILE_SIZE - HANDHOLDER_Y_OFFSET;
            }
          })
        }
      }
      stageOuter.update();
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

})();
