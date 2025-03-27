// updates.js
import { gameState } from "./config.js";
import {
  lastUIValues,
  playerElement,
  showBlockHighlight,
  hideBlockHighlight,
} from "./setup.js";
import { getCurrentTool } from "./crafting.js";
import { getInventoryCount } from "./player.js";
import { clearCrackingAnimations } from "./animations.js";
import { sendBlockMined, updateOtherPlayersForCamera } from "./multiplayer.js";

// Get DOM elements
export const jetpackPanel = document.getElementById("jetpack-panel");
export const moneyDisplay = document.getElementById("money");
export const depthDisplay = document.getElementById("depth");
export const bagDisplay = document.getElementById("bag-capacity");
export const gameWorld = document.getElementById("game-world");

// Block element pool for reuse
const blockElementPool = [];
let blockCache = {}; // Cache to track which blocks are already rendered

// Get a block element from the pool or create a new one
function getBlockElement() {
  if (blockElementPool.length > 0) {
    return blockElementPool.pop();
  } else {
    return document.createElement("div");
  }
}

// Render player
export function renderPlayer() {
  playerElement.style.left = `${gameState.player.x - gameState.camera.x}px`;
  playerElement.style.top = `${gameState.player.y - gameState.camera.y}px`;

  // Only update transform if direction changed
  if (playerElement._lastDirection !== gameState.player.direction) {
    playerElement.style.transform = `scaleX(${gameState.player.direction})`;
    playerElement._lastDirection = gameState.player.direction;
  }
}

// Update visible blocks with efficient DOM operations
export function updateVisibleBlocks() {
  const minBlockX = Math.max(
    0,
    Math.floor(gameState.camera.x / gameState.blockSize) - 1
  );
  const maxBlockX = Math.min(
    gameState.worldWidth - 1,
    Math.ceil(
      (gameState.camera.x + gameWorld.offsetWidth) / gameState.blockSize
    ) + 1
  );
  const minBlockY = Math.max(
    0,
    Math.floor(gameState.camera.y / gameState.blockSize) - 1
  );
  const maxBlockY = Math.min(
    gameState.worldHeight - 1,
    Math.ceil(
      (gameState.camera.y + gameWorld.offsetHeight) / gameState.blockSize
    ) + 1
  );

  const newBlockCache = {};

  for (let y = minBlockY; y <= maxBlockY; y++) {
    for (let x = minBlockX; x <= maxBlockX; x++) {
      if (!gameState.blockMap[y]) {
        continue;
      }

      const block = gameState.blockMap[y][x];
      const key = `${x},${y}`;

      if (block) {
        // Determine the correct specific class for this block
        // Prioritize block.className (for grass variants), fallback to block.color
        const specificClass = block.className ? block.className : block.color;

        if (blockCache[key] && blockCache[key].element) {
          const blockElement = blockCache[key].element;

          // Check if the applied class needs to be updated
          // Compare against the 'appliedClass' stored in the cache
          if (blockCache[key].appliedClass !== specificClass) {
            blockElement.className = `block ${specificClass}`;
            // Update cache with the new applied class
            blockCache[key].appliedClass = specificClass;
            // Keep type and color updated too, though appliedClass is key here
            blockCache[key].type = block.name;
            blockCache[key].color = block.color;
          }

          // --- Position update logic (remains the same) ---
          const posX = x * gameState.blockSize - gameState.camera.x;
          const posY = y * gameState.blockSize - gameState.camera.y;
          if (blockElement._lastX === undefined) {
            blockElement._lastX = -1;
            blockElement._lastY = -1;
          }
          if (
            Math.abs(blockElement._lastX - posX) > 0 ||
            Math.abs(blockElement._lastY - posY) > 0
          ) {
            blockElement.style.left = `${posX}px`;
            blockElement.style.top = `${posY}px`;
            blockElement._lastX = posX;
            blockElement._lastY = posY;
          }
          // --- End Position update logic ---

          newBlockCache[key] = blockCache[key]; // Keep this block

        } else {
          // Create new block element
          const blockElement = getBlockElement();
          // Use the determined specificClass here too
          blockElement.className = `block ${specificClass}`;
          const posX = x * gameState.blockSize - gameState.camera.x;
          const posY = y * gameState.blockSize - gameState.camera.y;
          blockElement.style.left = `${posX}px`;
          blockElement.style.top = `${posY}px`;
          blockElement._lastX = posX;
          blockElement._lastY = posY;
          gameWorld.appendChild(blockElement);

          // Store in new cache, including the 'appliedClass'
          newBlockCache[key] = {
            x,
            y,
            element: blockElement,
            type: block.name,
            color: block.color,
            appliedClass: specificClass, // Store the class that was actually used
          };
        }
      }
    }
  }

  // --- Remove blocks logic (remains the same) ---
  for (const key in blockCache) {
    if (blockCache[key] && !newBlockCache[key]) {
      const blockElement = blockCache[key].element;
      if (blockElement && blockElement.parentNode) {
        blockElement.parentNode.removeChild(blockElement);
        blockElementPool.push(blockElement);
      }
    }
  }
  // --- End Remove blocks logic ---

  // --- Mining target checks (remain the same) ---
  if (gameState.miningTarget) { /* ... */ }
  if (gameState.laserMiningTarget) { /* ... */ }
  // --- End Mining target checks ---

  blockCache = newBlockCache; // Update the cache
}

// Handle successful block mining with multiplayer support
export function handleBlockMined(x, y) {
  if (isValidBlock(x, y)) {
    // Update local state
    gameState.blockMap[y][x] = null;
    
    // Send to server to update other players
    sendBlockMined(x, y);
    
    // Update visible blocks locally
    updateVisibleBlocks();
  }
}

// Call this when game world changes drastically (e.g., respawn)
export function forceFullRender() {
  // Clear all cached blocks
  for (const key in blockCache) {
    if (blockCache[key] && blockCache[key].element) {
      const blockElement = blockCache[key].element;
      if (blockElement.parentNode) {
        blockElement.parentNode.removeChild(blockElement);
      }
      blockElementPool.push(blockElement);
    }
  }
  blockCache = {};
  updateVisibleBlocks();
}

// Update camera position
export function updateCamera() {
  gameState.camera.x =
    gameState.player.x + gameState.player.width / 2 - gameWorld.offsetWidth / 2;
  gameState.camera.y =
    gameState.player.y +
    gameState.player.height / 2 -
    gameWorld.offsetHeight / 2;

  if (gameState.camera.x < 0) {
    gameState.camera.x = 0;
  }
  if (
    gameState.camera.x >
    gameState.worldWidth * gameState.blockSize - gameWorld.offsetWidth
  ) {
    gameState.camera.x =
      gameState.worldWidth * gameState.blockSize - gameWorld.offsetWidth;
  }
  if (gameState.camera.y < 0) {
    gameState.camera.y = 0;
  }
  if (
    gameState.camera.y >
    gameState.worldHeight * gameState.blockSize - gameWorld.offsetHeight
  ) {
    gameState.camera.y =
      gameState.worldHeight * gameState.blockSize - gameWorld.offsetHeight;
  }

  if (
    gameState.targetBlock &&
    gameState.mouseHeld &&
    gameState.crafting.currentToolType !== "laser" &&
    getInventoryCount() < gameState.bagSize
  ) {
    showBlockHighlight(gameState.targetBlock.x, gameState.targetBlock.y);
  } else {
    hideBlockHighlight();
  }
  
  // Update other players' positions relative to camera
  updateOtherPlayersForCamera();
}

// Update the background position in sync with the game camera
export function updateBackgroundPosition() {
  const background = document.getElementById("fixed-background");

  // Apply the same transformation as the game world to keep it synced
  // but with an inverted direction to create the "stationary" effect
  background.style.transform = `translate(${-gameState.camera.x}px, ${-gameState
    .camera.y}px)`;
}

// Update the cloud position in sync with the game camera
export function updateCloudPosition() {
  const clouds = document.getElementById("cloud-layer");
  if (clouds) {
    clouds.style.transform = `translate(${-gameState.camera.x}px, ${-gameState
      .camera.y}px)`;
  }
}

export function updateCraftingStationPosition() {
  const craftingStation = document.getElementById("crafting-station");
  if (!craftingStation) return;

  // Check for rocket transition in addition to planet check
  if (gameState.inRocketTransition || gameState.currentPlanet !== "earth") {
    craftingStation.style.display = "none";
    return;
  } else {
    craftingStation.style.display = "block";
  }

  // Check if craftingStation exists in gameState before destructuring
  if (!gameState.crafting || !gameState.crafting.craftingStation) {
    console.warn("Crafting station not initialized in game state");
    return;
  }

  const { x, y } = gameState.crafting.craftingStation;

  // Position relative to camera
  const screenX = x - gameState.camera.x;
  const screenY = y - gameState.camera.y;

  // Use style.left and style.top instead of transform
  craftingStation.style.left = `${screenX}px`;
  craftingStation.style.top = `${screenY}px`;
}

// Modified updateShopPosition function
export function updateShopPosition() {
  const shopSign = document.getElementById("shop-sign");
  if (!shopSign) return;

  // Check for rocket transition in addition to planet check
  // This ensures shop stays hidden during planet transitions
  if (gameState.inRocketTransition || gameState.currentPlanet !== "earth") {
    shopSign.style.display = "none";
    return;
  } else {
    shopSign.style.display = "block";
  }

  const { x, y } = gameState.shopSign;

  // Position relative to camera
  const screenX = x - gameState.camera.x;
  const screenY = y - gameState.camera.y;

  // Use style.left and style.top instead of transform
  shopSign.style.left = `${screenX}px`;
  shopSign.style.top = `${screenY}px`;
}

export function updateExplosionPosition() {
  if (gameState.activeExplosions && gameState.activeExplosions.length > 0) {
    gameState.activeExplosions.forEach((explosion) => {
      explosion.style.transform = `translate(${-gameState.camera
        .x}px, ${-gameState.camera.y}px)`;
    });
  }
}

// Add this helper function (place it near your other update functions)
export function updateJetpackGauge() {
  const fuelLevel = document.querySelector(".fuel-level");
  if (fuelLevel) {
    fuelLevel.style.width = `${
      (gameState.jetpackFuel / gameState.maxJetpackFuel) * 100
    }%`;
  }
}

export function updateMoneyDisplay() {
  const moneyElement = document.getElementById('money');
  const formattedMoney = formatMoney(gameState.money);
  moneyElement.textContent = formattedMoney;
  
  // Optional: Add animation class when money changes
  moneyElement.classList.add('money-change');
  setTimeout(() => {
    moneyElement.classList.remove('money-change');
  }, 400);
}

// Update the health display
export function updateHealthDisplay() {
  const healthFill = document.getElementById("health-fill");
  const healthValue = document.querySelector("#health-text .health-value");
  const currentHealth = gameState.player.health;

  // Update text and fill bar
  healthValue.textContent = currentHealth;
  healthFill.style.width = `${
    (gameState.player.health / gameState.player.maxHealth) * 100
  }%`;

  
  // Add appropriate classes based on health level
  healthFill.classList.remove('low', 'critical');

  // Change color based on health level
  if (currentHealth <= 25) {
    healthFill.classList.add("critical");
  } else if (currentHealth <= 50) {
    healthFill.classList.add("low");
  }
}

function updateBagCapacity(currentItems, maxCapacity) {
  const bagDisplay = document.getElementById('bag-capacity');
  const currentElement = document.getElementById('bag-current');
  const maxElement = document.getElementById('bag-max');
  
  // Update text
  currentElement.textContent = currentItems;
  maxElement.textContent = maxCapacity;
  
  // Calculate percentage
  const percentage = (currentItems / maxCapacity) * 100;
  
  // Update classes based on fullness
  bagDisplay.classList.remove('bag-warning', 'bag-full');
  
  if (percentage >= 90) {
    bagDisplay.classList.add('bag-full');
  } else if (percentage >= 70) {
    bagDisplay.classList.add('bag-warning');
  }
}

export function updateUIIfNeeded() {
  if (lastUIValues.money !== gameState.money) {
    updateMoneyDisplay();
    lastUIValues.money = gameState.money;
  }

  if (lastUIValues.depth !== gameState.depth) {
    depthDisplay.textContent = gameState.depth;
    lastUIValues.depth = gameState.depth;
  }
  
  // Update player count if needed (for multiplayer)
  const playerCountElement = document.getElementById("player-count-value");
  if (playerCountElement && lastUIValues.playerCount !== gameState.playerCount) {
    playerCountElement.textContent = gameState.playerCount;
    lastUIValues.playerCount = gameState.playerCount;
  }
}

// Update UI with current tool information
export function updateUI() {
  // Update basic game state displays
  depthDisplay.textContent = gameState.depth;
  const currentCount = Object.values(gameState.inventory).reduce(
    (sum, count) => sum + count,
    0
  );

  updateMoneyDisplay();
  updateHealthDisplay();
  updateBagCapacity(currentCount, gameState.bagSize);

  // Update jetpack
  if (gameState.hasJetpack) {
    jetpackPanel.style.display = "block";
    updateJetpackGauge();
  } else {
    jetpackPanel.style.display = "none";
  }

  // Update bomb display if it exists
  const bombDisplay = document.getElementById("bomb-display");
  if (bombDisplay) {
    bombDisplay.innerHTML = `<span class="bomb-icon">💣</span> ${gameState.bombs}/${gameState.maxBombs}`;
  }

  // Get current tool information
  const currentTool = getCurrentTool();
  const isLaserEquipped = currentTool && currentTool.type === "laser";

  // Update laser UI
  const statusBarElement = document.getElementById("status-bar");
  if (statusBarElement) {
    let laserIndicator = document.getElementById("laser-indicator");

    // Only show laser indicator if laser tool is equipped
    if (isLaserEquipped) {
      if (!laserIndicator) {
        laserIndicator = document.createElement("div");
        laserIndicator.id = "laser-indicator";
        laserIndicator.className = "laser-indicator";

        // Create laser icon
        const laserIcon = document.createElement("div");
        laserIcon.className = "laser-icon";

        // Assemble the laser indicator
        laserIndicator.appendChild(laserIcon);

        // Add to status bar
        statusBarElement.appendChild(laserIndicator);
      } else {
        // Make sure it's visible
        laserIndicator.style.display = "flex";
      }
    } else if (laserIndicator) {
      // Hide laser indicator if laser is not equipped
      laserIndicator.style.display = "none";
    }
  }
}

// Check if a block is valid
// Check if a block is valid
export function isValidBlock(x, y) {
  return (
    x >= 0 &&
    y >= 0 &&
    x < gameState.worldWidth &&
    y < gameState.worldHeight &&
    gameState.blockMap[y] !== undefined && // Ensure the row exists
    gameState.blockMap[y][x] !== undefined && // Ensure the block exists
    gameState.blockMap[y][x] !== null // Ensure the block is not null
  );
}

/**
 * Apply block changes received from the server
 * @param {number} x - Block x coordinate
 * @param {number} y - Block y coordinate
 * @param {object|null} blockData - The block data or null if block was removed
 */
export function applyServerBlockUpdate(x, y, blockData) {
  // Make sure the row exists
  if (!gameState.blockMap[y]) {
    gameState.blockMap[y] = {};
  }
  
  // Update the block
  gameState.blockMap[y][x] = blockData;
  
  // Update visible blocks if this is in view
  if (
    x >= Math.floor(gameState.camera.x / gameState.blockSize) - 1 &&
    x <= Math.ceil((gameState.camera.x + gameWorld.offsetWidth) / gameState.blockSize) + 1 &&
    y >= Math.floor(gameState.camera.y / gameState.blockSize) - 1 &&
    y <= Math.ceil((gameState.camera.y + gameWorld.offsetHeight) / gameState.blockSize) + 1
  ) {
    updateVisibleBlocks();
  }
}

/**
 * Format money values to be more compact for display
 * @param {number} amount - The money amount to format
 * @return {string} Formatted money string
 */
function formatMoney(amount) {
  // For values less than 10,000, show the full number
  if (amount < 10000) {
    return amount.toString();
  }
  // For values 10k to 999k, show as X.Xk
  else if (amount < 1000000) {
    return (amount / 1000).toFixed(1) + 'k';
  }
  // For values 1M to 999M, show as X.XM
  else if (amount < 1000000000) {
    return (amount / 1000000).toFixed(1) + 'M';
  }
  // For values 1B+, show as X.XB
  else {
    return (amount / 1000000000).toFixed(1) + 'B';
  }
}