// worldGeneration.js
import { gameState } from "./config.js";
import { updateVisibleBlocks } from "./updates.js";
import { uploadWorldToServer, requestWorldData } from "./multiplayer.js";

// Define the surface layer depth
const SURFACE_LAYER_DEPTH = 2; // Number of dirt blocks below grass

// Cache common ore references to avoid repeated lookups
let cachedOres = null;

// Helper function to initialize ore cache
function getOres() {
  if (cachedOres === null) {
    cachedOres = {
      grass: gameState.ores.find((ore) => ore.name === "grass"),
      dirt: gameState.ores.find((ore) => ore.name === "dirt"),
      stone: gameState.ores.find((ore) => ore.name === "stone"),
    };

    // Add all other ores to the cache for quick access
    gameState.ores.forEach((ore) => {
      if (!["grass", "dirt", "stone"].includes(ore.name)) {
        cachedOres[ore.name] = ore;
      }
    });
  }
  return cachedOres;
}

/**
 * Generate or load the game world
 */
export function generateWorld() {
  // Initialize clouds and background - ALWAYS do this regardless of multiplayer status
  if (typeof setupBackground === "function") {
    setupBackground();
  }

  if (typeof initializeClouds === "function") {
    initializeClouds();
  }

  // Update the current planet
  gameState.currentPlanet = "earth";

  // Check if we're joining multiplayer - if so, don't generate or load a world
  if (gameState.isJoiningMultiplayer) {
    console.log("Joining multiplayer - waiting for host's world data");

    // Initialize an empty blockMap to prepare for receiving world data
    gameState.blockMap = [];

    // Still update visible blocks to ensure UI is ready
    updateVisibleBlocks();

    // Request world data from the server
    if (typeof requestWorldData === "function") {
      console.log("Requesting world data from host");
      requestWorldData();
    }
    return;
  }

  // Check for forceNewWorld flag before using existing blockMap
  if (
    gameState.blockMap &&
    gameState.blockMap.length > 0 &&
    !gameState.forceNewWorld
  ) {
    console.log("Using existing blockMap from save");
    updateVisibleBlocks();

    // If we're the host, upload the world
    if (gameState.needToUploadWorld) {
      uploadWorldToServer();
    }
    return;
  }

  // Check if returning from moon (look for saved Earth map)
  // Also consider forceNewWorld flag here
  if (
    gameState.earthBlockMap &&
    gameState.earthBlockMap.length > 0 &&
    !gameState.forceNewWorld
  ) {
    console.log("Restoring Earth map from saved state");
    gameState.blockMap = JSON.parse(JSON.stringify(gameState.earthBlockMap));
    updateVisibleBlocks();

    // If we're the host, upload the world after restoration
    if (gameState.needToUploadWorld) {
      console.log("Host is uploading restored Earth map to server");
      uploadWorldToServer();

      // Add a retry mechanism to ensure world is uploaded
      setTimeout(() => {
        if (gameState.needToUploadWorld) {
          console.log("Retrying world data upload...");
          uploadWorldToServer();
        }
      }, 3000);
    }
    return;
  }

  // FIXED: Add log to indicate if we're regenerating because of forceNewWorld
  if (gameState.forceNewWorld) {
    console.log("Force generating new world due to forceNewWorld flag");
    if (gameState.player) {
      gameState.player.x = 280;
      gameState.player.y = 550;
    }

    // Reset the flag after we've used it
    gameState.forceNewWorld = false;
  } else {
    console.log("Generating new Earth world");
  }

  // Reset the ore cache to ensure we're using fresh data
  cachedOres = null;

  // Initialize the block map
  gameState.blockMap = [];

  // Generate the terrain
  for (let y = 0; y < gameState.worldHeight; y++) {
    const row = [];
    for (let x = 0; x < gameState.worldWidth; x++) {
      // Sky area remains null
      if (y < gameState.skyRows) {
        row.push(null);
        continue;
      }

      // Get the block type for this position
      const block = getBlockForPosition(x, y);
      row.push(block);
    }
    gameState.blockMap.push(row);
  }

  // Generate ore veins in a second pass
  addOreVeins();

  // Save the Earth block map for future use
  gameState.earthBlockMap = JSON.parse(JSON.stringify(gameState.blockMap));

  updateVisibleBlocks();

  // If we're the host, upload the newly generated world to the server
  if (gameState.needToUploadWorld) {
    console.log("Host is uploading newly generated world to server");
    uploadWorldToServer();

    // Add a retry mechanism to ensure world is uploaded
    setTimeout(() => {
      if (gameState.needToUploadWorld) {
        console.log("Retrying world data upload...");
        uploadWorldToServer();
      }
    }, 3000);
  }
}

export function transitionToEarth() {
  // Position the rocket on Earth
  placeEarthRocket();

  // Use deep copy to avoid reference issues
  gameState.blockMap = JSON.parse(JSON.stringify(gameState.earthBlockMap));

  // Set the current planet
  gameState.currentPlanet = "earth";

  // IMPORTANT: We need to keep multiplayer connection alive
  // The flag handling is different for hosts and non-hosts
  if (gameState.isHost) {
    // For hosts, leave the flag as-is and let uploadWorldToServer handle it
    console.log(
      "Host transitioning to Earth, maintaining upload flag:",
      gameState.needToUploadWorld
    );
  }
  // Do not modify the flag for non-hosts at all

  // Remove stars and earth planet
  removeSpaceBackgroundElements();

  // Small delay before requesting player list to ensure server processes planet change first
  setTimeout(() => {
    if (typeof requestPlayersOnCurrentPlanet === "function") {
      console.log("Requesting updated player list for Earth");
      requestPlayersOnCurrentPlanet();
    }
  }, 500);
}

// Function to remove Moon-specific background elements when returning to Earth
function removeSpaceBackgroundElements() {
  // Remove stars
  const starsElement = document.getElementById("moon-stars");
  if (starsElement) {
    starsElement.remove();
  }

  // Remove Earth in sky
  const earthElement = document.getElementById("earth-in-sky");
  if (earthElement) {
    earthElement.remove();
  }
}

// Function to position rocket on Earth surface
function placeEarthRocket() {
  // Position the rocket on a flat part of the Earth's surface
  const startX = Math.floor(gameState.worldWidth / 2);

  // Find surface Y position (sky rows + 1 for the grass layer)
  const surfaceY = gameState.skyRows - 1;

  // Make sure the rocket object exists
  if (!gameState.rocket) {
    gameState.rocket = {
      width: 64, // Default width
      height: 128, // Default height
    };
  }

  // Set both block and pixel coordinates
  gameState.rocketX = startX;
  gameState.rocketY = surfaceY - 4; // Position just above the surface

  // Convert block coordinates to pixel coordinates for rendering
  gameState.rocket.x = startX * gameState.blockSize;
  gameState.rocket.y = (surfaceY - 4) * gameState.blockSize;

  // Make sure rocket is enabled and placed
  gameState.hasRocket = true;
  gameState.rocketPlaced = true;

  console.log(
    "Rocket placed on Earth at pixels:",
    gameState.rocket.x,
    gameState.rocket.y,
    "blocks:",
    gameState.rocketX,
    gameState.rocketY
  );
}

// Determine what block should be at a specific position
function getBlockForPosition(x, y) {
  const ores = getOres();
  const depthFromSurface = y - gameState.skyRows;

  // Surface layer is grass
  if (depthFromSurface === 0) {
    return ores.grass;
  }
  // Dirt layer
  else if (depthFromSurface <= SURFACE_LAYER_DEPTH) {
    return ores.dirt;
  }
  // Below dirt layer is primarily stone with a transition zone
  else {
    const stoneChance = Math.min(
      0.9,
      0.3 + (depthFromSurface - SURFACE_LAYER_DEPTH) * 0.1
    );
    return Math.random() < stoneChance ? ores.stone : ores.dirt;
  }
}

// Calculate adjusted ore chance based on depth
function getAdjustedOreChance(ore, depthFromSurface) {
  // Use the base chance if no depth modifiers exist
  if (!ore.depthModifiers || !ore.depthModifiers.length) {
    return ore.chance;
  }

  // Sort modifiers by depth to ensure correct application
  const sortedModifiers = [...ore.depthModifiers].sort(
    (a, b) => b.depth - a.depth
  );

  // Find applicable depth modifier
  // Start with the deepest modifier that applies to current depth
  let modifier = 1.0;
  for (const depthMod of sortedModifiers) {
    if (depthFromSurface >= depthMod.depth) {
      modifier = depthMod.multiplier;
      break;
    }
  }

  // Apply the modifier and return the adjusted chance
  const adjustedChance = ore.chance * modifier;

  /* Debug logging to verify modifiers are applied
  console.log(
    `Ore: ${ore.name}, Depth: ${depthFromSurface}, Base chance: ${ore.chance}, Modifier: ${modifier}, Adjusted: ${adjustedChance}`
  ); */

  return adjustedChance;
}

// Add ore veins throughout the stone areas
function addOreVeins() {
  const ores = getOres();

  // Process each ore type that's not a basic block
  gameState.ores.forEach((ore) => {
    // Skip basic terrain blocks
    if (ore.name === "dirt" || ore.name === "stone" || ore.name === "grass") {
      return;
    }

    // FIXED: Skip moon-only ores when on Earth
    if (gameState.currentPlanet === "earth" && ore.moonOnly) {
      //console.log(`Skipping moon-only ore ${ore.name} on Earth`);
      return;
    }

    // Skip earth-only ores when on Moon
    if (gameState.currentPlanet === "moon" && ore.earthOnly) {
      //console.log(`Skipping earth-only ore ${ore.name} on Moon`);
      return;
    }

    // Calculate total veins by depth ranges to account for modifiers
    let totalVeins = 0;
    const depthRanges = [];

    // Define depth sections for more accurate vein distribution
    const minDepth = ore.minDepth;
    const maxDepth = ore.maxDepth;
    const worldArea = gameState.worldWidth * gameState.worldHeight;

    // If there are depth modifiers, create ranges for each
    if (ore.depthModifiers && ore.depthModifiers.length > 0) {
      // Sort modifiers by depth
      const sortedModifiers = [...ore.depthModifiers].sort(
        (a, b) => a.depth - b.depth
      );

      let lastDepth = minDepth;

      // Create ranges between each modifier
      for (const mod of sortedModifiers) {
        if (mod.depth > lastDepth && mod.depth <= maxDepth) {
          // Add range from last depth to this modifier
          const range = {
            start: lastDepth,
            end: mod.depth - 1,
            multiplier: 1.0, // Default multiplier before hitting this threshold
          };

          depthRanges.push(range);
          lastDepth = mod.depth;
        }
      }

      // Add final range from last modifier to max depth
      if (lastDepth < maxDepth) {
        // Find the applicable multiplier for this final range
        let finalMult = sortedModifiers[sortedModifiers.length - 1].multiplier;
        for (const mod of sortedModifiers) {
          if (mod.depth <= lastDepth) {
            finalMult = mod.multiplier;
          }
        }

        depthRanges.push({
          start: lastDepth,
          end: maxDepth,
          multiplier: finalMult,
        });
      }
    }
    // If no modifiers, use the entire range
    else {
      depthRanges.push({
        start: minDepth,
        end: maxDepth,
        multiplier: 1.0,
      });
    }

    // Calculate and create veins for each range
    for (const range of depthRanges) {
      const rangeSize = range.end - range.start + 1;
      const rangeFraction = rangeSize / (maxDepth - minDepth + 1);

      // Base vein count calculation
      let rangeVeins = Math.ceil(
        worldArea * ore.chance * 0.0001 * rangeFraction * range.multiplier
      );

      // Ensure reasonable minimum
      rangeVeins = Math.max(rangeVeins, Math.ceil(5 * rangeFraction));

      /*console.log(
        `${ore.name}: Creating ${rangeVeins} veins for depth range ${range.start}-${range.end} (multiplier: ${range.multiplier})`
      );*/

      // Create the veins for this range
      for (let i = 0; i < rangeVeins; i++) {
        createOreVein(ore, range.start, range.end);
      }

      totalVeins += rangeVeins;
    }

    //console.log(`${ore.name}: Created total of ${totalVeins} veins`);
  });
}

// Create a vein of a specific ore type within a specified depth range
function createOreVein(ore, minDepth = null, maxDepth = null) {
  const ores = getOres();

  // Use ore's min/max depth if not specified
  minDepth = minDepth !== null ? minDepth : ore.minDepth;
  maxDepth = maxDepth !== null ? maxDepth : ore.maxDepth;

  // Calculate actual depth positions factoring in sky rows
  const minY = gameState.skyRows + minDepth;
  const maxY = Math.min(
    gameState.worldHeight - 1,
    gameState.skyRows + maxDepth
  );

  // Don't continue if there's no valid depth range
  if (minY >= maxY) {
    //console.log(`${ore.name} has invalid depth range: ${minY} to ${maxY}`);
    return;
  }

  // Pick a random starting point for the vein within the valid depth range
  const startY = Math.floor(Math.random() * (maxY - minY + 1)) + minY;
  const startX = Math.floor(Math.random() * gameState.worldWidth);

  // Calculate depth from surface for chance modification
  const depthFromSurface = startY - gameState.skyRows;

  // Only place ores in stone blocks
  if (
    !gameState.blockMap[startY] ||
    !gameState.blockMap[startY][startX] ||
    gameState.blockMap[startY][startX]?.name !== "stone"
  ) {
    return;
  }

  // Determine vein size using the ore's configuration
  const minSize = ore.minVein || 3;
  const maxSize = ore.maxVein || 5;
  const veinSize =
    Math.floor(Math.random() * (maxSize - minSize + 1)) + minSize;

  // Points to check in the vein expansion
  const queue = [{ x: startX, y: startY, depth: 0 }];
  const placed = new Set();
  const key = (x, y) => `${x},${y}`;

  // Place the first ore block
  gameState.blockMap[startY][startX] = ore;
  placed.add(key(startX, startY));

  // Get adjusted ore chance based on depth
  const adjustedChance = getAdjustedOreChance(ore, depthFromSurface);

  // Expand the vein using a branch-and-bound approach
  while (queue.length > 0 && placed.size < veinSize) {
    // Sort queue by depth to create more natural-looking veins
    // that expand outward rather than in a single direction
    queue.sort((a, b) => a.depth - b.depth);

    const pos = queue.shift();

    // Define possible directions with weights
    const directions = [
      // Cardinal directions (higher probability)
      { dx: -1, dy: 0, prob: 0.5 },
      { dx: 1, dy: 0, prob: 0.5 },
      { dx: 0, dy: -1, prob: 0.5 },
      { dx: 0, dy: 1, prob: 0.5 },
      // Diagonal directions (lower probability)
      { dx: -1, dy: -1, prob: 0.25 },
      { dx: -1, dy: 1, prob: 0.25 },
      { dx: 1, dy: -1, prob: 0.25 },
      { dx: 1, dy: 1, prob: 0.25 },
    ];

    // Shuffle directions for natural patterns
    shuffleArray(directions);

    // Try each direction
    for (const dir of directions) {
      const nx = pos.x + dir.dx;
      const ny = pos.y + dir.dy;

      // Skip if out of bounds
      if (nx < 0 || nx >= gameState.worldWidth || ny < minY || ny > maxY) {
        continue;
      }

      // Skip if already placed or not stone
      if (
        placed.has(key(nx, ny)) ||
        !gameState.blockMap[ny] ||
        !gameState.blockMap[ny][nx] ||
        gameState.blockMap[ny][nx]?.name !== "stone"
      ) {
        continue;
      }

      // Use probability weighted by the ore's chance value (already adjusted) and direction
      const placementChance = dir.prob * Math.min(1, adjustedChance * 10);

      if (Math.random() < placementChance) {
        gameState.blockMap[ny][nx] = ore;
        placed.add(key(nx, ny));

        // Add to queue with increased depth for branch tracking
        queue.push({ x: nx, y: ny, depth: pos.depth + 1 });

        // Break if we reached the target size
        if (placed.size >= veinSize) {
          break;
        }
      }
    }
  }
}

// Helper function to shuffle an array
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
// Function to update the background variables and position
export function setupBackground() {
  console.log("settingup background")
  const background = document.getElementById("fixed-background");

  // Set the background dimensions to match your world size
  background.style.width = gameState.worldWidth * gameState.blockSize + "px";
  background.style.height = gameState.worldHeight * gameState.blockSize + "px";

  // Set the sky, dirt and stone transition points
  const skyHeight = gameState.skyRows * gameState.blockSize;
  const dirtHeight = 5 * gameState.blockSize; // Rows of dirt
  const stoneStartY = skyHeight + dirtHeight; // Stone starts after dirt

  // Adding more natural coloring with multiple gradient stops for sky, dirt, and stone layers
  background.style.background = `
    linear-gradient(
      to bottom,
      #64B5F6 0px,
      #90CAF9 ${skyHeight * 0.5}px,
      #BBDEFB ${skyHeight}px,
      #8D6E63 ${skyHeight + 15}px,
      #8D6E63 ${stoneStartY - 10}px,
      #757575 ${stoneStartY}px, /* Start of stone layer */
      #616161 ${stoneStartY + gameState.blockSize * 10}px,
      #424242 ${stoneStartY + gameState.blockSize * 20}px,
      #212121 ${
        stoneStartY + gameState.blockSize * 40
      }px /* Deeper stone gets darker */
    )
  `;

  // Creating a noise texture overlay for stone appearance
  const stoneTexture = document.createElement("div");
  stoneTexture.id = "stone-texture";
  stoneTexture.style.position = "absolute";
  stoneTexture.style.top = stoneStartY + "px";
  stoneTexture.style.left = "0";
  stoneTexture.style.width = "100%";
  stoneTexture.style.height =
    gameState.worldHeight * gameState.blockSize - stoneStartY + "px";
  stoneTexture.style.backgroundImage = `
    radial-gradient(circle at 20% 30%, rgba(114, 114, 114, 0.4) 2%, transparent 6%),
    radial-gradient(circle at 40% 70%, rgba(80, 80, 80, 0.3) 2%, transparent 6%),
    radial-gradient(circle at 60% 20%, rgba(100, 100, 100, 0.4) 2%, transparent 6%),
    radial-gradient(circle at 80% 50%, rgba(90, 90, 90, 0.3) 2%, transparent 6%)
  `;
  stoneTexture.style.backgroundSize = `${gameState.blockSize * 4}px ${
    gameState.blockSize * 4
  }px`;
  stoneTexture.style.opacity = "0.7";
  stoneTexture.style.pointerEvents = "none"; // Make sure it doesn't interfere with game interactions

  // Remove existing texture if present
  const existingTexture = document.getElementById("stone-texture");
  if (existingTexture) {
    existingTexture.remove();
  }

  // Add the texture overlay to the game container
  const gameContainer = background.parentElement;
  gameContainer.appendChild(stoneTexture);

  // Add texture overlay for more natural appearance
  background.style.backgroundBlendMode = "normal";
  background.style.position = "absolute";
  background.style.top = "0";
  background.style.left = "0";
}

// Create a container for clouds separate from the game's camera-following elements
function createCloudLayer() {
  if (document.getElementById("cloud-layer"))
    return document.getElementById("cloud-layer");

  const gameContainer =
    document.getElementById("game-container") || document.body;
  const cloudLayer = document.createElement("div");
  cloudLayer.id = "cloud-layer";
  cloudLayer.style.setProperty(
    "width",
    gameState.worldWidth * gameState.blockSize + "px",
    "important"
  );

  gameContainer.appendChild(cloudLayer);
  return cloudLayer;
}

const MAX_CLOUDS = 50; // Maximum number of clouds at once

// Create a single cloud and add it to the cloud layer
function createCloud() {
  const cloudLayer = createCloudLayer();
  const worldWidth = gameState.worldWidth * gameState.blockSize;

  const cloud = document.createElement("div");
  cloud.className = "cloud";

  // Random cloud size
  const cloudWidth = 100 + Math.random() * 150;
  const cloudHeight = 30 + Math.random() * 40;

  cloud.style.width = `${cloudWidth}px`;
  cloud.style.height = `${cloudHeight}px`;

  // Get the cloud layer element and its height
  const cloudLayerHeight = cloudLayer.clientHeight;

  // Start clouds off-screen to the left
  const posX = -cloudWidth;

  // Calculate maximum allowed top position to keep clouds within the cloud layer
  const maxPosY = cloudLayerHeight - cloudHeight;
  // Generate a random posY from 0 to maxPosY
  const posY = Math.random() * maxPosY;

  // Store absolute world position in data attributes
  cloud.dataset.worldX = posX;
  cloud.dataset.worldY = posY;

  // Apply initial position
  cloud.style.transform = `translate(${posX}px, ${posY}px)`;

  // Add some random puffiness to clouds
  const borderRadius = 15 + Math.random() * 15;
  cloud.style.borderRadius = `${borderRadius}px`;

  // Vary cloud opacity slightly
  const opacity = 0.7 + Math.random() * 0.3;
  cloud.style.opacity = opacity;

  // Set a slower speed for clouds (30-60 seconds to cross the screen)
  const speed = 30 + Math.random() * 30;
  // Store the speed as a data attribute for movement calculations
  cloud.dataset.speed = (worldWidth + cloudWidth * 2) / speed / 60; // pixels per frame at 60fps

  cloudLayer.appendChild(cloud);

  return cloud;
}

// Initialize the first set of clouds
export function initializeClouds() {
  // Create 5-8 initial clouds at different positions
  const cloudCount = 5 + Math.floor(Math.random() * 4);
  const worldWidth = gameState.worldWidth * gameState.blockSize;

  for (let i = 0; i < cloudCount; i++) {
    const cloud = createCloud();
    // Position initial clouds throughout the world width
    const randomPosition = Math.random() * worldWidth;
    cloud.dataset.worldX = randomPosition;
    cloud.style.transform = `translate(${randomPosition}px, ${cloud.dataset.worldY}px)`;
  }
}

// Update cloud positions and manage cloud lifecycle
export function updateClouds() {
  const clouds = document.querySelectorAll(".cloud");
  const worldWidth = gameState.worldWidth * gameState.blockSize;

  // Move each cloud based on its speed
  clouds.forEach((cloud) => {
    const speed =
      parseFloat(cloud.dataset.speed) * (gameState.deltaTime / 16.67); // Adjust for actual frame time
    const worldX = parseFloat(cloud.dataset.worldX) + speed;
    const worldY = parseFloat(cloud.dataset.worldY);

    // Update the stored world position
    cloud.dataset.worldX = worldX;

    // Update visual position
    cloud.style.transform = `translate(${worldX}px, ${worldY}px)`;

    // Remove clouds that have moved off screen to the right
    if (worldX > worldWidth) {
      cloud.remove();
    }
  });
}

// Periodically check if we need more clouds
export function manageClouds() {
  // Skip cloud management if on the moon
  if (gameState.onMoon) {
    return;
  }

  const clouds = document.querySelectorAll(".cloud");

  // Add a new cloud if we have fewer than maximum
  if (clouds.length < MAX_CLOUDS && Math.random() < 0.01) {
    createCloud();
  }
}
