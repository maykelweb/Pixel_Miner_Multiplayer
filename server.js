// server.js - Using Node.js with Express and Socket.IO
const express = require("express");
const http = require("http");
const socketIO = require("socket.io");
const path = require("path");

// Create server and socket connection
const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Serve the static game files
app.use(express.static(path.join(__dirname, "public")));

// Store game state
const games = {}; // Object to store multiple game instances
const playerGameMap = {}; // Maps players to their game

// Generate a random game code
function generateGameCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Handle socket connections
io.on("connection", (socket) => {
  console.log("New player connected:", socket.id);

  // Handle hosting a new game
  socket.on("hostGame", (options) => {
    try {
      const gameCode = generateGameCode();
      console.log("Game code generated:", gameCode);

      // Create a new game instance with all required properties
      games[gameCode] = {
        host: socket.id,
        name: options.gameName || "Pixel Miner Game",
        maxPlayers: options.maxPlayers || 4,
        players: {}, // Initialize empty players object
        worldBlocks: {},
        worldGenerated: false,
        currentPlayers: 0,
        hasRocket: false,
        rocketPosition: { x: 0, y: 0 },
      };

      // IMPORTANT: Make sure the games object and players property exist before adding players
      if (!games[gameCode]) {
        games[gameCode] = {};
      }

      if (!games[gameCode].players) {
        games[gameCode].players = {};
      }

      // Add the host as the first player
      games[gameCode].players[socket.id] = {
        id: socket.id,
        x: 100,
        y: 100,
        direction: 1,
        onGround: false,
        velocityX: 0,
        velocityY: 0,
        health: 100,
        currentTool: "pickaxe-basic",
        depth: 0,
        currentPlanet: "earth", // Added planet property
        jetpackActive: false, // Add the jetpack state property
      };

      games[gameCode].currentPlayers = 1;

      // Add player to game mapping
      playerGameMap[socket.id] = gameCode;

      // Join the socket room for this game
      socket.join(gameCode);

      // Send game code back to host
      socket.emit("gameHosted", { gameCode, success: true });

      // Send basic game state (player info)
      socket.emit("gameState", {
        playerId: socket.id,
        players: games[gameCode].players,
        worldBlocks: games[gameCode].worldBlocks,
        hasRocket: games[gameCode].hasRocket,
        rocketPosition: games[gameCode].rocketPosition,
        currentPlanet: "earth",
      });

      console.log(`New game created: ${gameCode} by ${socket.id}`);
    } catch (error) {
      console.error("Error hosting game:", error);
      socket.emit("gameHosted", {
        success: false,
        error: "Failed to host game",
      });
    }
  });

  // Add a new event handler to receive the world data from the host
  socket.on("uploadWorldData", (data) => {
    const gameCode = playerGameMap[socket.id];

    if (gameCode && games[gameCode] && socket.id === games[gameCode].host) {
      console.log(`Received world data from host for game ${gameCode}`);

      // Store the complete world data
      games[gameCode].worldBlocks = data.worldBlocks;
      games[gameCode].worldGenerated = true;

      console.log("World data stored successfully");
    }
  });

  // Handle joining an existing game
  socket.on("joinGame", (data) => {
    const gameCode = data.gameCode;

    // Check if game exists
    if (!games[gameCode]) {
      socket.emit("joinResponse", {
        success: false,
        message: "Game not found",
      });
      return;
    }

    // Check if game is full
    if (games[gameCode].currentPlayers >= games[gameCode].maxPlayers) {
      socket.emit("joinResponse", {
        success: false,
        message: "Game is full",
      });
      return;
    }

    // Make sure players object exists
    if (!games[gameCode].players) {
      games[gameCode].players = {};
    }

    // Add player to the game
    games[gameCode].players[socket.id] = {
      id: socket.id,
      x: 100 + Math.random() * 50,
      y: 100,
      direction: 1,
      onGround: false,
      velocityX: 0,
      velocityY: 0,
      health: 100,
      currentTool: "pickaxe-basic",
      depth: 0,
      currentPlanet: "earth", // Default to earth
      jetpackActive: false, // Add the jetpack state property
    };
    games[gameCode].currentPlayers++;

    // Map player to game
    playerGameMap[socket.id] = gameCode;

    // Join the socket room for this game
    socket.join(gameCode);

    // Send success response
    socket.emit("joinResponse", {
      success: true,
      gameCode: gameCode,
      gameName: games[gameCode].name,
    });

    // Create a filtered version of players on the same planet
    const playersOnSamePlanet = {};
    for (const playerId in games[gameCode].players) {
      if (games[gameCode].players[playerId].currentPlanet === "earth") {
        playersOnSamePlanet[playerId] = games[gameCode].players[playerId];
      }
    }

    // Send game state to the new player
    socket.emit("gameState", {
      playerId: socket.id,
      players: playersOnSamePlanet,
      worldBlocks: games[gameCode].worldBlocks,
      hasRocket: games[gameCode].hasRocket,
      rocketPosition: games[gameCode].rocketPosition,
      currentPlanet: "earth",
    });

    // Broadcast new player to others in the same game
    socket.to(gameCode).emit("newPlayer", games[gameCode].players[socket.id]);

    console.log(`Player ${socket.id} joined game: ${gameCode}`);
  });

  // Handle player movement
  socket.on("playerMove", (data) => {
    const gameCode = playerGameMap[socket.id];

    if (
      gameCode &&
      games[gameCode] &&
      games[gameCode].players &&
      games[gameCode].players[socket.id]
    ) {
      // Update player position
      games[gameCode].players[socket.id].x = data.x;
      games[gameCode].players[socket.id].y = data.y;
      games[gameCode].players[socket.id].direction = data.direction;
      games[gameCode].players[socket.id].velocityX = data.velocityX;
      games[gameCode].players[socket.id].velocityY = data.velocityY;
      games[gameCode].players[socket.id].onGround = data.onGround;
      games[gameCode].players[socket.id].depth = data.depth;

      // Get current player's planet
      const currentPlanet = games[gameCode].players[socket.id].currentPlanet;

      // Safely broadcast to other players
      for (const playerId in games[gameCode].players) {
        if (
          playerId !== socket.id &&
          games[gameCode].players[playerId].currentPlanet === currentPlanet
        ) {
          io.to(playerId).emit("playerMoved", {
            id: socket.id,
            ...data,
          });
        }
      }
    }
  });

  // Handle block mining
  socket.on("blockMined", (data) => {
    const gameCode = playerGameMap[socket.id];

    if (gameCode && games[gameCode]) {
      // Update shared world state
      if (!games[gameCode].worldBlocks[data.y]) {
        games[gameCode].worldBlocks[data.y] = {};
      }
      games[gameCode].worldBlocks[data.y][data.x] = null; // Remove the block

      // Broadcast block change to all players in the same game
      io.to(gameCode).emit("worldUpdated", {
        x: data.x,
        y: data.y,
        block: null,
      });
    }
  });

  // Handle player tool change
  socket.on("toolChanged", (data) => {
    const gameCode = playerGameMap[socket.id];

    if (gameCode && games[gameCode] && games[gameCode].players[socket.id]) {
      games[gameCode].players[socket.id].currentTool = data.tool;

      // Get current player's planet
      const currentPlanet = games[gameCode].players[socket.id].currentPlanet;

      // Broadcast tool change to players on the same planet
      Object.keys(games[gameCode].players).forEach((playerId) => {
        if (
          playerId !== socket.id &&
          games[gameCode].players[playerId].currentPlanet === currentPlanet
        ) {
          io.to(playerId).emit("playerToolChanged", {
            id: socket.id,
            tool: data.tool,
          });
        }
      });
    }
  });

  // Handle rocket purchase
  socket.on("rocketPurchased", (data) => {
    const gameCode = playerGameMap[socket.id];

    if (gameCode && games[gameCode]) {
      // Update game state
      games[gameCode].hasRocket = true;
      games[gameCode].rocketPosition = {
        x: data.rocketX,
        y: data.rocketY,
      };

      // Broadcast to all players in the game
      io.to(gameCode).emit("rocketPurchased", {
        playerId: socket.id,
        rocketX: data.rocketX,
        rocketY: data.rocketY,
      });

      console.log(`Player ${socket.id} purchased a rocket in game ${gameCode}`);
    }
  });

  // Handle rocket position updates
  socket.on("rocketPosition", (data) => {
    const gameCode = playerGameMap[socket.id];

    if (gameCode && games[gameCode]) {
      // Update rocket position in game state
      games[gameCode].rocketPosition = {
        x: data.x,
        y: data.y,
      };

      // Broadcast to all other players in the game
      socket.to(gameCode).emit("rocketPositionUpdate", {
        x: data.x,
        y: data.y,
      });
    }
  });

  socket.on("rocketLaunched", (data) => {
    const gameCode = playerGameMap[socket.id];

    if (
      gameCode &&
      games[gameCode] &&
      games[gameCode].players &&
      games[gameCode].players[socket.id]
    ) {
      const oldPlanet = games[gameCode].players[socket.id].currentPlanet;
      const newPlanet = data.targetPlanet;

      // Don't update if the player is already on that planet
      if (oldPlanet === newPlanet) {
        console.log(
          `Player ${socket.id} already on planet ${newPlanet}, no update needed`
        );
        return;
      }

      // Update THIS PLAYER'S current planet
      games[gameCode].players[socket.id].currentPlanet = newPlanet;

      // Broadcast rocket launch to all players in the game
      io.to(gameCode).emit("rocketLaunched", {
        playerId: socket.id,
        targetPlanet: newPlanet,
      });

      console.log(
        `Player ${socket.id} launched rocket from ${oldPlanet} to ${newPlanet}`
      );
    } else {
      console.error(
        `Invalid game data for player ${socket.id} in rocketLaunched event`
      );
      // Send error to client
      socket.emit("serverError", {
        event: "rocketLaunched",
        message: "Invalid game data",
      });
    }
  });

  // Handle planet change
  socket.on("planetChanged", (data) => {
    const gameCode = playerGameMap[socket.id];

    if (
      gameCode &&
      games[gameCode] &&
      games[gameCode].players &&
      games[gameCode].players[socket.id]
    ) {
      const oldPlanet = games[gameCode].players[socket.id].currentPlanet;
      const newPlanet = data.planet;

      // Don't update if the player is already on that planet
      if (oldPlanet === newPlanet) {
        console.log(
          `Player ${socket.id} already on planet ${newPlanet}, no update needed`
        );
        return;
      }

      // Update THIS PLAYER'S current planet
      games[gameCode].players[socket.id].currentPlanet = newPlanet;

      console.log(
        `Player ${socket.id} changed planet from ${oldPlanet} to ${newPlanet}`
      );

      // Broadcast planet change to all players in the game
      io.to(gameCode).emit("planetChanged", {
        playerId: socket.id,
        planet: newPlanet,
      });
    } else {
      console.error(
        `Invalid game data for player ${socket.id} in planetChanged event`
      );
      // Send error to client
      socket.emit("serverError", {
        event: "planetChanged",
        message: "Invalid game data",
      });
    }
  });

  // Handle getting players on a specific planet (REMOVE DUPLICATE)
  socket.on("getPlayersOnPlanet", (data) => {
    const gameCode = playerGameMap[socket.id];

    if (gameCode && games[gameCode] && games[gameCode].players) {
      const requestedPlanet = data.planet || "earth";
      console.log(
        `Player ${socket.id} requesting players on ${requestedPlanet}`
      );

      // Filter players on the requested planet
      const playersOnPlanet = {};
      for (const playerId in games[gameCode].players) {
        if (
          games[gameCode].players[playerId].currentPlanet === requestedPlanet
        ) {
          playersOnPlanet[playerId] = games[gameCode].players[playerId];
        }
      }

      // Log the response for debugging
      console.log(
        `Sending ${
          Object.keys(playersOnPlanet).length
        } players on ${requestedPlanet} to ${socket.id}`
      );

      // Send filtered player list to the client
      socket.emit("playersOnPlanet", {
        players: playersOnPlanet,
        planet: requestedPlanet,
      });
    } else {
      console.error(
        `Invalid game data for player ${socket.id} in getPlayersOnPlanet event`
      );
      // Send empty response to avoid client-side errors
      socket.emit("playersOnPlanet", {
        players: {},
        planet: data.planet || "earth",
        error: "Invalid game data",
      });
    }
  });

  // Handle jetpack activation
  socket.on("jetpackActivated", () => {
    const gameCode = playerGameMap[socket.id];

    if (gameCode && games[gameCode] && games[gameCode].players[socket.id]) {
      // Store the jetpack state
      games[gameCode].players[socket.id].jetpackActive = true;

      // Get current player's planet
      const currentPlanet = games[gameCode].players[socket.id].currentPlanet;

      // Broadcast to players on the same planet
      Object.keys(games[gameCode].players).forEach((playerId) => {
        if (
          playerId !== socket.id &&
          games[gameCode].players[playerId].currentPlanet === currentPlanet
        ) {
          io.to(playerId).emit("playerJetpackActivated", {
            id: socket.id,
          });
        }
      });
    }
  });

  // Handle jetpack deactivation
  socket.on("jetpackDeactivated", () => {
    const gameCode = playerGameMap[socket.id];

    if (gameCode && games[gameCode] && games[gameCode].players[socket.id]) {
      // Update jetpack state
      games[gameCode].players[socket.id].jetpackActive = false;

      // Get current player's planet
      const currentPlanet = games[gameCode].players[socket.id].currentPlanet;

      // Broadcast to players on the same planet
      Object.keys(games[gameCode].players).forEach((playerId) => {
        if (
          playerId !== socket.id &&
          games[gameCode].players[playerId].currentPlanet === currentPlanet
        ) {
          io.to(playerId).emit("playerJetpackDeactivated", {
            id: socket.id,
          });
        }
      });
    }
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log("Player disconnected:", socket.id);

    // Get the game this player was in
    const gameCode = playerGameMap[socket.id];

    if (gameCode && games[gameCode]) {
      // Remove player from the game
      delete games[gameCode].players[socket.id];
      games[gameCode].currentPlayers--;

      // Notify other players in the same game
      io.to(gameCode).emit("playerDisconnected", socket.id);

      // If this was the host or the last player, clean up the game
      if (
        socket.id === games[gameCode].host ||
        games[gameCode].currentPlayers === 0
      ) {
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
