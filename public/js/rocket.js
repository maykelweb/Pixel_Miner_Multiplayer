// rocket.js

import { gameState } from "./config.js";
import {
  showMessage,
  rocketLaunch,
  playSFX,
  ORIGINAL_VOLUMES,
  isPlayerNearRocket,
} from "./setup.js";
import { generateWorld, transitionToEarth } from "./worldGeneration.js";
import { generateMoonWorld } from "./moonGeneration.js";
import { updateUI } from "./updates.js";
import {
  sendRocketLaunched,
  refreshPlayerVisibility,
  requestPlayersOnCurrentPlanet,
  sendPlayerUpdate,
  sendPlanetChanged,
} from "./multiplayer.js";

// Create rocket element
let rocketElement = null;

// Create a rocket interaction modal
let rocketModal = null;

// Global reference to the key press event handler so we can remove it
let rocketKeyPressHandler = null;

// Global reference to the modal key press handler
let modalKeyPressHandler = null;

// Track if player is in rocket interaction range
let playerInRocketRange = false;

// Add flag to track if rocket launch animation is in progress
let rocketLaunchInProgress = false;
let rocketLandingInProgress = false;

// Track if player is in rocket (for preventing movement)
export let playerInRocket = false;

export function initializeRocket() {
  // Create rocket element if it doesn't exist
  if (!rocketElement) {
    rocketElement = document.createElement("div");
    rocketElement.id = "rocket";
    rocketElement.className = "rocket";
    rocketElement.style.width = `${gameState.rocket.width}px`;
    rocketElement.style.height = `${gameState.rocket.height}px`;
    rocketElement.style.position = "absolute"; // Ensure absolute positioning
    document.getElementById("game-world").appendChild(rocketElement);

    // Immediately hide the rocket if the player doesn't have one or it's not placed
    if (!gameState.hasRocket || !gameState.rocketPlaced) {
      rocketElement.style.display = "none";
    }
  } else {
    // Also update visibility for existing rocket element
    if (!gameState.hasRocket || !gameState.rocketPlaced) {
      rocketElement.style.display = "none";
    } else {
      rocketElement.style.display = "block";
    }
  }

  // Create rocket modal if it doesn't exist
  if (!rocketModal) {
    rocketModal = document.createElement("div");
    rocketModal.id = "rocket-modal";
    rocketModal.className = "modal";
    rocketModal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h2>Space Travel</h2>
          <span class="modal-close" id="rocket-modal-close">&times;</span>
        </div>
        <div class="modal-body">
          <div id="rocket-destination-earth" class="destination-option${
            gameState.currentPlanet === "moon" ? " active" : " inactive"
          }">
            <div class="destination-icon earth"></div>
            <div class="destination-info">
              <h3>Return to Earth</h3>
              <p>Return to your home planet with familiar ores and terrain.</p>
            </div>
          </div>
          <div id="rocket-destination-moon" class="destination-option${
            gameState.currentPlanet === "earth" ? " active" : " inactive"
          }">
            <div class="destination-icon moon"></div>
            <div class="destination-info">
              <h3>Travel to Moon</h3>
              <p>Explore the lunar surface and mine rare ores like Lunarite.</p>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button id="rocket-travel-button">Launch Rocket</button>
        </div>
      </div>
    `;
    document.body.appendChild(rocketModal);

    // Add event listeners
    document
      .getElementById("rocket-modal-close")
      .addEventListener("click", closeRocketModal);
    document
      .getElementById("rocket-destination-earth")
      .addEventListener("click", () => selectDestination("earth"));
    document
      .getElementById("rocket-destination-moon")
      .addEventListener("click", () => selectDestination("moon"));
    document
      .getElementById("rocket-travel-button")
      .addEventListener("click", launchRocket);
  }

  // Make sure checkRocketInteraction doesn't run if player doesn't have a rocket
  if (!gameState.hasRocket || !gameState.rocketPlaced) {
    removeRocketKeyListener();
    const hint = document.getElementById("rocket-interaction-hint");
    if (hint) hint.remove();
  }
}

// Update rocket position based on camera
export function updateRocketPosition() {
  if (rocketLandingInProgress) {
    if (rocketElement) rocketElement.style.display = "none";
  }

  // Skip updating if launch animation is in progress
  if (rocketLaunchInProgress) return;

  if (!gameState.hasRocket || !gameState.rocketPlaced) {
    if (rocketElement) rocketElement.style.display = "none";
    return;
  }

  // Make the rocket visible on both planets - removed Earth-only check
  const camera = gameState.camera;
  const rocketScreenX = gameState.rocket.x - camera.x;
  const rocketScreenY = gameState.rocket.y - camera.y;

  // Check if rocket is on screen
  if (
    rocketScreenX > -gameState.rocket.width &&
    rocketScreenX < window.innerWidth &&
    rocketScreenY > -gameState.rocket.height &&
    rocketScreenY < window.innerHeight
  ) {
    rocketElement.style.display = "block";
    rocketElement.style.left = `${rocketScreenX}px`;
    rocketElement.style.top = `${rocketScreenY}px`;
  } else {
    rocketElement.style.display = "none";
  }
}

// Check if player is near the rocket for interaction
export function checkRocketInteraction() {
  // Early return if player doesn't have a rocket or it's not placed
  if (!gameState.hasRocket || !gameState.rocketPlaced) {
    // Make sure any lingering UI elements are removed
    removeRocketKeyListener();
    const hint = document.getElementById("rocket-interaction-hint");
    if (hint) hint.remove();
    return false;
  }

  // Use the imported function to determine if player is in range
  playerInRocketRange = isPlayerNearRocket();

  // If player is within interaction range
  if (playerInRocketRange) {
    // Show interaction hint if not already showing
    if (!document.getElementById("rocket-interaction-hint")) {
      const hint = document.createElement("div");
      hint.id = "rocket-interaction-hint";
      hint.className = "interaction-hint";
      hint.textContent = "Press E to use rocket";
      hint.style.position = "absolute";
      hint.style.left = `${window.innerWidth / 2 - 75}px`;
      hint.style.top = "20px";
      hint.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
      hint.style.color = "white";
      hint.style.padding = "10px";
      hint.style.borderRadius = "5px";
      hint.style.zIndex = "1000";
      document.body.appendChild(hint);
    }

    // Create event handler if it doesn't exist
    if (!rocketKeyPressHandler) {
      rocketKeyPressHandler = (e) => {
        if (e.key === "e" || e.key === "E") {
          // If modal is open, close it, otherwise open it
          if (rocketModal && rocketModal.style.display === "flex") {
            closeRocketModal();
          } else {
            openRocketModal();
          }
        }
      };

      // Add the event listener
      document.addEventListener("keydown", rocketKeyPressHandler);
    }

    return true;
  } else {
    // Remove interaction hint if it exists
    const hint = document.getElementById("rocket-interaction-hint");
    if (hint) hint.remove();

    // Remove the event listener if player moves out of range
    removeRocketKeyListener();

    // If player just moved out of range AND modal is open, close it
    if (rocketModal && rocketModal.style.display === "flex") {
      closeRocketModal();
    }

    return false;
  }
}

// Remove key press event listener when not near rocket
function removeRocketKeyListener() {
  if (rocketKeyPressHandler) {
    document.removeEventListener("keydown", rocketKeyPressHandler);
    rocketKeyPressHandler = null;
  }
}

// Open the rocket modal
function openRocketModal() {
  if (!rocketModal) return;

  // Update destination options based on current planet
  document.getElementById(
    "rocket-destination-earth"
  ).className = `destination-option${
    gameState.currentPlanet === "moon" ? " active" : " inactive"
  }`;
  document.getElementById(
    "rocket-destination-moon"
  ).className = `destination-option${
    gameState.currentPlanet === "earth" ? " active" : " inactive"
  }`;

  // Set the default selected destination to the opposite of current planet
  selectedDestination = gameState.currentPlanet === "earth" ? "moon" : "earth";

  rocketModal.style.display = "flex";

  // Add modal-specific key listener for ESC key
  if (!modalKeyPressHandler) {
    modalKeyPressHandler = (e) => {
      if (e.key === "Escape" || e.key === "e" || e.key === "E") {
        closeRocketModal();
      }
    };

    document.addEventListener("keydown", modalKeyPressHandler);
  }
}

// Close the rocket modal
function closeRocketModal() {
  if (!rocketModal) return;
  rocketModal.style.display = "none";

  // Remove the modal-specific key press listener
  if (modalKeyPressHandler) {
    document.removeEventListener("keydown", modalKeyPressHandler);
    modalKeyPressHandler = null;
  }

  // The rocket key press listener will be added back if player is still in range
  // in the next game tick by the checkRocketInteraction function
}

// Handle destination selection
let selectedDestination = null;
function selectDestination(destination) {
  // Only allow selection if it's not the current planet
  if (destination === gameState.currentPlanet) return;

  selectedDestination = destination;

  // Update UI to show selection
  document.getElementById(
    "rocket-destination-earth"
  ).className = `destination-option${
    destination === "earth" ? " selected" : " inactive"
  }`;
  document.getElementById(
    "rocket-destination-moon"
  ).className = `destination-option${
    destination === "moon" ? " selected" : " inactive"
  }`;
}

// Launch the rocket to selected destination
function launchRocket() {
  if (!selectedDestination || selectedDestination === gameState.currentPlanet) {
    showMessage("Please select a valid destination", 2000);
    return;
  }

  // Close the modal
  closeRocketModal();

  // Set flag to prevent multiplayer.js from handling the planet transition
  gameState.skipMultiplayerTransition = true;

  // Set the flag to prevent player movement
  playerInRocket = true;

  // IMPORTANT: Add a visual transition flag
  gameState.inRocketTransition = true;

  // Store destination planet but DON'T change currentPlanet yet
  const targetPlanet = selectedDestination;

  // Hide the player character during rocket launch
  const playerElement = document.getElementById("player");
  if (playerElement) {
    playerElement.style.display = "none";
  }

  // Play launch sound
  playSFX(rocketLaunch, ORIGINAL_VOLUMES.rocketLaunch, false);

  // Create launch animation effect
  createLaunchAnimation();

  // Get current planet for reference later
  const currentPlanet = gameState.currentPlanet;

  // IMPORTANT: We need to send the multiplayer event, but we DON'T actually
  // want to change the local gameState.currentPlanet until the animation finishes
  // This is for any connected players to see us leave

  // Now send the rocket launched message with our new destination
  // We're passing the target planet, but NOT changing our local state yet
  sendRocketLaunched(targetPlanet);

  // Transition to new planet after delay
  setTimeout(() => {
    // NOW we can change the planet state after the animation has mostly completed
    gameState.currentPlanet = targetPlanet;

    // Send a planet changed message as a backup notification
    sendPlanetChanged(targetPlanet);

    // Now call the transition function with the new planet
    transitionToPlanet(targetPlanet);

    // Make sure player is visible again after transition
    if (playerElement) {
      playerElement.style.display = "block";
    }

    // Reset the flags after transition is complete
    gameState.skipMultiplayerTransition = false;
    gameState.inRocketTransition = false;
  }, 3000);
}

// Create visual effect for rocket launch
function createLaunchAnimation() {
  // Set flag to prevent position updates during animation
  rocketLaunchInProgress = true;

  // Get rocket position for starting animation
  const rocketScreenX = rocketElement.offsetLeft;
  const rocketScreenY = rocketElement.offsetTop;
  const rocketWidth = rocketElement.offsetWidth;
  const rocketHeight = rocketElement.offsetHeight;

  // Save original rocket element styles to restore later
  const originalRocketStyles = {
    position: rocketElement.style.position,
    left: rocketElement.style.left,
    top: rocketElement.style.top,
    zIndex: rocketElement.style.zIndex,
    transition: rocketElement.style.transition,
    transform: rocketElement.style.transform,
    display: rocketElement.style.display,
    parent: rocketElement.parentNode,
  };

  // Create a fullscreen overlay for the transition
  const overlay = document.createElement("div");
  overlay.id = "rocket-transition-overlay";
  overlay.style.position = "fixed";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
  overlay.style.opacity = "0";
  overlay.style.zIndex = "1000";
  overlay.style.transition = "opacity 1s, background-color 0.5s";
  document.body.appendChild(overlay);

  // Add CSS for animations
  const styleElement = document.createElement("style");
  styleElement.id = "rocket-animation-styles";
  document.head.appendChild(styleElement);

  // Create and attach all animation elements
  const elements = {
    stars: [],
    flameElement: null,
  };

  // IMPORTANT: Define rocketContainer at this scope level so it's available to all timeouts
  let rocketContainer = null;

  // Fade in overlay slightly
  setTimeout(() => {
    overlay.style.opacity = "1";

    // Create a container to keep rocket and flame together
    rocketContainer = document.createElement("div");
    rocketContainer.id = "rocket-animation-container";
    rocketContainer.style.position = "fixed";
    rocketContainer.style.left = `${rocketScreenX}px`;
    rocketContainer.style.top = `${rocketScreenY}px`;
    rocketContainer.style.width = `${rocketWidth}px`;
    rocketContainer.style.height = `${rocketHeight}px`;
    rocketContainer.style.zIndex = "1001";
    rocketContainer.style.transition =
      "top 2.5s cubic-bezier(0.2, 0.8, 0.2, 1), transform 2.5s";
    document.body.appendChild(rocketContainer);

    // Modify original rocket for animation
    rocketContainer.appendChild(rocketElement);
    rocketElement.style.position = "absolute";
    rocketElement.style.left = "0";
    rocketElement.style.top = "0";
    rocketElement.style.zIndex = "1001";

    // Create flame element
    const flameElement = document.createElement("div");
    flameElement.id = "rocket-flame";

    // Create inner flame for animation
    const flameInner = document.createElement("div");
    flameInner.className = "flame-inner";
    flameElement.appendChild(flameInner);

    // Add flame to rocket container
    rocketContainer.appendChild(flameElement);
    elements.flameElement = flameElement;

    // Add stars for space effect
    for (let i = 0; i < 50; i++) {
      const star = document.createElement("div");
      star.className = "space-star";
      star.style.width = `${Math.random() * 3 + 1}px`;
      star.style.height = star.style.width;
      star.style.left = `${Math.random() * window.innerWidth}px`;
      star.style.top = `${Math.random() * window.innerHeight * 0.7}px`;
      overlay.appendChild(star);
      elements.stars.push(star);

      // Fade in stars with slight delay
      setTimeout(() => {
        star.style.opacity = Math.random() * 0.5 + 0.5;
      }, 1000 + Math.random() * 1000);
    }

    // Start the rocket animation after a short delay
    setTimeout(() => {
      // Make the stars twinkle
      elements.stars.forEach((star) => {
        star.style.animation = `twinkle ${Math.random() * 3 + 2}s infinite`;
      });

      // Calculate the top position for rocket to move up and off screen
      const windowHeight = window.innerHeight;
      const rocketTargetY = -rocketHeight; // Move above the top of screen

      // Now we only need to animate the container
      const transformValue =
        "translateY(-" + windowHeight * 0.7 + "px) scale(0.5)";
      rocketContainer.style.transform = transformValue;
      rocketContainer.style.top = `${rocketTargetY}px`;
    }, 500);

    // Fade to black for planet transition
    setTimeout(() => {
      overlay.style.backgroundColor = "black";

      // Hide the animation elements
      setTimeout(() => {
        if (rocketContainer) {
          rocketContainer.style.display = "none";
        }

        elements.stars.forEach((star) => {
          star.style.display = "none";
        });
      }, 500);
    }, 2500);
  }, 100);

  // Reset the rocket element to its original state after planet transition
  setTimeout(() => {
    // Get the rocket back from the container
    if (
      rocketContainer &&
      rocketElement &&
      rocketElement.parentNode === rocketContainer
    ) {
      // Remove from container first
      rocketContainer.removeChild(rocketElement);
    }

    // Return rocket to its original container
    const gameWorld = document.getElementById("game-world");

    if (gameWorld) {
      gameWorld.appendChild(rocketElement);
    } else if (originalRocketStyles.parent) {
      // Fallback to original parent if game-world doesn't exist
      originalRocketStyles.parent.appendChild(rocketElement);
    } else {
      console.warn("Could not find original rocket container!");
    }

    // Restore original styles
    rocketElement.style.position = originalRocketStyles.position;
    rocketElement.style.left = originalRocketStyles.left;
    rocketElement.style.top = originalRocketStyles.top;
    rocketElement.style.zIndex = originalRocketStyles.zIndex;
    rocketElement.style.transition = originalRocketStyles.transition;
    rocketElement.style.transform = originalRocketStyles.transform;
    rocketElement.style.display = originalRocketStyles.display || "block";

    // Reset the launch flag
    rocketLaunchInProgress = false;

    // Clean up
    setTimeout(() => {
      if (overlay && overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }

      if (styleElement && styleElement.parentNode) {
        styleElement.parentNode.removeChild(styleElement);
      }

      if (rocketContainer && rocketContainer.parentNode) {
        rocketContainer.parentNode.removeChild(rocketContainer);
      }
    }, 1000); // Give a second for any fade-out animations
  }, 3000);
}

// Create visual effect for rocket landing
function createLandingAnimation() {
  // Set flag to prevent position updates during animation
  rocketLaunchInProgress = true;
  rocketLandingInProgress = true;

  // Force player to be hidden and stay hidden throughout the entire animation
  const playerElement = document.getElementById("player");
  if (playerElement) {
    playerElement.style.display = "none";
  }

  // Immediately position player at the rocket center (even though invisible)
  const rocketCenterX = gameState.rocket.x + gameState.rocket.width / 2;
  const rocketCenterY = gameState.rocket.y + gameState.rocket.height / 2;
  const playerHalfWidth = gameState.player.width / 2;
  const playerHalfHeight = gameState.player.height / 2;

  // Set player position immediately
  gameState.player.x = rocketCenterX - playerHalfWidth;
  gameState.player.y = rocketCenterY - playerHalfHeight;

  // Set camera position immediately
  gameState.camera.x =
    gameState.player.x + playerHalfWidth - window.innerWidth / 2;
  gameState.camera.y =
    gameState.player.y + playerHalfHeight - window.innerHeight / 2;

  // Get rocket position for landing animation
  const rocketWidth = gameState.rocket.width;
  const rocketHeight = gameState.rocket.height;
  const rocketX = gameState.rocket.x - gameState.camera.x; // Use the updated camera position
  const rocketY = gameState.rocket.y - gameState.camera.y; // Use the updated camera position

  // Create a fullscreen overlay for the transition
  const overlay = document.createElement("div");
  overlay.id = "rocket-transition-overlay";
  overlay.style.position = "fixed";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.backgroundColor = "black";
  overlay.style.opacity = "1";
  overlay.style.zIndex = "1000";
  overlay.style.transition = "opacity 1s, background-color 0.5s";
  document.body.appendChild(overlay);

  // Add CSS for animations
  const styleElement = document.createElement("style");
  styleElement.id = "rocket-animation-styles";
  document.head.appendChild(styleElement);

  // Create and attach all animation elements
  const elements = {
    stars: [],
    flameElement: null,
  };

  // Define rocketContainer at this scope level so it's available to all timeouts
  let rocketContainer = null;

  // Start the landing sequence after a short delay
  setTimeout(() => {
    // First, send a player update with the new position
    sendPlayerUpdate();

    // Fade in overlay to space scene
    overlay.style.backgroundColor = "rgba(0, 0, 0, 0.5)";

    // Add stars for space effect
    for (let i = 0; i < 50; i++) {
      const star = document.createElement("div");
      star.className = "space-star";
      star.style.width = `${Math.random() * 3 + 1}px`;
      star.style.height = star.style.width;
      star.style.left = `${Math.random() * window.innerWidth}px`;
      star.style.top = `${Math.random() * window.innerHeight * 0.7}px`;
      star.style.opacity = Math.random() * 0.5 + 0.5;
      star.style.animation = `twinkle ${Math.random() * 3 + 2}s infinite`;
      overlay.appendChild(star);
      elements.stars.push(star);
    }

    // Create a container to keep rocket and flame together
    rocketContainer = document.createElement("div");
    rocketContainer.id = "rocket-animation-container";
    rocketContainer.style.position = "fixed";
    rocketContainer.style.left = `${rocketX}px`;
    rocketContainer.style.top = `${-rocketHeight}px`; // Start above the screen
    rocketContainer.style.width = `${rocketWidth}px`;
    rocketContainer.style.height = `${rocketHeight}px`;
    rocketContainer.style.zIndex = "1001";
    rocketContainer.style.transition =
      "top 2.5s cubic-bezier(0.2, 0.8, 0.2, 1), transform 2.5s";
    rocketContainer.style.transform = "scale(0.5)"; // Start smaller
    document.body.appendChild(rocketContainer);

    // Create temporary rocket element for animation
    const tempRocket = document.createElement("div");
    tempRocket.className = "rocket";
    tempRocket.style.width = "100%";
    tempRocket.style.height = "100%";
    tempRocket.style.position = "absolute";
    tempRocket.style.left = "0";
    tempRocket.style.top = "0";
    rocketContainer.appendChild(tempRocket);

    // Create flame element
    const flameElement = document.createElement("div");
    flameElement.id = "rocket-flame";

    // Create inner flame for animation
    const flameInner = document.createElement("div");
    flameInner.className = "flame-inner";
    flameElement.appendChild(flameInner);

    // Add flame to rocket container
    rocketContainer.appendChild(flameElement);
    elements.flameElement = flameElement;

    // Double-check that player is still hidden
    if (playerElement) {
      playerElement.style.display = "none";
    }

    // Start the rocket landing animation after a short delay
    setTimeout(() => {
      // Animate rocket coming down
      rocketContainer.style.transform = "scale(1)";
      rocketContainer.style.top = `${rocketY}px`;

      // Play the rocket sound
      playSFX(rocketLaunch, ORIGINAL_VOLUMES.rocketLaunch, false);

      // Triple-check that player is still hidden
      if (playerElement) {
        playerElement.style.display = "none";
      }

      // Send another player update with the latest position
      sendPlayerUpdate();
    }, 500);

    // Complete the landing sequence
    setTimeout(() => {
      // Fade out stars and overlay
      elements.stars.forEach((star) => {
        star.style.opacity = "0";
      });

      overlay.style.opacity = "0";

      // Verify player position again
      gameState.player.x = rocketCenterX - playerHalfWidth;
      gameState.player.y = rocketCenterY - playerHalfHeight;

      // Verify camera position again
      gameState.camera.x =
        gameState.player.x + playerHalfWidth - window.innerWidth / 2;
      gameState.camera.y =
        gameState.player.y + playerHalfHeight - window.innerHeight / 2;

      // Send another player update to ensure server has our position
      sendPlayerUpdate();

      // Clean up and finalize
      setTimeout(() => {
        if (overlay && overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }

        if (styleElement && styleElement.parentNode) {
          styleElement.parentNode.removeChild(styleElement);
        }

        if (rocketContainer && rocketContainer.parentNode) {
          rocketContainer.parentNode.removeChild(rocketContainer);
        }

        // One final check of player position before revealing
        gameState.player.x = rocketCenterX - playerHalfWidth;
        gameState.player.y = rocketCenterY - playerHalfHeight;

        // One final camera update
        gameState.camera.x =
          gameState.player.x + playerHalfWidth - window.innerWidth / 2;
        gameState.camera.y =
          gameState.player.y + playerHalfHeight - window.innerHeight / 2;

        // Clear the planet transition flag
        gameState.inPlanetTransition = false;

        // Final update to UI elements
        updateUI();

        // Final player position update to server
        sendPlayerUpdate();

        requestPlayersOnCurrentPlanet();

        if (playerElement) {
          playerElement.style.display = "block";
        }

        // Allow player to move again
        playerInRocket = false;

        // Reset the animation flag
        rocketLaunchInProgress = false;
        rocketLandingInProgress = false;

        ensureRocketVisible(gameState.currentPlanet);

        // Final announcements and visibility refresh
        refreshPlayerVisibility();
      }, 1000);
    }, 3000);
  }, 500);
}

// Also update the transitionToPlanet function to ensure player is hidden early
function transitionToPlanet(destination) {
  // IMMEDIATELY make the player invisible at the very start
  const playerElement = document.getElementById("player");
  if (playerElement) {
    playerElement.style.display = "none";
  }

  // Save the current blockmap based on the destination
  if (destination === "moon") {
    // We're leaving Earth, save Earth map
    if (gameState.blockMap && gameState.blockMap.length > 0) {
      console.log("Saving Earth map before going to moon");
      gameState.earthBlockMap = JSON.parse(JSON.stringify(gameState.blockMap));
    }
  } else if (destination === "earth") {
    // We're leaving Moon, save Moon map
    if (gameState.blockMap && gameState.blockMap.length > 0) {
      console.log("Saving Moon map before returning to Earth");
      gameState.moonBlockMap = JSON.parse(JSON.stringify(gameState.blockMap));
    }
  }

  // Update game state
  gameState.currentPlanet = destination;

  // Generate the appropriate world - this already places the rocket
  if (destination === "earth") {
    generateWorld();
    transitionToEarth();
    gameState.gravity = 0.5; // Standard gravity on Earth
  } else if (destination === "moon") {
    generateMoonWorld();
    gameState.gravity = 0.3; // Lower gravity on the Moon
  }

  // Position the rocket but keep everything hidden until landing animation completes
  // Make sure rocket element exists but is hidden
  if (rocketElement) {
    rocketElement.style.display = "none";
  }

  // Double-check player is hidden
  if (playerElement) {
    playerElement.style.display = "none";
  }

  // Start the landing animation
  createLandingAnimation();
}

// New helper function to ensure rocket is immediately visible
function ensureRocketVisible(destination) {
  // Make sure rocket is initialized and visible
  gameState.hasRocket = true;
  gameState.rocketPlaced = true;

  // Force immediate visibility of rocket element
  if (rocketElement) {
    rocketElement.style.display = "block";

    // Immediately update rocket position on screen
    const camera = gameState.camera;
    const rocketScreenX = gameState.rocket.x - camera.x;
    const rocketScreenY = gameState.rocket.y - camera.y;

    rocketElement.style.left = `${rocketScreenX}px`;
    rocketElement.style.top = `${rocketScreenY}px`;
  }
}
