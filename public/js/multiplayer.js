// multiplayer.js - Client-side socket handling
import { gameState } from "./config.js";
import { playerElement, showMessage } from "./setup.js";
import { updateVisibleBlocks } from "./updates.js";
import { createBreakingAnimation } from "./animations.js";

// Socket.io client
let socket;
let isConnected = false;
let otherPlayers = {}; // Store references to other player elements
let currentGameCode = ""; // Store the current game code

/**
 * Initialize connection to multiplayer server
 * @param {boolean} isHost - Whether this client is hosting the game
 * @param {Object} options - Additional options for hosting
 */
export function initMultiplayer(isHost = false, options = {}) {
  // Connect to the server
  socket = io(); // Assumes Socket.IO is loaded in the HTML

  // Handle successful connection
  socket.on('connect', () => {
    isConnected = true;
    console.log("Connected to server with ID:", socket.id);
    
    // If hosting, send host information to server
    if (isHost) {
      socket.emit('hostGame', {
        gameName: options.gameName || "Pixel Miner Game",
        maxPlayers: options.maxPlayers || 4
      });
      showMessage("Hosting a new game!", 3000);
    } else {
      // If joining, send the game code to join
      const gameCode = document.getElementById("game-code").value;
      if (gameCode) {
        socket.emit('joinGame', {
          gameCode: gameCode
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
    playerCountDisplay.innerHTML = '<span class="player-icon">👥</span><span id="player-count-value">1</span>';
    infoPanel.appendChild(playerCountDisplay);
  });
  
  // Handle hosting response
  socket.on('gameHosted', (data) => {
    currentGameCode = data.gameCode;
    showMessage("Game created! Code: " + currentGameCode, 5000);
    // Display the game code for the host
    showGameCode(currentGameCode);
  });
  
  // Handle join response
  socket.on('joinResponse', (data) => {
    if (data.success) {
      showMessage("Successfully joined game: " + data.gameCode, 3000);
    } else {
      showMessage("Failed to join game: " + data.message, 3000);
    }
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    isConnected = false;
    showMessage("Disconnected from server. Attempting to reconnect...", 3000);
  });
  
  // Handle initial game state
  socket.on('gameState', (data) => {
    // Set local player ID
    gameState.playerId = data.playerId;
    
    // Initialize other players
    for (const id in data.players) {
      if (id !== gameState.playerId) {
        addOtherPlayer(id, data.players[id]);
      }
    }
    
    // Update player count
    updatePlayerCount(Object.keys(data.players).length);
    
    // Handle world block sync - only for new blocks different from local state
    for (const y in data.worldBlocks) {
      for (const x in data.worldBlocks[y]) {
        if (gameState.blockMap[y] && gameState.blockMap[y][x] !== data.worldBlocks[y][x]) {
          gameState.blockMap[y][x] = data.worldBlocks[y][x];
        }
      }
    }
    updateVisibleBlocks();
  });
  
  // Handle new player joining
  socket.on('newPlayer', (playerData) => {
    addOtherPlayer(playerData.id, playerData);
    
    // Update player count
    updatePlayerCount(Object.keys(otherPlayers).length + 1);
    
    showMessage("New player joined!", 2000);
  });
  
  // Handle players moving
  socket.on('playerMoved', (data) => {
    updateOtherPlayerPosition(data.id, data);
  });
  
  // Handle player tool changes
  socket.on('playerToolChanged', (data) => {
    updateOtherPlayerTool(data.id, data.tool);
  });
  
  // Handle world updates (blocks mined by others)
  socket.on('worldUpdated', (data) => {
    if (gameState.blockMap[data.y] && gameState.blockMap[data.y][data.x] !== null) {
      // Show breaking animation
      createBreakingAnimation(
        data.x,
        data.y,
        gameState.blockMap[data.y][data.x].color
      );
      
      // Update local block map
      gameState.blockMap[data.y][data.x] = null;
      
      // Update visible blocks
      updateVisibleBlocks();
    }
  });
  
  // Handle player disconnections
  socket.on('playerDisconnected', (playerId) => {
    removeOtherPlayer(playerId);
    
    // Update player count
    updatePlayerCount(Object.keys(otherPlayers).length + 1);
    
    showMessage("A player has left the game", 2000);
  });
}

/**
 * Shows the game code for other players to join
 * @param {string} gameCode - The game code to display
 */
export function showGameCode(gameCode) {
  // Create a modal with the game code
  const modal = document.createElement("div");
  modal.className = "modal";
  modal.id = "game-code-modal";

  modal.innerHTML = `
    <div class="modal-content">
      <h2>Your Game Code</h2>
      <p>Share this code with friends to let them join your game:</p>
      <div class="game-code">${gameCode}</div>
      <button id="close-code-modal" class="modal-button">Got It</button>
    </div>
  `;

  document.body.appendChild(modal);

  // Add event listener to close button
  document.getElementById("close-code-modal").addEventListener("click", () => {
    document.body.removeChild(modal);
  });
}

/**
 * Send player position update to server
 */
export function sendPlayerUpdate() {
  if (isConnected && socket && gameState.player) {
    socket.emit('playerMove', {
      x: gameState.player.x,
      y: gameState.player.y,
      direction: gameState.player.direction,
      velocityX: gameState.player.velocityX,
      velocityY: gameState.player.velocityY,
      onGround: gameState.player.onGround,
      health: gameState.player.health,
      depth: gameState.depth
    });
  }
}

/**
 * Send block mining event to server
 */
export function sendBlockMined(x, y) {
  if (isConnected && socket) {
    socket.emit('blockMined', {
      x: x,
      y: y
    });
  }
}

/**
 * Send tool change event to server
 */
export function sendToolChanged(toolId) {
  if (isConnected && socket) {
    socket.emit('toolChanged', {
      tool: toolId
    });
  }
}

/**
 * Create and add another player to the game world
 */
function addOtherPlayer(id, playerData) {
  // Create player element for the new player
  const newPlayerElement = document.createElement("div");
  newPlayerElement.className = "player other-player";
  newPlayerElement.dataset.playerId = id;
  
  // Create player avatar with tool
  const playerAvatar = document.createElement("div");
  playerAvatar.className = "player-avatar";
  playerAvatar.innerHTML = `
    <div class="player-tool-container">
      <img src="imgs/pickaxe-basic.svg" alt="Player Tool" class="player-tool" />
    </div>
    <div class="player-body"></div>
    <div class="player-name">${id.substring(0, 5)}</div>
  `;
  
  newPlayerElement.appendChild(playerAvatar);
  
  // Position the player
  newPlayerElement.style.left = `${playerData.x}px`;
  newPlayerElement.style.top = `${playerData.y}px`;
  
  // Add to game world
  const gameWorld = document.getElementById("game-world");
  gameWorld.appendChild(newPlayerElement);
  
  // Store reference
  otherPlayers[id] = {
    element: newPlayerElement,
    data: playerData
  };
}

/**
 * Update position of another player
 */
function updateOtherPlayerPosition(id, playerData) {
  if (otherPlayers[id]) {
    // Update stored data
    otherPlayers[id].data = {
      ...otherPlayers[id].data,
      ...playerData
    };
    
    // Update DOM position
    const playerElement = otherPlayers[id].element;
    playerElement.style.left = `${playerData.x - gameState.camera.x}px`;
    playerElement.style.top = `${playerData.y - gameState.camera.y}px`;
    
    // Update direction (facing)
    if (playerData.direction === -1) {
      playerElement.classList.add("facing-left");
    } else {
      playerElement.classList.remove("facing-left");
    }
    
    // Add jumping animation if player is not on ground
    if (!playerData.onGround) {
      playerElement.classList.add("jumping");
    } else {
      playerElement.classList.remove("jumping");
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
    
    // Determine tool image based on toolId
    let toolImage = "pickaxe-basic";
    if (toolId.includes("drill")) {
      toolImage = toolId;
    } else if (toolId.includes("laser")) {
      toolImage = "laser";
    } else {
      toolImage = toolId;
    }
    
    // Update tool visual
    toolContainer.innerHTML = `<img src="imgs/${toolImage}.svg" alt="Player Tool" class="player-tool" />`;
  }
}

/**
 * Remove another player from the game
 */
function removeOtherPlayer(id) {
  if (otherPlayers[id]) {
    // Remove from DOM
    const playerElement = otherPlayers[id].element;
    playerElement.parentNode.removeChild(playerElement);
    
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
    playerElement.style.left = `${playerData.x - gameState.camera.x}px`;
    playerElement.style.top = `${playerData.y - gameState.camera.y}px`;
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