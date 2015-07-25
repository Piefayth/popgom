var Popgom = function(){
  this.game = this.getGame();
  this.room = this.getRoom();
  this.user = this.getUser();
}

$(function(){

  var numberOfMessageElements = 0;
  var chatscrolls = {};

/*


HELPERS


*/

  var socket;
  var token;
  var count;
  var counter;
  var currentUser, currentGame, currentRoom, currentHost;

  function isAuthorized(callback){
    $.get('auth', function(data){
      return callback(data);
    }).fail(function(){
    }).done(function(data){
    });
  }

/* SOCKETS */



function configureSocketEvents(forceStale){
  if(!forceStale){

    if(socket) {socket.disconnect()};
    //socket = io({multiplex: false, forceNew: true, query: 'token=' + token });

    socket = io({multiplex: false, query: 'token=' + token, path: '/popgom/socket.io'});
  } else {
    socket.removeListener('gamechatresponse')
    socket.removeListener('friendconnect')
    socket.removeListener('joinerror')
    socket.removeListener('frienddisconnect')
    socket.removeListener('friendmessageresponse')
    socket.removeListener('invitemessageresponse')
    socket.removeListener('startsuccess')
    socket.removeListener('joinsuccess')
    socket.removeListener('userjoined')
    socket.removeListener('userleft')
    socket.removeListener('wearehere')
    socket.removeListener('acknowledgehost')
    socket.removeListener('game_begin_event')
  }

  var username;

  $.get('whoami', function(data){
    socket.emit('identify', data);
    username = data;
    currentUser = username;

    socket.on('joinerror', function(error){
      flash(error);
      setMainMenuState('return');
    })

    socket.on('friendconnect', function(username){
      $('#' + username).children('.glyphicon').css("color", "#00DD00");
      $('#' + username).children('.friendname').css("color", "#FFFFFF");
      $('#' + username).parent().parent().find('#messagebutton').removeClass('inactive');
      if(currentRoom) { $('#' + username).parent().parent().find('#invitebutton').removeClass('inactive'); }
      $('#' + username).parent().addClass('online');
    })

    socket.on('frienddisconnect', function(username){
      $('#' + username).children('.glyphicon').css("color", "#434a54");
      $('#' + username).children('.friendname').css("color", "#434a54");
      $('#' + username).parent().parent().find('#messagebutton').addClass('inactive');
      if(currentRoom) { $('#' + username).parent().parent().find('#invitebutton').addClass('inactive'); }
      $('#' + username).parent().addClass('offline');
    })

    socket.on('friendmessageresponse', function(data){
      handleMessageResponse('friendmessageresponse', socket, username, data);
    })

    socket.on('invitemessageresponse', function(data){
      handleMessageResponse('invitemessageresponse', socket, username, data);
    })

    socket.on('startsuccess', function(data){
      currentGame = data['gamename'];
      currentRoom = data['roomname'];
      $('.online').find('#invitebutton').removeClass('inactive');
      $.post('updatesession', {user: currentUser, game: currentGame, room: currentRoom});
    })
    socket.on('joinsuccess', function(data){
      currentGame = data['gamename'];
      currentRoom = data['roomname'];
      $('.online').find('#invitebutton').removeClass('inactive');
      $.post('updatesession', {user: currentUser, game: currentGame, room: currentRoom});
    })
    socket.on('userjoined', function(data){
      $('#usersInRoom > ul').append('<li data-username='+data+'>' + data + '</li>');
      displayHost();
      if(currentHost == currentUser){
        socket.emit('timechange', {game: currentGame, room: currentRoom, time:  curtime = parseInt($('#countdown').html())});
      }
    })
    socket.on('userleft', function(data){
      $('#usersInRoom > ul > li').each(function(index){
        if($(this).data('username') == data){
          $(this).remove();
        }
      })
    })
    socket.on('wearehere', function(data){
      data.forEach(function(user){
        $('#usersInRoom > ul').append('<li data-username='+user+'>' + user + '</li>');
      });
      displayHost();
    })

    socket.on('gamechatresponse', function(data){
      $('#gamechat').append('<div class=gamechatmessage>' + data['username'] + ": " + escapeHtml(data['message']) + '</div>');
      var heightDifference = $('#gamechat').height() - $('#gamechatcontainer').height();
      $('#gamechat').css('top', 0 - heightDifference);
    })

    socket.on('acknowledgehost', function(hostname){
      currentHost = hostname;
      displayHost();
    })

    socket.on('game_begin_event', function(data){
      $.getScript('js/loaditem.js', function(data){
        $('#startbutton').prop('disabled', true);
        if(counter){clearInterval(counter)}
        $('#countdowngroup').fadeTo("slow", 0, function(){
          $('#countdowngroup').html('');
        })
      }).fail(function(jqxhr, settings, exception){
        console.log(exception);
      })
    })

    socket.on('back-to-lobby', function(data){
      $('#usersInRoom > ul > li').each(function(index, element){
        if($(element).data('username') == data){
          $(element).append('♕');
        };
      })
      $('canvas').parent().remove();
      $('#countdowngroup').html('<div id="countdown">30</div><button class="btn btndefault" id="timebutton">Extend Countdown</button> <button class="btn btndefault" id="startbutton">Start Now</button>');
      $('#countdowngroup').fadeTo("fast", 1);
      configureCountdown();
      configureStartButton();
    })

  })
}

function handleMessageResponse(messagetype, socket, username, data){
  //create new window if there isn't one open, this should only happen for the sender

  if(!chatscrolls[data['sender']] && username != data['sender']){
    newChatWindow(data['sender']);
  }

  if (username == data['receiver']){
    //message notification counter
    if ($('#messagetextboxmessage' + data['sender'])[0] != $(document.activeElement)[0]){
      if($('#message' + data['sender']).attr("data-count")){
        $('#message' + data['sender']).attr("data-count", parseInt($('#message' + data['sender']).attr("data-count"), 10) + 1);
        $('#message' + data['sender']).find('.messageheader > strong > .chatnotificationcount').html($('#message' + data['sender']).attr("data-count"));
      } else {
        $('#message' + data['sender']).attr("data-count", 1);
        $('#message' + data['sender']).find('.messageheader > strong > .chatnotificationcount').html('1');
      }
    }
    //appending the actual message
    if(messagetype == "friendmessageresponse"){
      $('#message' + data['sender']).find('#chatscroller > ul').append('<li><span class=chatnamethem>'+ data['sender'] + "</span> <span class=chattext> " + escapeHtml(data['msg']) + '</span></li>');
    } else if (messagetype = "invitemessageresponse"){
      $('#message' + data['sender']).find('#chatscroller > ul').append('<li><span class=chatnamethem>'+ data['sender'] + "</span> <span class=chattext> <a href=# class=invitegamelink data-action=joingame data-room=\"" + data['roomname'] + "\" data-game=\"" + data['gamename'] + "\"> has invited you to play " + escapeHtml(data['msg']) + '!</a></span></li>');
    }
    var selector = '#message' + data['sender'] + ' > #chatscrollerhat > #chatscroller';
    $('#message' + data['sender']).find('#chatscroller').css("bottom", (207 - $(selector).height()) + 'px');

    chatscrolls[data['sender']].refresh();
    chatscrolls[data['sender']].scrollTo(0, chatscrolls[data['sender']].maxScrollY);
  } else if (username == data['sender']){
    //we skip the process of incrementing the noficiation counter if the sender is also this user
    if(messagetype == "friendmessageresponse"){
      $('#message' + data['receiver']).find('#chatscroller > ul').append('<li><span class=chatnameme>'+ data['sender'] + "</span> <span class=chattext> " + escapeHtml(data['msg']) + '</span></li>');
    } else if (messagetype = "invitemessageresponse"){
      $('#message' + data['receiver']).find('#chatscroller > ul').append('<li><span class=chatnameme>'+ data['sender'] + "</span> <span class=chattext> <a href=# class=invitegamelink data-action=joingame data-room=\"" + data['roomname'] + "\" data-game=\"" + data['gamename'] + "\"> has invited you to play " + escapeHtml(data['msg']) + '!</a></span></li>');
    }
    var selector = '#message' + data['receiver'] + ' > #chatscrollerhat > #chatscroller';
    $('#message' + data['receiver']).find('#chatscroller').css("bottom", (207 - $(selector).height()) + 'px');

    chatscrolls[data['receiver']].refresh();
    chatscrolls[data['receiver']].scrollTo(0, chatscrolls[data['receiver']].maxScrollY);
    }
}

function checkWhosHere(socketid){
  socket.emit('whoshere', socketid);
}


/* SOCKETS */

function displayHost(){
  $('#usersInRoom ul li').each(function(index, value){
    if($(value).data('username') == currentHost){
      $(value).css('color', 'orange');
    }
  })
}

function configureGameChat(){
  $('body').on('keypress', '#gamechattextbox', function(event){
    if (event.which == 13){
      data = {message: $(event.target).val(), room: currentRoom, game: currentGame, username: currentUser};
      socket.emit('gamechatmessage', data);
      $(event.target).val('');
    }
  })
}
function configureGamesCarousel(cb){
  $.get('gamescarousel', function(data){
    $('#mainscreen').html(data);
    var options = {
        $AutoPlay: true,                                    //[Optional] Whether to auto play, to enable slideshow, this option must be set to true, default value is false
        $AutoPlayInterval: 4000,                            //[Optional] Interval (in milliseconds) to go for next slide since the previous stopped if the slider is auto playing, default value is 3000
        $SlideDuration: 500,                                //[Optional] Specifies default duration (swipe) for slide in milliseconds, default value is 500
        $DragOrientation: 3,                                //[Optional] Orientation to drag slide, 0 no drag, 1 horizental, 2 vertical, 3 either, default value is 1 (Note that the $DragOrientation should be the same as $PlayOrientation when $DisplayPieces is greater than 1, or parking position is not 0)
        $UISearchMode: 0,
        $FillMode: 4,                                   //[Optional] The way (0 parellel, 1 recursive, default value is 1) to search UI components (slides container, loading screen, navigator container, arrow navigator container, thumbnail navigator container etc).

        $ThumbnailNavigatorOptions: {
            $Class: $JssorThumbnailNavigator$,              //[Required] Class to create thumbnail navigator instance
            $ChanceToShow: 2,                               //[Required] 0 Never, 1 Mouse Over, 2 Always

            $Loop: 1,                                       //[Optional] Enable loop(circular) of carousel or not, 0: stop, 1: loop, 2 rewind, default value is 1
            $SpacingX: 3,                                   //[Optional] Horizontal space between each thumbnail in pixel, default value is 0
            $SpacingY: 3,                                   //[Optional] Vertical space between each thumbnail in pixel, default value is 0
            $DisplayPieces: 6,                              //[Optional] Number of pieces to display, default value is 1
            $ParkingPosition: 253,                          //[Optional] The offset position to park thumbnail,

            $ArrowNavigatorOptions: {
                $Class: $JssorArrowNavigator$,              //[Requried] Class to create arrow navigator instance
                $ChanceToShow: 2,                               //[Required] 0 Never, 1 Mouse Over, 2 Always
                $AutoCenter: 2,                                 //[Optional] Auto center arrows in parent container, 0 No, 1 Horizontal, 2 Vertical, 3 Both, default value is 0
                $Steps: 6                                       //[Optional] Steps to go for each navigation request, default value is 1
            }
        }
    };

    var mainareawidth = $('#mainscreen').width();
    $('#thumbnavigator').css({width: 1720, height: 100});
    $('#gameslides').css({width: 1720, height: 1080});
    $('.jssort07').css({left: -100});
    $('#gamescarousel').css({height: '300px'});
    var carousel = new $JssorSlider$('gamescarousel', options);
    $('#gameslides').css({height: 3000});


    function ScaleSlider() {

      var parentWidth = $('#mainscreen').width();

        if (parentWidth){
          carousel.$ScaleWidth(Math.min(parentWidth/2, 1920));
        }
        else
            window.setTimeout(ScaleSlider, 30);
    }
    ScaleSlider();

    $(window).bind("load", ScaleSlider);
    $(window).bind("resize", ScaleSlider);
    $(window).bind("orientationchange", ScaleSlider);

    if(cb) return cb();
  })
}

function configureMainMenu(){
  $.get('mainmenu', function(data){
    $('#mainscreenmenu').html(data);
    $('#startgame').on('click', function(event){
      if(currentUser){
        $('#joingame').prop('disabled', true);
        $('#startgame').prop('disabled', true);
        var gamename = $('#gamescarousel').find('.item').filter(function(){
          if($(this).css("left") == '0px')
            return $(this);
        }).attr('data-gamename')
        setMainMenuState('startgame', gamename);
      } else {
        $('.form-control').css('border', '1px red solid');
      }
    })
    $('#joingame').on('click', function(event){
      if(currentUser){
        $('#joingame').prop('disabled', true);
        $('#startgame').prop('disabled', true);
        var gamename = $('#gamescarousel').find('.item').filter(function(){
          if($(this).css("left") == '0px')
            return $(this);
        }).attr('data-gamename')
        setMainMenuState('joingame', gamename);
      } else {
        $('.form-control').css('border', '1px red solid');
      }
    })
  })
}

function configureGameMenu(){
  configureCountdown();
  checkWhosHere();
  configureGameChat();
  $('.exitgame').on('click', function(event){
    socket.emit('leavingroom', {username: currentUser, room: currentRoom, game: currentGame})
    setMainMenuState('return');
  });
}



function configureStartButton(){
  $('#startbutton').unbind('click');
  $('#startbutton').on('click', function(){


    socket.emit('opengame', {room: currentRoom, game: currentGame});

  });
}



function configureCountdown(){
  configureStartButton();
  count = 30;

  if(counter){clearInterval(counter)}

  counter = setInterval(timer, 1000);
  $('#timebutton').on('click', function(){
    var curtime = parseInt($('#countdown').html());
    socket.emit('timechange', {game: currentGame, room: currentRoom, time:  curtime + 10});
  })

  socket.on('timeupdate', function(data){
    count = data['time'];
    if (count > 30 ) { count = 30 };
    $('#countdown').html(count);
  });

  function timer(){
    count -= 1;
    $('#countdown').html(count);
    if (count <= 0){
      clearInterval(counter);
      if(currentHost == currentUser){
        socket.emit('opengame', {room: currentRoom, game: currentGame});
      }
    }
  }
}

function setMainMenuState(state, data){
  switch(state){
    case 'startgame':
      if(data){
        var filename = data.replace(/[^A-Z0-9]/ig, "")
        $('#mainscreen').css('background-image', 'url(img/games/' + filename + '.jpg)');
        $('#mainscreen').fadeTo("fast", 0, function(){
          $('#mainscreen').find('*').remove();
          $('#mainscreen').fadeTo("fast", 1);
        });
        $('#mainscreenmenu').fadeTo("slow", 0, function(){
          $('#mainscreenmenu').find('*').remove();
          $.post('startgame', {title: data}, function(data){
            $('#mainscreenmenu').html(data);
            $('#mainscreenmenu').fadeTo("fast", 1);
            configureGameMenu();
          });
        })

        socket.emit('startgame', data);
      }
      break;

    case 'joingame':
      if(data){
        var filename = data.replace(/[^A-Z0-9]/ig, "")
        $('#mainscreen').css('background-image', 'url(img/games/' + filename + '.jpg)');
        $('#mainscreen').fadeTo("fast", 0, function(){
          $('#mainscreen').find('*').remove();
          $('#mainscreen').fadeTo("fast", 1);
        });
        $('#mainscreenmenu').fadeTo("slow", 0, function(){
          $('#mainscreenmenu').find('*').remove();
          $.post('joingame', {title: data}, function(data){
            $('#mainscreenmenu').html(data);
            $('#mainscreenmenu').fadeTo("fast", 1);
            configureGameMenu();
          });
        })
        socket.emit('joingame', data);
      }
      break;

    case 'joinroom':
      if(data){
        var filename = data['gamename'].replace(/[^A-Z0-9]/ig, "");
        $('#mainscreen').css('background-image', 'url(img/games/' + filename + '.jpg)');
        $('#mainscreen').fadeTo("fast", 0, function(){
          $('#mainscreen').find('*').remove();
          $('#mainscreen').fadeTo("fast", 1);
        });
        $('#mainscreenmenu').fadeTo("slow", 0, function(){
          $('#mainscreenmenu').find('*').remove();
          $.post('joinroom', {title: data['gamename'], roomname: data['roomname']}, function(data){
            $('#mainscreenmenu').html(data);
            $('#mainscreenmenu').fadeTo("fast", 1);
            configureGameMenu();
          });
        })
        socket.emit('joinroom', data);
      }
      break;
    case 'return':
      currentRoom = null;
      currentGame = null;
      $('body').unbind();
      $('#mainscreen').fadeTo("fast", 0, function(){
        $('#mainscreen').find('*').remove();
        $('mainscreen').fadeTo("fast", 1);
      });
      $('#mainscreenmenu').fadeTo("slow", 0, function(){
        $('#mainscreenmenu').find('*').remove();
        configureGamesCarousel(function(){
          $('#mainscreen').css('background-image', 'none');
          $('#mainscreenmenu').fadeTo("fast", 1);
          $('#mainscreen').fadeTo("fast", 1);
        });
        configureFriendMenuButton();
        configureFriendDropdownButtons();
        configureMainMenu();
        configureChatWindows();
      })
      break;
    default:
      //do thing
      break;
  }
}
/*




BEGIN FRIENDS LIST LOGIC



*/



function configureFriendsList(){
  $.get('friendslist', function(data){
    $('#friendslist').html(data);
    var friendscroll = new IScroll('#friendcontainer', {
      mouseWheel: true,
      scrollbars: 'custom'
    });
    $('#friendslist').fadeTo("slow", 1);
    $('#addfriendtextbox').val('');
    $('#messagebutton, #invitebutton').addClass('inactive');
  })
}

function dismantleFriendsList(){
  $('#friendslist').fadeTo("slow", 0, function(){
    $('#friendslist').html('');
  });
  $('body').unbind('click');
  $('#messagescontainer').fadeTo("slow", 0, function(){
    $('#messagescontainer').children().remove();
  });
}

isAuthorized(function(result){
  if (result['auth']) {
      token = result['token'];
      successfulLogin();
    }
})

function configureFriendDropdownButtons(){
    $('body').on('click', '#messagebutton', function(event, data){
      if (!$(event.target).hasClass('inactive')){
        username = $(event.target).data("username");
        newChatWindow(username);
      }
    })
    $('body').on('click', '#invitebutton', function(event, data){
      if(!$(event.target).hasClass('inactive')){
        username = $(event.target).data("username");
        newChatWindow(username);
        socket.emit('invitemessage', {message: currentGame, receiver: username, gamename: currentGame, roomname: currentRoom});
      }
    })
    $('body').on('click', '.invitegamelink', function(event, data){
      if(!currentRoom){
        $('#joingame').prop('disabled', true);
        $('#startgame').prop('disabled', true);
        var output = {username: currentUser, roomname: $(event.target).data('room'), gamename: $(event.target).data('game')}
        setMainMenuState('joinroom', output);
      }
    })
}



function configureChatWindows(){
  $('#messagescontainer').fadeTo("slow", 1);
  numberOfMessageElements = 0;
  //remove messages
  $('body').on('click', '.closeMessage', function(event){
    var messageboxid = $(event.target).closest('div').parent().attr("id");
    $('#' + messageboxid).remove();
    chatscrolls[messageboxid.substr(7)] = null;
    numberOfMessageElements--;
    $('.messagebox, .messageboxcollapsed').each(function(index){
      $(this).css("left", (index*200) + 'px');
    });
  })
  $('body').on('click', '.messageheader', function(event){
    //expand or collapse messages
    var messageboxid =  $(event.target).closest('.messagebox, .messageboxcollapsed').attr("id");
    if (messageboxid){
      if ($('#' + messageboxid).hasClass("messagebox")){
        $('#' + messageboxid).removeClass("messagebox");
        $('#' + messageboxid).addClass("messageboxcollapsed");
      } else{
        $('#' + messageboxid).addClass("messagebox");
        $('#' + messageboxid).removeClass("messageboxcollapsed");
      }
    }
  })


  $('body').on('keypress', '.messagetextbox', function(event){
    if (event.which == 13){
      var receiver = $(event.target).closest('.messagebox').attr("data-username");
      data = {message: $(event.target).closest('.messagetextbox').val(), receiver: receiver};
      socket.emit('friendmessage', data);
      $(event.target).closest('.messagetextbox').val('');
    }
  })
}



function newChatWindow(username){
    var newdivid = 'message' + username;
    var newdividcontainer = 'message' + username + 'container';

    if ($('#' + newdivid).length == 0){
      $('#messagescontainer').append( '<div id='+ newdivid + ' class="messagebox" data-username=' + username + '></div>');
      $('#' + newdivid).css("left", '' + (numberOfMessageElements*200) + 'px');
      numberOfMessageElements++;
      var appendstring = '<div id=header' + newdivid + ' class=messageheader> <strong>'
       + username + '<i class=\"glyphicon glyphicon-remove pull-right closeMessage\"></i><span class=\"chatnotificationcount\"></span></strong>'
       + '</div>';
      var appendstring = appendstring + '<div id=chatscrollerhat><div id=chatscroller><ul></ul>';
      var appendstring = appendstring + '</div></div><input id=messagetextbox' + newdivid + ' class=messagetextbox type=text></div></div>'
      $('#' + newdivid).append(appendstring)
      $('#' + newdivid + ', input').focus();

      var thingy = '#' + newdivid + ' > ' + '#chatscrollerhat';
      chatscrolls[username] = new IScroll(thingy, {mouseWheel: true, scrollbars: 'custom', interactiveScrollbars: true});

      //grant the box focus when clicking anywhere inside of it AND when expanding it from collapsed
      $('#' + newdivid).on('click', '*', function(event){
          if (!$(event.target).hasClass('messageheader') || $('#' + newdivid).hasClass('messageboxcollapsed')){
            $('#' + newdivid + ' > .messagetextbox').focus();
            //then additionally clear the "unread messages"
            $('#' + newdivid).find('.chatnotificationcount').html('');
            $('#' + newdivid).attr('data-count', 0);
          }
      })
    }



}

function configureFriendMenuButton(){
  $('body').on('click', '#friendmenubutton', function(event){
    $(this).parent().toggleClass('open');
    $('#addfriendtextbox').focus();
  });
}

function configureAddFriendButton(){
  $('#addfriendform').on('submit', function(event){
    event.preventDefault();
    var data2 = $('#addfriendform').serializeArray();

    $.ajax({
      url: "addfriend",
      type: "POST",
      data: JSON.stringify(data2),
      contentType: "application/json",
      dataType: "json",
      processData: false
    }).done(function(res){
      if(res["success"]){
        flash("Added " + res["addedfriend"] + "!");
        configureFriendsList();
        configureSocketEvents(true);
      } else{
        flash(res["response"])
      }
    })
  });
}

$('html').on('click', function(e){
  if (!($('.friendmenubutton').is(e.target))){
    $('#friendmenubutton').parent().removeClass('open');
  }
})

/* MAIN BAR */

  configureLoginForm();
  configureSignoutButton();
  configureGamesCarousel();
  configureMainMenu()


  function flash(data){
    if ( $('#alertbox').css("margin-right") == "-200px"){
      $('#alertbox').find('#alerttext').html(data);
      $('#alertbox').animate({"margin-right": '+=200'}).delay(2000).animate({"margin-right": '-=200'});
    }
    else {
      var tempAlert = $('#alertbox').clone();
      tempAlert.find('#alerttext').html(data);
      tempAlert.css("margin-right", "-200px");
      $('#alertcontainer').append(tempAlert);
      tempAlert.animate({"margin-right": '+=200'}).delay(2000).animate({"margin-right": '-=200'});
    }
  }

  function configureLoginForm(){
    $("#loginform").on('submit', (function(e){
      e.preventDefault();
      var data2 = $("#loginform").serializeArray();

      $.ajax({
        url: "login",
        type: "POST",
        data: JSON.stringify(data2),
        contentType: "application/json",
        dataType: "json",
        processData: false
      }).done(function(res){
        flash(res["text"]);
        if (res["auth"]) {
          token = res['token'];
          successfulLogin();
        }
      })
    }))
    $('#loginform').find('*').delay(100).fadeTo( "fast", 1);
    configureRegisterButton();
  }
  function configureRegisterForm(){
    $("#registerform").on('submit', (function(e){
      e.preventDefault();
      var data2 = $("#registerform").serializeArray();

      $.ajax({
        url: "register",
        type: "POST",
        data: JSON.stringify(data2),
        contentType: "application/json",
        dataType: "json",
        processData: false
      }).done(function(res){
        flash(res["text"]);
        if (res["auth"]) {
          token = res['token'];
          successfulLogin();
        }
      })
    }))
    $('#registerform').find('*').delay(100).fadeTo( "fast", 1);
    configureNevermindButton();
  }

  function configureHomebar(callback){
    $.get('homebar', function(data){
      $('form').find('*').prop('disabled', true);
      var count = 0;
      $('form').find('*').fadeTo("fast", 0, function(){
        count++;
        if(count == $('form').find('*').length){
          $('#footerpane').html(data);
          configureSignoutButton();
          callback();
        }
      })
    })
  }

  function configureRegisterButton(){
    $("#registerbutton").on('click', function(e){
      $.get('register', function(data){
        $('#loginform').find('*').prop('disabled', true);
        var count = 0;
        $('#loginform').find('*').fadeTo("fast", 0, function(){
          count++;
          if(count == $('#loginform').length){
            $('#footerpane').html(data);
            configureRegisterForm();
          }
        })
      })
    })
  }

  function configureNevermindButton(){
    $('#nevermindbutton').on('click', function(e){
      $.get('logout', function(data){
        $('#registerform').find('*').prop('disabled', true);
        var count = 0;
        $('#registerform').find('*').fadeTo("fast", 0, function(){
          count++;
          if(count == $('#registerform').length){
            $('#footerpane').html(data);
            configureLoginForm();
          }
        })
      })
    })
  }

  function configureSignoutButton(){
    $("#signoutelement").on('click', function(e){
      $.get('logout', function(data){
        socket.disconnect();
        currentUser = null;
        $('body').unbind();
        $('#homebar').find('*').prop('disabled', true);
        var count = 0;
        $('#homebar').find('*').fadeTo("fast", 0, function(){
          count++;
          if (count == $('#homebar').length){
            $('#footerpane').html(data);
            dismantleFriendsList();
            configureLoginForm();
          }
        })
      })
    })
  }

  function successfulLogin(){
    configureHomebar(function(){
      configureFriendsList();
      configureFriendMenuButton();
      configureAddFriendButton();
      configureSocketEvents();
      configureFriendDropdownButtons()
      configureChatWindows();

      configureGamesCarousel();
      configureMainMenu();
    })
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  Popgom.prototype.getGame = function getGame(){
    return currentGame;
  }
  Popgom.prototype.getRoom = function getRoom(){
    return currentRoom;
  }
  Popgom.prototype.getUser = function getUser(){
    return currentUser;
  }

})
