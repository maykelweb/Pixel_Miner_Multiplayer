// multiplayer.js - Client-side socket handling
import { gameState } from "./config.js";
import { playerElement, showMessage } from "./setup.js";
import { updateVisibleBlocks } from "./updates.js";
import { createBreakingAnimation } from "./animations.js";
import { getCurrentTool } from "./crafting.js";

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

  // Handle successful connection
  socket.on("connect", () => {
    isConnected = true;
    console.log("Connected to server with ID:", socket.id);

    // If hosting, send host information to server
    if (isHost) {
      socket.emit("hostGame", {
        gameName: options.gameName || "Pixel Miner Game",
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
  });

  // Handle hosting response
  socket.on("gameHosted", (data) => {
    currentGameCode = data.gameCode;
    console.log("Game created with code:", currentGameCode);
    showMessage("Game created! Code: " + currentGameCode, 5000);

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
    console.log("Received initial game state:", data);

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

    if (
      !isHost &&
      data.worldBlocks &&
      Object.keys(data.worldBlocks).length > 0
    ) {
      console.log("Using host's world data");

      // Clear any existing block map to prevent mixing
      gameState.blockMap = [];

      // Handle world block sync by fully replacing the blockMap
      // We need to recreate the full 2D array structure
      const maxY = Math.max(...Object.keys(data.worldBlocks).map(Number));

      // Create a new blockMap with the right dimensions
      for (let y = 0; y <= maxY; y++) {
        if (!gameState.blockMap[y]) {
          gameState.blockMap[y] = [];
        }

        // If we have data for this row, process it
        if (data.worldBlocks[y]) {
          for (const x in data.worldBlocks[y]) {
            // IMPORTANT: Fix ore references by looking up the proper ore object
            const blockData = data.worldBlocks[y][x];

            if (blockData === null) {
              gameState.blockMap[y][x] = null;
            } else if (blockData && blockData.name) {
              // Find the matching ore in our local ores array
              const matchingOre = gameState.ores.find(
                (ore) => ore.name === blockData.name
              );
              if (matchingOre) {
                gameState.blockMap[y][x] = matchingOre;
              } else {
                console.warn(`Unknown ore received: ${blockData.name}`);
                gameState.blockMap[y][x] = blockData;
              }
            } else {
              gameState.blockMap[y][x] = blockData;
            }
          }
        }
      }

      console.log("World synchronized from host data");
      updateVisibleBlocks();
    }
  });

  // Handle new player joining
  socket.on("newPlayer", (playerData) => {
    console.log("New player joined:", playerData);

    // Only add the player if they're on the same planet
    if (playerData.currentPlanet === gameState.currentPlanet) {
      addOtherPlayer(playerData.id, playerData);

      // Update player count
      updatePlayerCount(Object.keys(otherPlayers).length + 1);

      showMessage("New player joined!", 2000);
    }
  });

  // Handle players moving
  socket.on("playerMoved", (data) => {
    updateOtherPlayerPosition(data.id, data);
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

      // Add mining animation based on tool type
      if (data.tool === "drill") {
        // Add drilling animation
        const toolContainer = playerElement.querySelector(
          ".player-tool-container"
        );
        if (toolContainer) {
          toolContainer.classList.add("drilling-animation");
        }
      } else if (data.tool === "pickaxe") {
        // Add pickaxe mining animation
        const toolContainer = playerElement.querySelector(
          ".player-tool-container"
        );
        if (toolContainer) {
          toolContainer.classList.add("mining-animation");
        }
      }

      // Add the mining visual effects at the target block location
      addMiningEffectAtBlock(data.x, data.y);
    }
  });

  // Handle mining stops from other players
  socket.on("playerMiningStop", (data) => {
    if (otherPlayers[data.id]) {
      const playerElement = otherPlayers[data.id].element;

      // Remove mining animation
      const toolContainer = playerElement.querySelector(
        ".player-tool-container"
      );
      if (toolContainer) {
        toolContainer.classList.remove("drilling-animation");
        toolContainer.classList.remove("mining-animation");
      }

      // Clear mining data
      if (otherPlayers[data.id].mining) {
        // Remove any mining effects at the target block
        removeMiningEffectAtBlock(
          otherPlayers[data.id].mining.x,
          otherPlayers[data.id].mining.y
        );

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
    console.log("Player laser activated:", data.id);
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
    console.log("Laser update for player:", data.id, "angle:", data.angle);
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
          // Get the player's facing direction
          const playerDirection = otherPlayers[data.id].data.direction || 1;

          // Apply appropriate transform based on direction
          // FIXED: Corrected the transform logic to match player direction properly
          if (playerDirection === -1) {
            // When facing LEFT, we flip the beam AND negate the angle
            laserBeam.style.transform = `scaleX(-1) rotate(${data.angle}deg)`;
          } else {
            // When facing RIGHT, no horizontal flip needed
            laserBeam.style.transform = `rotate(${-data.angle}deg)`;
          }

          // Set transform origin to match local player
          laserBeam.style.transformOrigin = "left center";
        }
      }
    }
  });

  socket.on("playerJetpackActivated", (data) => {
    console.log("here");
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
    console.log("Someone purchased a rocket!");

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
          `Player ${data.playerId} moved to ${data.planet}, removing from view`
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
      }
    } else {
      // This is our own planet change

      // Save current planet state first
      if (gameState.currentPlanet === "earth" && data.planet === "moon") {
        if (gameState.blockMap && gameState.blockMap.length > 0) {
          gameState.earthBlockMap = JSON.parse(
            JSON.stringify(gameState.blockMap)
          );
        }
      } else if (
        gameState.currentPlanet === "moon" &&
        data.planet === "earth"
      ) {
        if (gameState.blockMap && gameState.blockMap.length > 0) {
          gameState.moonBlockMap = JSON.parse(
            JSON.stringify(gameState.blockMap)
          );
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
          gameState.blockMap = JSON.parse(
            JSON.stringify(gameState.moonBlockMap)
          );
          gameState.gravity = 0.3; // Lower gravity on the Moon
        }
      }

      // Clear other players since we changed planets
      for (const id in otherPlayers) {
        removeOtherPlayer(id);
      }

      // Update visible blocks
      updateVisibleBlocks();

      // Show message
      showMessage(`You traveled to the ${data.planet}`, 3000);

      // Request players on the new planet
      requestPlayersOnCurrentPlanet();
    }
  });

  socket.on("rocketLaunched", (data) => {
    // Only process this event if WE are the player who launched the rocket
    if (data.playerId === gameState.playerId) {
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
          gameState.moonBlockMap = JSON.parse(
            JSON.stringify(gameState.blockMap)
          );
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
          gameState.blockMap = JSON.parse(
            JSON.stringify(gameState.moonBlockMap)
          );
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
    } else {
      // If another player launched their rocket, remove them from our view
      if (otherPlayers[data.playerId]) {
        console.log(
          `Player ${data.playerId} launched to ${data.targetPlanet}, removing from view`
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
    }
  });

  socket.on("playersOnPlanet", (data) => {
    console.log("Received players on current planet:", data);

    // Add each player that isn't already visible
    for (const id in data.players) {
      if (id !== gameState.playerId && !otherPlayers[id]) {
        addOtherPlayer(id, data.players[id]);
      }
    }

    // Update player count
    updatePlayerCount(Object.keys(otherPlayers).length + 1);
  });

  // Add styles for other players if they don't exist yet
  addMultiplayerStyles();
}

/**
 * Upload the host's world to the server after world generation
 * This should be called once the world is fully generated
 */
export function uploadWorldToServer() {
  if (isConnected && socket && gameState.needToUploadWorld) {
    console.log("Uploading world data to server...");

    // Create a more efficient representation of the world
    // Only sending non-null blocks to reduce data size
    const worldData = {};

    for (let y = 0; y < gameState.blockMap.length; y++) {
      if (!gameState.blockMap[y]) continue;

      worldData[y] = {};

      for (let x = 0; x < gameState.blockMap[y].length; x++) {
        if (gameState.blockMap[y][x]) {
          worldData[y][x] = gameState.blockMap[y][x];
        }
      }
    }

    // Send the world data to the server
    socket.emit("uploadWorldData", {
      worldBlocks: worldData,
    });

    console.log("World data uploaded");
    gameState.needToUploadWorld = false;
  }
}

/**
 * Adds necessary CSS styles for multiplayer players
 */
function addMultiplayerStyles() {
  if (!document.getElementById("multiplayer-player-styles")) {
    const styleElement = document.createElement("style");
    styleElement.id = "multiplayer-player-styles";
    styleElement.textContent = `
      /* Existing styles... */
      
      .mining-effect {
        position: absolute;
        width: ${gameState.blockSize}px;
        height: ${gameState.blockSize}px;
        background-image: url('imgs/crack-overlay.png');
        background-size: cover;
        pointer-events: none;
        z-index: 40;
      }
    `;
    document.head.appendChild(styleElement);
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
    gameCodeDisplay.className = "game-code-display";

    // Add content to the game code display
    gameCodeDisplay.innerHTML = `
      <span class="game-code-label">Game Code:</span>
      <span id="pause-menu-code-value">${gameCode}</span>
      <button id="copy-pause-menu-code" class="copy-code-btn">Copy</button>
    `;

    // Insert at the top of the menu content
    if (menuContent && menuContent.firstChild) {
      menuContent.insertBefore(gameCodeDisplay, menuContent.firstChild);
    } else if (menuContent) {
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

  // Add the modal styles if they don't exist yet
  if (!document.getElementById("game-code-modal-styles")) {
    const styleElement = document.createElement("style");
    styleElement.id = "game-code-modal-styles";
    styleElement.textContent = `
      .game-code-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.7);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
      }
      
      .game-code-modal-content {
        background-color: #1a1a1a;
        border: 2px solid #444;
        border-radius: 8px;
        padding: 20px;
        width: 350px;
        text-align: center;
        box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
      }
      
      .game-code-modal h2 {
        color: #fff;
        margin-top: 0;
        font-size: 24px;
      }
      
      .game-code-modal p {
        color: #ccc;
        margin-bottom: 20px;
      }
      
      .game-code {
        background-color: #333;
        color: #4caf50;
        font-family: monospace;
        font-size: 28px;
        padding: 15px;
        margin: 20px 0;
        border-radius: 4px;
        user-select: all;
        border: 1px dashed #666;
        letter-spacing: 2px;
      }
      
      .button-container {
        display: flex;
        justify-content: center;
        gap: 10px;
      }
      
      .copy-success {
        color: #4caf50;
        font-size: 14px;
        margin-top: 10px;
        opacity: 0;
        transition: opacity 0.3s;
      }
      
      .copy-success.visible {
        opacity: 1;
      }
    `;
    document.head.appendChild(styleElement);
  }

  // Add event listener to close button
  const closeButton = document.getElementById("close-code-modal");
  if (closeButton) {
    closeButton.addEventListener("click", () => {
      document.body.removeChild(modal);
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
    socket.emit("playerMove", {
      x: gameState.player.x,
      y: gameState.player.y,
      direction: gameState.player.direction,
      velocityX: gameState.player.velocityX,
      velocityY: gameState.player.velocityY,
      onGround: gameState.player.onGround,
      health: gameState.player.health,
      depth: gameState.depth,
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

  // Add tool container with proper structure
  const toolContainer = document.createElement("div");
  toolContainer.className = "player-tool-container";

  // Use an actual SVG element instead of just an img for better animations
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
    console.log(
      `Added other player ${id} at position (${adjustedX}, ${adjustedY})`
    );
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
        }

        console.log(`Updated player ${id} tool to ${toolType} (${toolSrc})`);
      })
      .catch((error) => {
        console.error(`Failed to load tool SVG for player ${id}:`, error);
        // Fallback to simple img tag
        toolContainer.innerHTML = `<img src="${toolSrc}" alt="Tool" width="24" height="24">`;
      });
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
    socket.emit("miningStop", {});
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
    socket.emit("rocketLaunched", {
      targetPlanet: targetPlanet,
    });
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
export function requestPlayersOnCurrentPlanet() {
  if (isConnected && socket) {
    console.log(`Requesting players on planet: ${gameState.currentPlanet}`);

    // Send request immediately - no need for timeout
    socket.emit("getPlayersOnPlanet", {
      planet: gameState.currentPlanet,
    });

    // Add a safeguard retry in case the first request fails
    setTimeout(() => {
      // Only retry if we're still connected
      if (isConnected && socket) {
        console.log(
          `Retry: requesting players on planet: ${gameState.currentPlanet}`
        );
        socket.emit("getPlayersOnPlanet", {
          planet: gameState.currentPlanet,
        });
      }
    }, 2000);
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
