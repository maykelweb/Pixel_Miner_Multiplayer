// Modified main.js - Updated for multiplayer

import { gameState } from "./config.js";
import {
  generateWorld,
  updateClouds,
  manageClouds,
} from "./worldGeneration.js";
import { updateBombs, renderBombs } from "./bombs.js";
import { initializeShop } from "./shop.js";
import {
  updateUI,
  updateUIIfNeeded,
  updateVisibleBlocks,
  renderPlayer,
  updateCamera,
  updateBackgroundPosition,
  updateCloudPosition,
  updateCraftingStationPosition,
  updateShopPosition,
  updateExplosionPosition,
} from "./updates.js";
import { updateAllAnimationPositions } from "./animations.js";
import {
  gameMusic,
  menuMusic,
  storyMusic,
  playerElement,
  checkShopInteraction,
  setupEventListeners,
  showConfirmDialog,
  crossFadeAudio,
  stopSFX,
} from "./setup.js";
import { updatePlayer, loadEquippedTool } from "./player.js";
import { updateInventory } from "./inventory.js";
import {
  initializeCrafting,
  checkCraftingInteraction,
  getCurrentTool,
} from "./crafting.js";
// Import rocket functionality
import {
  initializeRocket,
  updateRocketPosition,
  checkRocketInteraction,
} from "./rocket.js";
import { generateMoonWorld } from "./moonGeneration.js";
import { loadAudioSettings, showMainMenu } from "./menu.js";
// Import the story sequence functions
import { showStorySequence } from "./story.js";
import { cleanupMenuBackground } from "./menuBackground.js";
// Import multiplayer functions
import {
  initMultiplayer,
  updateOtherPlayersForCamera,
  sendPlayerUpdate,
  showGameCode,
} from "./multiplayer.js";

// Get DOM elements
export const gameWorld = document.getElementById("game-world");

const FRAME_RATE = 60;
const FRAME_DELAY = 1000 / FRAME_RATE;
let lastFrameTime = 0;
let lastNetworkUpdateTime = 0;
const NETWORK_UPDATE_INTERVAL = 100; // Send updates every 100ms

/**
 * The main game loop with multiplayer support
 */
function gameLoop(timestamp) {
  const elapsed = timestamp - lastFrameTime;

  if (elapsed > FRAME_DELAY) {
    lastFrameTime = timestamp - (elapsed % FRAME_DELAY);

    // Skip updates if the menu is open.
    if (gameState.menuOpen) {
      requestAnimationFrame(gameLoop);
      return;
    }

    // Manage delta time ensuring a maximum value for stability.
    if (!gameState.lastTime) {
      gameState.lastTime = timestamp;
    }
    gameState.deltaTime = timestamp - gameState.lastTime;
    gameState.lastTime = timestamp;
    gameState.deltaTime = Math.min(gameState.deltaTime, 100);

    // Update game state and render
    updatePlayer();
    updateCamera();
    updateInventory();
    updateVisibleBlocks();
    updateBackgroundPosition();
    updateCloudPosition();
    updateExplosionPosition();
    updateCraftingStationPosition();
    updateShopPosition();
    updateAllAnimationPositions();

    // Update other players' positions to match camera movement
    updateOtherPlayersForCamera();

    // Send network update at fixed intervals to reduce bandwidth
    if (timestamp - lastNetworkUpdateTime > NETWORK_UPDATE_INTERVAL) {
      sendPlayerUpdate();
      lastNetworkUpdateTime = timestamp;
    }

    // Update rocket position and check for interaction
    updateRocketPosition();
    checkRocketInteraction();

    // Only update shop and crafting if on Earth
    if (gameState.currentPlanet === "earth") {
      checkShopInteraction();
      checkCraftingInteraction();
    }

    renderPlayer();
    updateUIIfNeeded();
    updateBombs(gameState.deltaTime);
    renderBombs();
  }

  // Always update and manage clouds regardless of frame capping.
  // Only update clouds on Earth
  if (gameState.currentPlanet === "earth") {
    updateClouds();
    manageClouds();
  }

  requestAnimationFrame(gameLoop);
}

/**
 * Hides the main menu and starts a new game
 */
export function startNewGame() {
  const mainMenu = document.getElementById("main-menu");
  if (mainMenu) {
    // Check if there's an existing save
    const hasSavedGame = localStorage.getItem("pixelMinerSave") !== null;

    // If there's a save, show confirmation dialog before proceeding
    if (hasSavedGame) {
      showConfirmDialog(
        "Starting a new game will delete your current save. Are you sure?",
        () => {
          // User confirmed, continue with starting a new game
          mainMenu.style.display = "none";

          // Clean up the menu background
          cleanupMenuBackground();

          // Clear any existing save data
          localStorage.removeItem("pixelMinerSave");

          // Show the story sequence for new games
          showStorySequence();

          // Note: initGame() will be called after the story sequence completes
        },
        () => {
          // User canceled, do nothing (stay on main menu)
        }
      );
    } else {
      // No save exists, proceed directly
      mainMenu.style.display = "none";

      // Clean up the menu background
      cleanupMenuBackground();

      // Show the story sequence for new games
      showStorySequence();

      // Note: initGame() will be called after the story sequence completes
    }
  }
}

/**
 * Loads an existing game from localStorage
 */
export function loadExistingGame() {
  const mainMenu = document.getElementById("main-menu");
  if (mainMenu) {
    mainMenu.style.display = "none";

    // Clean up the menu background
    cleanupMenuBackground();

    // Transition from menu music to game music
    crossFadeAudio(menuMusic, gameMusic, 1000, true);

    // Initialize and load the game
    initGame();

    // Set music started flag since we've already handled music
    gameState.musicStarted = true;
  }
}

/**
 * Initialize the game
 */
export function initGame() {
  try {
    const loadedGame = gameState.loadGame();
    if (loadedGame) {
      console.info("Game loaded from save");
    }
  } catch (error) {
    console.error("Failed to load game:", error);
  }

  // Load audio settings
  loadAudioSettings();

  // Ensure current planet is set to earth on first load
  if (gameState.currentPlanet === "earth") {
    generateWorld();
  } else {
    generateMoonWorld();
  }
  setupEventListeners();
  initializeShop();
  initializeCrafting();
  initializeRocket(); // Initialize the rocket system
  // Show UI Display
  document.getElementById("info-panel").style.display = "block";
  document.getElementById("depth-indicator").style.display = "block";

  // Add player to world
  gameWorld.appendChild(playerElement);
  loadEquippedTool();

  gameState.shopOpen = false;
  gameState.craftingOpen = false;
  updateUI();
  requestAnimationFrame(gameLoop);
}

// Create multiplayer dialogs if they don't exist
function createMultiplayerDialogs() {
  // Create join game dialog if it doesn't exist
  if (!document.getElementById("join-game-dialog")) {
    const joinDialog = document.createElement("div");
    joinDialog.id = "join-game-dialog";
    joinDialog.className = "modal";
    joinDialog.style.display = "none";
    
    joinDialog.innerHTML = `
      <div class="modal-content">
        <h2>Join Game</h2>
        <p>Enter the game code to join:</p>
        <input type="text" id="game-code" placeholder="Enter game code" class="modal-input">
        <div class="modal-buttons">
          <button id="join-game-submit" class="modal-button">Join</button>
          <button id="join-game-cancel" class="modal-button">Cancel</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(joinDialog);
  }
  
  // Create host game dialog if it doesn't exist
  if (!document.getElementById("host-game-dialog")) {
    const hostDialog = document.createElement("div");
    hostDialog.id = "host-game-dialog";
    hostDialog.className = "modal";
    hostDialog.style.display = "none";
    
    hostDialog.innerHTML = `
      <div class="modal-content">
        <h2>Host Game</h2>
        <div class="form-group">
          <label for="game-name">Game Name:</label>
          <input type="text" id="game-name" placeholder="My Pixel Miner Game" class="modal-input">
        </div>
        <div class="form-group">
          <label for="max-players">Max Players:</label>
          <input type="number" id="max-players" min="2" max="8" value="4" class="modal-input">
        </div>
        <div class="form-group">
          <p>World Selection:</p>
          <div class="radio-group">
            <input type="radio" id="world-new" name="world-type" checked>
            <label for="world-new">New World</label>
          </div>
          <div class="radio-group">
            <input type="radio" id="world-existing" name="world-type">
            <label for="world-existing">Use Existing Save</label>
          </div>
        </div>
        <div class="modal-buttons">
          <button id="host-game-submit" class="modal-button">Create Game</button>
          <button id="host-game-cancel" class="modal-button">Cancel</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(hostDialog);
  }
  
  // Add CSS for modals if needed
  if (!document.getElementById("multiplayer-styles")) {
    const styleElement = document.createElement("style");
    styleElement.id = "multiplayer-styles";
    styleElement.textContent = `
      .modal {
        display: none;
        position: fixed;
        z-index: 1000;
        left: 0;
        top: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.7);
        align-items: center;
        justify-content: center;
      }
      
      .modal-content {
        background-color: #1a1a1a;
        border: 2px solid #555;
        border-radius: 8px;
        padding: 20px;
        width: 90%;
        max-width: 400px;
        color: #fff;
      }
      
      .modal-input {
        width: 100%;
        padding: 10px;
        margin: 10px 0;
        background-color: #333;
        border: 1px solid #555;
        border-radius: 4px;
        color: #fff;
      }
      
      .modal-buttons {
        display: flex;
        justify-content: space-around;
        margin-top: 20px;
      }
      
      .modal-button {
        padding: 10px 20px;
        background-color: #4a6da7;
        border: none;
        border-radius: 4px;
        color: white;
        cursor: pointer;
        transition: background-color 0.3s;
      }
      
      .modal-button:hover {
        background-color: #5a7db7;
      }
      
      .form-group {
        margin-bottom: 15px;
      }
      
      .radio-group {
        margin: 5px 0;
      }
      
      .game-code {
        font-size: 24px;
        text-align: center;
        padding: 10px;
        margin: 10px 0;
        background-color: #333;
        border-radius: 4px;
        letter-spacing: 3px;
        font-weight: bold;
      }
    `;
    
    document.head.appendChild(styleElement);
  }
}

/**
 * Handles hosting a multiplayer game
 */
export function hostMultiplayerGame() {
  // Get game name and player count
  const gameName = 
    document.getElementById("game-name").value || "Pixel Miner Game";
  const maxPlayers = 
    parseInt(document.getElementById("max-players").value) || 4;
  const useExistingSave = document.getElementById("world-existing").checked;

  // Close main menu
  const mainMenu = document.getElementById("main-menu");
  if (mainMenu) {
    mainMenu.style.display = "none";
  }

  // Clean up menu background
  cleanupMenuBackground();

  // Initialize the world based on chosen option
  if (useExistingSave) {
    try {
      gameState.loadGame();
    } catch (error) {
      console.error("Failed to load existing save:", error);
      // Fall back to new world
      generateWorld();
    }
  } else {
    // Create new world
    generateWorld();
  }

  // Initialize multiplayer systems as host
  initMultiplayer(true, {
    gameName: gameName,
    maxPlayers: maxPlayers,
  });

  // Initialize game
  initGame();

  // Transition from menu music to game music
  crossFadeAudio(menuMusic, gameMusic, 1000, true);
  gameState.musicStarted = true;
}

/**
 * Handles joining a multiplayer game
 */
export function joinMultiplayerGame() {
  // Close main menu
  const mainMenu = document.getElementById("main-menu");
  if (mainMenu) {
    mainMenu.style.display = "none";
  }

  // Clean up menu background
  cleanupMenuBackground();

  // Initialize multiplayer systems
  initMultiplayer(false);

  // Initialize game
  initGame();

  // Transition from menu music to game music
  crossFadeAudio(menuMusic, gameMusic, 1000, true);
  gameState.musicStarted = true;
}

// Modify the DOMContentLoaded listener to show the main menu first
document.addEventListener("DOMContentLoaded", function () {
  // Load audio settings first, before any music plays
  loadAudioSettings();

  // Create multiplayer dialogs
  createMultiplayerDialogs();

  // Instead of immediately starting the game, show the main menu
  showMainMenu();

  // Add multiplayer button listeners
  const joinGameBtn = document.getElementById("join-game");
  if (joinGameBtn) {
    joinGameBtn.addEventListener("click", () => {
      // Play menu click sound
      const menuClickSound = document.getElementById("menu-click-sound");
      if (menuClickSound) menuClickSound.play();
      
      // Show join game dialog
      const joinDialog = document.getElementById("join-game-dialog");
      joinDialog.style.display = "flex";
    });
  }

  const hostGameBtn = document.getElementById("host-game");
  if (hostGameBtn) {
    hostGameBtn.addEventListener("click", () => {
      // Play menu click sound
      const menuClickSound = document.getElementById("menu-click-sound");
      if (menuClickSound) menuClickSound.play();
      
      // Show host game dialog
      const hostDialog = document.getElementById("host-game-dialog");
      hostDialog.style.display = "flex";
    });
  }

  // Handle dialog buttons
  const joinSubmitBtn = document.getElementById("join-game-submit");
  if (joinSubmitBtn) {
    joinSubmitBtn.addEventListener("click", () => {
      const joinDialog = document.getElementById("join-game-dialog");
      joinDialog.style.display = "none";
      joinMultiplayerGame();
    });
  }

  const joinCancelBtn = document.getElementById("join-game-cancel");
  if (joinCancelBtn) {
    joinCancelBtn.addEventListener("click", () => {
      const joinDialog = document.getElementById("join-game-dialog");
      joinDialog.style.display = "none";
    });
  }

  const hostSubmitBtn = document.getElementById("host-game-submit");
  if (hostSubmitBtn) {
    hostSubmitBtn.addEventListener("click", () => {
      const hostDialog = document.getElementById("host-game-dialog");
      hostDialog.style.display = "none";
      hostMultiplayerGame();
    });
  }

  const hostCancelBtn = document.getElementById("host-game-cancel");
  if (hostCancelBtn) {
    hostCancelBtn.addEventListener("click", () => {
      const hostDialog = document.getElementById("host-game-dialog");
      hostDialog.style.display = "none";
    });
  }
});