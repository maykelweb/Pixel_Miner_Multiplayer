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
        maxPlayers: options.maxPlayers || 4,
        players: {}, // Initialize empty players object
        // Store separate blockmaps for Earth and Moon
        worldBlocksEarth: {},
        worldBlocksMoon: {},
        worldGeneratedEarth: false,
        worldGeneratedMoon: false,
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
    });

    // Use the player's actual current planet instead of hardcoding "earth"
    // Get the appropriate world data for the planet the player is joining
    const currentPlanet = games[gameCode].players[socket.id].currentPlanet;
    let worldData = {};

    // Create a filtered version of players on the same planet
    const playersOnSamePlanet = {};
    for (const playerId in games[gameCode].players) {
      if (games[gameCode].players[playerId].currentPlanet === currentPlanet) {
        playersOnSamePlanet[playerId] = games[gameCode].players[playerId];
      }
    }

    // Check if world data is generated for the player's current planet
    const worldGenerated =
      currentPlanet === "earth"
        ? games[gameCode].worldGeneratedEarth
        : games[gameCode].worldGeneratedMoon;

    if (!worldGenerated) {
      if (!games[gameCode].pendingWorldDataRequests) {
        games[gameCode].pendingWorldDataRequests = [];
      }
      console.log(
        `Adding player ${socket.id} to pending world data requests for ${currentPlanet}`
      );
      games[gameCode].pendingWorldDataRequests.push({
        id: socket.id,
        planet: currentPlanet,
      });
    }

    // Get the appropriate world data based on the player's planet
    if (worldGenerated) {
      worldData =
        currentPlanet === "earth"
          ? games[gameCode].worldBlocksEarth
          : games[gameCode].worldBlocksMoon;
    }

    // Log what we're sending
    const worldSize = Object.keys(worldData).length;
    console.log(`Sending world data to joining player (${worldSize} rows)`);

    if (worldSize === 0 && worldGenerated) {
      console.log(
        "Warning: World is marked as generated but contains 0 rows. This may indicate a problem."
      );
    }

    // Ensure rocket info is properly initialized in game object
    if (!games[gameCode].hasRocket) {
      games[gameCode].hasRocket = false;
    }

    if (!games[gameCode].rocketPosition) {
      games[gameCode].rocketPosition = { x: 0, y: 0 };
    }

    // Send game state to the new player
    socket.emit("gameState", {
      playerId: socket.id,
      players: playersOnSamePlanet,
      worldBlocks: worldData,
      hasRocket: games[gameCode].hasRocket,
      rocketPosition: games[gameCode].rocketPosition,
      currentPlanet: currentPlanet,
      worldGenerated: worldGenerated, // Add this flag so client knows if world data should be expected
    });

    // Broadcast new player to others in the same game
    socket.to(gameCode).emit("newPlayer", games[gameCode].players[socket.id]);

    console.log(`Player ${socket.id} joined game: ${gameCode}`);
  });

  socket.on("requestWorldData", (data) => {
    const gameCode = playerGameMap[socket.id];

    if (!gameCode) {
      console.log(
        `Player ${socket.id} requested world data but is not in a game yet`
      );
      socket.emit("worldDataResponse", {
        success: false,
        message: "You are not in a game yet",
      });
      return;
    }

    if (!games[gameCode]) {
      console.log(
        `Player ${socket.id} requested world data but game ${gameCode} doesn't exist`
      );
      socket.emit("worldDataResponse", {
        success: false,
        message: "Game not found",
      });
      return;
    }

    // Determine which planet's data to check
    const requestedPlanet = data.planet || "earth";
    const worldGeneratedForPlanet =
      requestedPlanet === "earth"
        ? games[gameCode].worldGeneratedEarth
        : games[gameCode].worldGeneratedMoon;

    // Check if world data exists for the requested planet
    if (!worldGeneratedForPlanet) {
      console.log(
        `Player ${socket.id} requested ${requestedPlanet} data but it's not generated in game ${gameCode} yet`
      );
      socket.emit("worldDataResponse", {
        success: false,
        message: `${requestedPlanet} world not generated yet`,
        gameCode: gameCode,
        planet: requestedPlanet,
      });
      return;
    }

    // Get the appropriate world data
    const worldData =
      requestedPlanet === "earth"
        ? games[gameCode].worldBlocksEarth || {}
        : games[gameCode].worldBlocksMoon || {};

    const worldSize = Object.keys(worldData).length;
    console.log(
      `Sending requested ${requestedPlanet} world data to player ${socket.id} (${worldSize} rows)`
    );

    // Send the world data response with rocket information and planet type
    socket.emit("worldDataResponse", {
      success: true,
      worldBlocks: worldData,
      gameCode: gameCode,
      hasRocket: games[gameCode].hasRocket,
      rocketPosition: games[gameCode].rocketPosition,
      planet: requestedPlanet,
      message: `${requestedPlanet} world data with ${worldSize} rows sent successfully`,
    });
  });

  // Add a new event handler to receive the world data from the host
  // Handler for starting a chunked world upload
  socket.on("startWorldUpload", (data) => {
    const gameCode = playerGameMap[socket.id];
    console.log(
      `Starting chunked world upload from ${socket.id} for game ${
        gameCode || "undefined"
      }`
    );

    if (!gameCode) {
      console.error("Error: No game code found for player", socket.id);
      socket.emit("uploadWorldError", {
        message:
          "No game code associated with player. Please try again after game creation is complete.",
      });
      return;
    }

    if (!games[gameCode]) {
      console.error("Error: Game not found:", gameCode);
      socket.emit("uploadWorldError", { message: "Game not found" });
      return;
    }

    // Check if sender is host
    if (socket.id !== games[gameCode].host) {
      console.error("Error: Only host can upload world data");
      socket.emit("uploadWorldError", {
        message: "Only host can upload world data",
      });
      return;
    }

    // Store the planet type for this upload
    const planetType = data.planetType || "earth";
    console.log(
      `Starting chunked world upload for ${planetType} from ${socket.id}`
    );

    // Import rocket data from the host's upload
    if (data.hasRocket === true && data.rocketPosition) {
      console.log("Received rocket information from host:", data.hasRocket);
      games[gameCode].hasRocket = true;
      games[gameCode].rocketPosition = data.rocketPosition;
      console.log("Rocket position:", data.rocketPosition);
    } else {
      // For new worlds, ensure rocket is not present
      games[gameCode].hasRocket = false;
      games[gameCode].rocketPosition = { x: 0, y: 0 };
      console.log("No rocket in this world data upload");
    }

    // Initialize temporary storage for the chunked upload
    if (!games[gameCode].worldUpload) {
      games[gameCode].worldUpload = {
        chunks: {},
        receivedChunks: 0,
        totalChunks: 0,
        isComplete: false,
        startTime: Date.now(),
        planetType: planetType,
      };
    } else {
      // Reset if there was a previous upload in progress
      games[gameCode].worldUpload = {
        chunks: {},
        receivedChunks: 0,
        totalChunks: 0,
        isComplete: false,
        startTime: Date.now(),
        planetType: planetType,
      };
    }

    // Acknowledge start of upload
    socket.emit("worldUploadStarted", {
      success: true,
      message: `Ready to receive ${planetType} world chunks`,
    });
  });

  // Handler for receiving individual world chunks
  socket.on("worldChunk", (data) => {
    const gameCode = playerGameMap[socket.id];

    if (!gameCode || !games[gameCode] || !games[gameCode].worldUpload) {
      console.error("Error: No active world upload found");
      socket.emit("uploadWorldError", {
        message: "No active world upload found",
      });
      return;
    }

    // Update total chunks on first chunk if not set
    if (games[gameCode].worldUpload.totalChunks === 0) {
      games[gameCode].worldUpload.totalChunks = data.totalChunks;
    }

    // Store this chunk
    games[gameCode].worldUpload.chunks[data.chunkIndex] = data.chunkData;
    games[gameCode].worldUpload.receivedChunks++;

    console.log(
      `Received chunk ${data.chunkIndex + 1}/${data.totalChunks} with ${
        data.rowCount
      } rows for game ${gameCode}`
    );

    // Acknowledge receipt
    socket.emit("worldChunkReceived", {
      chunkIndex: data.chunkIndex,
      receivedChunks: games[gameCode].worldUpload.receivedChunks,
      totalChunks: data.totalChunks,
    });
  });

  // Handler for finalizing the world upload
  socket.on("finishWorldUpload", (data) => {
    const gameCode = playerGameMap[socket.id];

    if (!gameCode || !games[gameCode] || !games[gameCode].worldUpload) {
      console.error("Error: No active world upload found");
      socket.emit("uploadWorldError", {
        message: "No active world upload found",
      });
      return;
    }

    console.log(`Finalizing world upload for game ${gameCode}`);

    try {
      // Check if we have all the expected chunks
      if (
        games[gameCode].worldUpload.receivedChunks <
        games[gameCode].worldUpload.totalChunks
      ) {
        console.error(
          `Error: Missing chunks. Received ${games[gameCode].worldUpload.receivedChunks}/${games[gameCode].worldUpload.totalChunks}`
        );
        socket.emit("uploadWorldError", {
          message: `Missing chunks. Received ${games[gameCode].worldUpload.receivedChunks}/${games[gameCode].worldUpload.totalChunks}`,
        });
        return;
      }

      // Combine all chunks into the final world data
      const worldBlocks = {};
      const uploadData = games[gameCode].worldUpload;

      // Process each chunk
      for (let i = 0; i < uploadData.totalChunks; i++) {
        const chunkData = uploadData.chunks[i];
        if (!chunkData) {
          console.error(`Error: Missing chunk ${i}`);
          continue;
        }

        // Merge chunk data into world blocks
        for (const y in chunkData) {
          worldBlocks[y] = chunkData[y];
        }
      }

      // Verify we have data
      const rowCount = Object.keys(worldBlocks).length;
      if (rowCount === 0) {
        console.error("Error: No data in combined world");
        socket.emit("uploadWorldError", {
          message: "No data in combined world",
        });
        return;
      }

      console.log(`Successfully combined ${rowCount} rows of world data`);

      // Determine which planet's blockmap to update
      const planetType = games[gameCode].worldUpload.planetType || "earth";

      // Store the world data in the appropriate planet's blockmap
      if (planetType === "earth") {
        games[gameCode].worldBlocksEarth = worldBlocks;
        games[gameCode].worldGeneratedEarth = true;
        console.log(
          `Earth world data with ${rowCount} rows successfully stored for game ${gameCode}`
        );
      } else if (planetType === "moon") {
        games[gameCode].worldBlocksMoon = worldBlocks;
        games[gameCode].worldGeneratedMoon = true;
        console.log(
          `Moon world data with ${rowCount} rows successfully stored for game ${gameCode}`
        );
      }

      // Handle pending players who are waiting for this specific planet's data
      if (
        games[gameCode].pendingWorldDataRequests &&
        games[gameCode].pendingWorldDataRequests.length > 0
      ) {
        const pendingForThisPlanet = games[
          gameCode
        ].pendingWorldDataRequests.filter(
          (req) =>
            (!req.planet && planetType === "earth") || req.planet === planetType
        );

        if (pendingForThisPlanet.length > 0) {
          console.log(
            `Sending ${planetType} data to ${pendingForThisPlanet.length} players who joined early`
          );

          pendingForThisPlanet.forEach((request) => {
            const playerId = typeof request === "string" ? request : request.id;
            io.to(playerId).emit("worldDataResponse", {
              success: true,
              worldBlocks: worldBlocks,
              gameCode: gameCode,
              hasRocket: games[gameCode].hasRocket,
              rocketPosition: games[gameCode].rocketPosition,
              planet: planetType,
              message: `${planetType} world data with ${rowCount} rows sent successfully`,
            });
          });

          // Remove processed requests
          games[gameCode].pendingWorldDataRequests = games[
            gameCode
          ].pendingWorldDataRequests.filter((req) => {
            if (typeof req === "string") return planetType !== "earth";
            return req.planet !== planetType;
          });
        }
      }

      // Send acknowledgment to client
      socket.emit("worldDataReceived", {
        success: true,
        rowCount: rowCount,
        planet: planetType,
        message: `${planetType} world data stored successfully`,
        processingTime:
          (Date.now() - games[gameCode].worldUpload.startTime) / 1000,
      });

      // Notify all other players in the game that world data is now available
      socket.to(gameCode).emit("worldAvailable", {
        rowCount: rowCount,
        planet: planetType,
      });

      // Clean up the temporary storage
      delete games[gameCode].worldUpload;
    } catch (error) {
      console.error("Error finalizing world upload:", error);
      socket.emit("uploadWorldError", {
        message: "Error processing world data: " + error.message,
      });
    }
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

      // Update current planet if provided
      if (data.currentPlanet) {
        games[gameCode].players[socket.id].currentPlanet = data.currentPlanet;
      }

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

  // Handle mining start event
  socket.on("miningStart", (data) => {
    const gameCode = playerGameMap[socket.id];

    if (
      gameCode &&
      games[gameCode] &&
      games[gameCode].players &&
      games[gameCode].players[socket.id]
    ) {
      // Store mining state in the player object
      if (!games[gameCode].players[socket.id].mining) {
        games[gameCode].players[socket.id].mining = {};
      }

      games[gameCode].players[socket.id].mining = {
        active: true,
        x: data.x,
        y: data.y,
        tool: data.tool,
        toolId: data.toolId, // Store tool ID if provided
        startTime: Date.now(),
      };

      // Get current player's planet
      const currentPlanet = games[gameCode].players[socket.id].currentPlanet;

      // Broadcast to players on the same planet
      Object.keys(games[gameCode].players).forEach((playerId) => {
        if (
          playerId !== socket.id &&
          games[gameCode].players[playerId].currentPlanet === currentPlanet
        ) {
          io.to(playerId).emit("playerMiningStart", {
            id: socket.id,
            x: data.x,
            y: data.y,
            tool: data.tool,
            toolId: data.toolId,
            direction: games[gameCode].players[socket.id].direction,
          });
        }
      });
    }
  });

  // Handle mining stop event
  socket.on("miningStop", () => {
    const gameCode = playerGameMap[socket.id];

    if (
      gameCode &&
      games[gameCode] &&
      games[gameCode].players &&
      games[gameCode].players[socket.id]
    ) {
      // Update mining state
      if (games[gameCode].players[socket.id].mining) {
        games[gameCode].players[socket.id].mining.active = false;
      }

      // Get current player's planet
      const currentPlanet = games[gameCode].players[socket.id].currentPlanet;

      // Broadcast to players on the same planet
      Object.keys(games[gameCode].players).forEach((playerId) => {
        if (
          playerId !== socket.id &&
          games[gameCode].players[playerId].currentPlanet === currentPlanet
        ) {
          io.to(playerId).emit("playerMiningStop", {
            id: socket.id,
          });
        }
      });
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

  // Handle getting players on a specific planet
  socket.on("getPlayersOnPlanet", (data) => {
    const gameCode = playerGameMap[socket.id];

    // First check if player is in a game
    if (!gameCode) {
      console.log(
        `Player ${socket.id} requested players but is not in a game yet`
      );
      // Send empty response with helpful error message
      socket.emit("playersOnPlanet", {
        players: {},
        planet: data.planet || "earth",
        error: "Please join a game first",
      });
      return;
    }

    // Then check if the game exists
    if (!games[gameCode]) {
      console.log(
        `Player ${socket.id} requested players but game ${gameCode} doesn't exist`
      );
      // Send empty response with error message
      socket.emit("playersOnPlanet", {
        players: {},
        planet: data.planet || "earth",
        error: "Game not found",
      });
      return;
    }

    // Now check if players object exists
    if (!games[gameCode].players) {
      console.log(
        `Player ${socket.id} requested players but players object doesn't exist in game ${gameCode}`
      );
      // Initialize players object and send empty response
      games[gameCode].players = {};
      socket.emit("playersOnPlanet", {
        players: {},
        planet: data.planet || "earth",
        error: "No players in game yet",
      });
      return;
    }

    // All checks passed, proceed normally
    const requestedPlanet = data.planet || "earth";
    console.log(`Player ${socket.id} requesting players on ${requestedPlanet}`);

    // Filter players on the requested planet
    const playersOnPlanet = {};
    for (const playerId in games[gameCode].players) {
      if (games[gameCode].players[playerId].currentPlanet === requestedPlanet) {
        // Make sure we include all necessary state, including mining status
        playersOnPlanet[playerId] = {
          ...games[gameCode].players[playerId],
          // Ensure mining data is included if it exists
          mining: games[gameCode].players[playerId].mining || {
            active: false,
          },
        };
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

  // Handle tool rotation updates
  socket.on("toolRotation", (data) => {
    const gameCode = playerGameMap[socket.id];

    if (gameCode && games[gameCode] && games[gameCode].players[socket.id]) {
      // Store the tool rotation data in the player object
      if (!games[gameCode].players[socket.id].toolRotation) {
        games[gameCode].players[socket.id].toolRotation = {};
      }

      games[gameCode].players[socket.id].toolRotation.angle = data.angle;
      games[gameCode].players[socket.id].toolRotation.direction =
        data.direction;

      // Get current player's planet
      const currentPlanet = games[gameCode].players[socket.id].currentPlanet;

      // Broadcast to players on the same planet
      Object.keys(games[gameCode].players).forEach((playerId) => {
        if (
          playerId !== socket.id &&
          games[gameCode].players[playerId].currentPlanet === currentPlanet
        ) {
          io.to(playerId).emit("playerToolRotation", {
            id: socket.id,
            angle: data.angle,
            direction: data.direction,
          });
        }
      });
    }
  });

  // Handle laser activation
  socket.on("laserActivated", () => {
    const gameCode = playerGameMap[socket.id];

    if (gameCode && games[gameCode] && games[gameCode].players[socket.id]) {
      // Store the laser state in the player object
      games[gameCode].players[socket.id].laserActive = true;

      // Get current player's planet
      const currentPlanet = games[gameCode].players[socket.id].currentPlanet;

      // Broadcast to players on the same planet
      Object.keys(games[gameCode].players).forEach((playerId) => {
        if (
          playerId !== socket.id &&
          games[gameCode].players[playerId].currentPlanet === currentPlanet
        ) {
          io.to(playerId).emit("playerLaserActivated", {
            id: socket.id,
          });
        }
      });
    }
  });

  // Handle laser deactivation
  socket.on("laserDeactivated", () => {
    const gameCode = playerGameMap[socket.id];

    if (gameCode && games[gameCode] && games[gameCode].players[socket.id]) {
      // Update laser state
      games[gameCode].players[socket.id].laserActive = false;

      // Get current player's planet
      const currentPlanet = games[gameCode].players[socket.id].currentPlanet;

      // Broadcast to players on the same planet
      Object.keys(games[gameCode].players).forEach((playerId) => {
        if (
          playerId !== socket.id &&
          games[gameCode].players[playerId].currentPlanet === currentPlanet
        ) {
          io.to(playerId).emit("playerLaserDeactivated", {
            id: socket.id,
          });
        }
      });

      console.log(`Player ${socket.id} deactivated laser in game ${gameCode}`);
    }
  });

  // Handle laser update (angle)
  socket.on("laserUpdate", (data) => {
    const gameCode = playerGameMap[socket.id];

    if (gameCode && games[gameCode] && games[gameCode].players[socket.id]) {
      // Store the laser angle in player data
      games[gameCode].players[socket.id].laserAngle = data.angle;

      // Get current player's planet
      const currentPlanet = games[gameCode].players[socket.id].currentPlanet;

      // Broadcast to players on the same planet
      Object.keys(games[gameCode].players).forEach((playerId) => {
        if (
          playerId !== socket.id &&
          games[gameCode].players[playerId].currentPlanet === currentPlanet
        ) {
          io.to(playerId).emit("playerLaserUpdate", {
            id: socket.id,
            angle: data.angle,
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
