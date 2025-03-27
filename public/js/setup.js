// setup.js
import { gameState } from "./config.js";
import { placeBomb } from "./bombs.js";
import { initializeShop } from "./shop.js";
import {
  activateLaser,
  deactivateLaser,
  isLaserActive,
  findTargetBlock,
  getInventoryCount,
  checkBagCapacity,
  stopAllMiningAnimations,
  updateToolRotation,
} from "./player.js";
import { toggleInventory, setupInventorySystem } from "./inventory.js";
import {
  initializeCrafting,
  setupCraftingEventListeners,
  checkCraftingInteraction,
  getCurrentTool,
  hasMoonBootsEquipped,
  isPlayerNearCraftingTable,
} from "./crafting.js";
import { playerInRocket } from "./rocket.js";
import {
  applyAudioSettings,
  applyMusicVolume,
  applySFXVolume,
  applyMuteSetting,
} from "./menu.js";

// Get DOM elements
export const shop = document.getElementById("shop");
export const shopSign = document.getElementById("shop-sign");
export const sellModal = document.getElementById("sell-modal");
export const sellModalClose = document.getElementById("sell-modal-close");
export const gameWorld = document.getElementById("game-world");

// Prevent right-click context menu
export function preventRightClick() {
  document.addEventListener("contextmenu", function (event) {
    event.preventDefault();
  });
}
preventRightClick();

// Pre-load audio files
export const gameMusic = new Audio("sounds/gameMusic1.mp3");
export const menuMusic = new Audio("sounds/gamemusicmenu.mp3");
export const storyMusic = new Audio("sounds/gamemusicstory.mp3");
export const walkingSound = new Audio("sounds/walking.mp3");
export const jumpingSound = new Audio("sounds/jump.mp3");
export const jetpackSound = new Audio("sounds/jetpack.mp3");
jetpackSound.addEventListener("timeupdate", function () {
  /* Fix for gapless loop */
  var buffer = 0.44;
  if (this.currentTime > this.duration - buffer) {
    playSFX(this, ORIGINAL_VOLUMES.this, false);
  }
});
export const miningSound = new Audio("sounds/mining.mp3");
export const drillSound = new Audio("sounds/drill.mp3");
drillSound.addEventListener("timeupdate", function () {
  /* Fix for gapless loop */
  var buffer = 0.44;
  if (this.currentTime > this.duration - buffer) {
    playSFX(this, ORIGINAL_VOLUMES.this, false);
  }
});
export const laserSound = new Audio("sounds/laser.mp3");
laserSound.addEventListener("timeupdate", function () {
  /* Fix for gapless loop */
  var buffer = 0.44;
  if (this.currentTime > this.duration - buffer) {
    playSFX(this, ORIGINAL_VOLUMES.this, false);
  }
});

export const blockBreak = new Audio("sounds/block-break.mp3");
export const breakSound = new Audio(); // Define this as it's used elsewhere
export const craftingSound = new Audio(`sounds/crafting.mp3`);
export const equipSound = new Audio(`sounds/equip.mp3`);
export const rocketLaunch = new Audio(`sounds/rocket-launch.mp3`);
export const purchaseSound = new Audio("sounds/purchase.mp3");
export const coinSound = new Audio("sounds/sellOres.mp3");
export const buildingRocketSound = new Audio("sounds/building-rocket.mp3");
export const throwBombSound = new Audio("sounds/bomb-throw.mp3");
export const explosionSound = new Audio("sounds/bomb-explode.mp3");
export const menuHoverSound = new Audio("sounds/menuHover.mp3");
export const menuClickSound = new Audio("sounds/menuSelect.mp3");
export const openMenuSound = new Audio("sounds/openMenu.mp3");

/**
 * Define the original max volumes for each audio element
 */
export const ORIGINAL_VOLUMES = {
  gameMusic: 0.1,
  menuMusic: 0.1,
  storyMusic: 0.1,
  walkingSound: 0.3,
  jumpingSound: 0.1,
  jetpackSound: 0.1,
  miningSound: 0.3,
  drillSound: 0.05,
  laserSound: 0.2,
  blockBreak: 0.1,
  craftingSound: 0.2,
  equipSound: 0.2,
  rocketLaunch: 0.3,
  purchaseSound: 0.3,
  coinSound: 0.3,
  buildingRocketSound: 0.2,
  explosionSound: 0.1,
  throwBombSound: 0.1,
  menuHoverSound: 0.6,
  menuClickSound: 0.2,
  openMenuSound: 0.2,
};

// Create player element
export const playerElement = document.createElement("div");
playerElement.id = "player";

// Block Highlight
export const blockHighlight = document.createElement("div");
blockHighlight.className = "block-highlight";
blockHighlight.style.width = `60px`;
blockHighlight.style.height = `60px`;
blockHighlight.style.display = "none";
gameWorld.appendChild(blockHighlight);

export function showBlockHighlight(blockX, blockY) {
  if (!blockHighlight) return;

  // Don't show highlight if bag is full
  if (getInventoryCount() >= gameState.bagSize) {
    hideBlockHighlight();
    return;
  }

  // Position highlight at the block's location, accounting for camera position
  blockHighlight.style.left = `${
    blockX * gameState.blockSize - gameState.camera.x
  }px`;
  blockHighlight.style.top = `${
    blockY * gameState.blockSize - gameState.camera.y
  }px`;
  blockHighlight.style.display = "block";
}

// Function to hide the highlight
export function hideBlockHighlight() {
  if (!blockHighlight) return;
  blockHighlight.style.display = "none";
}

export function showMessage(message, duration = 2000) {
  // Check for an existing message element and remove it if found
  const existingMessage = document.querySelector(".game-message");
  if (existingMessage) {
    existingMessage.remove();
  }

  const messageDiv = document.createElement("div");
  messageDiv.className = "game-message";
  messageDiv.textContent = message;
  document.body.appendChild(messageDiv);

  setTimeout(() => {
    messageDiv.remove();
  }, duration);
}

// UI Optimization - only update when values change
export let lastUIValues = {
  money: -1,
  depth: -1,
  inventoryCount: -1,
  bagSize: -1,
};

// Set up event listeners
export function setupEventListeners() {
  document.addEventListener("keydown", (e) => {
    switch (e.key) {
      case "ArrowLeft":
      case "a":
      case "A":
        gameState.keys.left = true;
        break;
      case "ArrowRight":
      case "d":
      case "D":
        gameState.keys.right = true;
        break;
      case "ArrowUp":
      case "w":
      case "W":
        gameState.keys.up = true;
        break;
      case "ArrowDown":
      case "s":
      case "S":
        gameState.keys.down = true;
        break;
      case " ":
        // Don't interact if menu is open
        if (gameState.menuOpen || gameState.physicsPaused) {
          break;
        }

        if (!gameState.keys.jump && !playerInRocket) {
          if (gameState.player.onGround) {
            // Ground jump
            let jumpPower = gameState.player.jumpPower;
            if (hasMoonBootsEquipped()) {
              // Double the jump power when moon boots are equipped
              jumpPower *= Math.sqrt(2);
            }

            gameState.player.velocityY = -jumpPower;
            gameState.player.isJumping = true;
            gameState.player.onGround = false;
            gameState.player.jumpCount = 1; // mark that the first jump has occurred

            // Play jump sound
            playSFX(jumpingSound, ORIGINAL_VOLUMES.jumpingSound, false);
          } else {
            gameState.player.jumpCount = 2; // second jump press allows jetpack
          }
        }
        gameState.keys.jump = true;
        break;
      case "q":
      case "Q":
        // Don't interact if menu is open
        if (gameState.menuOpen) {
          break;
        }

        // Place bomb if player has bombs
        if (gameState.bombs > 0 && !gameState.shopOpen) {
          placeBomb();
        } else if (gameState.bombs <= 0) {
          showMessage("No bombs in inventory! Buy more at the shop.", 2000);
        }
        break;
      case "e":
      case "E":
        // Don't interact if menu is open
        if (gameState.menuOpen) {
          break;
        }

        // Check sell modal is closed
        if (sellModal.style.display === "flex") {
          sellModal.style.display = "none";
        }

        gameState.keys.interact = true;

        // Play the open menu sound whenever E is pressed
        playSFX(openMenuSound, ORIGINAL_VOLUMES.openMenuSound, false);

        // Check if player is near shop, if so, toggle shop
        if (isPlayerNearShop()) {
          toggleShop(); // Open or close shop
        }
        // Check if player is near crafting table
        else if (isPlayerNearCraftingTable()) {
          // Do nothing here
          // The crafting interaction is already handled in checkCraftingInteraction()
          // which is called elsewhere
        }
        // Check if player is in rocket or near rocket
        else if (playerInRocket || isPlayerNearRocket()) {
          // Do nothing here
          // The rocket module has its own event listeners for the E key
          break; // Add this break to prevent inventory from opening
        }
        // Only toggle inventory if not near any interactive object
        else {
          toggleInventory();
        }
        break;
      case "Escape":
        // Check if the shop is open before toggling the menu
        if (gameState.shopOpen) {
          gameState.shopOpen = false;
          shop.style.display = "none";
          if (sellModal.style.display === "flex") {
            sellModal.style.display = "none";
          }
        } else if (gameState.craftingOpen) {
          // Close the crafting menu if it's open
          closeCraftingMenu();
        } else if (
          document.getElementById("rocket-modal") &&
          document.getElementById("rocket-modal").style.display === "flex"
        ) {
          // Let the rocket's own modal handler handle it
          // The rocket modal already has its own ESC key handler
        } else {
          toggleMenu();
        }
        break;
    }
  });

  document.addEventListener("keyup", (e) => {
    switch (e.key) {
      case "ArrowLeft":
      case "a":
      case "A":
        gameState.keys.left = false;
        break;
      case "ArrowRight":
      case "d":
      case "D":
        gameState.keys.right = false;
        break;
      case "ArrowUp":
      case "w":
      case "W":
        gameState.keys.up = false;
        break;
      case "ArrowDown":
      case "s":
      case "S":
        gameState.keys.down = false;
        break;
      case " ":
        gameState.keys.jump = false;
        break;
      case "e":
      case "E":
        gameState.keys.interact = false;
        break;
    }
  });

  // Update shop sign click event
  shopSign.addEventListener("click", toggleShop);

  sellModalClose.addEventListener("click", () => {
    sellModal.style.display = "none";
  });

  // Mouse move handler
  gameWorld.addEventListener("mousemove", (e) => {
    if (
      gameState.isPlayerDead ||
      gameState.shopOpen ||
      gameState.menuOpen ||
      gameState.physicsPaused
    )
      return;

    // Update stored mouse coordinates regardless of mining status
    const rect = gameWorld.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Update stored mouse coordinates
    gameState.mouseX = mouseX;
    gameState.mouseY = mouseY;

    // Get current tool
    const currentTool = getCurrentTool();
    const isRotatableTool =
      currentTool &&
      (currentTool.type === "drill" || currentTool.type === "laser");

    // Always update tool rotation for drill and laser, regardless of mining status
    if (isRotatableTool) {
      updateToolRotation();
    }

    // Skip mining-related updates if bag is full
    if (checkBagCapacity()) {
      // Don't return early - we still want to rotate the tool
      // We just don't want to start mining
      if (!isRotatableTool) {
        return; // Only return if not a rotatable tool
      }
    }

    // Calculate world coordinates (mouse position + camera offset)
    const worldX = mouseX + gameState.camera.x;
    const worldY = mouseY + gameState.camera.y;

    // Get player center position
    const playerCenterX = gameState.player.x + gameState.player.width / 2;
    const playerCenterY = gameState.player.y + gameState.player.height / 2;

    // Calculate angle from player to mouse cursor
    const angle = Math.atan2(worldY - playerCenterY, worldX - playerCenterX);

    // Maximum mining range
    const maxMiningRange = 3 * gameState.blockSize;

    if (isLaserActive()) {
      return;
    }

    // Check if we're currently locked in mining
    // This is the key fix - skip target updates if mining is locked
    if (gameState.miningLocked) {
      return;
    }

    // Use ray tracing to find target block
    const targetBlock = findTargetBlock(
      playerCenterX,
      playerCenterY,
      angle,
      maxMiningRange
    );

    // Update the game state with the target block
    gameState.targetBlock = targetBlock
      ? {
          x: targetBlock.x,
          y: targetBlock.y,
        }
      : null;

    // Show highlight for valid target blocks
    if (targetBlock) {
      if (gameState.mouseHeld) {
        // Make sure the block still exists in the blockMap
        if (
          gameState.blockMap[targetBlock.y] &&
          gameState.blockMap[targetBlock.y][targetBlock.x]
        ) {
          // Update mining target if mouse is held down and not locked
          gameState.pickaxeMiningActive = true;
          gameState.miningTarget = {
            x: targetBlock.x,
            y: targetBlock.y,
            block: targetBlock.block,
            progress: 0,
          };

          // Add explicit call to show highlight for the target block
          showBlockHighlight(targetBlock.x, targetBlock.y);
        } else {
          // Block doesn't exist, clear mining state
          gameState.pickaxeMiningActive = false;
          gameState.miningTarget = null;
          hideBlockHighlight();
        }
      }
    } else {
      hideBlockHighlight();
    }
  });

  // Lastly, we need to modify the mousedown event to also check if the block exists
  gameWorld.addEventListener("mousedown", (e) => {
    if (
      gameState.isPlayerDead ||
      gameState.shopOpen ||
      gameState.menuOpen ||
      gameState.craftingOpen ||
      gameState.physicsPaused
    )
      return;
    if (e.button !== 0) return; // Only activate on left click

    // Check if bag is full - use our new function
    if (checkBagCapacity()) {
      // Make sure to force stop any mining animations
      stopAllMiningAnimations();
      return; // Don't proceed with mining if bag is full
    }

    gameState.mouseHeld = true;

    const currentTool = getCurrentTool();
    const rect = gameWorld.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (currentTool && currentTool.type === "laser") {
      // Laser mining
      gameState.laserMineTimer = 0;
      gameState.laserMiningTarget = null;
      activateLaser();
    } else if (gameState.targetBlock) {
      // For pickaxe mining, use the ray-traced target block
      const blockX = gameState.targetBlock.x;
      const blockY = gameState.targetBlock.y;

      // Make sure the block still exists in the blockMap
      if (gameState.blockMap[blockY] && gameState.blockMap[blockY][blockX]) {
        // Set mining target
        gameState.pickaxeMiningActive = true;
        gameState.miningTarget = {
          x: blockX,
          y: blockY,
          block: gameState.blockMap[blockY][blockX],
          progress: 0,
        };
      } else {
        // Block doesn't exist, don't set the mining target
        gameState.pickaxeMiningActive = false;
        gameState.miningTarget = null;
      }
    }
  });

  // Update mouseup handler to clear mouseHeld state
  gameWorld.addEventListener("mouseup", (e) => {
    if (e.button !== 0) return; // Only on left click

    gameState.mouseHeld = false;

    const currentTool = getCurrentTool();
    if (currentTool && currentTool.type === "laser") {
      deactivateLaser();
    } else {
      gameState.pickaxeMiningActive = false;
    }
  });

  // Update mouseleave handler
  gameWorld.addEventListener("mouseleave", () => {
    gameState.mouseHeld = false;
    hideBlockHighlight();

    const currentTool = getCurrentTool();
    if (currentTool && currentTool.type === "laser") {
      deactivateLaser();
    } else {
      gameState.pickaxeMiningActive = false;
    }
  });

  // Setup crafting UI event listeners
  setupCraftingEventListeners();
  setupMenuEventListeners();
  setupInventorySystem();
}

// Modify the setupMenuEventListeners function to include sounds
export function setupMenuEventListeners() {
  // Add event listeners to menu buttons
  const respawnButton = document.getElementById("respawn-button");
  respawnButton.addEventListener("mouseenter", () => {
    playSFX(menuHoverSound, ORIGINAL_VOLUMES.menuHoverSound, false);
  });
  respawnButton.addEventListener("click", () => {
    playSFX(menuClickSound, ORIGINAL_VOLUMES.menuClickSound, false);
    showConfirmDialog("Are you sure? You will lose all your ores!", () => {
      gameState.respawn();
      closeMenu();
    });
  });

  const saveButton = document.getElementById("save-button");
  saveButton.addEventListener("mouseenter", () => {
    playSFX(menuHoverSound, ORIGINAL_VOLUMES.menuHoverSound, false);
  });
  saveButton.addEventListener("click", () => {
    playSFX(menuClickSound, ORIGINAL_VOLUMES.menuClickSound, false);
    if (gameState.saveGame()) {
      saveButton.textContent = "Game Saved!";
      setTimeout(() => {
        saveButton.textContent = "Save Game";
      }, 1500);
    }
  });

  const deleteSaveButton = document.getElementById("delete-save-button");
  deleteSaveButton.addEventListener("mouseenter", () => {
    playSFX(menuHoverSound, ORIGINAL_VOLUMES.menuHoverSound, false);
  });
  deleteSaveButton.addEventListener("click", () => {
    playSFX(menuClickSound, ORIGINAL_VOLUMES.menuClickSound, false);
    showConfirmDialog("Are you sure you want to delete your save?", () => {
      localStorage.removeItem("pixelMinerSave");
      location.reload();
    });
  });

  const resumeButton = document.getElementById("resume-button");
if (resumeButton) {
  resumeButton.addEventListener("mouseenter", () => {
    playSFX(menuHoverSound, ORIGINAL_VOLUMES.menuHoverSound, false);
  });
  resumeButton.addEventListener("click", () => {
    playSFX(menuClickSound, ORIGINAL_VOLUMES.menuClickSound, false);
    closeMenu();
  });
}

  // Add handler for in-game options resume button
  const inGameResumeButton = document.getElementById("in-game-resume-button");
  if (inGameResumeButton) {
    inGameResumeButton.addEventListener("mouseenter", () => {
      playSFX(menuHoverSound, ORIGINAL_VOLUMES.menuHoverSound, false);
    });
    inGameResumeButton.addEventListener("click", () => {
      playSFX(menuClickSound, ORIGINAL_VOLUMES.menuClickSound, false);
      // Make sure to hide in-game options first, then close the menu
      hideInGameOptions();
      closeMenu();
    });
  }

  // Set up in-game options listeners
  setupInGameOptionsListeners();
}

// Function to toggle music on/off
export function toggleMusic() {
  if (gameMusic.paused) {
    playSFX(gameMusic, ORIGINAL_VOLUMES.gameMusic, false);
  } else {
    stopSFX(gameMusic);
  }
}

export function toggleShop() {
  if (isPlayerNearShop()) {
    gameState.shopOpen = !gameState.shopOpen;
    shop.style.display = gameState.shopOpen ? "flex" : "none";

    // Initialize the shop when opening it to ensure contents are updated
    if (gameState.shopOpen) {
      initializeShop();
      console.log("here");
    }
  }
}

// Add new functions for menu handling
export function toggleMenu() {
  if (gameState.menuOpen) {
    closeMenu();
  } else {
    openMenu();
  }
}

export function openMenu() {
  gameState.menuOpen = true;
  document.getElementById("game-menu").style.display = "flex";
}

export function closeMenu() {
  gameState.menuOpen = false;
  const menu = document.getElementById("game-menu");
  if (menu) {
    menu.style.display = "none";
  }
}

// Returns true if the player's bounding box overlaps the shop sign area
// Returns true if the player's bounding box overlaps the shop sign area
export function isPlayerNearShop() {
  const shopX = gameState.shopSign.x;
  const shopY = gameState.shopSign.y;
  const shopW = gameState.shopSign.width;
  const shopH = gameState.shopSign.height;

  // Calculate player's position in absolute game world coordinates
  const playerX = gameState.player.x;
  const playerY = gameState.player.y;
  const playerW = gameState.player.width;
  const playerH = gameState.player.height;

  // Calculate centers for both player and shop
  const playerCenterX = playerX + playerW / 2;
  const playerCenterY = playerY + playerH / 2;
  
  // Add a horizontal offset to move the interaction zone more to the right
  // This shifts the effective center of the shop sign to better match visual expectations
  const offsetX = 80; // Positive value shifts right, negative shifts left
  const shopCenterX = shopX + shopW / 2 + offsetX;
  const shopCenterY = shopY + shopH / 2;

  // Use an elliptical interaction zone with larger horizontal radius
  // This allows for a wider interaction area horizontally
  const horizontalRadius = shopW * 1.2; // Wider horizontal interaction
  const verticalRadius = shopH * 0.8;
  
  // Calculate normalized elliptical distance 
  const normalizedX = (playerCenterX - shopCenterX) / horizontalRadius;
  const normalizedY = (playerCenterY - shopCenterY) / verticalRadius;
  const ellipticalDistance = Math.sqrt(normalizedX * normalizedX + normalizedY * normalizedY);
  
  // Player is near shop if inside the elliptical boundary (distance < 1)
  return ellipticalDistance < 1;
}

// Check shop sign appearance and auto-close shop if player moves away
export function checkShopInteraction() {
  if (isPlayerNearShop()) {
    shopSign.style.cursor = "pointer";
    shopSign.style.color = "#FFFF00";
    shopSign.style.borderColor = "#FFFF00";
  } else {
    shopSign.style.cursor = "default";
    shopSign.style.color = "#FFD700";
    shopSign.style.borderColor = "#A52A2A";
    if (gameState.shopOpen) {
      gameState.shopOpen = false;
      shop.style.display = "none";
    }
    // Also close the sell modal if it's open
    if (sellModal.style.display === "flex") {
      sellModal.style.display = "none";
    }
  }

  checkCraftingInteraction();
}

export function createJetpackFlame() {
  const jetpackFlame = document.createElement("div");
  jetpackFlame.className = "jetpack-flame";
  playerElement.appendChild(jetpackFlame);
}

// Create a stylized confirm dialog function to replace the standard alert/confirm
export function showConfirmDialog(message, onConfirm, onCancel) {
  // Check if there's already a dialog open and remove it
  const existingDialog = document.querySelector(".game-confirm-dialog");
  if (existingDialog) {
    existingDialog.remove();
  }

  // Create the dialog container
  const dialogOverlay = document.createElement("div");
  dialogOverlay.className = "game-confirm-overlay";

  const dialogContainer = document.createElement("div");
  dialogContainer.className = "game-confirm-dialog";

  // Create the dialog content
  const dialogContent = document.createElement("div");
  dialogContent.className = "dialog-content";

  // Message text
  const messageText = document.createElement("p");
  messageText.textContent = message;

  // Button container
  const buttonContainer = document.createElement("div");
  buttonContainer.className = "dialog-buttons";

  // Confirm button
  const confirmButton = document.createElement("button");
  confirmButton.className = "menu-button primary";
  confirmButton.textContent = "Confirm";
  confirmButton.addEventListener("mouseenter", () => {
    playSFX(menuHoverSound, ORIGINAL_VOLUMES.menuHoverSound, false);
  });
  confirmButton.addEventListener("click", () => {
    playSFX(menuClickSound, ORIGINAL_VOLUMES.menuClickSound, false);
    dialogOverlay.remove();
    if (onConfirm) onConfirm();
  });

  // Cancel button
  const cancelButton = document.createElement("button");
  cancelButton.className = "menu-button";
  cancelButton.textContent = "Cancel";
  cancelButton.addEventListener("mouseenter", () => {
    playSFX(menuHoverSound, ORIGINAL_VOLUMES.menuHoverSound, false);
  });
  cancelButton.addEventListener("click", () => {
    playSFX(menuClickSound, ORIGINAL_VOLUMES.menuClickSound, false);
    dialogOverlay.remove();
    if (onCancel) onCancel();
  });

  // Assemble the dialog
  buttonContainer.appendChild(confirmButton);
  buttonContainer.appendChild(cancelButton);

  dialogContent.appendChild(messageText);
  dialogContent.appendChild(buttonContainer);

  dialogContainer.appendChild(dialogContent);
  dialogOverlay.appendChild(dialogContainer);

  // Add dialog to the document
  document.body.appendChild(dialogOverlay);

  // Focus the cancel button by default (safer option)
  cancelButton.focus();
}

export function isPlayerNearRocket() {
  // If rocket doesn't exist or isn't placed, player can't be near it
  if (!gameState.hasRocket || !gameState.rocketPlaced) return false;

  const playerX = gameState.player.x;
  const playerY = gameState.player.y;
  const playerWidth = gameState.player.width;
  const playerHeight = gameState.player.height;

  // Calculate rocket center
  const rocketCenterX = gameState.rocket.x + gameState.rocket.width / 2;
  const rocketCenterY = gameState.rocket.y + gameState.rocket.height / 2;

  // Calculate player center
  const playerCenterX = playerX + playerWidth / 2;
  const playerCenterY = playerY + playerHeight / 2;

  // Use the same interaction radius as in rocket.js
  const interactionRadius = 150;

  // Calculate distance between player and rocket
  const distance = Math.sqrt(
    Math.pow(playerCenterX - rocketCenterX, 2) +
      Math.pow(playerCenterY - rocketCenterY, 2)
  );

  // Return true if player is within interaction radius
  return distance < interactionRadius;
}

/**
 * Play a sound effect with the correct volume based on user settings
 * @param {HTMLAudioElement} sound - The audio element to play
 * @param {number} originalVolume - The original max volume for this sound
 * @param {boolean} [loop=false] - Whether the sound should loop
 */
export function playSFX(sound, originalVolume, loop = false) {
  if (!sound) return;

  // Reset sound
  sound.currentTime = 0;
  sound.loop = loop;

  // Apply current SFX volume setting from gameState
  const volumeMultiplier =
    gameState.sfxVolume !== undefined ? gameState.sfxVolume : 1.0;
  sound.volume = originalVolume * volumeMultiplier;

  // Play the sound
  sound.play().catch((error) => console.warn(`Failed to play sound: ${error}`));
}

/**
 * Stop a sound effect that's currently playing
 * @param {HTMLAudioElement} sound - The audio element to stop
 */
export function stopSFX(sound) {
  if (!sound) return;

  sound.pause();
  sound.currentTime = 0;
}

/**
 * Update the volume of a currently playing sound effect
 * @param {HTMLAudioElement} sound - The audio element to update
 * @param {number} originalVolume - The original max volume for this sound
 */
export function updateSFXVolume(sound, originalVolume) {
  if (!sound) return;

  const volumeMultiplier =
    gameState.sfxVolume !== undefined ? gameState.sfxVolume : 1.0;
  sound.volume = originalVolume * volumeMultiplier;
}

/**
 * Setup event listeners for the in-game options menu
 */
function setupInGameOptionsListeners() {
  // Add event listener for the in-game options button
  const inGameOptionsButton = document.getElementById("in-game-options-button");
  inGameOptionsButton.addEventListener("mouseenter", () => {
    playSFX(menuHoverSound, ORIGINAL_VOLUMES.menuHoverSound, false);
  });
  inGameOptionsButton.addEventListener("click", () => {
    playSFX(menuClickSound, ORIGINAL_VOLUMES.menuClickSound, false);
    showInGameOptions();
  });

  // Add event listener for the back button in the in-game options
  const backButton = document.getElementById("back-to-pause-menu");
  backButton.addEventListener("mouseenter", () => {
    playSFX(menuHoverSound, ORIGINAL_VOLUMES.menuHoverSound, false);
  });
  backButton.addEventListener("click", () => {
    playSFX(menuClickSound, ORIGINAL_VOLUMES.menuClickSound, false);
    hideInGameOptions();
  });

  // Setup audio control event listeners for in-game options
  setupInGameAudioControls();
}

/**
 * Setup event listeners for in-game audio control elements
 */
function setupInGameAudioControls() {
  const musicVolumeSlider = document.getElementById("in-game-music-volume");
  const musicVolumeValue = document.getElementById(
    "in-game-music-volume-value"
  );
  const sfxVolumeSlider = document.getElementById("in-game-sfx-volume");
  const sfxVolumeValue = document.getElementById("in-game-sfx-volume-value");
  const muteCheckbox = document.getElementById("in-game-mute-all");

  // Update music volume when slider changes
  musicVolumeSlider.addEventListener("input", () => {
    const volume = musicVolumeSlider.value / 100;
    musicVolumeValue.textContent = Math.round(volume * 100) + "%";

    if (!muteCheckbox.checked) {
      applyMusicVolume(volume);
    }
  });

  // Update SFX volume when slider changes
  sfxVolumeSlider.addEventListener("input", () => {
    const volume = sfxVolumeSlider.value / 100;
    sfxVolumeValue.textContent = Math.round(volume * 100) + "%";

    if (!muteCheckbox.checked) {
      applySFXVolume(volume);
    }
  });

  // Handle mute checkbox
  muteCheckbox.addEventListener("change", () => {
    playSFX(menuClickSound, ORIGINAL_VOLUMES.menuClickSound, false);
    applyMuteSetting(muteCheckbox.checked);

    // Update volume displays to match main options
    document.getElementById("mute-all").checked = muteCheckbox.checked;
  });

  // For sliders, play click sound on mouseup instead of mousedown
  musicVolumeSlider.addEventListener("mouseup", () => {
    playSFX(menuClickSound, ORIGINAL_VOLUMES.menuClickSound, false);
  });

  sfxVolumeSlider.addEventListener("mouseup", () => {
    playSFX(menuClickSound, ORIGINAL_VOLUMES.menuClickSound, false);
  });
}

/**
 * Shows the in-game options panel and hides the main menu panel
 */
function showInGameOptions() {
  // Hide the main menu panel
  document.querySelector(".menu-content").style.display = "none";

  // Show the options panel
  document.getElementById("in-game-options").style.display = "block";

  // Load current audio settings into the in-game options
  syncInGameOptionsWithSettings();
}

/**
 * Hides the in-game options panel and shows the main menu panel
 */
function hideInGameOptions() {
  // Save the current audio settings
  saveAudioSettings();

  // Show the main menu panel
  document.querySelector(".menu-content").style.display = "block";

  // Hide the options panel
  document.getElementById("in-game-options").style.display = "none";
}

/**
 * Synchronizes the in-game options controls with the current audio settings
 */
function syncInGameOptionsWithSettings() {
  // Get the current settings
  const musicVolumeSlider = document.getElementById("music-volume");
  const sfxVolumeSlider = document.getElementById("sfx-volume");
  const muteCheckbox = document.getElementById("mute-all");

  // Apply them to the in-game controls
  document.getElementById("in-game-music-volume").value =
    musicVolumeSlider.value;
  document.getElementById("in-game-music-volume-value").textContent =
    document.getElementById("music-volume-value").textContent;

  document.getElementById("in-game-sfx-volume").value = sfxVolumeSlider.value;
  document.getElementById("in-game-sfx-volume-value").textContent =
    document.getElementById("sfx-volume-value").textContent;

  document.getElementById("in-game-mute-all").checked = muteCheckbox.checked;
}

// Modify the saveAudioSettings function to sync settings between menus
function saveAudioSettings() {
  // Determine which set of controls to use based on context
  let musicVolumeElement, sfxVolumeElement, muteAllElement;

  // Check if the in-game options are visible
  if (document.getElementById("in-game-options").style.display === "block") {
    musicVolumeElement = document.getElementById("in-game-music-volume");
    sfxVolumeElement = document.getElementById("in-game-sfx-volume");
    muteAllElement = document.getElementById("in-game-mute-all");

    // Also update the main menu controls to keep them in sync
    document.getElementById("music-volume").value = musicVolumeElement.value;
    document.getElementById("music-volume-value").textContent =
      document.getElementById("in-game-music-volume-value").textContent;

    document.getElementById("sfx-volume").value = sfxVolumeElement.value;
    document.getElementById("sfx-volume-value").textContent =
      document.getElementById("in-game-sfx-volume-value").textContent;

    document.getElementById("mute-all").checked = muteAllElement.checked;
  } else {
    musicVolumeElement = document.getElementById("music-volume");
    sfxVolumeElement = document.getElementById("sfx-volume");
    muteAllElement = document.getElementById("mute-all");

    // Also update the in-game controls to keep them in sync
    document.getElementById("in-game-music-volume").value =
      musicVolumeElement.value;
    document.getElementById("in-game-music-volume-value").textContent =
      document.getElementById("music-volume-value").textContent;

    document.getElementById("in-game-sfx-volume").value =
      sfxVolumeElement.value;
    document.getElementById("in-game-sfx-volume-value").textContent =
      document.getElementById("sfx-volume-value").textContent;

    document.getElementById("in-game-mute-all").checked =
      muteAllElement.checked;
  }

  const musicVolume = musicVolumeElement.value / 100;
  const sfxVolume = sfxVolumeElement.value / 100;
  const muteAll = muteAllElement.checked;

  const audioSettings = {
    musicVolume,
    sfxVolume,
    muteAll,
  };

  localStorage.setItem(
    "pixelMinerAudioSettings",
    JSON.stringify(audioSettings)
  );

  // Apply the settings immediately
  applyAudioSettings(musicVolume, sfxVolume);
  applyMuteSetting(muteAll);
}

// Modify the loadAudioSettings function to also set in-game options values
function loadAudioSettings() {
  // Get saved values or use defaults
  const savedSettings =
    JSON.parse(localStorage.getItem("pixelMinerAudioSettings")) || {};

  // Set music volume slider
  const musicVolumeSlider = document.getElementById("music-volume");
  const musicVolumeValue = document.getElementById("music-volume-value");
  const musicVolume =
    savedSettings.musicVolume !== undefined ? savedSettings.musicVolume : 1.0;

  musicVolumeSlider.value = musicVolume * 100;
  musicVolumeValue.textContent = Math.round(musicVolume * 100) + "%";

  // Set SFX volume slider
  const sfxVolumeSlider = document.getElementById("sfx-volume");
  const sfxVolumeValue = document.getElementById("sfx-volume-value");
  const sfxVolume =
    savedSettings.sfxVolume !== undefined ? savedSettings.sfxVolume : 1.0;

  sfxVolumeSlider.value = sfxVolume * 100;
  sfxVolumeValue.textContent = Math.round(sfxVolume * 100) + "%";

  // Apply volume settings (with respect to original max volumes)
  applyAudioSettings(musicVolume, sfxVolume);

  // Set mute checkbox
  const muteCheckbox = document.getElementById("mute-all");
  const muteAll =
    savedSettings.muteAll !== undefined ? savedSettings.muteAll : false;

  muteCheckbox.checked = muteAll;

  // Apply mute setting
  applyMuteSetting(muteAll);

  // Add event listeners for sliders and checkbox
  setupAudioControls();

  // Also update in-game options controls
  const inGameMusicSlider = document.getElementById("in-game-music-volume");
  const inGameMusicValue = document.getElementById(
    "in-game-music-volume-value"
  );
  const inGameSFXSlider = document.getElementById("in-game-sfx-volume");
  const inGameSFXValue = document.getElementById("in-game-sfx-volume-value");
  const inGameMuteCheckbox = document.getElementById("in-game-mute-all");

  if (inGameMusicSlider && inGameMusicValue) {
    inGameMusicSlider.value = musicVolume * 100;
    inGameMusicValue.textContent = Math.round(musicVolume * 100) + "%";
  }

  if (inGameSFXSlider && inGameSFXValue) {
    inGameSFXSlider.value = sfxVolume * 100;
    inGameSFXValue.textContent = Math.round(sfxVolume * 100) + "%";
  }

  if (inGameMuteCheckbox) {
    inGameMuteCheckbox.checked = muteAll;
  }
}

/**
 * Cross-fade between two audio elements
 * @param {HTMLAudioElement} fromAudio - The audio element to fade out
 * @param {HTMLAudioElement} toAudio - The audio element to fade in
 * @param {number} duration - Duration of the cross-fade in milliseconds
 * @param {boolean} loop - Whether the target audio should loop
 */
export function crossFadeAudio(fromAudio, toAudio, duration, loop = true) {
  if (!fromAudio || !toAudio) return;

  // If the source audio isn't playing, just start the target audio
  if (fromAudio.paused) {
    playSFX(toAudio, ORIGINAL_VOLUMES[toAudio.id] || 0.1, loop);
    return;
  }

  // Get the appropriate volume based on audio settings
  const volumeMultiplier =
    gameState.sfxVolume !== undefined ? gameState.sfxVolume : 1.0;
  const fromOriginalVolume = fromAudio.volume;
  const toOriginalVolume =
    (ORIGINAL_VOLUMES[toAudio.src.split("/").pop().split(".")[0]] || 0.1) *
    volumeMultiplier;

  // Start the target audio at 0 volume
  toAudio.volume = 0;
  toAudio.loop = loop;
  toAudio
    .play()
    .catch((error) => console.warn(`Failed to play sound: ${error}`));

  // Calculate step size for smooth transition
  const steps = duration / 50; // Update every 50ms
  const fromStep = fromOriginalVolume / steps;
  const toStep = toOriginalVolume / steps;

  let currentStep = 0;

  const fadeInterval = setInterval(() => {
    currentStep++;

    // Decrease volume of source audio
    if (fromAudio.volume > fromStep) {
      fromAudio.volume -= fromStep;
    } else {
      fromAudio.pause();
      fromAudio.currentTime = 0;
      fromAudio.volume = fromOriginalVolume; // Reset for future use
    }

    // Increase volume of target audio
    if (currentStep < steps) {
      toAudio.volume += toStep;
    } else {
      toAudio.volume = toOriginalVolume;
      clearInterval(fadeInterval);
    }
  }, 50);
}
