import { gameState } from "./config.js";
const moneyDisplay = document.getElementById("money");
const gameWorld = document.getElementById("game-world");

// Create a breaking animation when mining a block
export function createBreakingAnimation(x, y, blockType) {
  // Create animation container
  const animationElement = document.createElement("div");
  animationElement.className = "block-breaking-animation";
  
  // Store the world coordinates as data attributes
  animationElement.dataset.worldX = x;
  animationElement.dataset.worldY = y;

  // Ensure the element is absolutely positioned
  animationElement.style.position = "absolute";

  // Position the animation at the block's location
  updateAnimationPosition(animationElement);
  
  animationElement.style.width = `${gameState.blockSize}px`;
  animationElement.style.height = `${gameState.blockSize}px`;

  // Create particles inside the animation
  for (let i = 0; i < 8; i++) {
    const particle = document.createElement("div");
    particle.className = `block-particle ${blockType}`;

    // Random particle size between 4 and 10 pixels
    const size = 4 + Math.random() * 6;
    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;

    // Position within the block
    particle.style.left = `${Math.random() * 80}%`;
    particle.style.top = `${Math.random() * 80}%`;

    // Random velocity for each particle
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 3;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed - 4; // Initial upward boost

    // Apply animation
    particle.animate(
      [
        {
          transform: "translate(0, 0) rotate(0deg)",
          opacity: 1,
        },
        {
          transform: `translate(${vx * 15}px, ${vy * 15}px) rotate(${
            Math.random() * 360
          }deg)`,
          opacity: 0,
        },
      ],
      {
        duration: 500 + Math.random() * 500,
        easing: "cubic-bezier(0.1, 0.8, 0.2, 1)",
        fill: "forwards",
      }
    );

    animationElement.appendChild(particle);
  }

  // Add to game world
  gameWorld.appendChild(animationElement);

  // Remove after animation completes
  setTimeout(() => {
    if (animationElement.parentNode) {
      animationElement.parentNode.removeChild(animationElement);
    }
  }, 1000);
}

// Function to display cracking animation during mining
export function showCrackingAnimation(blockX, blockY, block, progress) {
  // Check if there's already a cracking animation on this block
  const existingCrackElement = document.querySelector(
    `.block-cracking[data-world-x="${blockX}"][data-world-y="${blockY}"]`
  );

  // If there is an existing element, update it, otherwise create new
  const crackElement = existingCrackElement || document.createElement("div");

  if (!existingCrackElement) {
    // Set up the new cracking element
    crackElement.className = "block-cracking";
    crackElement.dataset.worldX = blockX;
    crackElement.dataset.worldY = blockY;

    // Position the cracking overlay at the block's location
    crackElement.style.position = "absolute";
    updateCrackPosition(crackElement);
    
    crackElement.style.width = `${gameState.blockSize}px`;
    crackElement.style.height = `${gameState.blockSize}px`;
    crackElement.style.pointerEvents = "none"; // Make sure it doesn't interfere with interaction

    // Add to game world
    gameWorld.appendChild(crackElement);
  } else {
    // Update position based on camera
    updateCrackPosition(crackElement);
  }

  // Determine crack stage (1-4) based on progress
  const crackStage = Math.ceil(progress * 4);

  // Update the appearance based on the crack stage
  //crackElement.style.backgroundImage = `url('img/crack_${crackStage}.png')`; // USE WHEN HAVE BACKGROUND IMAGE
  crackElement.dataset.crack = crackStage;

  // Remove the element if we're done mining
  if (progress >= 1) {
    if (crackElement.parentNode) {
      crackElement.parentNode.removeChild(crackElement);
    }
  }

  return crackElement;
}

// Helper function to update crack animation position
function updateCrackPosition(crackElement) {
  const worldX = parseInt(crackElement.dataset.worldX);
  const worldY = parseInt(crackElement.dataset.worldY);
  
  crackElement.style.left = `${
    worldX * gameState.blockSize - gameState.camera.x
  }px`;
  crackElement.style.top = `${
    worldY * gameState.blockSize - gameState.camera.y
  }px`;
}

// Helper function to update breaking animation position
function updateAnimationPosition(animationElement) {
  const worldX = parseInt(animationElement.dataset.worldX);
  const worldY = parseInt(animationElement.dataset.worldY);
  
  animationElement.style.left = `${
    worldX * gameState.blockSize - gameState.camera.x
  }px`;
  animationElement.style.top = `${
    worldY * gameState.blockSize - gameState.camera.y
  }px`;
}

// Remove crack animation when mining is stopped
export function clearCrackingAnimations() {
  const crackElements = document.querySelectorAll(".block-cracking");
  crackElements.forEach((element) => {
    if (element.parentNode) {
      element.parentNode.removeChild(element);
    }
  });

  // Reset mining target
  gameState.miningTarget = null;
}

// Function to create a money gain animation
export function createMoneyAnimation(amount) {
  // Create the animation element
  const animation = document.createElement("div");
  animation.className = "money-gain-animation";
  animation.textContent = `+$${amount}`;

  // Style the animation
  animation.style.position = "absolute";
  animation.style.color = "#2ecc71";
  animation.style.fontWeight = "bold";
  animation.style.fontSize = "18px";
  animation.style.zIndex = "1000";
  animation.style.opacity = "0";
  animation.style.textShadow = "0 0 5px rgba(46, 204, 113, 0.7)";

  // Position near the money display
  const moneyDisplayRect = moneyDisplay.parentElement.getBoundingClientRect();
  animation.style.left = `${moneyDisplayRect.right + 20}px`;
  animation.style.top = `${moneyDisplayRect.top}px`;

  // Add to DOM
  document.body.appendChild(animation);

  // Apply animation with CSS
  animation.animate(
    [
      { opacity: 0, transform: "translateY(30px)" },
      { opacity: 1, transform: "translateY(15px)" },
      { opacity: 0, transform: "translateY(0px)" },
    ],
    {
      duration: 1500,
      easing: "cubic-bezier(0.16, 1, 0.3, 1)",
    }
  );

  // Flash the money display
  moneyDisplay.parentElement.animate(
    [
      { color: "#FFFFFF", textShadow: "0 0 8px #FFFF00" },
      { color: "#FFD700", textShadow: "0 0 0px #FFFF00" },
    ],
    { duration: 600, easing: "ease-out" }
  );

  // Remove after animation
  setTimeout(() => {
    document.body.removeChild(animation);
  }, 1500);
}

// Update all animation positions when camera moves
export function updateAllAnimationPositions() {
  // Update breaking animations
  const breakingAnimations = document.querySelectorAll(".block-breaking-animation");
  breakingAnimations.forEach(updateAnimationPosition);
  
  // Update cracking animations
  const crackingAnimations = document.querySelectorAll(".block-cracking");
  crackingAnimations.forEach(updateCrackPosition);
}