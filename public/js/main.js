// Modified main.js - Updated for multiplayer

import { gameState } from "./config.js";
import {
  generateWorld,
  updateClouds,
  manageClouds,
  initializeClouds,
  setupBackground,
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
import {
  loadAudioSettings,
  showMainMenu,
  multiplayerInitialized,
} from "./menu.js";
// Import the story sequence functions
import { showStorySequence } from "./story.js";
import { cleanupMenuBackground } from "./menuBackground.js";
// Import multiplayer functions
import {
  initMultiplayer,
  updateOtherPlayersForCamera,
  sendPlayerUpdate,
  showGameCode,
  refreshPlayerVisibility,
} from "./multiplayer.js";

// Get DOM elements
export const gameWorld = document.getElementById("game-world");

const FRAME_RATE = 60;
const FRAME_DELAY = 1000 / FRAME_RATE;
let lastFrameTime = 0;
let lastNetworkUpdateTime = 0;
const NETWORK_UPDATE_INTERVAL = 50; // Send updates every 100ms

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

    // FIXED: Skip player physics updates if waiting for world data
    // This prevents the player from falling through the unloaded world
    if (!gameState.isWaitingForWorldData) {
      updatePlayer();
    }
    
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
  // FIXED: Changed from "main-menu" to "main-menu-overlay" to match the HTML ID
  const mainMenu = document.getElementById("main-menu-overlay");
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
  } else {
    console.error("Main menu element not found with ID 'main-menu-overlay'");
  }
}


/**
 * Loads an existing game from localStorage
 */
export function loadExistingGame() {
  console.log("loadExistingGame function called");

  // FIXED: Changed from "main-menu" to "main-menu-overlay" to match the HTML ID
  const mainMenu = document.getElementById("main-menu-overlay");
  if (mainMenu) {
    mainMenu.style.display = "none";

    // Clean up the menu background
    cleanupMenuBackground();

    // Set flag to ensure we're not joining multiplayer
    gameState.isJoiningMultiplayer = false;
    
    // IMPORTANT: Explicitly set flag to ensure we're NOT in a new game state
    gameState.newGame = false;
    
    // Transition from menu music to game music
    crossFadeAudio(menuMusic, gameMusic, 1000, true);
    
    // Check and load save before initializing game
    try {
      const saveExists = localStorage.getItem("pixelMinerSave") !== null;
      if (saveExists) {
        console.log("Found existing save, will load it during initialization");
      } else {
        console.warn("No save found but loadExistingGame was called");
        // Continue anyway, initGame will handle the absence of save data
      }
    } catch (error) {
      console.error("Error checking for save:", error);
    }

    // Initialize and load the game
    initGame();

    // Set music started flag since we've already handled music
    gameState.musicStarted = true;
  } else {
    console.error("Main menu element not found with ID 'main-menu-overlay'");
  }
}

/**
 * Initialize the game - with improved save handling
 */
export function initGame() {
  // Only attempt to load saved game if not joining a multiplayer game
  // and not explicitly creating a new game
  if (!gameState.isJoiningMultiplayer && !gameState.newGame) {
    try {
      const saveData = localStorage.getItem("pixelMinerSave");
      if (saveData) {
        const loaded = gameState.loadGame();
        if (loaded) {
          console.info("Game loaded from save successfully");
        } else {
          console.error("Failed to parse saved game data");
        }
      } else {
        console.info("No saved game found to load");
      }
    } catch (error) {
      console.error("Failed to load game:", error);
    }
  } else if (gameState.isJoiningMultiplayer) {
    console.info("Joining multiplayer game - skipping local save load");
  } else {
    console.info("Creating new game - skipping local save load");
  }

  // Load audio settings
  loadAudioSettings();

  // If joining multiplayer, don't generate a world yet - wait for host data
  if (!gameState.isJoiningMultiplayer) {
    // Ensure current planet is set to earth on first load
    if (gameState.currentPlanet === "earth") {
      generateWorld();
    } else {
      generateMoonWorld();
    }
  } else {
    // For joining players, initialize an empty world structure
    // that will be filled with the host's data
    gameState.blockMap = [];
    // Since we're not generating a world, setup the background here
    setupBackground()
    initializeClouds();
  }

  setupEventListeners();
  initializeShop();
  initializeCrafting();
  initializeRocket(); // Initialize the rocket system

  // Show UI Display
  document.getElementById("info-panel").style.display = "block";
  document.getElementById("depth-indicator").style.display = "block";

  // Add player to world but only make it visible if not waiting for world data
  gameWorld.appendChild(playerElement);
  
  // NEW: Hide player element initially if joining multiplayer
  if (gameState.isJoiningMultiplayer && gameState.isWaitingForWorldData) {
    playerElement.style.visibility = "hidden";
  } else {
    playerElement.style.visibility = "visible";
  }
  
  loadEquippedTool();

  gameState.shopOpen = false;
  gameState.craftingOpen = false;
  updateUI();
  requestAnimationFrame(gameLoop);
}

/**
 * Handles hosting a multiplayer game
 */
export function hostMultiplayerGame() {
  // Get player count
  const maxPlayers =
    parseInt(document.getElementById("max-players").value) || 4;
  const useExistingSave = document.getElementById("world-existing").checked;

  // Close all UI elements - both main menu IDs to be safe
  const mainMenu = document.getElementById("main-menu");
  if (mainMenu) {
    mainMenu.style.display = "none";
  }

  const mainMenuOverlay = document.getElementById("main-menu-overlay");
  if (mainMenuOverlay) {
    mainMenuOverlay.style.display = "none";
  }

  // Close any open dialogs
  const hostDialog = document.getElementById("host-game-dialog");
  if (hostDialog) {
    hostDialog.style.display = "none";
  }

  // Also hide options modal if it's open
  const optionsModal = document.getElementById("options-modal");
  if (optionsModal) {
    optionsModal.style.display = "none";
  }

  // Clean up menu background
  cleanupMenuBackground();

  // First initialize multiplayer systems as host BEFORE generating the world
  // This ensures multiplayer is ready to sync world data
  initMultiplayer(true, {
    maxPlayers: maxPlayers,
  });

  // Transition from menu music to game music
  crossFadeAudio(menuMusic, gameMusic, 1000, true);
  gameState.musicStarted = true;

  // FIXED: Don't remove save data, just set flags appropriately
  if (!useExistingSave) {
    console.log("Creating new world - but keeping save data intact");
    // Set flag to generate a new world
    gameState.forceNewWorld = true;
  } else {
    console.log("Using existing world from save");
    gameState.forceNewWorld = false;
  }

  // Set upload world to server flag - IMPORTANT: Must be set before initGame
  gameState.needToUploadWorld = true;
  gameState.isHost = true;

  // Initialize the game - this will load the save or create a new world
  initGame();

  // Show game UI elements
  const infoPanel = document.getElementById("info-panel");
  if (infoPanel) infoPanel.style.display = "block";

  const depthIndicator = document.getElementById("depth-indicator");
  if (depthIndicator) depthIndicator.style.display = "block";

  // Make sure player is visible
  const playerElement = document.getElementById("player");
  if (playerElement) playerElement.style.display = "block";

  // Send an immediate player update to ensure presence in the game
  sendPlayerUpdate();
  
  // For extra reliability, schedule another world upload attempt after a short delay
  // This ensures world data is sent even if the first attempt encounters timing issues
  setTimeout(() => {
    if (gameState.isHost && currentGameCode) {
      console.log("Scheduled additional world upload check");
      if (gameState.needToUploadWorld) {
        console.log("Executing additional world upload");
        uploadWorldToServer();
      }
    }
  }, 5000);
}

/**
 * Handles joining a multiplayer game
 */
export function joinMultiplayerGame() {
  console.log("Starting join multiplayer game process");

  // Get the game code from the input
  const gameCode = document.getElementById("game-code").value;
  if (!gameCode || gameCode.trim() === "") {
    console.error("No game code provided");
    showMessage("Please enter a valid game code", 3000);
    return;
  }

  // Close all UI elements - check both main menu IDs to be safe
  const mainMenu = document.getElementById("main-menu");
  if (mainMenu) {
    mainMenu.style.display = "none";
  }

  const mainMenuOverlay = document.getElementById("main-menu-overlay");
  if (mainMenuOverlay) {
    mainMenuOverlay.style.display = "none";
  }

  // Close any open dialogs
  const joinDialog = document.getElementById("join-game-dialog");
  if (joinDialog) {
    joinDialog.style.display = "none";
  }

  // Also hide options modal if it's open
  const optionsModal = document.getElementById("options-modal");
  if (optionsModal) {
    optionsModal.style.display = "none";
  }

  // Clean up menu background
  cleanupMenuBackground();

  // Show a loading screen while waiting for world data
  showLoadingScreen("Connecting to game...");

  // Flag that we're waiting for world data
  gameState.isWaitingForWorldData = true;

  // Initialize multiplayer systems as client with the game code
  console.log("Initializing multiplayer as client with game code:", gameCode);
  initMultiplayer(false, {
    gameCode: gameCode,
  });

  // Flag that we're NOT the host (set to false explicitly)
  gameState.needToUploadWorld = false;

  // IMPORTANT: Set a flag to skip loading from save when joining multiplayer
  gameState.isJoiningMultiplayer = true;

  // Show game UI elements
  const infoPanel = document.getElementById("info-panel");
  if (infoPanel) infoPanel.style.display = "block";

  const depthIndicator = document.getElementById("depth-indicator");
  if (depthIndicator) depthIndicator.style.display = "block";

  // Initialize game - world generation will be overridden with host data
  // BUT keep player hidden until world data is received
  initGame();

  // Transition from menu music to game music
  crossFadeAudio(menuMusic, gameMusic, 1000, true);
  gameState.musicStarted = true;
}


// Called once during initialization to ensure proper setup
export function setupMultiplayer() {
  // Check if multiplayer is already initialized and avoid duplicate setup
  if (multiplayerInitialized) {
    return;
  }

  // Set up event listeners for main menu multiplayer buttons
  const joinGameBtn = document.getElementById("join-game");
  if (joinGameBtn) {
    // Use cloneNode to remove any existing listeners
    const newJoinBtn = joinGameBtn.cloneNode(true);
    joinGameBtn.parentNode.replaceChild(newJoinBtn, joinGameBtn);

    newJoinBtn.addEventListener("click", () => {
      // Play menu click sound
      const menuClickSound = document.getElementById("menu-click-sound");
      if (menuClickSound) menuClickSound.play();

      // Show the join game dialog
      const joinDialog = document.getElementById("join-game-dialog");
      if (joinDialog) {
        joinDialog.style.display = "flex";
      }
    });
  }

  const hostGameBtn = document.getElementById("host-game");
  if (hostGameBtn) {
    // Use cloneNode to remove any existing listeners
    const newHostBtn = hostGameBtn.cloneNode(true);
    hostGameBtn.parentNode.replaceChild(newHostBtn, hostGameBtn);

    newHostBtn.addEventListener("click", () => {
      // Play menu click sound
      const menuClickSound = document.getElementById("menu-click-sound");
      if (menuClickSound) menuClickSound.play();

      // Show the host game dialog
      const hostDialog = document.getElementById("host-game-dialog");
      if (hostDialog) {
        hostDialog.style.display = "flex";
      }
    });
  }

  // Set up event listeners for the dialog buttons
  setupDialogButtonListeners();

  // Mark multiplayer as initialized
  window.multiplayerInitialized = true;
}

// Set up event listeners for dialog buttons
function setupDialogButtonListeners() {
  // Set up join game dialog buttons
  const joinSubmitBtn = document.getElementById("join-game-submit");
  if (joinSubmitBtn) {
    // Use cloneNode to remove any existing listeners
    const newJoinSubmitBtn = joinSubmitBtn.cloneNode(true);
    joinSubmitBtn.parentNode.replaceChild(newJoinSubmitBtn, joinSubmitBtn);

    newJoinSubmitBtn.addEventListener("click", () => {
      const joinDialog = document.getElementById("join-game-dialog");
      if (joinDialog) {
        joinDialog.style.display = "none";
      }
      joinMultiplayerGame();
    });
  }

  const joinCancelBtn = document.getElementById("join-game-cancel");
  if (joinCancelBtn) {
    // Use cloneNode to remove any existing listeners
    const newJoinCancelBtn = joinCancelBtn.cloneNode(true);
    joinCancelBtn.parentNode.replaceChild(newJoinCancelBtn, joinCancelBtn);

    newJoinCancelBtn.addEventListener("click", () => {
      const joinDialog = document.getElementById("join-game-dialog");
      if (joinDialog) {
        joinDialog.style.display = "none";
      }
    });
  }

  // Set up host game dialog buttons
  const hostSubmitBtn = document.getElementById("host-game-submit");
  if (hostSubmitBtn) {
    // Use cloneNode to remove any existing listeners
    const newHostSubmitBtn = hostSubmitBtn.cloneNode(true);
    hostSubmitBtn.parentNode.replaceChild(newHostSubmitBtn, hostSubmitBtn);

    newHostSubmitBtn.addEventListener("click", () => {
      const hostDialog = document.getElementById("host-game-dialog");
      if (hostDialog) {
        hostDialog.style.display = "none";
      }
      hostMultiplayerGame();
    });
  }

  const hostCancelBtn = document.getElementById("host-game-cancel");
  if (hostCancelBtn) {
    // Use cloneNode to remove any existing listeners
    const newHostCancelBtn = hostCancelBtn.cloneNode(true);
    hostCancelBtn.parentNode.replaceChild(newHostCancelBtn, hostCancelBtn);

    newHostCancelBtn.addEventListener("click", () => {
      const hostDialog = document.getElementById("host-game-dialog");
      if (hostDialog) {
        hostDialog.style.display = "none";
      }
    });
  }
}

// Function to show a temporary message to the user
function showMessage(message, duration = 2000) {
  // Create a message element if it doesn't exist
  let messageElement = document.getElementById("game-message");
  if (!messageElement) {
    messageElement = document.createElement("div");
    messageElement.id = "game-message";
    messageElement.style.position = "fixed";
    messageElement.style.top = "20%";
    messageElement.style.left = "50%";
    messageElement.style.transform = "translate(-50%, -50%)";
    messageElement.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
    messageElement.style.color = "white";
    messageElement.style.padding = "15px";
    messageElement.style.borderRadius = "5px";
    messageElement.style.zIndex = "1001";
    messageElement.style.textAlign = "center";
    messageElement.style.opacity = "0";
    messageElement.style.transition = "opacity 0.3s";
    document.body.appendChild(messageElement);
  }

  // Set the message and show it
  messageElement.textContent = message;
  messageElement.style.opacity = "1";

  // Hide the message after the duration
  setTimeout(() => {
    messageElement.style.opacity = "0";
  }, duration);
}

// Create a loading screen function
export function showLoadingScreen(message) {
  // Remove any existing loading screen
  const existingLoadingScreen = document.getElementById("loading-screen");
  if (existingLoadingScreen) {
    document.body.removeChild(existingLoadingScreen);
  }

  // Remove any existing loading screen styles
  const existingStyles = document.getElementById("loading-screen-styles");
  if (existingStyles) {
    document.head.removeChild(existingStyles);
  }

  // Create loading screen element
  const loadingScreen = document.createElement("div");
  loadingScreen.id = "loading-screen";
  
  // Create content container
  const contentContainer = document.createElement("div");
  contentContainer.className = "loading-content";
  
  // Create game logo
  const logoContainer = document.createElement("div");
  logoContainer.className = "paused-game-logo";
  logoContainer.innerHTML = `<span>Pixel</span><span>Miner</span>`;
  
  // Create loading spinner with multiple rings for a more dynamic effect
  const spinner = document.createElement("div");
  spinner.className = "loading-spinner";
  
  // Inner rings
  for (let i = 1; i <= 3; i++) {
    const ring = document.createElement("div");
    ring.className = `spinner-ring ring-${i}`;
    spinner.appendChild(ring);
  }
  
  // Create message container with animated dots
  const messageContainer = document.createElement("div");
  messageContainer.className = "loading-message-container";
  
  // Create the message element
  const messageElement = document.createElement("div");
  messageElement.className = "loading-message";
  messageElement.textContent = message;
  
  // Create animated dots
  const dotsElement = document.createElement("div");
  dotsElement.className = "loading-dots";
  dotsElement.innerHTML = "<span>.</span><span>.</span><span>.</span>";
  
  // Assemble the message container
  messageContainer.appendChild(messageElement);
  messageContainer.appendChild(dotsElement);
  
  // Add progress bar
  const progressContainer = document.createElement("div");
  progressContainer.className = "progress-container";
  const progressBar = document.createElement("div");
  progressBar.className = "progress-bar";
  progressContainer.appendChild(progressBar);
  
  // Add elements to container
  contentContainer.appendChild(logoContainer);
  contentContainer.appendChild(spinner);
  contentContainer.appendChild(messageContainer);
  contentContainer.appendChild(progressContainer);
  
  // Add container to loading screen
  loadingScreen.appendChild(contentContainer);
  
  // Add to document
  document.body.appendChild(loadingScreen);
  
  // Add the styles
  const styleElement = document.createElement("style");
  styleElement.id = "loading-screen-styles";
  
  styleElement.textContent = `
    #loading-screen {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: linear-gradient(135deg, rgba(15, 20, 30, 0.97) 0%, rgba(23, 25, 35, 0.95) 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2000;
      backdrop-filter: blur(8px);
      opacity: 1;
      transition: opacity 0.5s ease;
    }
    
    .loading-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      max-width: 400px;
      padding: 40px;
      background-color: rgba(23, 25, 35, 0.5);
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(100, 120, 200, 0.2);
      animation: float 6s infinite ease-in-out;
    }
    
    .paused-game-logo {
      font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
      font-size: 42px;
      font-weight: 800;
      margin-bottom: 30px;
      text-transform: uppercase;
      text-align: center;
      letter-spacing: 1px;
    }
    
    .paused-game-logo span:first-child {
      color: var(--primary-color, #3498db);
      text-shadow: 0 0 15px rgba(52, 152, 219, 0.7);
    }
    
    .paused-game-logo span:last-child {
      color: var(--accent-color, #ff7700);
      text-shadow: 0 0 15px rgba(255, 119, 0, 0.7);
      margin-left: 10px;
    }
    
    .loading-spinner {
      width: 80px;
      height: 80px;
      position: relative;
      margin: 20px 0 30px;
    }
    
    .spinner-ring {
      position: absolute;
      border-radius: 50%;
      border: 3px solid transparent;
      box-sizing: border-box;
    }
    
    .ring-1 {
      width: 80px;
      height: 80px;
      border-top: 3px solid var(--primary-color, #3498db);
      border-left: 3px solid var(--primary-color, #3498db);
      animation: spin1 2s linear infinite;
    }
    
    .ring-2 {
      width: 60px;
      height: 60px;
      top: 10px;
      left: 10px;
      border-right: 3px solid var(--accent-color, #ff7700);
      border-bottom: 3px solid var(--accent-color, #ff7700);
      animation: spin2 1.5s linear infinite;
    }
    
    .ring-3 {
      width: 40px;
      height: 40px;
      top: 20px;
      left: 20px;
      border-top: 3px solid var(--light-text, #f3f4f6);
      animation: spin1 1.2s linear infinite;
      box-shadow: 0 0 10px rgba(255, 255, 255, 0.2);
    }
    
    .loading-message-container {
      display: flex;
      align-items: center;
      color: var(--light-text, #f3f4f6);
      font-size: 18px;
      font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;
      margin-bottom: 20px;
    }
    
    .loading-message {
      margin-right: 5px;
    }
    
    .loading-dots span {
      animation: dots 1.5s infinite;
      opacity: 0;
    }
    
    .loading-dots span:nth-child(1) {
      animation-delay: 0s;
    }
    
    .loading-dots span:nth-child(2) {
      animation-delay: 0.3s;
    }
    
    .loading-dots span:nth-child(3) {
      animation-delay: 0.6s;
    }
    
    .progress-container {
      width: 100%;
      height: 8px;
      background-color: rgba(30, 35, 50, 0.6);
      border-radius: 4px;
      overflow: hidden;
      box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.3);
    }
    
    .progress-bar {
      height: 100%;
      width: 20%;
      background: linear-gradient(90deg, var(--primary-color, #3498db), var(--accent-color, #ff7700));
      border-radius: 4px;
      animation: progress 2s infinite ease-in-out;
      box-shadow: 0 0 8px rgba(52, 152, 219, 0.5);
    }
    
    @keyframes spin1 {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    @keyframes spin2 {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(-360deg); }
    }
    
    @keyframes dots {
      0% { opacity: 0; }
      50% { opacity: 1; }
      100% { opacity: 0; }
    }
    
    @keyframes progress {
      0% { width: 15%; }
      50% { width: 85%; }
      100% { width: 15%; }
    }
    
    @keyframes float {
      0% { transform: translateY(0px); }
      50% { transform: translateY(-10px); }
      100% { transform: translateY(0px); }
    }
  `;
  
  document.head.appendChild(styleElement);
  
  // Animate the progress bar
  animateProgress(progressBar);
}

// Function to animate the progress bar in a more realistic way
function animateProgress(progressBar) {
  let width = 0;
  const interval = setInterval(() => {
    if (width >= 90) {
      // Stop at 90% to indicate waiting for response
      clearInterval(interval);
    } else {
      // Increase by a random amount to simulate variable loading
      width += Math.random() * 3;
      if (width > 90) width = 90;
      progressBar.style.width = width + '%';
    }
  }, 200);
  
  // Store the interval ID for cleanup
  progressBar.dataset.intervalId = interval;
}

// Function to hide loading screen
export function hideLoadingScreen() {
  const loadingScreen = document.getElementById("loading-screen");
  if (loadingScreen) {
    // Get progress bar and clear its animation interval
    const progressBar = loadingScreen.querySelector(".progress-bar");
    if (progressBar && progressBar.dataset.intervalId) {
      clearInterval(parseInt(progressBar.dataset.intervalId));
    }
    
    // Quickly finish the progress animation
    if (progressBar) {
      progressBar.style.transition = "width 0.5s ease-out";
      progressBar.style.width = "100%";
    }
    
    // Add fade-out effect after progress completes
    setTimeout(() => {
      loadingScreen.style.transition = "opacity 0.5s ease";
      loadingScreen.style.opacity = "0";
      
      // Remove from DOM after transition
      setTimeout(() => {
        if (loadingScreen.parentNode) {
          loadingScreen.parentNode.removeChild(loadingScreen);
        }
        
        // Clean up styles when done
        const styles = document.getElementById("loading-screen-styles");
        if (styles) {
          styles.parentNode.removeChild(styles);
        }
      }, 500);
    }, 300);
  }
}

// Modify the DOMContentLoaded listener to properly initialize multiplayer
document.addEventListener("DOMContentLoaded", function () {
  // Load audio settings first, before any music plays
  loadAudioSettings();

  // Show the main menu which sets up basic UI elements
  showMainMenu();

  // IMPORTANT: Setup multiplayer AFTER the main menu is shown
  // This ensures the multiplayer buttons exist before we attach listeners
  setupMultiplayer();
});
