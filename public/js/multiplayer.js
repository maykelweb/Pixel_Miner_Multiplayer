// multiplayer.js - Client-side socket handling
import { gameState } from "./config.js";
import { playerElement, showMessage } from "./setup.js";
import { updateVisibleBlocks } from "./updates.js";
import { createBreakingAnimation } from "./animations.js";
import { getCurrentTool } from "./crafting.js";
import { hideLoadingScreen, showLoadingScreen } from "./main.js";
import { initializeRocket, updateRocketPosition } from "./rocket.js";

// Socket.io client
let socket;
let isConnected = false;
let otherPlayers = {}; // Store references to other player elements
let currentGameCode = ""; // Store the current game code
let hasShownGameCode = false;

/**
 * Initialize connection to multiplayer server
 * @param {boolean} isHost - Whether this client is hosting the game
 * @param {Object} options - Additional options for hosting
 */
export function initMultiplayer(isHost = false, options = {}) {
  // Connect to the server
  socket = io(); // Assumes Socket.IO is loaded in the HTML
  isConnected = true;

  // Handle successful connection
  socket.on("connect", () => {
    console.log("Connected to server with ID:", socket.id);

    // If hosting, send host information to server
    if (isHost) {
      socket.emit("hostGame", {
        maxPlayers: options.maxPlayers || 4,
      });
      showMessage("Hosting a new game!", 3000);
    } else {
      // If joining, send the game code to join
      const gameCode = options.gameCode;
      if (gameCode) {
        socket.emit("joinGame", {
          gameCode: gameCode,
        });
        showMessage("Joining game: " + gameCode, 3000);
      } else {
        showMessage("Joining random game...", 3000);
      }
    }

    // Add player info display
    const infoPanel = document.getElementById("info-panel");
    const playerCountDisplay = document.createElement("div");
    playerCountDisplay.id = "player-count";
    playerCountDisplay.className = "status-item";
    playerCountDisplay.innerHTML =
      '<span class="player-icon">👥</span><span id="player-count-value">1</span>';
    infoPanel.appendChild(playerCountDisplay);

    // Important: After successful connection, immediately send our tool information
    // This ensures other players can see our tool correctly from the start
    setTimeout(() => {
      sendInitialToolInfo();
    }, 1000); // Small delay to ensure game state is fully loaded
  });

  // Handle hosting response
  socket.on("gameHosted", (data) => {
    currentGameCode = data.gameCode;
    console.log("Game created with code:", currentGameCode);

    // Display the game code for the host
    showGameCode(currentGameCode);
    // Update game code in pause menu
    updatePauseMenuGameCode(currentGameCode);

    // For the host, we need to wait until the world is generated before uploading it
    if (isHost) {
      // Set a flag to indicate we need to upload the world
      gameState.needToUploadWorld = true;
    }
  });

  // Handle join response
  socket.on("joinResponse", (data) => {
    if (data.success) {
      currentGameCode = data.gameCode;
      showMessage("Successfully joined game: " + data.gameCode, 3000);
      // Update game code in pause menu
      updatePauseMenuGameCode(currentGameCode);
    } else {
      showMessage("Failed to join game: " + data.message, 3000);
    }
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    isConnected = false;
    showMessage("Disconnected from server. Attempting to reconnect...", 3000);
  });

  // Handle initial game state
  socket.on("gameState", (data) => {
    // Set local player ID
    gameState.playerId = data.playerId;

    // Clear any existing other players first
    for (const id in otherPlayers) {
      removeOtherPlayer(id);
    }

    // Initialize other players (already filtered by planet on the server)
    for (const id in data.players) {
      if (id !== gameState.playerId) {
        // First add the other player
        addOtherPlayer(id, data.players[id]);

        // Check for active tools and states
        const playerData = data.players[id];

        if (playerData.currentTool) {
          updateOtherPlayerTool(id, playerData.currentTool);
        } else if (playerData.toolId) {
          // Alternative property name that might be used
          updateOtherPlayerTool(id, playerData.toolId);
        }

        // Check if player has active laser and display it
        if (playerData.laserActive) {
          const playerElement = otherPlayers[id].element;
          const laserBeam = playerElement.querySelector(".other-player-laser");

          if (laserBeam) {
            laserBeam.style.display = "block";

            // Set angle if available
            if (playerData.laserAngle !== undefined) {
              laserBeam.style.transform = `rotate(${playerData.laserAngle}deg)`;
              otherPlayers[id].laser.angle = playerData.laserAngle;
            }
          }
        }

        // Now properly check for active jetpack and display it
        if (data.players[id].jetpackActive === true) {
          const playerElement = otherPlayers[id].element;

          // Find the jetpack flame element (should already exist from addOtherPlayer)
          const jetpackFlame = playerElement.querySelector(".jetpack-flame");
          if (jetpackFlame) {
            // Make it visible
            jetpackFlame.style.display = "block";

            // Update the state in our local tracking object
            otherPlayers[id].jetpackActive = true;
          }
        }
      }
    }

    // Update player count
    updatePlayerCount(Object.keys(data.players).length);

    // Handle world data if we're not the host or if we're rejoining
    const hasWorldData =
      data.worldBlocks && Object.keys(data.worldBlocks).length > 0;
    const worldDataExpected = data.worldGenerated === true;

    // Handle rocket data - Always check for rocket information
    if (data.hasRocket === true) {
      gameState.hasRocket = true;
      gameState.rocketPlaced = true;

      if (data.rocketPosition) {
        gameState.rocket.x = data.rocketPosition.x;
        gameState.rocket.y = data.rocketPosition.y;
        gameState.rocketX = data.rocketPosition.x / gameState.blockSize;
        gameState.rocketY = data.rocketPosition.y / gameState.blockSize;

        // Initialize the rocket element
        if (typeof initializeRocket === "function") {
          initializeRocket();
        }
      }
    }

    if (!isHost && hasWorldData) {
      try {
        // Clear any existing block map to prevent mixing
        gameState.blockMap = [];

        // Find the maximum Y value in the received data
        const maxY = Math.max(...Object.keys(data.worldBlocks).map(Number));

        // Calculate the maximum X value by checking all rows
        let maxX = 0;
        for (const y in data.worldBlocks) {
          if (data.worldBlocks[y]) {
            const xKeys = Object.keys(data.worldBlocks[y]).map(Number);
            if (xKeys.length > 0) {
              maxX = Math.max(maxX, Math.max(...xKeys));
            }
          }
        }

        // Initialize the entire blockMap with proper dimensions first
        for (let y = 0; y <= maxY; y++) {
          gameState.blockMap[y] = [];

          // Pre-fill the row with nulls to ensure we have a complete array
          for (let x = 0; x <= maxX; x++) {
            gameState.blockMap[y][x] = null;
          }
        }

        // Now fill in the actual block data
        for (const y in data.worldBlocks) {
          const yNum = Number(y);
          for (const x in data.worldBlocks[y]) {
            const xNum = Number(x);
            const blockData = data.worldBlocks[y][x];

            if (blockData === null) {
              gameState.blockMap[yNum][xNum] = null;
            } else if (blockData && blockData.name) {
              // Find the matching ore in our local ores array
              const matchingOre = gameState.ores.find(
                (ore) => ore.name === blockData.name
              );
              if (matchingOre) {
                gameState.blockMap[yNum][xNum] = matchingOre;
              } else {
                console.warn(`Unknown ore received: ${blockData.name}`);
                gameState.blockMap[yNum][xNum] = blockData;
              }
            } else {
              gameState.blockMap[yNum][xNum] = blockData;
            }
          }
        }

        // NEW: Now that we have world data, make the player visible if it was hidden
        if (gameState.isWaitingForWorldData) {
          const playerElement = document.getElementById("player");
          if (playerElement) {
            playerElement.style.visibility = "visible";
          }
          gameState.isWaitingForWorldData = false;
          hideLoadingScreen();
        }
      } catch (error) {
        console.error("Error processing world data:", error);

        // Even on error, make player visible to prevent being stuck
        if (gameState.isWaitingForWorldData) {
          const playerElement = document.getElementById("player");
          if (playerElement) {
            playerElement.style.visibility = "visible";
          }
          gameState.isWaitingForWorldData = false;
          hideLoadingScreen();
        }
      }

      // After everything is set up, update visible blocks
      updateVisibleBlocks();
    } else if (!isHost && !hasWorldData) {
      // MODIFIED: Always request world data if we're not the host and no data was received
      // This handles the case where a player joins before the host uploads the world

      requestWorldData();

      // For better user experience, show a message
      showMessage("Connecting to game world...", 3000);

      // Make sure loading screen shows during this process
      if (gameState.isWaitingForWorldData) {
        showLoadingScreen("Downloading world data...");
      }
    }
  });

  // Handle new player joining
  socket.on("newPlayer", (playerData) => {
    console.log("New player joined:", playerData);

    // Make sure the player doesn't already exist in our list
    if (otherPlayers[playerData.id]) {
      updateOtherPlayerPosition(playerData.id, playerData);
      return;
    }

    // Only add the player if they're on the same planet
    if (playerData.currentPlanet === gameState.currentPlanet) {
      addOtherPlayer(playerData.id, playerData);

      // Update player count
      updatePlayerCount(Object.keys(otherPlayers).length + 1);

      showMessage("New player joined!", 2000);

      // Send our current tool information to make sure the new player sees it correctly
      sendInitialToolInfo();
    } else {
    }
  });

  // Handle players moving
  socket.on("playerMoved", (data) => {
    // Check if the player is not on our list and they're on our planet
    if (
      !otherPlayers[data.id] &&
      data.currentPlanet === gameState.currentPlanet
    ) {
      // Add this player since they're not in our list yet
      addOtherPlayer(data.id, data);
      // Update player count
      updatePlayerCount(Object.keys(otherPlayers).length + 1);
    } else {
      // Normal position update for existing player
      updateOtherPlayerPosition(data.id, data);
    }
  });

  // Handle player tool changes
  socket.on("playerToolChanged", (data) => {
    updateOtherPlayerTool(data.id, data.tool);
  });

  // Handle world updates (blocks mined by others)
  socket.on("worldUpdated", (data) => {
    // Ensure we have a data structure to work with
    if (!gameState.blockMap[data.y]) {
      gameState.blockMap[data.y] = {};
    }

    if (gameState.blockMap[data.y][data.x] !== null) {
      // Show breaking animation if we have block data
      if (
        gameState.blockMap[data.y][data.x] &&
        gameState.blockMap[data.y][data.x].color
      ) {
        createBreakingAnimation(
          data.x,
          data.y,
          gameState.blockMap[data.y][data.x].color
        );
      }

      // Update local block map
      gameState.blockMap[data.y][data.x] = null;

      // Update visible blocks
      updateVisibleBlocks();
    }
  });

  // Handle player disconnections
  socket.on("playerDisconnected", (playerId) => {
    removeOtherPlayer(playerId);

    // Update player count
    updatePlayerCount(Object.keys(otherPlayers).length + 1);

    showMessage("A player has left the game", 2000);
  });

  // Handle mining starts from other players
  socket.on("playerMiningStart", (data) => {
    if (otherPlayers[data.id]) {
      const playerElement = otherPlayers[data.id].element;

      // Store mining data
      otherPlayers[data.id].mining = {
        active: true,
        x: data.x,
        y: data.y,
        tool: data.tool,
      };

      // Add mining animation based on tool type - CALL THE FUNCTION HERE
      applyMiningAnimation(data.id);

      // Add the mining visual effects at the target block location
      addMiningEffectAtBlock(data.x, data.y);
    }
  });

  // Handle mining stops from other players
  socket.on("playerMiningStop", (data) => {
    if (otherPlayers[data.id]) {
      const playerElement = otherPlayers[data.id].element;

      // Find the tool container first
      const toolContainer = playerElement.querySelector(
        ".player-tool-container"
      );

      // Then find the SVG within the container
      const svgElement = toolContainer?.querySelector("svg");

      if (svgElement) {
        // Remove animation classes
        svgElement.classList.remove("drilling");
        svgElement.classList.remove("mining");

        // Clear animation style
        svgElement.style.animation = "";

        // Restore default transform origin if needed
        if (svgElement.classList.contains("pickaxe")) {
          svgElement.style.transformOrigin = "";
        }
      }

      // Clear mining data
      if (otherPlayers[data.id].mining) {
        // Remove any mining effects at the target block
        if (
          otherPlayers[data.id].mining.x !== undefined &&
          otherPlayers[data.id].mining.y !== undefined
        ) {
          removeMiningEffectAtBlock(
            otherPlayers[data.id].mining.x,
            otherPlayers[data.id].mining.y
          );
        }

        // Reset mining state but maintain tool information
        otherPlayers[data.id].mining = {
          active: false,
        };
      }
    }
  });

  socket.on("playerToolRotation", (data) => {
    if (otherPlayers[data.id]) {
      // Store the rotation angle in our player tracking object
      if (!otherPlayers[data.id].toolRotation) {
        otherPlayers[data.id].toolRotation = {};
      }
      otherPlayers[data.id].toolRotation.angle = data.angle;
      otherPlayers[data.id].toolRotation.direction = data.direction;

      // Update the visual rotation of the tool
      updateOtherPlayerToolRotation(data.id);
    }
  });

  // Handle laser activation from other players
  socket.on("playerLaserActivated", (data) => {
    if (otherPlayers[data.id]) {
      const playerElement = otherPlayers[data.id].element;

      // Add laser beam element if it doesn't exist
      let laserBeam = playerElement.querySelector(".other-player-laser");
      if (!laserBeam) {
        laserBeam = document.createElement("div");
        laserBeam.className = "other-player-laser";
        playerElement.appendChild(laserBeam);
      }

      // Show the laser beam
      laserBeam.style.display = "block";

      // Store laser state
      otherPlayers[data.id].laser = {
        active: true,
        angle: otherPlayers[data.id].laser
          ? otherPlayers[data.id].laser.angle || 0
          : 0,
      };

      // Set initial transform with the current angle
      if (otherPlayers[data.id].laser.angle) {
        laserBeam.style.transform = `rotate(${
          otherPlayers[data.id].laser.angle
        }deg)`;
        laserBeam.style.transformOrigin = "left center";
      }

      // Add laser active class to the player element
      playerElement.classList.add("laser-active");
    }
  });

  // Handle laser deactivation from other players
  socket.on("playerLaserDeactivated", (data) => {
    if (otherPlayers[data.id]) {
      const playerElement = otherPlayers[data.id].element;

      // Hide the laser beam
      const laserBeam = playerElement.querySelector(".other-player-laser");
      if (laserBeam) {
        laserBeam.style.display = "none";
      }

      // Update laser state
      if (otherPlayers[data.id].laser) {
        otherPlayers[data.id].laser.active = false;
      }

      // Remove laser active class
      playerElement.classList.remove("laser-active");
    }
  });

  // Handle laser updates (angle) from other players
  socket.on("playerLaserUpdate", (data) => {
    if (otherPlayers[data.id]) {
      // Update the laser angle even if not active yet (could be activated right after)
      if (!otherPlayers[data.id].laser) {
        otherPlayers[data.id].laser = { active: false, angle: data.angle };
      } else {
        otherPlayers[data.id].laser.angle = data.angle;
      }

      // Only update DOM if the laser is active
      if (otherPlayers[data.id].laser.active) {
        const laserBeam = otherPlayers[data.id].element.querySelector(
          ".other-player-laser"
        );
        if (laserBeam) {
          laserBeam.style.transform = `rotate(${data.angle}rad)`;
        }
      }
    }
  });

  socket.on("playerJetpackActivated", (data) => {
    if (otherPlayers[data.id]) {
      const playerElement = otherPlayers[data.id].element;

      // Find the jetpack flame element
      const jetpackFlame = playerElement.querySelector(".jetpack-flame");
      if (jetpackFlame) {
        // Make it visible
        jetpackFlame.style.display = "block";

        // Update state in our tracking object
        otherPlayers[data.id].jetpackActive = true;
      } else {
        // If the flame element doesn't exist for some reason, create it
        const newJetpackFlame = document.createElement("div");
        newJetpackFlame.className = "jetpack-flame";
        newJetpackFlame.style.display = "block";
        playerElement.appendChild(newJetpackFlame);

        // Still update our tracking state
        otherPlayers[data.id].jetpackActive = true;
      }
    }
  });

  socket.on("playerJetpackDeactivated", (data) => {
    if (otherPlayers[data.id]) {
      const playerElement = otherPlayers[data.id].element;

      // Hide the flame
      const jetpackFlame = playerElement.querySelector(".jetpack-flame");
      if (jetpackFlame) {
        jetpackFlame.style.display = "none";
      }

      // Update jetpack state
      otherPlayers[data.id].jetpackActive = false;
    }
  });

  // Handle rocket purchase events
  socket.on("rocketPurchased", (data) => {
    // Update game state to show rocket for everyone
    gameState.hasRocket = true;
    gameState.rocketPlaced = true;

    // Set rocket position if provided
    if (data.rocketX !== undefined && data.rocketY !== undefined) {
      gameState.rocket.x = data.rocketX;
      gameState.rocket.y = data.rocketY;
      gameState.rocketX = data.rocketX / gameState.blockSize;
      gameState.rocketY = data.rocketY / gameState.blockSize;
    }

    // Initialize the rocket element if needed
    initializeRocket();

    // Show message to other players
    showMessage(
      `Player ${data.playerId.substring(0, 3)} bought a rocket!`,
      3000
    );
  });

  // Handle rocket position updates from host
  socket.on("rocketPositionUpdate", (data) => {
    // Update rocket position
    gameState.rocket.x = data.x;
    gameState.rocket.y = data.y;
    gameState.rocketX = data.x / gameState.blockSize;
    gameState.rocketY = data.y / gameState.blockSize;

    // Make sure rocket is visible
    gameState.hasRocket = true;
    gameState.rocketPlaced = true;

    // Update rocket element position
    updateRocketPosition();
  });

  // Handle planet change events
  socket.on("planetChanged", (data) => {
    // If we're not the player who triggered the change
    if (data.playerId !== gameState.playerId) {
      // If we can see this player, remove them from our view
      if (otherPlayers[data.playerId]) {
        console.log(
          `Removing player ${data.playerId} who changed to planet ${data.planet}`
        );
        removeOtherPlayer(data.playerId);

        // Update player count after removal
        updatePlayerCount(Object.keys(otherPlayers).length + 1);

        // Show message about player changing planets
        showMessage(
          `Player ${data.playerId.substring(0, 3)} traveled to the ${
            data.planet
          }`,
          3000
        );
      } else {
      }
      return; // Exit early for other players
    }

    // This is our own planet change

    // Save current planet state first
    if (gameState.currentPlanet === "earth" && data.planet === "moon") {
      if (gameState.blockMap && gameState.blockMap.length > 0) {
        gameState.earthBlockMap = JSON.parse(
          JSON.stringify(gameState.blockMap)
        );
      }
    } else if (gameState.currentPlanet === "moon" && data.planet === "earth") {
      if (gameState.blockMap && gameState.blockMap.length > 0) {
        gameState.moonBlockMap = JSON.parse(JSON.stringify(gameState.blockMap));
      }
    }

    // Update the current planet
    gameState.currentPlanet = data.planet;

    // Load the appropriate planet's block map
    if (data.planet === "earth") {
      if (gameState.earthBlockMap && gameState.earthBlockMap.length > 0) {
        gameState.blockMap = JSON.parse(
          JSON.stringify(gameState.earthBlockMap)
        );
        gameState.gravity = 0.5; // Standard gravity on Earth
      }
    } else if (data.planet === "moon") {
      if (gameState.moonBlockMap && gameState.moonBlockMap.length > 0) {
        gameState.blockMap = JSON.parse(JSON.stringify(gameState.moonBlockMap));
        gameState.gravity = 0.3; // Lower gravity on the Moon
      }
    }

    // IMPORTANT: Clear ALL other players when we change planets
    for (const id in otherPlayers) {
      removeOtherPlayer(id);
    }

    // Update visible blocks
    updateVisibleBlocks();

    // Show message
    showMessage(`You traveled to the ${data.planet}`, 3000);

    // Request players on the new planet
    requestPlayersOnCurrentPlanet();
  });

  socket.on("rocketLaunched", (data) => {

    // If another player launched their rocket, remove them from our view immediately
    if (data.playerId !== gameState.playerId) {
      if (otherPlayers[data.playerId]) {
        console.log(
          `Removing player ${data.playerId} who launched to ${data.targetPlanet}`
        );
        removeOtherPlayer(data.playerId);

        // Update player count after removal
        updatePlayerCount(Object.keys(otherPlayers).length + 1);

        showMessage(
          `Player ${data.playerId.substring(0, 3)} launched to the ${
            data.targetPlanet
          }`,
          3000
        );
      }
      return; // Exit early for other players' launches
    }

    // Below code only executes for our own rocket launch

    // Skip planet transition if we're already handling it in rocket.js
    if (gameState.skipMultiplayerTransition) {
      // We still need to save planet state
      if (gameState.currentPlanet === "earth" && data.targetPlanet === "moon") {
        if (gameState.blockMap && gameState.blockMap.length > 0) {
          gameState.earthBlockMap = JSON.parse(
            JSON.stringify(gameState.blockMap)
          );
        }
      } else if (
        gameState.currentPlanet === "moon" &&
        data.targetPlanet === "earth"
      ) {
        if (gameState.blockMap && gameState.blockMap.length > 0) {
          gameState.moonBlockMap = JSON.parse(
            JSON.stringify(gameState.blockMap)
          );
        }
      }

      // Show message but skip the rest of the planet transition
      showMessage(
        `Rocket launched! Traveling to the ${data.targetPlanet}...`,
        3000
      );
      return;
    }

    // If we get here, we're not handling the transition in rocket.js,
    // so proceed with the original planet transition code

    // Save current planet state first
    if (gameState.currentPlanet === "earth" && data.targetPlanet === "moon") {
      if (gameState.blockMap && gameState.blockMap.length > 0) {
        gameState.earthBlockMap = JSON.parse(
          JSON.stringify(gameState.blockMap)
        );
      }
    } else if (
      gameState.currentPlanet === "moon" &&
      data.targetPlanet === "earth"
    ) {
      if (gameState.blockMap && gameState.blockMap.length > 0) {
        gameState.moonBlockMap = JSON.parse(JSON.stringify(gameState.blockMap));
      }
    }

    // Update the current planet
    gameState.currentPlanet = data.targetPlanet;

    // Load the appropriate planet's block map
    if (data.targetPlanet === "earth") {
      if (gameState.earthBlockMap && gameState.earthBlockMap.length > 0) {
        gameState.blockMap = JSON.parse(
          JSON.stringify(gameState.earthBlockMap)
        );
        gameState.gravity = 0.5; // Standard gravity on Earth
      }
    } else if (data.targetPlanet === "moon") {
      if (gameState.moonBlockMap && gameState.moonBlockMap.length > 0) {
        gameState.blockMap = JSON.parse(JSON.stringify(gameState.moonBlockMap));
        gameState.gravity = 0.3; // Lower gravity on the Moon
      }
    }

    // Clear other players since we changed planets
    for (const id in otherPlayers) {
      removeOtherPlayer(id);
    }

    // Update visible blocks
    updateVisibleBlocks();

    showMessage(
      `Rocket launched! Traveling to the ${data.targetPlanet}...`,
      3000
    );

    // Trigger rocket launch animations or effects
    triggerRocketLaunchAnimation(data.targetPlanet);

    // Request players on the new planet
    requestPlayersOnCurrentPlanet();
  });

  socket.on("playersOnPlanet", (data) => {

    // Create a list of player IDs to add/update
    const receivedPlayerIds = Object.keys(data.players);
    const currentPlayerIds = Object.keys(otherPlayers);

    // Don't clear players if we already have some and didn't receive any
    // This protects against empty responses
    if (currentPlayerIds.length > 0 && receivedPlayerIds.length === 0) {
      console.warn(
        "Received empty player list but already have players, ignoring"
      );
      return;
    }

    // Clear all existing other players first
    for (const id in otherPlayers) {
      removeOtherPlayer(id);
    }

    // Add each player that isn't ourselves
    let playersAdded = 0;
    for (const id in data.players) {
      if (id !== gameState.playerId) {
        // Only add players on our current planet
        if (data.players[id].currentPlanet === gameState.currentPlanet) {
          addOtherPlayer(id, data.players[id]);
          playersAdded++;
        }
      }
    }

    // Update player count
    updatePlayerCount(Object.keys(otherPlayers).length + 1);
  });

  // Add this new event handler to the client-side socket.io event handlers
  socket.on("worldDataResponse", (data) => {
    if (!data.success) {
      console.log("World data request failed:", data.message);
      return;
    }

    // Only process if we actually got world blocks
    if (data.worldBlocks && Object.keys(data.worldBlocks).length > 0) {
      try {
        // Clear any existing block map to prevent mixing
        gameState.blockMap = [];

        // Find the maximum Y value in the received data
        const maxY = Math.max(...Object.keys(data.worldBlocks).map(Number));

        // Calculate the maximum X value by checking all rows
        let maxX = 0;
        for (const y in data.worldBlocks) {
          if (data.worldBlocks[y]) {
            const xKeys = Object.keys(data.worldBlocks[y]).map(Number);
            if (xKeys.length > 0) {
              maxX = Math.max(maxX, Math.max(...xKeys));
            }
          }
        }

        // Initialize the entire blockMap with proper dimensions first
        for (let y = 0; y <= maxY; y++) {
          gameState.blockMap[y] = [];

          // Pre-fill the row with nulls to ensure we have a complete array
          for (let x = 0; x <= maxX; x++) {
            gameState.blockMap[y][x] = null;
          }
        }

        // Now fill in the actual block data
        for (const y in data.worldBlocks) {
          const yNum = Number(y);
          for (const x in data.worldBlocks[y]) {
            const xNum = Number(x);
            const blockData = data.worldBlocks[y][x];

            if (blockData === null) {
              gameState.blockMap[yNum][xNum] = null;
            } else if (blockData && blockData.name) {
              // Find the matching ore in our local ores array
              const matchingOre = gameState.ores.find(
                (ore) => ore.name === blockData.name
              );
              if (matchingOre) {
                gameState.blockMap[yNum][xNum] = matchingOre;
              } else {
                console.warn(`Unknown ore received: ${blockData.name}`);
                gameState.blockMap[yNum][xNum] = blockData;
              }
            } else {
              gameState.blockMap[yNum][xNum] = blockData;
            }
          }
        }

        // Update rocket information if available
        // Always check for rocket information in the response
        if (data.hasRocket === true) {
          gameState.hasRocket = true;
          gameState.rocketPlaced = true;

          if (data.rocketPosition) {
            gameState.rocket.x = data.rocketPosition.x;
            gameState.rocket.y = data.rocketPosition.y;
            gameState.rocketX = data.rocketPosition.x / gameState.blockSize;
            gameState.rocketY = data.rocketPosition.y / gameState.blockSize;

            // Initialize the rocket element
            if (typeof initializeRocket === "function") {
              initializeRocket();
            }
          }
        }

        // After everything is set up, update visible blocks
        updateVisibleBlocks();

        // NEW: Now that we have world data, make the player visible if it was hidden
        if (gameState.isWaitingForWorldData) {
          // Show the player
          const playerElement = document.getElementById("player");
          if (playerElement) {
            playerElement.style.visibility = "visible";
          }

          // Reset the waiting flag
          gameState.isWaitingForWorldData = false;

          // Hide the loading screen if it's still showing
          hideLoadingScreen();
        }

        // Show a message to confirm the world has loaded
        showMessage("World data loaded successfully", 2000);
      } catch (error) {
        console.error("Error processing received world data:", error);
        showMessage("Error processing world data", 3000);

        // Even if there's an error, we should make the player visible
        // and hide the loading screen to prevent being stuck
        if (gameState.isWaitingForWorldData) {
          const playerElement = document.getElementById("player");
          if (playerElement) {
            playerElement.style.visibility = "visible";
          }
          gameState.isWaitingForWorldData = false;
          hideLoadingScreen();
        }
      }
    } else {
      console.warn("Received world data response, but no blocks were present");

      // If we got an empty response, still make the player visible after a timeout
      // This prevents players from being stuck in a loading state
      setTimeout(() => {
        if (gameState.isWaitingForWorldData) {
          const playerElement = document.getElementById("player");
          if (playerElement) {
            playerElement.style.visibility = "visible";
          }
          gameState.isWaitingForWorldData = false;
          hideLoadingScreen();
          showMessage("Could not load world data. Using default world.", 3000);
        }
      }, 5000); // Give it 5 seconds before giving up
    }
  });
}

export function uploadWorldToServer() {
  // Only upload if we're connected, the socket exists, AND we have received a game code
  if (isConnected && socket && gameState.needToUploadWorld && currentGameCode) {
    // Ensure blockMap exists and has data
    if (!gameState.blockMap || gameState.blockMap.length === 0) {
      console.error("Error: blockMap is empty or null, cannot upload world");
      return; // Don't proceed with upload
    }

    try {
      // Create a simplified world representation
      const worldData = {};
      let blockCount = 0;

      // Process the entire world data
      for (let y = 0; y < gameState.blockMap.length; y++) {
        if (!gameState.blockMap[y]) continue;

        let rowData = {};
        let hasDataInRow = false;

        for (let x = 0; x < gameState.blockMap[y].length; x++) {
          if (gameState.blockMap[y][x]) {
            // Simplify ore objects
            if (typeof gameState.blockMap[y][x] === "object") {
              rowData[x] = {
                name: gameState.blockMap[y][x].name || "unknown",
                color: gameState.blockMap[y][x].color || "#000000",
                value: gameState.blockMap[y][x].value || 0,
              };
            } else {
              rowData[x] = gameState.blockMap[y][x];
            }
            hasDataInRow = true;
            blockCount++;
          }
        }

        if (hasDataInRow) {
          worldData[y] = rowData;
        }
      }

      // Check if we have data to send
      if (blockCount === 0 || Object.keys(worldData).length === 0) {
        console.error("Error: No blocks found in world data");
        return;
      }

      // ===== CHUNKED UPLOAD IMPLEMENTATION =====
      // First notify the server that we're starting a chunked upload
      socket.emit("startWorldUpload", {
        totalRows: Object.keys(worldData).length,
        blockCount: blockCount,
        planetType: gameState.currentPlanet,
        // Only include rocket data if it actually exists
        hasRocket: gameState.hasRocket === true,
        rocketPosition:
          gameState.hasRocket === true && gameState.rocket
            ? {
                x: gameState.rocket.x,
                y: gameState.rocket.y,
              }
            : null,
      });

      // Split the world data into chunks for easier transmission
      const CHUNK_SIZE = 100; // Increased rows per chunk for faster transfer
      const worldRows = Object.keys(worldData).sort(
        (a, b) => Number(a) - Number(b)
      );
      const totalChunks = Math.ceil(worldRows.length / CHUNK_SIZE);

      // Function to send a chunk and get acknowledgment
      const sendChunk = (chunkIndex) => {
        if (chunkIndex >= totalChunks) {
          // All chunks sent, send completion event
          socket.emit("finishWorldUpload", {
            totalSent: worldRows.length,
            blockCount: blockCount,
          });
          return;
        }

        const chunkStart = chunkIndex * CHUNK_SIZE;
        const chunkEnd = Math.min(
          (chunkIndex + 1) * CHUNK_SIZE,
          worldRows.length
        );
        const rowsInThisChunk = worldRows.slice(chunkStart, chunkEnd);

        // Create chunk data object
        const chunkData = {};
        rowsInThisChunk.forEach((y) => {
          chunkData[y] = worldData[y];
        });

        // Send this chunk immediately
        socket.emit("worldChunk", {
          chunkIndex: chunkIndex,
          totalChunks: totalChunks,
          chunkData: chunkData,
          rowCount: rowsInThisChunk.length,
        });

        // Send next chunk immediately without waiting
        sendChunk(chunkIndex + 1);
      };

      // Start sending chunks immediately
      sendChunk(0);

      // Only set the flag to false after we've started the process
      // This allows retry mechanisms to work if needed
      gameState.needToUploadWorld = false;
    } catch (error) {
      console.error("Error in uploadWorldToServer:", error);

      // We'll keep the flag true to allow for retries
      console.log("Upload failed, will retry later");
    }
  } else {
    console.log("Upload conditions not met:", {
      isConnected: isConnected,
      socketExists: !!socket,
      needToUploadWorld: gameState.needToUploadWorld,
      currentGameCode: currentGameCode || "not assigned yet",
    });
  }
}

/**
 * Updates the game code display in the pause menu
 * @param {string} gameCode - The game code to display
 */
function updatePauseMenuGameCode(gameCode) {
  // Check if the game code display element exists
  let gameCodeDisplay = document.getElementById("pause-menu-game-code");

  // If it doesn't exist yet, create it
  if (!gameCodeDisplay) {
    const menuContent = document.querySelector(".menu-content");

    // Create the game code display element
    gameCodeDisplay = document.createElement("div");
    gameCodeDisplay.id = "pause-menu-game-code";
    gameCodeDisplay.className = "game-code-display menu-item";

    // Add content to the game code display with styling that matches menu items
    gameCodeDisplay.innerHTML = `
      <div class="menu-item-content">
        <span class="game-code-label">Game Code:</span>
        <span id="pause-menu-code-value">${gameCode}</span>
        <button id="copy-pause-menu-code" class="copy-code-btn menu-button">Copy</button>
      </div>
    `;

    // Insert at the bottom of the menu content instead of the top
    if (menuContent) {
      menuContent.appendChild(gameCodeDisplay);
    }

    // Add event listener to copy button
    const copyBtn = document.getElementById("copy-pause-menu-code");
    if (copyBtn) {
      copyBtn.addEventListener("click", () => {
        // Copy the game code to clipboard
        navigator.clipboard
          .writeText(gameCode)
          .then(() => {
            // Change button text temporarily
            const originalText = copyBtn.textContent;
            copyBtn.textContent = "Copied!";

            // Reset button text after 2 seconds
            setTimeout(() => {
              copyBtn.textContent = originalText;
            }, 2000);
          })
          .catch((err) => {
            console.error("Failed to copy text: ", err);
          });
      });
    }
  } else {
    // If it exists, just update the code value
    const codeValue = document.getElementById("pause-menu-code-value");
    if (codeValue) {
      codeValue.textContent = gameCode;
    }
  }
}

/**
 * Shows the game code for other players to join
 * @param {string} gameCode - The game code to display
 */
export function showGameCode(gameCode) {
  // Skip showing the modal if we've already shown it this session
  if (hasShownGameCode) {
    // Still update the pause menu code
    updatePauseMenuGameCode(gameCode);
    return;
  }

  // Mark that we've shown the code
  hasShownGameCode = true;

  // First, remove any existing game code modal
  const existingModal = document.getElementById("game-code-modal");
  if (existingModal) {
    document.body.removeChild(existingModal);
  }

  // Create a modal with the game code
  const modal = document.createElement("div");
  modal.className = "game-code-modal";
  modal.id = "game-code-modal";

  modal.innerHTML = `
    <div class="game-code-modal-content">
      <h2>Your Game Code</h2>
      <p>Share this code with friends to let them join your game:</p>
      <div class="game-code">${gameCode}</div>
      <div class="button-container">
        <button id="copy-code-button" class="modal-button copy-button">Copy Code</button>
        <button id="close-code-modal" class="modal-button">Got It</button>
      </div>
      <div id="copy-success" class="copy-success">Code copied to clipboard!</div>
    </div>
  `;

  document.body.appendChild(modal);

  // Add event listener to close button
  const closeButton = document.getElementById("close-code-modal");
  if (closeButton) {
    closeButton.addEventListener("click", () => {
      modal.classList.add("fade-out");
      setTimeout(() => {
        if (modal && modal.parentNode) {
          document.body.removeChild(modal);
        }
      }, 300);
    });
  }

  // Add event listener to copy button
  const copyButton = document.getElementById("copy-code-button");
  if (copyButton) {
    copyButton.addEventListener("click", () => {
      // Copy the game code to clipboard
      navigator.clipboard
        .writeText(gameCode)
        .then(() => {
          // Show success message
          const successMessage = document.getElementById("copy-success");
          if (successMessage) {
            successMessage.classList.add("visible");

            // Hide the success message after 3 seconds
            setTimeout(() => {
              successMessage.classList.remove("visible");
            }, 3000);
          }
        })
        .catch((err) => {
          console.error("Failed to copy text: ", err);
        });
    });
  }

  // Make game code text directly clickable to copy as well
  const gameCodeElement = modal.querySelector(".game-code");
  if (gameCodeElement) {
    gameCodeElement.addEventListener("click", () => {
      navigator.clipboard
        .writeText(gameCode)
        .then(() => {
          // Show success message
          const successMessage = document.getElementById("copy-success");
          if (successMessage) {
            successMessage.classList.add("visible");

            // Hide the success message after 3 seconds
            setTimeout(() => {
              successMessage.classList.remove("visible");
            }, 3000);
          }
        })
        .catch((err) => {
          console.error("Failed to copy text: ", err);
        });
    });
  }
}

/**
 * Get the current game code
 * @returns {string} The current game code
 */
export function getCurrentGameCode() {
  return currentGameCode;
}

/**
 * Send player position update to server
 */
export function sendPlayerUpdate() {
  if (isConnected && socket && gameState.player) {
    // Get the player's current tool to include in the update
    const currentToolType = gameState.crafting.currentToolType;
    const currentToolId = gameState.crafting.equippedTools[currentToolType];

    // Always include a timestamp to help with ordering
    const timestamp = Date.now();

    socket.emit("playerMove", {
      x: gameState.player.x,
      y: gameState.player.y,
      direction: gameState.player.direction,
      velocityX: gameState.player.velocityX,
      velocityY: gameState.player.velocityY,
      onGround: gameState.player.onGround,
      health: gameState.player.health,
      depth: gameState.depth,
      // Always include current planet to ensure consistent planet tracking
      currentPlanet: gameState.currentPlanet,
      // Include tool information in regular updates
      currentTool: currentToolId,
      // Also include tool type to ensure consistency
      toolType: currentToolType,
      // Add timestamp for ordering
      timestamp: timestamp,
      // Add explicit update type flag
      updateType: "position",
    });
  }
}

/**
 * Send block mining event to server
 */
export function sendBlockMined(x, y) {
  if (isConnected && socket) {
    socket.emit("blockMined", {
      x: x,
      y: y,
    });
  }
}

/**
 * Send tool change event to server
 */
export function sendToolChanged(toolId) {
  if (isConnected && socket) {
    socket.emit("toolChanged", {
      tool: toolId,
    });
  }
}

/**
 * Create and add another player to the game world
 */
function addOtherPlayer(id, playerData) {
  // Don't add if the player already exists
  if (otherPlayers[id]) {
    return;
  }

  // Create player element for the new player
  const newPlayerElement = document.createElement("div");
  newPlayerElement.className = "player other-player";
  newPlayerElement.dataset.playerId = id;

  // Add name tag
  const nameTag = document.createElement("div");
  nameTag.className = "player-name";
  nameTag.textContent = `Player ${id.substring(0, 3)}`;
  newPlayerElement.appendChild(nameTag);

  // Add jetpack flame element
  const jetpackFlame = document.createElement("div");
  jetpackFlame.className = "jetpack-flame";
  jetpackFlame.style.display = "none"; // Hidden by default
  newPlayerElement.appendChild(jetpackFlame);

  // Add laser beam element (always create it)
  const laserBeam = document.createElement("div");
  laserBeam.className = "other-player-laser";
  laserBeam.style.display = "none"; // Hidden by default
  laserBeam.style.transformOrigin = "left center"; // Match local player setting
  newPlayerElement.appendChild(laserBeam);

  // Create and store the player object with all states properly initialized
  otherPlayers[id] = {
    element: newPlayerElement,
    data: playerData,
    mining: {
      active: false,
    },
    laser: {
      active: playerData.laserActive === true,
      angle: playerData.laserAngle || 0,
    },
    jetpackActive: playerData.jetpackActive === true,
    // NEW: Initialize toolRotation if it exists in the playerData
    toolRotation: playerData.toolRotation
      ? {
          angle: playerData.toolRotation.angle || 0,
          direction: playerData.toolRotation.direction || 1,
        }
      : null,
  };

  // Check if player mining
  if (playerData.mining && playerData.mining.active) {
    otherPlayers[id].mining = {
      active: true,
      x: playerData.mining.x,
      y: playerData.mining.y,
      tool: playerData.mining.tool || playerData.toolType,
    };

    // Apply mining animation immediately
    applyMiningAnimation(id);

    // Add mining effect at the target block
    addMiningEffectAtBlock(playerData.mining.x, playerData.mining.y);
  }

  // Add tool container with proper structure
  const toolContainer = document.createElement("div");
  toolContainer.className = "player-tool-container";

  // Use an actual SVG element instead of just an img tag for better animations
  toolContainer.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="pickaxe">
      <use href="#pickaxe-basic-icon" />
    </svg>
  `;

  newPlayerElement.appendChild(toolContainer);

  // Position the player - adjust for camera immediately
  const adjustedX = playerData.x - gameState.camera.x;
  const adjustedY = playerData.y - gameState.camera.y;

  newPlayerElement.style.left = `${adjustedX}px`;
  newPlayerElement.style.top = `${adjustedY}px`;

  // Set initial direction
  if (playerData.direction === -1) {
    newPlayerElement.classList.add("facing-left");
  }

  // Check if the laser should be active initially
  if (otherPlayers[id].laser.active) {
    // Show the laser
    laserBeam.style.display = "block";
    // Add appropriate class
    newPlayerElement.classList.add("laser-active");

    // Set angle if available
    if (otherPlayers[id].laser.angle) {
      laserBeam.style.transform = `rotate(${otherPlayers[id].laser.angle}deg)`;
    }
  }

  // NEW: Apply initial tool rotation if available
  if (otherPlayers[id].toolRotation) {
    updateOtherPlayerToolRotation(id);
  }

  // Add to game world
  const gameWorld = document.getElementById("game-world");
  if (gameWorld) {
    gameWorld.appendChild(newPlayerElement);

    // Check for tool information in a consistent way
    // This is the key part that needs fixing - properly check all possible tool properties
    if (playerData.currentTool) {
      updateOtherPlayerTool(id, playerData.currentTool);
    } else if (playerData.toolId) {
      updateOtherPlayerTool(id, playerData.toolId);
    } else {
      // If no tool data, initialize with default pickaxe
      updateOtherPlayerTool(id, "pickaxe-basic");
    }
  }
}

/**
 * Update position of another player
 */
function updateOtherPlayerPosition(id, playerData) {
  if (otherPlayers[id]) {
    // Update stored data
    otherPlayers[id].data = {
      ...otherPlayers[id].data,
      ...playerData,
    };

    // Update DOM position - adjust for camera
    const playerElement = otherPlayers[id].element;
    const adjustedX = playerData.x - gameState.camera.x;
    const adjustedY = playerData.y - gameState.camera.y;

    playerElement.style.left = `${adjustedX}px`;
    playerElement.style.top = `${adjustedY}px`;

    // Update direction (facing)
    if (playerData.direction === -1) {
      playerElement.classList.add("facing-left");
    } else {
      playerElement.classList.remove("facing-left");
    }
  }
}

/**
 * Update tool of another player
 */
function updateOtherPlayerTool(id, toolId) {
  if (otherPlayers[id]) {
    const playerElement = otherPlayers[id].element;
    const toolContainer = playerElement.querySelector(".player-tool-container");

    // Determine tool type and image based on toolId
    let toolType = "pickaxe";
    let toolSrc = "imgs/pickaxe-basic.svg";

    if (toolId && toolId.includes("drill")) {
      toolType = "drill";
      if (toolId.includes("ruby")) {
        toolSrc = "imgs/drill-ruby.svg";
      } else if (toolId.includes("diamond")) {
        toolSrc = "imgs/drill-diamond.svg";
      } else {
        toolSrc = "imgs/drill-basic.svg";
      }
    } else if (toolId && toolId.includes("laser")) {
      toolType = "laser";
      toolSrc = "imgs/laser.svg";
    } else if (toolId) {
      // Different pickaxe styles
      if (toolId.includes("gold")) {
        toolSrc = "imgs/pickaxe-gold.svg";
      } else if (toolId.includes("diamond")) {
        toolSrc = "imgs/pickaxe-diamond.svg";
      } else if (toolId.includes("iron")) {
        toolSrc = "imgs/pickaxe-iron.svg";
      } else {
        toolSrc = "imgs/pickaxe-basic.svg";
      }
    }

    // Store the current tool type in the player data
    otherPlayers[id].data.currentTool = toolId;
    otherPlayers[id].data.toolType = toolType; // Store the tool type separately for animation lookup

    // Fetch and load the SVG
    fetch(toolSrc)
      .then((response) => response.text())
      .then((svgContent) => {
        // Update tool container with the SVG content
        toolContainer.innerHTML = svgContent;

        // Get the SVG element and add appropriate class
        const svgElement = toolContainer.querySelector("svg");
        if (svgElement) {
          // Remove existing tool classes
          svgElement.classList.remove("pickaxe", "drill", "laser");
          // Add appropriate class
          svgElement.classList.add(toolType);

          // Apply appropriate scaling and rotation based on tool type
          if (toolType === "drill" || toolType === "laser") {
            // If we have stored rotation data, apply it
            if (otherPlayers[id].toolRotation) {
              updateOtherPlayerToolRotation(id);
            } else {
              // Default scaling if no rotation data
              const scale = toolType === "laser" ? 2.5 : 1.5;
              svgElement.style.transform = `scale(${scale})`;
            }
          }

          // If the player is currently mining, reapply mining animation
          if (otherPlayers[id].mining && otherPlayers[id].mining.active) {
            applyMiningAnimation(id);
          }
        }
      })
      .catch((error) => {
        console.error(`Failed to load tool SVG for player ${id}:`, error);
        // Fallback to simple img tag
        toolContainer.innerHTML = `<img src="${toolSrc}" alt="Tool" width="24" height="24">`;
      });
  }
}

function applyMiningAnimation(playerId) {
  if (
    !otherPlayers[playerId] ||
    !otherPlayers[playerId].mining ||
    !otherPlayers[playerId].mining.active
  ) {
    return;
  }

  const playerElement = otherPlayers[playerId].element;
  const toolContainer = playerElement.querySelector(".player-tool-container");
  const svgElement = toolContainer?.querySelector("svg");

  if (!svgElement) return;

  // Get tool type from the mining info or from player data
  let tool = "pickaxe"; // Default tool type

  // Try to get the most specific tool information available
  if (otherPlayers[playerId].mining.tool) {
    tool = otherPlayers[playerId].mining.tool;
  } else if (
    otherPlayers[playerId].data &&
    otherPlayers[playerId].data.toolType
  ) {
    tool = otherPlayers[playerId].data.toolType;
  } else if (
    otherPlayers[playerId].data &&
    otherPlayers[playerId].data.currentTool
  ) {
    // Infer tool type from the tool ID
    const toolId = otherPlayers[playerId].data.currentTool;
    if (toolId.includes("drill")) {
      tool = "drill";
    } else if (toolId.includes("laser")) {
      tool = "laser";
    }
  }

  // Apply the appropriate animation class to the SVG element (not the container)
  if (tool === "drill" || tool.includes("drill")) {
    svgElement.classList.add("drilling");
    svgElement.classList.remove("mining");

    // Ensure proper CSS variables for drill rotation
    if (otherPlayers[playerId].toolRotation) {
      const rotation = otherPlayers[playerId].toolRotation.angle || 0;
      svgElement.style.setProperty("--rotation", `${rotation}deg`);
    }
  } else if (tool === "pickaxe" || tool.includes("pickaxe")) {
    svgElement.classList.add("mining");
    svgElement.classList.remove("drilling");
  }
}

/**
 * Remove another player from the game
 */
function removeOtherPlayer(id) {
  if (otherPlayers[id]) {
    // Remove from DOM
    const playerElement = otherPlayers[id].element;
    if (playerElement && playerElement.parentNode) {
      playerElement.parentNode.removeChild(playerElement);
    }

    // Remove from tracking object
    delete otherPlayers[id];
  }
}

/**
 * Update camera positions for all other players
 */
export function updateOtherPlayersForCamera() {
  if (!isConnected) return;

  for (const id in otherPlayers) {
    const playerData = otherPlayers[id].data;
    const playerElement = otherPlayers[id].element;

    // Adjust position based on camera
    const adjustedX = playerData.x - gameState.camera.x;
    const adjustedY = playerData.y - gameState.camera.y;

    playerElement.style.left = `${adjustedX}px`;
    playerElement.style.top = `${adjustedY}px`;

    // NEW: Update tool rotation if needed
    if (otherPlayers[id].toolRotation) {
      updateOtherPlayerToolRotation(id);
    }

    // If this player is mining, update mining effect position
    if (otherPlayers[id].mining && otherPlayers[id].mining.active) {
      const blockX = otherPlayers[id].mining.x;
      const blockY = otherPlayers[id].mining.y;

      const effectElement = document.querySelector(
        `.mining-effect[data-block-x="${blockX}"][data-block-y="${blockY}"]`
      );

      if (effectElement) {
        const posX = blockX * gameState.blockSize - gameState.camera.x;
        const posY = blockY * gameState.blockSize - gameState.camera.y;
        effectElement.style.left = `${posX}px`;
        effectElement.style.top = `${posY}px`;
      }
    }
  }
}

/**
 * Update the player count display
 */
function updatePlayerCount(count) {
  const playerCountElement = document.getElementById("player-count-value");
  if (playerCountElement) {
    playerCountElement.textContent = count;
  }
}

/**
 * Send mining start event to server
 */
export function sendMiningStart(blockX, blockY, toolType) {
  if (isConnected && socket) {
    socket.emit("miningStart", {
      x: blockX,
      y: blockY,
      tool: toolType,
    });
  }
}

/**
 * Send mining stop event to server
 */
export function sendMiningStop() {
  if (isConnected && socket) {
    try {
      // Only send if socket is in OPEN state
      if (socket.connected) {
        socket.emit("miningStop", {});
      } else {
      }
    } catch (error) {
      console.error("Error sending mining stop:", error);
    }
  }
}

/**
 * Send laser activated event to server
 */
export function sendLaserActivated() {
  if (isConnected && socket) {
    socket.emit("laserActivated", {});
  }
}

/**
 * Send laser deactivated event to server
 */
export function sendLaserDeactivated() {
  if (isConnected && socket) {
    socket.emit("laserDeactivated", {});
  }
}

/**
 * Send laser update (angle) to server
 */
export function sendLaserUpdate(angle) {
  if (isConnected && socket) {
    socket.emit("laserUpdate", {
      angle: angle,
    });
  }
}

// Helper functions for mining effects
function addMiningEffectAtBlock(blockX, blockY) {
  // Create a mining effect element
  const effectElement = document.createElement("div");
  effectElement.className = "mining-effect";
  effectElement.dataset.blockX = blockX;
  effectElement.dataset.blockY = blockY;

  // Position it at the block location (adjusted for camera)
  const posX = blockX * gameState.blockSize - gameState.camera.x;
  const posY = blockY * gameState.blockSize - gameState.camera.y;
  effectElement.style.left = `${posX}px`;
  effectElement.style.top = `${posY}px`;

  // Add to game world
  const gameWorld = document.getElementById("game-world");
  if (gameWorld) {
    gameWorld.appendChild(effectElement);
  }
}

function removeMiningEffectAtBlock(blockX, blockY) {
  // Find and remove the mining effect element for this block
  const effectElement = document.querySelector(
    `.mining-effect[data-block-x="${blockX}"][data-block-y="${blockY}"]`
  );
  if (effectElement && effectElement.parentNode) {
    effectElement.parentNode.removeChild(effectElement);
  }
}

// Send rocket purchase event to server
export function sendRocketPurchased() {
  if (isConnected && socket) {
    socket.emit("rocketPurchased", {
      rocketX: gameState.rocket.x,
      rocketY: gameState.rocket.y,
    });
  }
}

// Send rocket position update to server
export function sendRocketPosition() {
  if (isConnected && socket && gameState.hasRocket) {
    socket.emit("rocketPosition", {
      x: gameState.rocket.x,
      y: gameState.rocket.y,
    });
  }
}

// Send planet change event to server
export function sendPlanetChanged(planet) {
  if (isConnected && socket) {
    socket.emit("planetChanged", {
      planet: planet,
    });
  }
}

export function sendRocketLaunched(targetPlanet) {
  if (isConnected && socket && gameState.hasRocket) {

    // Send the rocket launched event with a different format to be distinct
    // This ensures this event is handled differently than normal movement updates
    socket.emit("rocketLaunched", {
      targetPlanet: targetPlanet,
      currentPlanet: gameState.currentPlanet, // Include current planet for confirmation
      timestamp: Date.now(), // Adding timestamp to make the event unique
      rocketAction: "launch", // Explicit action flag
    });

    // Send additional notification after a delay as a backup
    setTimeout(() => {
      if (isConnected && socket) {
        socket.emit("rocketLaunched", {
          targetPlanet: targetPlanet,
          currentPlanet: gameState.currentPlanet,
          timestamp: Date.now(),
          rocketAction: "launch-confirm",
        });
      }
    }, 500);
  }
}

function triggerRocketLaunchAnimation(targetPlanet) {
  // This is a simple example - you can expand this with more complex animations
  const rocketElement = document.querySelector(".rocket");

  if (rocketElement) {
    // Add launch animation class
    rocketElement.classList.add("launching");

    // Play sound effect if available
    const launchSound = document.getElementById("rocket-launch-sound");
    if (launchSound) {
      launchSound.play();
    }

    // Remove animation class after animation completes
    setTimeout(() => {
      rocketElement.classList.remove("launching");
    }, 3000);
  }
}

/**
 * Request updated player list after changing planets
 * This ensures we see players already on our new planet
 */
/**
 * Request updated player list after changing planets
 * This ensures we see players already on our new planet
 */
export function requestPlayersOnCurrentPlanet() {
  if (isConnected && socket) {
    // Only request players if we have a valid game code
    if (currentGameCode) {
      console.log(`Requesting players on ${gameState.currentPlanet}`);

      // Send request
      socket.emit("getPlayersOnPlanet", {
        planet: gameState.currentPlanet,
      });

      // Add a safeguard retry in case the first request fails
      setTimeout(() => {
        // Only retry if we're still connected and have a valid game code
        if (isConnected && socket && currentGameCode) {
          socket.emit("getPlayersOnPlanet", {
            planet: gameState.currentPlanet,
          });
        }
      }, 1000);

      // Send one more request after a longer delay
      setTimeout(() => {
        if (isConnected && socket && currentGameCode) {
          socket.emit("getPlayersOnPlanet", {
            planet: gameState.currentPlanet,
          });
        }
      }, 3000);
    } else {
      console.warn("Cannot request players - not joined a game yet");
    }
  } else {
    console.warn("Cannot request players - socket not connected");
  }
}

export function sendJetpackActivated() {
  if (isConnected && socket) {
    socket.emit("jetpackActivated", {});
  }
}

export function sendJetpackDeactivated() {
  if (isConnected && socket) {
    socket.emit("jetpackDeactivated", {});
  }
}

// Function to update the visual rotation of another player's tool
function updateOtherPlayerToolRotation(playerId) {
  if (!otherPlayers[playerId] || !otherPlayers[playerId].toolRotation) return;

  const playerElement = otherPlayers[playerId].element;
  const toolContainer = playerElement.querySelector(".player-tool-container");
  const svgElement = toolContainer?.querySelector("svg");

  if (svgElement) {
    const rotation = otherPlayers[playerId].toolRotation.angle;
    const playerDirection = otherPlayers[playerId].toolRotation.direction;

    // Get the current tool type to determine appropriate scale
    const currentTool = otherPlayers[playerId].data.currentTool || "";
    const isLaser = currentTool.includes("laser");
    const isDrill = currentTool.includes("drill");

    // Only rotate drills and lasers
    if (isDrill || isLaser) {
      let scale = isDrill ? 1.5 : 2.5;

      // Set rotation based on direction
      if (playerDirection === -1) {
        svgElement.style.transform = `scaleX(-${scale}) scaleY(${scale}) rotate(${rotation}deg)`;
      } else {
        svgElement.style.transform = `scaleX(${scale}) scaleY(${scale}) rotate(${rotation}deg)`;
      }

      // Store the rotation as a CSS property too (used for animations)
      svgElement.style.setProperty("--rotation", `${rotation}deg`);
    }
  }
}

// Add a function to send tool rotation updates to the server
export function sendToolRotationUpdate() {
  if (isConnected && socket && gameState.player) {
    const currentTool = getCurrentTool();

    // Only send updates for drill and laser tools
    if (
      currentTool &&
      (currentTool.type === "drill" || currentTool.type === "laser")
    ) {
      socket.emit("toolRotation", {
        angle: gameState.player.toolRotation || 0,
        direction: gameState.player.direction,
      });
    }
  }
}

// Handle player visibility refreshes more gracefully
// Handle player visibility refreshes more gracefully
export function refreshPlayerVisibility() {
  // First check if we have a valid game code
  if (!currentGameCode) {
    console.warn("Cannot refresh player visibility - not joined a game yet");
    return;
  }

  // First, send our own position update to ensure server has latest data
  sendPlayerUpdate();

  // Clear all existing other players first to prevent mixing planets
  for (const id in otherPlayers) {
    removeOtherPlayer(id);
  }

  // Request all players on our current planet
  requestPlayersOnCurrentPlanet();

  // Send additional updates with short delays for reliability
  setTimeout(() => {
    sendPlayerUpdate();
  }, 300);

  setTimeout(() => {
    sendPlayerUpdate();
    // Request players again after a delay to catch any late arrivals
    requestPlayersOnCurrentPlanet();
  }, 800);

  // Log current state
  setTimeout(() => {

    // If we still don't see any other players, try one more request
    if (Object.keys(otherPlayers).length === 0) {
      requestPlayersOnCurrentPlanet();
    }
  }, 1500);
}

export function sendInitialToolInfo() {
  // Should be called after the player's tools are loaded
  if (isConnected && socket) {
    const currentToolType = gameState.crafting.currentToolType;
    const currentToolId = gameState.crafting.equippedTools[currentToolType];

    if (currentToolType && currentToolId) {
      // Send explicit tool changed event to ensure other players see our tool
      sendToolChanged(currentToolId);
    }
  }
}

/**
 * Request world data from the server
 * This function should be exported from multiplayer.js so that it can be used in worldGeneration.js
 */
export function requestWorldData() {
  if (isConnected && socket && currentGameCode) {
    socket.emit("requestWorldData", {
      planet: gameState.currentPlanet,
    });

    // Try again after a short delay in case the first request fails
    setTimeout(() => {
      if (isConnected && socket && currentGameCode) {
        socket.emit("requestWorldData", {
          planet: gameState.currentPlanet,
        });
      }
    }, 2000);
  }
}
