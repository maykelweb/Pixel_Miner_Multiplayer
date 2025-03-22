// bombs.js
import { gameState } from "./config.js";
import { takeDamage, getInventoryCount } from "./player.js";
import { updateVisibleBlocks } from "./updates.js";
import { throwBombSound, explosionSound, ORIGINAL_VOLUMES, playSFX } from "./setup.js";

// Place a bomb at the player's position
export function placeBomb() {
  if (gameState.bombs <= 0) return;

  // Get player center position
  const playerCenterX = gameState.player.x + gameState.player.width / 2;
  const playerCenterY = gameState.player.y + gameState.player.height / 2;

  // Calculate grid position for bomb
  const bombX = Math.floor(playerCenterX / gameState.blockSize);
  const bombY = Math.floor(playerCenterY / gameState.blockSize);

  // Create bomb element
  const bombElement = document.createElement("div");
  bombElement.className = "bomb";
  bombElement.style.left = playerCenterX + "px";
  bombElement.style.top = playerCenterY + "px";

  // Add rolling animation class
  bombElement.classList.add("bomb-rolling");

  // Add bomb to game world
  document.getElementById("game-world").appendChild(bombElement);

  // Add throw sound
  playSFX(throwBombSound, ORIGINAL_VOLUMES.throwBombSound, false);

  // Determine base bomb throw velocity
  const initialXSpeed = 4; // throw force sideways
  const initialYSpeed = -7; // throw force up (negative for upward movement)
  let bombVelocityX = gameState.player.direction * initialXSpeed;
  let bombVelocityY = initialYSpeed;

  // Incorporate player's current horizontal velocity into bomb throw
  bombVelocityX += gameState.player.velocityX * 0.2;
  // Only add player's vertical velocity if they're moving upward (to avoid cancellation when falling)
  if (gameState.player.velocityY < 0) {
    bombVelocityY += gameState.player.velocityY * 0.2;
  }

  // Add bomb to active bombs array with physics properties
  gameState.activeBombs.push({
    x: playerCenterX / gameState.blockSize, // Stored as floating point for smooth movement
    y: playerCenterY / gameState.blockSize,
    element: bombElement,
    timeLeft: gameState.bombTimer,
    velocityX: bombVelocityX,
    velocityY: bombVelocityY,
    rotation: 0,
    gridX: bombX, // Final grid position after rolling
    gridY: bombY,
  });

  // Decrement bomb count and update UI/message as needed
  gameState.bombs--;

  // Update UI
  const bombDisplay = document.getElementById("bomb-display");
  if (bombDisplay) {
    bombDisplay.innerHTML = `<span class="bomb-icon">💣</span> ${gameState.bombs}/${gameState.maxBombs}`;
  }
}

/**
 * Helper function to create (or restore) a bomb DOM element.
 * This is used when the bomb element is missing (e.g., after reloading a saved game).
 */
function restoreBombElement(bomb) {
  const bombElement = document.createElement("div");
  bombElement.className = "bomb";
  bombElement.style.width = "20px";
  bombElement.style.height = "20px";
  bombElement.classList.add("bomb-rolling");
  bombElement.style.left = bomb.x * gameState.blockSize + "px";
  bombElement.style.top = bomb.y * gameState.blockSize + "px";
  return bombElement;
}

function isValidElement(el) {
  // Check if el is a DOM element (HTMLElement) and has a classList property.
  return el instanceof HTMLElement && el.classList && typeof el.classList.contains === "function";
}

export function updateBombs(deltaTime) {
  // Adjusted constants for more natural physics
  // groundFriction is now the multiplier applied each step when the bomb is on the ground.
  // A low value (like 0.01) will nearly zero out the velocity if truly on the ground.
  const groundFriction = 0.97;
  const airResistance = 0.995;
  const gravity = gameState.gravity * 48;
  const bounceRestitution = 0.5;

  // Epsilon for detecting near-contact with a surface
  const frictionEpsilon = 0.05;

  for (let i = gameState.activeBombs.length - 1; i >= 0; i--) {
    const bomb = gameState.activeBombs[i];
    
    // If bomb.element is not valid, recreate it.
    if (!isValidElement(bomb.element)) {
      bomb.element = restoreBombElement(bomb);
      document.getElementById("game-world").appendChild(bomb.element);
    }

    bomb.width = 0.3;
    bomb.height = 0.3;

    // Update timer and visual pulse
    bomb.timeLeft -= deltaTime;
    const secondsLeft = Math.ceil(bomb.timeLeft / 1000);
    if (secondsLeft <= 1 && !bomb.element.classList.contains("pulse")) {
      bomb.element.classList.add("pulse");
    }

    // Apply gravity
    bomb.velocityY += gravity * (deltaTime / 1000);

    // Determine number of integration steps for smoother collision handling
    const maxVel = Math.max(Math.abs(bomb.velocityX), Math.abs(bomb.velocityY));
    const steps = Math.max(1, Math.ceil(maxVel * (deltaTime / 1000) * 2));
    const dtPerStep = deltaTime / steps;

    for (let step = 0; step < steps; step++) {
      // --- Horizontal (X) movement ---
      const xStep = bomb.velocityX * (dtPerStep / 1000);
      if (Math.abs(xStep) > 0.001) {
        const newX = bomb.x + xStep;
        // Check horizontal boundaries using the bomb’s bounding box
        if (newX < 0) {
          bomb.x = 0.001;
          bomb.velocityX *= -bounceRestitution;
        } else if (newX + bomb.width > gameState.worldWidth) {
          bomb.x = gameState.worldWidth - bomb.width - 0.001;
          bomb.velocityX *= -bounceRestitution;
        } else {
          // Determine which rows (y grid cells) the bomb spans
          const startY = Math.floor(bomb.y);
          const endY = Math.floor(bomb.y + bomb.height);
          let collision = false;
          if (bomb.velocityX > 0) {
            // Moving right: check the cells at the bomb’s right edge
            const cellX = Math.floor(newX + bomb.width);
            for (let gridY = startY; gridY <= endY; gridY++) {
              if (
                gameState.blockMap[gridY] &&
                gameState.blockMap[gridY][cellX]
              ) {
                collision = true;
                break;
              }
            }
            if (collision) {
              // Position the bomb just to the left of the block
              bomb.x = cellX - bomb.width - 0.001;
              bomb.velocityX *= -bounceRestitution;
            } else {
              bomb.x = newX;
            }
          } else if (bomb.velocityX < 0) {
            // Moving left: check the cells at the bomb’s left edge
            const cellX = Math.floor(newX);
            for (let gridY = startY; gridY <= endY; gridY++) {
              if (
                gameState.blockMap[gridY] &&
                gameState.blockMap[gridY][cellX]
              ) {
                collision = true;
                break;
              }
            }
            if (collision) {
              // Position the bomb just to the right of the block
              bomb.x = cellX + 1 + 0.001;
              bomb.velocityX *= -bounceRestitution;
            } else {
              bomb.x = newX;
            }
          }
        }
      }

      // --- Vertical (Y) movement ---
      const yStep = bomb.velocityY * (dtPerStep / 1000);
      if (Math.abs(yStep) > 0.001) {
        const newY = bomb.y + yStep;
        if (newY < 0) {
          bomb.y = 0.001;
          bomb.velocityY *= -bounceRestitution;
        } else if (newY + bomb.height > gameState.worldHeight) {
          bomb.y = gameState.worldHeight - bomb.height - 0.001;
          bomb.velocityY *= -bounceRestitution;
        } else {
          const startX = Math.floor(bomb.x);
          const endX = Math.floor(bomb.x + bomb.width);
          let collision = false;
          if (bomb.velocityY > 0) {
            // Moving downward: check the cells at the bomb’s bottom edge
            const cellY = Math.floor(newY + bomb.height);
            for (let gridX = startX; gridX <= endX; gridX++) {
              if (
                gameState.blockMap[cellY] &&
                gameState.blockMap[cellY][gridX]
              ) {
                collision = true;
                break;
              }
            }
            if (collision) {
              bomb.y = cellY - bomb.height - 0.001;
              bomb.velocityY *= -bounceRestitution;
              // Transfer some vertical energy to horizontal movement if conditions apply
              if (
                Math.abs(bomb.velocityX) < 3.0 &&
                Math.abs(bomb.velocityY) > 1.0
              ) {
                const direction =
                  Math.abs(bomb.velocityX) < 0.5
                    ? Math.random() > 0.5
                      ? 1
                      : -1
                    : Math.sign(bomb.velocityX);
                bomb.velocityX += direction * 0.5;
              }
              if (Math.abs(bomb.velocityY) < 1.0) {
                bomb.velocityY = 0;
              }
            } else {
              bomb.y = newY;
            }
          } else if (bomb.velocityY < 0) {
            // Moving upward: check the cells at the bomb’s top edge
            const cellY = Math.floor(newY);
            for (let gridX = startX; gridX <= endX; gridX++) {
              if (
                gameState.blockMap[cellY] &&
                gameState.blockMap[cellY][gridX]
              ) {
                collision = true;
                break;
              }
            }
            if (collision) {
              bomb.y = cellY + 1 + 0.001;
              bomb.velocityY *= -bounceRestitution;
            } else {
              bomb.y = newY;
            }
          }
        }
      }

      // --- Friction ---
      // Instead of checking an exact grid cell below the bomb, we check whether the bomb’s bottom is nearly aligned with a grid boundary.
      const bottomY = bomb.y + bomb.height;
      const gridBottomY = Math.round(bottomY); // nearest grid line
      let onSurface = false;
      if (Math.abs(bottomY - gridBottomY) < frictionEpsilon) {
        // Check each grid cell under the bomb
        for (
          let gridX = Math.floor(bomb.x);
          gridX <= Math.floor(bomb.x + bomb.width);
          gridX++
        ) {
          if (
            gridBottomY >= gameState.worldHeight ||
            (gameState.blockMap[gridBottomY] &&
              gameState.blockMap[gridBottomY][gridX])
          ) {
            onSurface = true;
            break;
          }
        }
      }
      if (onSurface) {
        bomb.velocityX *= groundFriction;
      } else {
        bomb.velocityX *= Math.pow(airResistance, 1 / steps);
      }
    }

    // Ensure bomb has the rolling animation when moving
    if (!bomb.element.classList.contains("bomb-rolling")) {
      bomb.element.classList.add("bomb-rolling");
    }

    // Update rotation based on movement (using dominant velocity component)
    const rotationSpeed =
      Math.abs(bomb.velocityX) > Math.abs(bomb.velocityY)
        ? bomb.velocityX
        : Math.sign(bomb.velocityX) * bomb.velocityY;
    bomb.rotation += rotationSpeed * 200 * (deltaTime / 1000);
    bomb.element.style.transform = `rotate(${bomb.rotation}deg)`;

    // Update visual position (convert grid coordinates to pixels)
    bomb.element.style.left = bomb.x * gameState.blockSize + "px";
    bomb.element.style.top = bomb.y * gameState.blockSize + "px";

    // Check for explosion
    if (bomb.timeLeft <= 0) {
      explodeBomb(bomb, i);
    }
  }
}

// Render bombs (adjusting position for camera)
export function renderBombs() {
  gameState.activeBombs.forEach((bomb) => {
    // Get the current position and rotation
    const rotation = bomb.rotation || 0;

    // Apply camera offset and rotation in a single transform
    bomb.element.style.transform = `translate(${-gameState.camera
      .x}px, ${-gameState.camera.y}px) rotate(${rotation}deg)`;
  });
}

// Explode a bomb
function explodeBomb(bomb, index) {
  // Play explosion sound
  playSFX(explosionSound, ORIGINAL_VOLUMES.explosionSound, false);

  // Get final grid position
  const bombGridX = Math.round(bomb.x);
  const bombGridY = Math.round(bomb.y);

  // Create explosion effect
  createExplosionEffect(bombGridX, bombGridY);

  // Damage blocks within radius
  const radius = gameState.bombRadius;
  for (let y = bombGridY - radius; y <= bombGridY + radius; y++) {
    for (let x = bombGridX - radius; x <= bombGridX + radius; x++) {
      // Skip if out of world bounds
      if (
        x < 0 ||
        x >= gameState.worldWidth ||
        y < 0 ||
        y >= gameState.worldHeight
      )
        continue;

      // Calculate distance from bomb center
      const distance = Math.sqrt(
        Math.pow(x - bombGridX, 2) + Math.pow(y - bombGridY, 2)
      );

      // Only destroy blocks within the radius
      if (distance <= radius) {
        const block = gameState.blockMap[y][x];
        if (block) {
          // Remove the block from the world
          gameState.blockMap[y][x] = null;
        }
      }
    }
  }

  // Check if player is within blast radius and apply damage
  const playerX = Math.floor(
    (gameState.player.x + gameState.player.width / 2) / gameState.blockSize
  );
  const playerY = Math.floor(
    (gameState.player.y + gameState.player.height / 2) / gameState.blockSize
  );
  const distanceToPlayer = Math.sqrt(
    Math.pow(playerX - bombGridX, 2) + Math.pow(playerY - bombGridY, 2)
  );

  if (distanceToPlayer <= radius * 1.5) {
    // Calculate damage based on proximity
    const damage = Math.floor(200 * (1 - distanceToPlayer / (radius * 1.5)));
    if (damage > 0) {
      takeDamage(damage);
    }
  }

  // Remove bomb element
  bomb.element.remove();

  // Remove bomb from active bombs array
  gameState.activeBombs.splice(index, 1);

  // Update visible blocks
  updateVisibleBlocks();
}

// Create explosion visual effect
function createExplosionEffect(x, y) {
  const explosion = document.createElement("div");
  explosion.className = "explosion";
  explosion.style.left =
    x * gameState.blockSize - gameState.blockSize * 1.5 + "px";
  explosion.style.top =
    y * gameState.blockSize - gameState.blockSize * 1.5 + "px";
  explosion.style.width = gameState.blockSize * 4 + "px";
  explosion.style.height = gameState.blockSize * 4 + "px";

  // Adjust for camera
  explosion.style.transform = `translate(${-gameState.camera.x}px, ${-gameState
    .camera.y}px)`;

  document.getElementById("game-world").appendChild(explosion);

  // Add to active explosions array
  if (!gameState.activeExplosions) {
    gameState.activeExplosions = [];
  }
  gameState.activeExplosions.push(explosion);

  // Remove after animation completes
  setTimeout(() => {
    explosion.remove();
    gameState.activeExplosions = gameState.activeExplosions.filter(
      (e) => e !== explosion
    );
  }, 1000);
}
