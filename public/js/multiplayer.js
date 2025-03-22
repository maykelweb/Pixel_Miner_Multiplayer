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
      const gameCode = options.gameCode;
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
    console.log(currentGameCode);
    showMessage("Game created! Code: " + currentGameCode, 5000);
    // Display the game code for the host
    showGameCode(currentGameCode);
    // Update game code in pause menu
    updatePauseMenuGameCode(currentGameCode);
  });
  
  // Handle join response
  socket.on('joinResponse', (data) => {
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

  // Add styles for other players if they don't exist yet
  addMultiplayerStyles();
}

/**
 * Adds necessary CSS styles for multiplayer players
 */
function addMultiplayerStyles() {
  if (!document.getElementById('multiplayer-player-styles')) {
    const styleElement = document.createElement('style');
    styleElement.id = 'multiplayer-player-styles';
    styleElement.textContent = `
      .other-player {
        width: 40px;
        height: 50px;
        position: absolute;
        z-index: 50;
        background-image: url(../imgs/character.svg);
        background-size: cover;
        background-position: center;
        transition: transform 0.1s;
        pointer-events: none;
      }

      .other-player.facing-left {
        transform: scaleX(-1);
      }

      .player-name {
        position: absolute;
        top: -20px;
        left: 0;
        width: 100%;
        text-align: center;
        color: white;
        font-size: 12px;
        font-weight: bold;
        text-shadow: 0px 0px 3px #000;
        white-space: nowrap;
        pointer-events: none;
      }

      .player-tool-container {
        position: absolute;
        top: 10px;
        right: -15px;
        width: 24px;
        height: 24px;
        z-index: 30;
        pointer-events: none;
      }

      .other-player.facing-left .player-tool-container {
        right: auto;
        left: -15px;
        transform: scaleX(-1);
      }
      
      .game-code-display {
        background-color: #333;
        color: #4caf50;
        font-family: monospace;
        font-size: 18px;
        padding: 8px 12px;
        margin-bottom: 15px;
        border-radius: 4px;
        user-select: all;
        border: 1px dashed #666;
        letter-spacing: 2px;
        text-align: center;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .game-code-label {
        color: #ccc;
        font-size: 14px;
        margin-right: 10px;
      }
      
      .copy-code-btn {
        background-color: #2a2a2a;
        border: 1px solid #555;
        color: #ccc;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .copy-code-btn:hover {
        background-color: #3a3a3a;
        color: #fff;
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
  let gameCodeDisplay = document.getElementById('pause-menu-game-code');
  
  // If it doesn't exist yet, create it
  if (!gameCodeDisplay) {
    const menuContent = document.querySelector('.menu-content');
    
    // Create the game code display element
    gameCodeDisplay = document.createElement('div');
    gameCodeDisplay.id = 'pause-menu-game-code';
    gameCodeDisplay.className = 'game-code-display';
    
    // Add content to the game code display
    gameCodeDisplay.innerHTML = `
      <span class="game-code-label">Game Code:</span>
      <span id="pause-menu-code-value">${gameCode}</span>
      <button id="copy-pause-menu-code" class="copy-code-btn">Copy</button>
    `;
    
    // Insert at the top of the menu content
    if (menuContent.firstChild) {
      menuContent.insertBefore(gameCodeDisplay, menuContent.firstChild);
    } else {
      menuContent.appendChild(gameCodeDisplay);
    }
    
    // Add event listener to copy button
    document.getElementById("copy-pause-menu-code").addEventListener("click", () => {
      // Copy the game code to clipboard
      navigator.clipboard.writeText(gameCode).then(() => {
        // Change button text temporarily
        const copyBtn = document.getElementById("copy-pause-menu-code");
        const originalText = copyBtn.textContent;
        copyBtn.textContent = "Copied!";
        
        // Reset button text after 2 seconds
        setTimeout(() => {
          copyBtn.textContent = originalText;
        }, 2000);
      }).catch(err => {
        console.error('Failed to copy text: ', err);
      });
    });
  } else {
    // If it exists, just update the code value
    document.getElementById('pause-menu-code-value').textContent = gameCode;
  }
}

/**
 * Shows the game code for other players to join
 * @param {string} gameCode - The game code to display
 */
export function showGameCode(gameCode) {
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
  if (!document.getElementById('game-code-modal-styles')) {
    const styleElement = document.createElement('style');
    styleElement.id = 'game-code-modal-styles';
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
  document.getElementById("close-code-modal").addEventListener("click", () => {
    document.body.removeChild(modal);
  });

  // Add event listener to copy button
  document.getElementById("copy-code-button").addEventListener("click", () => {
    // Copy the game code to clipboard
    navigator.clipboard.writeText(gameCode).then(() => {
      // Show success message
      const successMessage = document.getElementById("copy-success");
      successMessage.classList.add("visible");
      
      // Hide the success message after 3 seconds
      setTimeout(() => {
        successMessage.classList.remove("visible");
      }, 3000);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  });
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
  
  // Add name tag
  const nameTag = document.createElement("div");
  nameTag.className = "player-name";
  nameTag.textContent = `Player ${id.substring(0, 3)}`;
  newPlayerElement.appendChild(nameTag);
  
  // Add tool container
  const toolContainer = document.createElement("div");
  toolContainer.className = "player-tool-container";
  toolContainer.innerHTML = '<img src="imgs/pickaxe-basic.svg" alt="Pickaxe" width="24" height="24">';
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
  
  // Add to game world
  const gameWorld = document.getElementById("game-world");
  gameWorld.appendChild(newPlayerElement);
  
  console.log(`Added other player ${id} at position (${adjustedX}, ${adjustedY})`);
  
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
    
    // Determine tool image based on toolId
    let toolSrc = "imgs/pickaxe-basic.svg";
    
    if (toolId && toolId.includes("drill")) {
      if (toolId.includes("ruby")) {
        toolSrc = "imgs/drill-ruby.svg";
      } else if (toolId.includes("diamond")) {
        toolSrc = "imgs/drill-diamond.svg";
      } else {
        toolSrc = "imgs/drill-basic.svg";
      }
    } else if (toolId && toolId.includes("laser")) {
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
    
    // Update tool visual using the same image sources as the main player
    toolContainer.innerHTML = `<img src="${toolSrc}" alt="Tool" width="24" height="24">`;
    
    console.log(`Updated player ${id} tool to ${toolSrc}`);
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
    const adjustedX = playerData.x - gameState.camera.x;
    const adjustedY = playerData.y - gameState.camera.y;
    
    playerElement.style.left = `${adjustedX}px`;
    playerElement.style.top = `${adjustedY}px`;
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