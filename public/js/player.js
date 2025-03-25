// player.js
import { gameState } from "./config.js";
import {
  walkingSound,
  jetpackSound,
  miningSound,
  playerElement,
  showMessage,
  breakSound,
  laserSound,
  drillSound,
  blockBreak,
  playSFX,
  stopSFX,
  ORIGINAL_VOLUMES,
  createJetpackFlame,
  hideBlockHighlight,
  showBlockHighlight,
} from "./setup.js";
import {
  updateUI,
  updateVisibleBlocks,
  updateJetpackGauge,
  updateHealthDisplay,
} from "./updates.js";
import {
  createBreakingAnimation,
  showCrackingAnimation,
  clearCrackingAnimations,
} from "./animations.js";
import { getCurrentTool, hasMoonBootsEquipped, TOOL_TYPES } from "./crafting.js";
import { playerInRocket } from "./rocket.js";
import {
  sendPlayerUpdate,
  sendBlockMined,
  sendToolChanged,
  sendMiningStart,
  sendMiningStop,
  sendLaserActivated,
  sendLaserDeactivated,
  sendLaserUpdate,
  sendJetpackActivated, 
  sendJetpackDeactivated, 
  sendToolRotationUpdate,
  sendInitialToolInfo
} from "./multiplayer.js";


// Get DOM elements
export const gameWorld = document.getElementById("game-world");

window.addEventListener("DOMContentLoaded", () => {});

// Update player position and state
export function updatePlayer() {
  if (gameState.isPlayerDead || playerInRocket || gameState.physicsPaused) {
    return;
  }

  // Store initial position to check if we need to send updates
  const initialX = gameState.player.x;
  const initialY = gameState.player.y;
  const initialDirection = gameState.player.direction;

  // Add this check near the beginning of updatePlayer
  // Stop all mining if bag is full, regardless of mouse movement
  if (gameState.mouseHeld && getInventoryCount() >= gameState.bagSize) {
    // Stop all mining activities
    if (!miningSound.paused) {
      miningSound.pause();
      miningSound.currentTime = 0;
    }

    // Make sure to stop drill sound as well
    if (!drillSound.paused) {
      drillSound.pause();
      drillSound.currentTime = 0;
    }

    // Deactivate laser if it's active
    if (isLaserActive()) {
      deactivateLaser();
    }

    // Clear mining state
    gameState.pickaxeMiningActive = false;
    gameState.miningTarget = null;
    gameState.laserMiningTarget = null;
    gameState.mineTimer = 0;
    gameState.mineCooldown = 0;
    gameState.miningLocked = false;
    clearCrackingAnimations();
    hideBlockHighlight();
    stopAllMiningAnimations();
  }

  // Check current equipped tool
  const currentTool = getCurrentTool();
  const isLaserEquipped = currentTool && currentTool.type === "laser";

  // Update invulnerability timer
  if (gameState.player.invulnerableTime > 0) {
    gameState.player.invulnerableTime -= gameState.deltaTime;

    // Make player flash when invulnerable
    if (Math.floor(gameState.player.invulnerableTime / 100) % 2 === 0) {
      playerElement.style.opacity = "0.5";
    } else {
      playerElement.style.opacity = "1";
    }
  } else {
    playerElement.style.opacity = "1";
  }

  // Player movement code
  gameState.player.velocityX = 0;
  if (gameState.keys.left) {
    gameState.player.velocityX = -gameState.player.speed;
    gameState.player.direction = -1;
  }
  if (gameState.keys.right) {
    gameState.player.velocityX = gameState.player.speed;
    gameState.player.direction = 1;
  }
  gameState.player.velocityY += gameState.gravity;
  if (gameState.player.velocityY > gameState.gravity * 200) {
    gameState.player.velocityY = gameState.gravity * 200;
  }

  if (gameState.keys.left || gameState.keys.right) {
    if (gameState.player.onGround) {
      if (walkingSound.paused) {
        playSFX(walkingSound, ORIGINAL_VOLUMES.walkingSound, true);
      }
    } else {
      stopSFX(walkingSound);
    }
  } else {
    stopSFX(walkingSound);
  }

  // Jetpack code remains the same...
  if (
    gameState.keys.jump &&
    gameState.player.jumpCount > 1 &&
    gameState.hasJetpack &&
    gameState.jetpackFuel > 0 &&
    !gameState.player.onGround
  ) {
    // Jetpack activation

    // Only use jetpack when in the air
    gameState.player.velocityY = Math.max(
      gameState.player.velocityY - gameState.jetpackSpeed,
      -gameState.jetpackMaxSpeed
    );
    gameState.jetpackFuel = Math.max(
      0,
      gameState.jetpackFuel - gameState.jetpackUsage
    );

    // Update the jetpack gauge UI right after fuel decrement
    updateJetpackGauge();

    // Play jetpack sound#
    if (jetpackSound.paused) {
      playSFX(jetpackSound, ORIGINAL_VOLUMES.jetpackSound, true);

      // NEW: Send jetpack activated event to server for multiplayer sync
      sendJetpackActivated();
    }

    // Show jetpack visual effect (flame)
    const jetpackFlame = playerElement.querySelector(".jetpack-flame");
    if (jetpackFlame) {
      jetpackFlame.style.display = "block";
    } else {
      createJetpackFlame();
    }
  } else {
    // Hide jetpack flame when not using
    const jetpackFlame = playerElement.querySelector(".jetpack-flame");
    if (jetpackFlame) {
      jetpackFlame.style.display = "none";
    }

    // Pause jetpack sound
    if (!jetpackSound.paused) {
      jetpackSound.pause();
      jetpackSound.currentTime = 0;

      // NEW: Send jetpack deactivated event to server for multiplayer sync
      sendJetpackDeactivated();
    }
  }

  const svgElement = playerElement.querySelector("svg");
  if (svgElement) {
    const currentTool = getCurrentTool();
    const isDrill = currentTool && currentTool.type === "drill";
    const isLaserEquipped = currentTool && currentTool.type === "laser";

    // FIXED: Moved the drill animation logic outside of the mining check
    // to ensure the drill animates regardless of bag capacity or mining status
    if (isDrill && getInventoryCount() < gameState.bagSize) {
      // Apply the drilling animation class
      svgElement.classList.add("drilling");

      // Store the current rotation as a CSS custom property
      if (gameState.player.toolRotation !== undefined) {
        svgElement.style.setProperty(
          "--rotation",
          `${gameState.player.toolRotation}deg`
        );

        // Add flipped class if player is facing left
        if (gameState.player.direction === -1) {
          svgElement.classList.add("flipped");
        } else {
          svgElement.classList.remove("flipped");
        }
      }

      if (gameState.mouseHeld && drillSound.paused) {
        playSFX(drillSound, ORIGINAL_VOLUMES.drillSound, true);
      }
    } else if (
      !_isLaserActive &&
      !isLaserEquipped &&
      gameState.pickaxeMiningActive
    ) {
      // Only for pickaxe
      if (getInventoryCount() < gameState.bagSize) {
        // Use the mining target set during the click
        if (gameState.miningTarget) {
          svgElement.classList.add("mining");
        } else {
          svgElement.classList.remove("mining");
        }
      }
    }
  }

  // Mining logic now considers the current tool
  const miningWithLaser =
    isLaserEquipped && _isLaserActive && gameState.laserMiningTarget;
  const miningWithPickaxe = !isLaserEquipped && gameState.pickaxeMiningActive;

  if (miningWithLaser || miningWithPickaxe) {
    // Check bag capacity first - this will stop all mining activities if bag is full
    if (checkBagCapacity()) {
      // Explicitly stop all animations
      stopAllMiningAnimations();
      return; // Skip the rest of the mining logic if bag is full
    }

    if (getInventoryCount() < gameState.bagSize) {
      let target = null;

      if (miningWithLaser) {
        target = gameState.laserMiningTarget;
      } else if (miningWithPickaxe) {
        target = gameState.miningTarget;
      }

      // Send mining animation to multiplayer
      syncMiningActivity();

      if (target) {
        // Check if block still exists
        if (
          !target.block ||
          !gameState.blockMap[target.y] ||
          !gameState.blockMap[target.y][target.x]
        ) {
          // Block no longer exists, reset mining state
          clearCrackingAnimations();
          gameState.miningTarget = null;
          gameState.laserMiningTarget = null;
          gameState.pickaxeMiningActive = false;
          gameState.mineTimer = 0;
          gameState.miningLocked = false; // Clear the lock

          // Stop mining sound
          if (!miningSound.paused) {
            miningSound.pause();
            miningSound.currentTime = 0;
          }

          if (gameState.pickaxeMiningActive && !gameState.mouseHeld) {
            gameState.pickaxeMiningActive = false;
            sendMiningStop();
          }

          // CHANGED: Don't stop drill sound here, it's handled separately now
          return;
        }

        // ===== NEW RANGE CHECK =====
        // Check if target is still within range
        const playerCenterX = gameState.player.x + gameState.player.width / 2;
        const playerCenterY = gameState.player.y + gameState.player.height / 2;
        const blockCenterX = (target.x + 0.5) * gameState.blockSize;
        const blockCenterY = (target.y + 0.5) * gameState.blockSize;

        // Calculate distance to target block
        const distanceToBlock = Math.sqrt(
          Math.pow(blockCenterX - playerCenterX, 2) +
            Math.pow(blockCenterY - playerCenterY, 2)
        );

        // Get current tool and its range
        const currentTool = getCurrentTool();
        const toolRange = currentTool ? currentTool.range : 3;
        const maxRange = toolRange * gameState.blockSize;

        // If block is out of range, stop mining
        if (distanceToBlock > maxRange) {
          clearCrackingAnimations();
          gameState.miningTarget = null;
          gameState.laserMiningTarget = null;
          gameState.pickaxeMiningActive = false;
          gameState.mineTimer = 0;
          gameState.miningLocked = false;

          if (!miningSound.paused) {
            miningSound.pause();
            miningSound.currentTime = 0;
          }

          if (gameState.pickaxeMiningActive && !gameState.mouseHeld) {
            gameState.pickaxeMiningActive = false;
            sendMiningStop();
          }

          // CHANGED: Don't stop drill sound here, it's handled separately now
          return;
        }
        // ===== END NEW RANGE CHECK =====

        // If target changes, reset mining progress
        if (
          !gameState.miningTarget ||
          gameState.miningTarget.x !== target.x ||
          gameState.miningTarget.y !== target.y
        ) {
          clearCrackingAnimations();
          gameState.miningTarget = target;
          gameState.mineTimer = 0;
          gameState.miningLocked = false; // Reset lock when target changes
        }

        if (gameState.mineCooldown > 0) {
          gameState.mineCooldown -= gameState.deltaTime;
        } else {
          if (!miningWithLaser) {
            // CHANGED: Only use mining sound for pickaxe, drill sound is handled separately
            if (gameState.crafting.currentToolType === "pickaxe") {
              // Use regular mining sound for pickaxe
              if (miningSound.paused) {
                playSFX(miningSound, ORIGINAL_VOLUMES.miningSound, true);
              }
            }
            if (gameState.crafting.currentToolType === "drill") {
              // Use regular mining sound for pickaxe
              if (drillSound.paused) {
                playSFX(drillSound, ORIGINAL_VOLUMES.drillSound, true);
              }
            }
          }
          // Get the current tool to determine its speed multiplier
          const currentTool = getCurrentTool();
          let toolSpeedMultiplier = 1.0; // Default fallback

          // Make sure we use the correct tool type based on what's currently being used
          if (miningWithLaser && currentTool && currentTool.type === "laser") {
            toolSpeedMultiplier = currentTool.speedMultiplier;
          } else if (miningWithPickaxe) {
            // For pickaxe/drill use the existing pickaxeSpeed which is set correctly when equipped
            toolSpeedMultiplier = gameState.pickaxeSpeed;
          }

          const effectiveMiningDuration =
            gameState.blockMiningDuration / toolSpeedMultiplier;

          gameState.mineTimer += gameState.deltaTime;
          gameState.miningTarget.progress = Math.min(
            1,
            gameState.mineTimer / effectiveMiningDuration
          );

          // Set the mining lock when progress reaches 50%
          if (
            gameState.miningTarget.progress >= 0.5 &&
            !gameState.miningLocked
          ) {
            gameState.miningLocked = true;
          }

          showCrackingAnimation(
            gameState.miningTarget.x,
            gameState.miningTarget.y,
            gameState.miningTarget.block,
            gameState.miningTarget.progress
          );

          if (gameState.mineTimer >= effectiveMiningDuration) {
            // Mine the block
            if (gameState.miningTarget.block) {
              createBreakingAnimation(
                gameState.miningTarget.x,
                gameState.miningTarget.y,
                gameState.miningTarget.block.color
              );

              setTimeout(() => {
                breakSound.pause();
                breakSound.currentTime = 0;
              }, gameState.blockMiningDuration);

              if (
                gameState.miningTarget.block.name !== "grass" &&
                gameState.miningTarget.block.name !== "dirt" &&
                gameState.miningTarget.block.name !== "stone"
              ) {
                if (!gameState.inventory[gameState.miningTarget.block.name]) {
                  gameState.inventory[gameState.miningTarget.block.name] = 0;
                }
                gameState.inventory[gameState.miningTarget.block.name]++;
                updateUI();
              }

              // Store the current mining coordinates
              const minedX = gameState.miningTarget.x;
              const minedY = gameState.miningTarget.y;

              // Remove the block
              gameState.blockMap[gameState.miningTarget.y][
                gameState.miningTarget.x
              ] = null;

              // NEW: Send block mining update to server for multiplayer sync
              sendBlockMined(minedX, minedY);

              updateVisibleBlocks();
              clearCrackingAnimations();
              hideBlockHighlight();

              // Unlock mining now that the block is broken
              gameState.miningLocked = false;

              playSFX(blockBreak, ORIGINAL_VOLUMES.blockBreak, false);

              // If mouse is still being held, find the next block to mine
              if (gameState.mouseHeld) {
                // Get player center position for ray casting
                const playerCenterX =
                  gameState.player.x + gameState.player.width / 2;
                const playerCenterY =
                  gameState.player.y + gameState.player.height / 2;

                // Calculate angle from player to last mouse position
                const angle = Math.atan2(
                  gameState.mouseY + gameState.camera.y - playerCenterY,
                  gameState.mouseX + gameState.camera.x - playerCenterX
                );

                // Get current tool and its range
                const currentTool = getCurrentTool();
                const toolRange = currentTool ? currentTool.range : 3;
                const maxMiningRange = toolRange * gameState.blockSize;

                // Use ray tracing to find the next target block
                const nextTargetBlock = findTargetBlock(
                  playerCenterX,
                  playerCenterY,
                  angle,
                  maxMiningRange
                );

                // If a new valid block is found, start mining it
                if (nextTargetBlock) {
                  gameState.targetBlock = {
                    x: nextTargetBlock.x,
                    y: nextTargetBlock.y,
                  };

                  // Show highlight on the new target
                  showBlockHighlight(nextTargetBlock.x, nextTargetBlock.y);

                  // Set as new mining target
                  gameState.pickaxeMiningActive = true;
                  gameState.miningTarget = {
                    x: nextTargetBlock.x,
                    y: nextTargetBlock.y,
                    block: nextTargetBlock.block,
                    progress: 0,
                  };
                } else {
                  // No valid block found, clear mining state
                  gameState.pickaxeMiningActive = false;
                  gameState.miningTarget = null;
                  gameState.targetBlock = null;
                }
              } else {
                // Mouse not held, clean up everything
                gameState.targetBlock = null;
                gameState.miningTarget = null;
                gameState.pickaxeMiningActive = false;
              }
            }

            gameState.mineTimer = 0;
            gameState.mineCooldown = effectiveMiningDuration / 4;
          }
        }
      } else {
        if (!miningSound.paused) {
          miningSound.pause();
          miningSound.currentTime = 0;
        }
        clearCrackingAnimations();
      }
    }
  } else {
    // Stop mining sound if playing
    if (!miningSound.paused) {
      miningSound.pause();
      miningSound.currentTime = 0;
    }

    // CHANGED: Only stop drill sound if mouse is not held down
    if (!gameState.mouseHeld && !drillSound.paused) {
      drillSound.pause();
      drillSound.currentTime = 0;
    }

    gameState.mineTimer = 0;
    gameState.mineCooldown = 0;
    gameState.miningLocked = false;
    clearCrackingAnimations();
  }

  if (!gameState.mouseHeld) {
    stopAllMiningAnimations();
  }

  // ADDED: Make sure the drill stops animating when mouse is not held
  if (!gameState.mouseHeld && svgElement) {
    // Only stop the mining/drilling animations but preserve rotation capability
    svgElement.classList.remove("drilling");
    svgElement.classList.remove("mining");
    svgElement.classList.remove("flipped");

    // Don't reset transforms for drills and lasers to allow rotation
    const isDrill = currentTool && currentTool.type === "drill";
    const isLaser = currentTool && currentTool.type === "laser";

    if (!isDrill && !isLaser) {
      // Fix: Apply consistent scaling factor for pickaxe when facing either direction
      svgElement.style.transform =
        gameState.player.direction === -1
          ? `rotate(70deg) scale(1.5) scaleX(-1)`
          : `rotate(70deg) scale(1.5) scaleX(-1)`;
    }
  }

  // Rest of movement and collision code remains the same...
  gameState.player.x += gameState.player.velocityX;
  checkHorizontalCollisions();
  gameState.player.y += gameState.player.velocityY;
  gameState.player.onGround = false;
  checkVerticalCollisions();
  if (gameState.player.x < 0) {
    gameState.player.x = 0;
  }
  if (
    gameState.player.x + gameState.player.width >
    gameState.worldWidth * gameState.blockSize
  ) {
    gameState.player.x =
      gameState.worldWidth * gameState.blockSize - gameState.player.width;
  }

  // Check if player has moved significantly
  if (hasPlayerMoved()) {
    // Update mining targets based on new position
    updateMiningTargetDuringMovement();
  }

  if (_isLaserActive) {
    updateLaserTargetDuringMovement();
  }

  // Update tool rotation
  if (
    getCurrentTool() &&
    (getCurrentTool().type === "drill" || getCurrentTool().type === "laser")
  ) {
    updateToolRotation();
  }

  // Update lastX and lastY for the next frame
  gameState.player.lastX = gameState.player.x;
  gameState.player.lastY = gameState.player.y;

  const playerDepth =
    Math.floor(
      (gameState.player.y - gameState.skyRows * gameState.blockSize) /
        gameState.blockSize
    ) + 1;
  gameState.depth = playerDepth < 0 ? 0 : playerDepth;

  // check if we need to send a multiplayer update
  if (
    initialX !== gameState.player.x ||
    initialY !== gameState.player.y ||
    initialDirection !== gameState.player.direction
  ) {
    // Send update to server with our new position
    sendPlayerUpdate();
  }
}

// Check horizontal collisions
export function checkHorizontalCollisions() {
  const playerLeft = gameState.player.x;
  const playerRight = gameState.player.x + gameState.player.width;
  const playerTop = gameState.player.y;
  const playerBottom = gameState.player.y + gameState.player.height;
  const startY = Math.floor(playerTop / gameState.blockSize);
  const endY = Math.floor((playerBottom - 1) / gameState.blockSize);

  if (gameState.player.velocityX < 0) {
    const blockX = Math.floor(playerLeft / gameState.blockSize);
    for (let y = startY; y <= endY; y++) {
      if (
        y < 0 ||
        y >= gameState.worldHeight ||
        blockX < 0 ||
        blockX >= gameState.worldWidth
      )
        continue;
      if (gameState.blockMap[y][blockX]) {
        gameState.player.x = (blockX + 1) * gameState.blockSize;
        break;
      }
    }
  }

  if (gameState.player.velocityX > 0) {
    const blockX = Math.floor(playerRight / gameState.blockSize);
    for (let y = startY; y <= endY; y++) {
      if (
        y < 0 ||
        y >= gameState.worldHeight ||
        blockX < 0 ||
        blockX >= gameState.worldWidth
      )
        continue;
      if (gameState.blockMap[y][blockX]) {
        gameState.player.x =
          blockX * gameState.blockSize - gameState.player.width;
        break;
      }
    }
  }
}

function hasPlayerMoved() {
  const currentX = gameState.player.x;
  const currentY = gameState.player.y;
  const lastX = gameState.player.lastX;
  const lastY = gameState.player.lastY;

  // Check if player has moved beyond the threshold in any direction
  const POSITION_THRESHOLD = 5; // Minimum movement in pixels to trigger an update
  const deltaX = Math.abs(currentX - lastX);
  const deltaY = Math.abs(currentY - lastY);

  return deltaX > POSITION_THRESHOLD || deltaY > POSITION_THRESHOLD;
}

// Check vertical collisions
export function checkVerticalCollisions() {
  const playerLeft = gameState.player.x;
  const playerRight = gameState.player.x + gameState.player.width;
  const playerTop = gameState.player.y;
  const playerBottom = gameState.player.y + gameState.player.height;
  const startX = Math.floor(playerLeft / gameState.blockSize);
  const endX = Math.floor((playerRight - 1) / gameState.blockSize);

  // Add shop sign platform collision detection
  if (gameState.player.velocityY >= 0) {
    // Get the shop sign position directly from gameState
    const shopSignPos = gameState.shopSign;
    
    if (shopSignPos) {
      // Define the invisible platform dimensions
      const platformWidth = shopSignPos.width; // Make platform a bit wider than the sign
      const platformHeight = 10; // Small invisible platform height
      const platformX = shopSignPos.x; // Center platform under sign
      const platformY = shopSignPos.y + shopSignPos.height; // Position right below the sign
      
      // More precise collision check for the platform
      if (playerBottom <= platformY + 2 && // Allow a small overlap for better detection
          playerBottom + gameState.player.velocityY >= platformY - 2 && // Check if we're about to cross the platform
          playerRight > platformX && 
          playerLeft < platformX + platformWidth) {
        
        // Stop player on the platform
        gameState.player.y = platformY - gameState.player.height;
        gameState.player.velocityY = 0;
        gameState.player.onGround = true;
        gameState.player.isJumping = false;
        
        // Return early to prevent regular block collisions from overriding our platform
        return;
      }
    }
    
    // Add crafting station platform collision detection
    const craftingStationPos = gameState.crafting.craftingStation;
    
    if (craftingStationPos) {
      // Define the invisible platform dimensions for crafting station
      const platformWidth = craftingStationPos.width - 20;
      const platformHeight = 10; // Small invisible platform height
      const platformX = craftingStationPos.x;
      const platformY = craftingStationPos.y + 160;
      
      // More precise collision check for the crafting station platform
      if (playerBottom <= platformY + 2 && // Allow a small overlap for better detection
          playerBottom + gameState.player.velocityY >= platformY - 2 && // Check if we're about to cross the platform
          playerRight > platformX && 
          playerLeft < platformX + platformWidth) {
        
        // Stop player on the platform
        gameState.player.y = platformY - gameState.player.height;
        gameState.player.velocityY = 0;
        gameState.player.onGround = true;
        gameState.player.isJumping = false;
        
        // Return early to prevent regular block collisions from overriding our platform
        return;
      }
    }
  }

  if (gameState.player.velocityY >= 0) {
    const blockY = Math.floor(playerBottom / gameState.blockSize);
    for (let x = startX; x <= endX; x++) {
      // Safe check for valid indices
      if (
        blockY < 0 ||
        blockY >= gameState.worldHeight ||
        x < 0 ||
        x >= gameState.worldWidth ||
        !gameState.blockMap[blockY] // Add this check to ensure row exists
      )
        continue;
        
      if (gameState.blockMap[blockY][x]) {
        // Check for fall damage before stopping the fall
        if (gameState.player.velocityY > gameState.player.fallDamageThreshold) {
          if (gameState.player.invulnerableTime <= 0) {
            const damage = Math.floor(
              (gameState.player.velocityY -
                gameState.player.fallDamageThreshold) *
                gameState.player.fallDamageMultiplier
            );

            // Check if player is on the moon planet OR has moon boots equipped
            // Only take fall damage if neither condition is true
            const isMoonBootsEquipped = hasMoonBootsEquipped();

            if (gameState.currentPlanet !== "moon" && !isMoonBootsEquipped) {
              takeDamage(damage);
            } else if (
              isMoonBootsEquipped &&
              gameState.player.velocityY >
                gameState.player.fallDamageThreshold * 1.5
            ) {
              // If falling from a particularly high height with moon boots, show a visual effect
              // but don't take damage
              playerElement.classList.add("bounce");
              setTimeout(() => {
                playerElement.classList.remove("bounce");
              }, 300);
            }
          }
        }

        gameState.player.y =
          blockY * gameState.blockSize - gameState.player.height;
        gameState.player.velocityY = 0;
        gameState.player.onGround = true;
        gameState.player.isJumping = false;
        break;
      }
    }
  }

  // Upward collision code
  if (gameState.player.velocityY < 0) {
    const blockY = Math.floor(playerTop / gameState.blockSize);
    for (let x = startX; x <= endX; x++) {
      // Safe check for valid indices, including checking if blockMap[blockY] exists
      if (
        blockY < 0 ||
        blockY >= gameState.worldHeight ||
        x < 0 ||
        x >= gameState.worldWidth ||
        !gameState.blockMap[blockY] // Add this check to ensure row exists
      )
        continue;
        
      if (gameState.blockMap[blockY][x]) {
        gameState.player.y = (blockY + 1) * gameState.blockSize;
        gameState.player.velocityY = 0;
        break;
      }
    }
  }
}

// Show damage taken as text// Show damage taken as text
function showDamageIndicator(amount) {
  // Create a new element for the damage indicator
  const damageIndicator = document.createElement("div");
  damageIndicator.className = "damage-indicator";
  damageIndicator.textContent = `-${amount}`;

  // Position it above the player, accounting for camera position
  const cameraOffsetX = gameState.camera.x;
  const cameraOffsetY = gameState.camera.y || 0;

  // Initial position - start above the player
  const initialPosY = gameState.player.y - 20;

  damageIndicator.style.left = `${
    gameState.player.x - cameraOffsetX + gameState.player.width / 2
  }px`;
  damageIndicator.style.top = `${initialPosY - cameraOffsetY}px`;

  // Add to the game world
  gameWorld.appendChild(damageIndicator);

  // Let CSS handle the animation, but remove the element after animation completes
  setTimeout(() => {
    if (damageIndicator.parentNode) {
      gameWorld.removeChild(damageIndicator);
    }
  }, 1000); // Adjust timing to match your CSS animation duration
}

// Add these functions to handle damage and death
export function takeDamage(amount) {
  // Only take damage if not invulnerable
  if (gameState.player.invulnerableTime <= 0) {
    gameState.player.health = Math.max(0, gameState.player.health - amount);
    gameState.player.invulnerableTime = gameState.player.maxInvulnerableTime;

    // Show the damage indicator
    showDamageIndicator(amount);

    // Flash the player red
    playerElement.classList.add("damaged");
    setTimeout(() => {
      playerElement.classList.remove("damaged");
    }, 300);

    // Check for death
    if (gameState.player.health <= 0) {
      playerDeath();
    }

    // Update the health display
    updateHealthDisplay();
  }
}

function playerDeath() {
  showMessage("You died! Respawning...", 3000);

  // Stop all movement immediately
  gameState.player.velocityX = 0;
  gameState.player.velocityY = 0;

  // Set the flag to stop further movement updates
  gameState.isPlayerDead = true;

  // Prevent further damage during death animation
  gameState.player.invulnerableTime = 2000;

  // Add death animation
  playerElement.classList.add("death");

  // Respawn after a delay
  setTimeout(() => {
    playerElement.classList.remove("death");
    gameState.respawn();
    gameState.isPlayerDead = false;
    gameState.player.health = gameState.player.maxHealth;
    updateHealthDisplay();
  }, 1500);
}

// Get total inventory count
export function getInventoryCount() {
  return Object.values(gameState.inventory).reduce(
    (sum, count) => sum + count,
    0
  );
}

// New global variables for the laser
let laserElement = null;
let _isLaserActive = false;

// Create the laser beam element
export function createLaserBeam() {
  if (laserElement) return;

  // Create the laser element
  laserElement = document.createElement("div");
  laserElement.className = "laser-beam";

  // Critical: make laser a child of the player element so it moves with player automatically
  playerElement.appendChild(laserElement);
}

// Find the first block that intersects with the ray (used by both laser and pickaxe)
export function findTargetBlock(startX, startY, angle, maxLength) {
  // Get current tool and its range
  const currentTool = getCurrentTool();

  // If no tool is equipped (shouldn't happen), use minimum range
  const toolRange = currentTool ? currentTool.range : 1;

  // Calculate actual max length based on tool range
  const effectiveMaxLength = toolRange * gameState.blockSize;

  // Use the smaller of the two values to respect both the tool's range and any other limitations
  const finalMaxLength = Math.min(maxLength, effectiveMaxLength);

  // Calculate end point
  const endX = startX + Math.cos(angle) * finalMaxLength;
  const endY = startY + Math.sin(angle) * finalMaxLength;

  // Rest of existing DDA algorithm implementation
  const blockX = Math.floor(startX / gameState.blockSize);
  const blockY = Math.floor(startY / gameState.blockSize);

  const endBlockX = Math.floor(endX / gameState.blockSize);
  const endBlockY = Math.floor(endY / gameState.blockSize);

  // Direction of ray
  const dirX = Math.cos(angle);
  const dirY = Math.sin(angle);

  // Calculate step size
  const stepX = dirX > 0 ? 1 : -1;
  const stepY = dirY > 0 ? 1 : -1;

  // Calculate distance to next block boundary
  const tDeltaX = Math.abs(1 / dirX);
  const tDeltaY = Math.abs(1 / dirY);

  // Calculate distance to first boundary
  const nextX =
    stepX > 0
      ? (blockX + 1) * gameState.blockSize - startX
      : startX - blockX * gameState.blockSize;
  const nextY =
    stepY > 0
      ? (blockY + 1) * gameState.blockSize - startY
      : startY - blockY * gameState.blockSize;

  let tMaxX = nextX / Math.abs(dirX);
  let tMaxY = nextY / Math.abs(dirY);

  let curBlockX = blockX;
  let curBlockY = blockY;

  const maxSteps =
    Math.max(Math.abs(blockX - endBlockX), Math.abs(blockY - endBlockY)) * 2;
  let steps = 0;

  // Perform ray casting
  while (steps < maxSteps) {
    if (tMaxX < tMaxY) {
      curBlockX += stepX;
      tMaxX += tDeltaX * gameState.blockSize;
    } else {
      curBlockY += stepY;
      tMaxY += tDeltaY * gameState.blockSize;
    }

    steps++;

    // Check if current block is valid and contains a block
    if (
      curBlockX >= 0 &&
      curBlockX < gameState.worldWidth &&
      curBlockY >= 0 &&
      curBlockY < gameState.worldHeight &&
      gameState.blockMap[curBlockY] &&
      gameState.blockMap[curBlockY][curBlockX]
    ) {
      // Calculate the actual distance to this block
      const distSq =
        Math.pow((curBlockX + 0.5) * gameState.blockSize - startX, 2) +
        Math.pow((curBlockY + 0.5) * gameState.blockSize - startY, 2);

      // Return block if within range
      if (distSq <= finalMaxLength * finalMaxLength) {
        // Add one more validation check here
        if (gameState.blockMap[curBlockY][curBlockX] === null) {
          return null; // Don't return if the block slot is explicitly null
        }

        return {
          x: curBlockX,
          y: curBlockY,
          block: gameState.blockMap[curBlockY][curBlockX],
          progress: 0,
        };
      } else {
        // Block found but too far away
        return null;
      }
    }

    // Check if we've gone past max range
    const currentDistSq =
      Math.pow((curBlockX + 0.5) * gameState.blockSize - startX, 2) +
      Math.pow((curBlockY + 0.5) * gameState.blockSize - startY, 2);

    if (currentDistSq > finalMaxLength * finalMaxLength) {
      break;
    }
  }

  return null;
}

export function updateLaserTargetDuringMovement() {
  // Only run if laser is active and mouse is held down
  if (!_isLaserActive || !gameState.mouseHeld) {
    return;
  }

  // Check bag capacity
  if (getInventoryCount() >= gameState.bagSize) {
    return;
  }

  // Get current tool to confirm it's a laser
  const currentTool = getCurrentTool();
  if (!currentTool || currentTool.type !== "laser") {
    return;
  }

  // Get player center position
  const playerCenterX = gameState.player.x + gameState.player.width / 2;
  const playerCenterY = gameState.player.y + gameState.player.height / 2;

  // Calculate angle from player to last known mouse position
  const worldMouseX = gameState.mouseX + gameState.camera.x;
  const worldMouseY = gameState.mouseY + gameState.camera.y;
  const angle = Math.atan2(
    worldMouseY - playerCenterY,
    worldMouseX - playerCenterX
  );

  // Get the range from the current tool
  const toolRange = currentTool.range || LASER_RANGE;
  const maxLength = toolRange * gameState.blockSize;

  // Use ray tracing to find target block
  const targetBlock = findTargetBlock(
    playerCenterX,
    playerCenterY,
    angle,
    maxLength
  );

  // Update the laser visually to match the new player position
  // We need to convert player coordinates to screen coordinates
  const screenPlayerX = playerCenterX - gameState.camera.x;
  const screenPlayerY = playerCenterY - gameState.camera.y;

  // Set the laser target
  gameState.laserMiningTarget = targetBlock;

  // Update the laser beam visually
  if (laserElement) {
    let length, targetX, targetY;

    if (targetBlock) {
      // If a block was found, calculate distance to block
      const blockCenterX =
        (targetBlock.x + 0.5) * gameState.blockSize - gameState.camera.x;
      const blockCenterY =
        (targetBlock.y + 0.5) * gameState.blockSize - gameState.camera.y;

      length = Math.sqrt(
        Math.pow(blockCenterX - screenPlayerX, 2) +
          Math.pow(blockCenterY - screenPlayerY, 2)
      );
    } else {
      // No block found, extend to max range
      length = maxLength;
    }

    // Adjust rotation based on player direction
    let adjustedAngle = angle;
    if (gameState.player.direction === -1) {
      // When facing left, mirror the angle to maintain the correct up/down direction
      adjustedAngle = Math.PI - angle;
    }

    laserElement.style.width = `${length - gameState.blockSize / 2}px`;
    laserElement.style.transform = `rotate(${adjustedAngle}rad)`;
    sendLaserUpdate(adjustedAngle); // Send rotation to multiplayer
  }
}

export function updateMiningTargetDuringMovement() {
  // Only update if mouse is held down and we're using a pickaxe (not laser)
  // Also don't interrupt if we're already mining a block past 50% completion
  const currentTool = getCurrentTool();
  const isLaserEquipped = currentTool && currentTool.type === "laser";

  if (gameState.mouseHeld && !isLaserEquipped && !gameState.miningLocked) {
    // Get player center position
    const playerCenterX = gameState.player.x + gameState.player.width / 2;
    const playerCenterY = gameState.player.y + gameState.player.height / 2;

    // Calculate angle from player to last known mouse position
    const worldMouseX = gameState.mouseX + gameState.camera.x;
    const worldMouseY = gameState.mouseY + gameState.camera.y;
    const angle = Math.atan2(
      worldMouseY - playerCenterY,
      worldMouseX - playerCenterX
    );

    // Get current tool range
    const toolRange = currentTool ? currentTool.range : 3;
    const maxMiningRange = toolRange * gameState.blockSize;

    // Use ray tracing to find target block
    const targetBlock = findTargetBlock(
      playerCenterX,
      playerCenterY,
      angle,
      maxMiningRange
    );

    // Update the game state with the target block
    if (targetBlock) {
      // Check if this is a different block than we're currently mining
      const isSameBlock =
        gameState.miningTarget &&
        gameState.miningTarget.x === targetBlock.x &&
        gameState.miningTarget.y === targetBlock.y;

      // Only update if it's a new block
      if (!isSameBlock) {
        gameState.targetBlock = {
          x: targetBlock.x,
          y: targetBlock.y,
        };

        showBlockHighlight(targetBlock.x, targetBlock.y);

        // Make sure the block still exists in the blockMap
        if (
          gameState.blockMap[targetBlock.y] &&
          gameState.blockMap[targetBlock.y][targetBlock.x]
        ) {
          // Set as new mining target
          gameState.pickaxeMiningActive = true;
          gameState.miningTarget = {
            x: targetBlock.x,
            y: targetBlock.y,
            block: targetBlock.block,
            progress: 0,
          };
        }
      }
    } else {
      // No valid target found
      hideBlockHighlight();
    }
  }
}

// Check if laser is active
export function isLaserActive() {
  return _isLaserActive;
}

// Activates the laser - now checks if laser is equipped
export function activateLaser() {
  if (gameState.inventoryOpen || gameState.physicsPaused) {
    return;
  }

  const currentTool = getCurrentTool();
  if (!currentTool || currentTool.type !== "laser") return;

  if (!laserElement) createLaserBeam();

  laserElement.style.display = "block";
  _isLaserActive = true;
  playerElement.classList.add("player-laser-active");

  // Start the laser sound
  if (laserSound.paused) {
    playSFX(laserSound, ORIGINAL_VOLUMES.laserSound, true);
  }

  // Send laser activation to server for multiplayer sync
  sendLaserActivated();
}

// Modify the deactivateLaser function to send laser deactivation to server
export function deactivateLaser() {
  if (!laserElement) return;

  laserElement.style.display = "none";
  _isLaserActive = false;
  playerElement.classList.remove("player-laser-active");

  // Stop the laser sound
  if (typeof laserSound !== "undefined" && !laserSound.paused) {
    laserSound.pause();
    laserSound.currentTime = 0;
  }
  clearCrackingAnimations();
  gameState.mineTimer = 0;
  gameState.laserMiningTarget = null;

  // Send laser deactivation to server for multiplayer sync
  sendLaserDeactivated();
}

export function updateCharacterAppearance() {
  // Check if moon boots are equipped
  const isMoonBootsEquipped = hasMoonBootsEquipped();

  // Look for existing moon boots overlay
  let moonBootsOverlay = playerElement.querySelector(".moon-boots");

  if (isMoonBootsEquipped) {
    // If moon boots are equipped but the overlay doesn't exist, create it
    if (!moonBootsOverlay) {
      moonBootsOverlay = document.createElement("div");
      moonBootsOverlay.className = "moon-boots";

      // Add it to the player element
      playerElement.appendChild(moonBootsOverlay);
    }
  } else {
    // If moon boots are not equipped but the overlay exists, remove it
    if (moonBootsOverlay) {
      playerElement.removeChild(moonBootsOverlay);
    }
  }
}

// Modified function to save all tool state to localStorage
export function saveToolState() {
  // Save the entire tool state
  const toolState = {
    equippedTools: gameState.crafting.equippedTools,
    currentToolType: gameState.crafting.currentToolType,
  };

  localStorage.setItem("toolState", JSON.stringify(toolState));
}

// Load tool state from localStorage
export function loadEquippedTool() {
  try {
    // Assuming gameState already contains tool information from the game save
    const currentToolType = gameState.crafting.currentToolType;
    const currentToolId = gameState.crafting.equippedTools[currentToolType];

    // If we have valid tool information
    if (currentToolType && currentToolId) {
      // Get the tool details from available tools
      const toolToEquip = gameState.crafting.availableTools.find(
        (tool) => tool.id === currentToolId
      );

      if (toolToEquip) {
        // Just update the visual appearance without changing game state
        updateToolVisuals(toolToEquip.type);
        sendInitialToolInfo(); // Already here
        return true;
      }
    }

    // Default to basic pickaxe visuals if no valid tool info
    // First set the default equipped tool to pickaxe-basic to ensure correct loading
    if (gameState.crafting && gameState.crafting.equippedTools) {
      gameState.crafting.equippedTools[TOOL_TYPES.PICKAXE] = "pickaxe-basic";
      gameState.crafting.currentToolType = TOOL_TYPES.PICKAXE;
    }
    updateToolVisuals("pickaxe");
    sendInitialToolInfo(); // Add this line to send tool info even when defaulting to basic pickaxe
    return false;
  } catch (error) {
    console.error("Error loading equipped tool:", error);
    updateToolVisuals("pickaxe"); // Fallback
    sendInitialToolInfo(); // Add this line to send tool info even in error cases
    return false;
  }
}

// New function that only handles the visuals without state changes
export function updateToolVisuals(toolType) {
  // Get the currently equipped tool to determine which specific tool to show
  const currentToolId = gameState.crafting.equippedTools[toolType];

  // Load the appropriate SVG based on tool type and level
  let svgPath = "";

  if (toolType === "drill") {
    // Choose the correct drill SVG based on the equipped drill ID
    switch (currentToolId) {
      case "drill-basic":
        svgPath = "imgs/drill-basic.svg";
        break;
      case "drill-ruby":
        svgPath = "imgs/drill-ruby.svg";
        break;
      case "drill-diamond":
        svgPath = "imgs/drill-diamond.svg";
        break;
      default:
        // Fallback to basic drill if ID is unknown
        svgPath = "imgs/drill-basic.svg";
    }
  } else if (toolType === "laser") {
    svgPath = "imgs/laser.svg";
  } else if (toolType === "pickaxe") {
    // Choose the correct pickaxe SVG based on the equipped pickaxe ID
    switch (currentToolId) {
      case "pickaxe-basic":
        svgPath = "imgs/pickaxe-basic.svg";
        break;
      case "pickaxe-iron":
        svgPath = "imgs/pickaxe-iron.svg";
        break;
      case "pickaxe-gold":
        svgPath = "imgs/pickaxe-gold.svg";
        break;
      case "pickaxe-diamond":
        svgPath = "imgs/pickaxe-diamond.svg";
        break;
      default:
        // Fallback to basic pickaxe if ID is unknown
        svgPath = "imgs/pickaxe-basic.svg";
    }
  } else {
    // Default to basic pickaxe for any other case
    svgPath = "imgs/pickaxe-basic.svg";
  }

  // First, ensure we have the proper structure in the player element
  // Check if we already have a dedicated tool container
  let toolContainer = playerElement.querySelector(".player-tool-container");

  if (!toolContainer) {
    // Create a dedicated container for the tool if it doesn't exist
    toolContainer = document.createElement("div");
    toolContainer.className = "player-tool-container";

    // Insert the tool container as the first child of the player
    if (playerElement.firstChild) {
      playerElement.insertBefore(toolContainer, playerElement.firstChild);
    } else {
      playerElement.appendChild(toolContainer);
    }
  }

  // Fetch and update only the tool SVG
  fetch(svgPath)
    .then((response) => response.text())
    .then((svg) => {
      // Replace only the tool container's content
      toolContainer.innerHTML = svg;

      // Get the SVG element
      const svgElement = toolContainer.querySelector("svg");
      if (svgElement) {
        // Remove any previously set tool classes
        svgElement.classList.remove("drill", "pickaxe", "laser");
        // Add the class based on the toolType
        svgElement.classList.add(toolType);

        // Apply rotation if it's a drill or laser
        if (
          (toolType === "drill" || toolType === "laser") &&
          gameState.player.toolRotation !== undefined
        ) {
          if (gameState.player.direction === -1) {
            svgElement.style.transform = `scaleX(-1.5) scaleY(1.5) rotate(${gameState.player.toolRotation}deg)`;
          } else {
            svgElement.style.transform = `scaleX(1.5) scaleY(1.5) rotate(${gameState.player.toolRotation}deg)`;
          }
        }
      }
    })
    .catch((error) => {
      console.error(`Error loading ${toolType} SVG (${svgPath}):`, error);
      // Provide more specific fallback based on tool type
      let fallbackPath = "imgs/pickaxe-basic.svg";

      if (toolType === "drill") {
        fallbackPath = "imgs/drill-basic.svg";
      } else if (toolType === "laser") {
        fallbackPath = "imgs/laser.svg";
      }

      fetch(fallbackPath)
        .then((response) => response.text())
        .then((svg) => {
          toolContainer.innerHTML = svg;
          const svgElement = toolContainer.querySelector("svg");
          if (svgElement) {
            svgElement.classList.add(toolType);
          }
        })
        .catch((err) =>
          console.error(`Error loading fallback ${toolType}:`, err)
        );
    });
}

// Modify the existing updatePlayerTool function to update both game state and visuals
export function updatePlayerTool(toolType) {
  // Update the visuals
  updateToolVisuals(toolType);

  // Get the currently equipped tool ID to send to other players
  const currentToolId = gameState.crafting.equippedTools[toolType];

  // Send tool change to server for multiplayer sync
  sendToolChanged(currentToolId);

  // If switching to drill or laser, set up rotation handling
  if (toolType === "drill" || toolType === "laser") {
    // Initialize rotation to 0 degrees
    gameState.player.toolRotation = 0;

    // Update rotation immediately
    updateToolRotation();
  } else {
    // For other tools, reset the transformation
    const svgElement = playerElement.querySelector("svg");
    if (svgElement) {
      if (gameState.player.direction === -1) {
        svgElement.style.transform = "scaleX(-1)";
      } else {
        svgElement.style.transform = "";
      }
    }
  }
}

export function updateToolRotation() {
  const currentTool = getCurrentTool();
  if (
    currentTool &&
    (currentTool.type === "drill" || currentTool.type === "laser")
  ) {
    const svgElement = playerElement.querySelector("svg");
    if (svgElement) {
      // Get player center position (in screen coordinates)
      const playerCenterX =
        gameState.player.x + gameState.player.width / 2 - gameState.camera.x;
      const playerCenterY =
        gameState.player.y + gameState.player.height / 2 - gameState.camera.y;

      // Calculate angle from player to mouse position
      const angle = Math.atan2(
        gameState.mouseY - playerCenterY,
        gameState.mouseX - playerCenterX
      );

      // Convert angle to degrees
      let degrees = (angle * 180) / Math.PI;
      let scale = 1.5;

      if (currentTool.type === "laser") {
        // For laser, always add 180° so that its tip points away from the player,
        // and ignore the player's direction flipping.
        degrees += 180;
        scale = 2.5;
      }

      // For the drill, use the existing logic that accounts for player direction.
      gameState.player.toolRotation = degrees;

      // Rest of function remains the same...
      svgElement.style.setProperty("--rotation", `${degrees}deg`);

      if (gameState.player.direction === -1) {
        if (svgElement.classList.contains("drilling")) {
          svgElement.classList.add("flipped");
        } else {
          svgElement.style.transform = `scaleX(-${scale}) scaleY(${scale}) rotate(${degrees}deg)`;
        }
      } else {
        svgElement.classList.remove("flipped");
        if (!svgElement.classList.contains("drilling")) {
          svgElement.style.transform = `scaleX(${scale}) scaleY(${scale}) rotate(${degrees}deg)`;
        }
      }

      // NEW: Send tool rotation update to server
      // Send this for all tools (drill and laser), not just when laser is active
      sendToolRotationUpdate();
    }
  }
}

export function checkBagCapacity() {
  if (getInventoryCount() >= gameState.bagSize) {
    // Stop all mining activities
    if (!miningSound.paused) {
      miningSound.pause();
      miningSound.currentTime = 0;
    }

    // Make sure to stop the drill sound when bag is full
    if (!drillSound.paused) {
      drillSound.pause();
      drillSound.currentTime = 0;
    }

    // Deactivate laser if it's active
    if (isLaserActive()) {
      deactivateLaser();
    }

    // Clear mining state
    gameState.pickaxeMiningActive = false;
    gameState.miningTarget = null;
    gameState.laserMiningTarget = null;
    gameState.mineTimer = 0;
    gameState.mineCooldown = 0;
    gameState.miningLocked = false;
    clearCrackingAnimations();
    hideBlockHighlight();

    // Stop all mining animations properly
    stopAllMiningAnimations();

    // Check if we already showed the message or if the animation is still running
    if (!gameState.fullInventoryMessageShown) {
      // Flash the bag capacity indicator
      const bagElement = document.getElementById("bag-capacity");
      bagElement.classList.add("bag-flash");
      showMessage("Your bag is full! Visit the shop to sell items.", 1500);

      // Set this flag to prevent repeated flashing until animation completes
      gameState.fullInventoryMessageShown = true;

      // Remove the flash class after animation completes AND reset the flag
      // to allow flashing again after a short delay
      setTimeout(() => {
        bagElement.classList.remove("bag-flash");

        // Allow the bag to flash again after a cooldown period
        setTimeout(() => {
          gameState.fullInventoryMessageShown = false;
        }, 1000); // 2-second cooldown before allowing another flash
      }, 1000);
    }

    return true; // Bag is full
  }

  // Reset the flag when bag is not full
  gameState.fullInventoryMessageShown = false;

  return false; // Bag has space
}

export function stopAllMiningAnimations() {
  // Get the SVG element from the player
  const svgElement = playerElement.querySelector("svg");
  if (svgElement) {
    // Remove animation-related classes
    svgElement.classList.remove("mining");
    svgElement.classList.remove("drilling");
    svgElement.classList.remove("flipped");

    // Determine tool type
    const currentTool = getCurrentTool();
    const isDrill = currentTool && currentTool.type === "drill";
    const isLaser = currentTool && currentTool.type === "laser";

    // Make sure to stop drill sound when animations are stopped
    if (isDrill && !drillSound.paused) {
      drillSound.pause();
      drillSound.currentTime = 0;
    }

    // Send mining stop event for multiplayer sync
    sendMiningStop();
  }
}

export function syncMiningActivity() {
  // If we're mining and have a target, send a start event
  if (gameState.pickaxeMiningActive && gameState.miningTarget) {
    sendMiningStart(
      gameState.miningTarget.x,
      gameState.miningTarget.y,
      gameState.crafting.currentToolType
    );
  }
  // If we're not mining anymore, send a stop event
  else if (!gameState.pickaxeMiningActive && gameState.mouseHeld === false) {
    sendMiningStop();
  }
}
