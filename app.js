
var bodyParser = require('body-parser');
var cors = require('cors');
var express = require('express');
var app = express();
// use body parser so we can get info from POST and/or URL parameters
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies
app.use(bodyParser.json()); // support json encoded bodies
app.use(cors({ origin: '*' }));
// Settings for CORS
app.use(function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.header('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
    res.setHeader('Access-Control-Allow-Credentials', true);
    next();
});
var server = require( "http" ).createServer( app );

var io = require('socket.io').listen(server, {
    log: false,
    agent: false,
    origins: '*:*',
    transports: ['websocket', 'htmlfile', 'xhr-polling', 'jsonp-polling', 'polling']
});

var canvas = {
  x: 640,
  y: 480
};
var playerVars = {
  height: 37,
};
const gravitySpeed = 0.2;
const drag = 0.2;
const acceleration = 0.4;
const maxSpeed = 4;
const jumpSpeed = 5.5;
const TicksPerSecond = 30;
const maxItems = 3;

var objects = {};
var players = {};
var items = [];

objects = [
  {x: -10, y: 400, height: 10, width: 200},
  {x: 460, y: 400, height: 10, width: 200},
  {x: -10, y: 300, height: 10, width: 200},
  {x: 460, y: 300, height: 10, width: 200},
  {x: 250, y: 288, height: 10, width: 150},
  {x: 250, y: 384, height: 10, width: 150},
];

itemsTypes = [
  {name:"bomb", action: "health", value: "-50", height: 25, width: 25, x:0 , y:0 ,speedx:0 , speedy:0},
  {name:"heart", action: "health", value: "50", height: 25, width: 25 , x:0 , y:0 ,speedx:0 , speedy:0},
];

io.on("connection", socket => {
  socket.on('new player', name => {

    randomx = Math.floor((Math.random() * 635) );
    players[socket.id] = {
      id: socket.id,
      name: name || socket.id,
      x: randomx,
      y: 200,
      connState: true,
      moveState: false,
      speedy: 0,
      speedx: 0,
      direction: 'right',
      attacking: false,
      health: 100,
      dying: false,
      score: 0,
      vars: playerVars,
      movedata: {
        left: false,
        right: false,
        up: false,
        down: false,
      }
    };
  });

  socket.on("movement", data => {
    var player = players[socket.id] || {};
    try {
      if (!player.dying) {
        player.movedata = data;
      } else {
        player.movedata ={ 
          left: false,
          right: false,
          up: false,
          down: false,
        }
      }
    } catch (e) {
      console.log("failed to update: ", socket.id);
    }
  });

  socket.on("attack", data => {
    var player = players[socket.id] || {};
    try {
      players[socket.id].attacking = true;
    } catch (e) {
      console.log("failed to update: ", socket.id);
    }
    setTimeout(()=>{ 
      try {
        players[socket.id].attacking=false;
      } catch (e) {
        console.log("failed to update: ", socket.id);
      }
    }, 750);
    targets = [];
    var hitbox ={};
    var direction = player.direction;
    if (direction == "right"){
      hitbox = {xs: player.x, xe: player.x+45,  ys: player.y-10, ye: player.y+37}
      // (player.x, player.y-10, 35, 47)
    } else {
      hitbox = {xs: player.x-40, xe: player.x+5, ys: player.y-10, ye: player.y+37}
      // (player.x-30, player.y-10, 35, 47)
    }
  
    for (var id in players) {
      var potential = players[id];
      if ((potential.x > hitbox.xs && potential.x < hitbox.xe ) && (potential.y > hitbox.ys && potential.y < hitbox.ye ) && id != socket.id)
      {
        targets.push(id);
      }
    }
    targets.forEach(target => {
      
      if ( players[target].attacking && players[target].direction != direction){
        if (direction == "right"){
          players[socket.id].speedx -= 5;
          players[target].speedx += 5;
        }else{
          players[socket.id].speedx += 5;
          players[target].speedx -= -5;
        }
      } else {
        if (direction == "right"){
          players[target].speedx += 5;
        }else{
          players[target].speedx += -5;
        }
        players[target].health -= 20;
        players[target].speedy = -4;
      }
      
      if (players[target].health <= 0) {
        // so this was set to socket.id for a short peried. which meant if you lowered a targets hp to 0. you died. ha ha woops.
        try {
          players[socket.id].score ++;
          players[target].dying = true;
        } catch (e) {
          console.log("failed to update: ", target);
        }
        setTimeout(()=>{ 
          try {
            delete players[target];
          } catch (e) {
            console.log("failed to delete: ", target);
          }
        }, 3000);
      }
    });
  });

  socket.on("message", data => {
    console.log(data);
  });

  socket.on("disconnect", () => {
    if( players[socket.id] && players[socket.id].connState ){
      players[socket.id].connState = false;
      players[socket.id].dying = true;
    }
    setTimeout (()=>{
      try {
        delete players[socket.id];
      } catch (e) {
        console.log("failed to delete: ", socket.id);
      }
    }, 3000);
    
  });
});

// GAME TICK
setInterval(()=>{
  for (var id in players) {
    var player = players[id];
    var collision = false;
    // detect collision
    for(let index in objects) {
      const obj = objects[index];
      if (((player.x > obj.x && player.x < obj.x+obj.width ) && (player.y+37 > obj.y && player.y+37 < obj.y+obj.height )) || player.y > canvas.y-playerVars.height-1){
        collision = true;
      }
    }
    // hp drain 
    if (player.health > 100){
      player.health--;
    }

    player.moveState = false;
    if (player.movedata.left) {
      player.moveState = 'left';
      player.direction = 'left';
      if (player.speedx > maxSpeed*-1){
        player.speedx -= acceleration;
      }
      
    } else if (player.movedata.right) {
      player.moveState = 'right';
      player.direction = 'right';
      if (player.speedx < maxSpeed){
        player.speedx += acceleration;
      }
    } 
    // gravity 
    if(player.speedy < 10) {
      player.speedy += gravitySpeed;
    }

    if (collision && player.speedy > 0 && !player.movedata.down) {
      player.speedy = 0;
    }

    if (player.movedata.up & (player.y > canvas.y-(playerVars.height*1.1) || collision)) {
      player.speedy = -1*jumpSpeed;
    }

    if (player.y > canvas.y-(playerVars.height - 1)){
      player.y = canvas.y-(playerVars.height - 1);
    }
    player.y += player.speedy;

    // drag
    if(player.speedx < 0.1 && player.speedx > -0.1){
      player.speedx = 0;
    }
    if (player.speedx > 0) {
      player.speedx -= drag;
    } else if (player.speedx < 0) {
      player.speedx += drag;
    }
    player.x += player.speedx;
    if ( !collision ) {
      if (player.speedy < 0 ){
        player.moveState = 'jump';
      } else if ( player.speedy > 1.5 ){
        player.moveState = 'fall';
      }
    }
    if (player.x > canvas.x) {
      player.x = canvas.x;
    } 
    if (player.x < 0) {
      player.x = 0;
    }
    
  }
  for (var index in items) {
    var item = items[index];
    var collision = false;
    // detect collision
    for(let index in objects) {
      const obj = objects[index];
      if (((item.x+item.width > obj.x && item.x < obj.x+obj.width ) && (item.y+item.height > obj.y && item.y+item.height < obj.y+obj.height )) || item.y > canvas.y-item.height+1){
        collision = true;
      }
    }

    // gravity 
    if(item.speedy < 10) {
      item.speedy += gravitySpeed;
    }
    if (collision && item.speedy > 0) {
      item.speedy = 0;
    }
    item.y += item.speedy;

    //detect player collision 
    for (var id in players) {
      var potential = players[id];
      if ((potential.x+10 > item.x && potential.x-10 < item.x+item.width) && (potential.y+20 >= item.y && potential.y+20 <= item.y+item.height)){
        if (item.value*1 < 0){
          if (players[id].direction == "right"){
            players[id].speedx -= 8;
          } else {
            players[id].speedx += 8;
          }
          players[id].speedy -= 5;
        }
        players[id].health += item.value*1;
        if(players[id].health <=0){
          try {
            players[id].score --;
            players[id].dying = true;
          } catch (e) {
            console.log("failed to update: ", target);
          }
          setTimeout(()=>{ 
            try {
              delete players[id];
            } catch (e) {
              console.log("failed to delete: ", target);
            }
          }, 3000);
        } else if (players[id].health > 200 ){
          players[id].health=200;
        }

        delete items.splice(index, 1);
        break;
      }
    }
  }

}, 1000 / TicksPerSecond);

setInterval(function() {
  if(items.length < maxItems) {
    var item = JSON.parse(JSON.stringify(itemsTypes[Math.floor(Math.random() * itemsTypes.length)]));
    item.x = randomx = Math.floor((Math.random() * 635) );
    items.push(item);
  }
}, 30000);

setInterval(function() {
  let actors = {
    players: players,
    objects: objects,
    items: items,
  }
  io.sockets.emit('state', actors);
}, 1000 / TicksPerSecond);

server.listen(3000);