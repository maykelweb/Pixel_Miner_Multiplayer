// server.js - Using Node.js with Express and Socket.IO
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');

// Create server and socket connection
const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Serve the static game files
app.use(express.static(path.join(__dirname, 'public')));

// Store game state
const games = {};  // Object to store multiple game instances
const playerGameMap = {}; // Maps players to their game

// Generate a random game code
function generateGameCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Handle socket connections
io.on('connection', (socket) => {
  console.log('New player connected:', socket.id);
  
  // Handle hosting a new game
  socket.on('hostGame', (options) => {
    const gameCode = generateGameCode();
    console.log(gameCode)
    
    // Create a new game instance
    games[gameCode] = {
      host: socket.id,
      name: options.gameName || "Pixel Miner Game",
      maxPlayers: options.maxPlayers || 4,
      players: {},
      worldBlocks: {},
      currentPlayers: 0
    };
    
    // Add the host as the first player
    games[gameCode].players[socket.id] = {
      id: socket.id,
      x: 100, // Starting position
      y: 100,
      direction: 1,
      onGround: false,
      velocityX: 0,
      velocityY: 0,
      health: 100,
      currentTool: 'pickaxe-basic',
      depth: 0,
    };
    games[gameCode].currentPlayers++;
    
    // Add player to game mapping
    playerGameMap[socket.id] = gameCode;
    
    // Send game code back to host
    socket.emit('gameHosted', { gameCode, success: true });
    
    // Send initial game state to host
    socket.emit('gameState', {
      playerId: socket.id,
      players: games[gameCode].players,
      worldBlocks: games[gameCode].worldBlocks
    });
    
    console.log(`New game created: ${gameCode} by ${socket.id}`);
  });
  
  // Handle joining an existing game
  socket.on('joinGame', (data) => {
    const gameCode = data.gameCode;
    
    // Check if game exists
    if (!games[gameCode]) {
      socket.emit('joinResponse', { 
        success: false, 
        message: "Game not found" 
      });
      return;
    }
    
    // Check if game is full
    if (games[gameCode].currentPlayers >= games[gameCode].maxPlayers) {
      socket.emit('joinResponse', { 
        success: false, 
        message: "Game is full" 
      });
      return;
    }
    
    // Add player to the game
    games[gameCode].players[socket.id] = {
      id: socket.id,
      x: 100 + (Math.random() * 50), // Randomize starting position slightly
      y: 100,
      direction: 1,
      onGround: false,
      velocityX: 0,
      velocityY: 0,
      health: 100,
      currentTool: 'pickaxe-basic',
      depth: 0,
    };
    games[gameCode].currentPlayers++;
    
    // Map player to game
    playerGameMap[socket.id] = gameCode;
    
    // Send success response
    socket.emit('joinResponse', { 
      success: true, 
      gameCode: gameCode,
      gameName: games[gameCode].name
    });
    
    // Send game state to the new player
    socket.emit('gameState', {
      playerId: socket.id,
      players: games[gameCode].players,
      worldBlocks: games[gameCode].worldBlocks
    });
    
    // Broadcast new player to others in the same game
    socket.to(gameCode).emit('newPlayer', games[gameCode].players[socket.id]);
    
    console.log(`Player ${socket.id} joined game: ${gameCode}`);
  });
  
  // Handle player movement
  socket.on('playerMove', (data) => {
    const gameCode = playerGameMap[socket.id];
    
    if (gameCode && games[gameCode] && games[gameCode].players[socket.id]) {
      // Update player position
      games[gameCode].players[socket.id].x = data.x;
      games[gameCode].players[socket.id].y = data.y;
      games[gameCode].players[socket.id].direction = data.direction;
      games[gameCode].players[socket.id].velocityX = data.velocityX;
      games[gameCode].players[socket.id].velocityY = data.velocityY;
      games[gameCode].players[socket.id].onGround = data.onGround;
      
      // Broadcast updated position to all other players in the same game
      socket.to(gameCode).emit('playerMoved', {
        id: socket.id,
        ...data
      });
    }
  });
  
  // Handle block mining
  socket.on('blockMined', (data) => {
    const gameCode = playerGameMap[socket.id];
    
    if (gameCode && games[gameCode]) {
      // Update shared world state
      if (!games[gameCode].worldBlocks[data.y]) {
        games[gameCode].worldBlocks[data.y] = {};
      }
      games[gameCode].worldBlocks[data.y][data.x] = null; // Remove the block
      
      // Broadcast block change to all players in the same game
      io.to(gameCode).emit('worldUpdated', {
        x: data.x,
        y: data.y,
        block: null
      });
    }
  });
  
  // Handle player tool change
  socket.on('toolChanged', (data) => {
    const gameCode = playerGameMap[socket.id];
    
    if (gameCode && games[gameCode] && games[gameCode].players[socket.id]) {
      games[gameCode].players[socket.id].currentTool = data.tool;
      
      // Broadcast tool change to all other players in the same game
      socket.to(gameCode).emit('playerToolChanged', {
        id: socket.id,
        tool: data.tool
      });
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    
    // Get the game this player was in
    const gameCode = playerGameMap[socket.id];
    
    if (gameCode && games[gameCode]) {
      // Remove player from the game
      delete games[gameCode].players[socket.id];
      games[gameCode].currentPlayers--;
      
      // Notify other players in the same game
      io.to(gameCode).emit('playerDisconnected', socket.id);
      
      // If this was the host or the last player, clean up the game
      if (socket.id === games[gameCode].host || games[gameCode].currentPlayers === 0) {
        console.log(`Game ${gameCode} ended - host left or no players remain`);
        delete games[gameCode];
      }
    }
    
    // Remove from player-game mapping
    delete playerGameMap[socket.id];
  });
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});