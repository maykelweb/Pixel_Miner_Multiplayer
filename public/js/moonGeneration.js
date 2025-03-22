// moonGeneration.js
import { gameState } from "./config.js";
import { updateVisibleBlocks } from "./updates.js";

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
        cachedOres[ore.name.toLowerCase()] = ore;
      }
    });
  }
  return cachedOres;
}

// Generate a moon environment
export function generateMoonWorld() {
  // Remove any existing clouds from the Earth world
  const cloudLayer = document.getElementById("cloud-layer");
  if (cloudLayer) {
    cloudLayer.remove();
  }

  // Initialize background for moon
  setupMoonBackground();
  
  // Update the current planet
  gameState.currentPlanet = "moon";

  // Save the Earth block map if we're coming from Earth
  if (
    gameState.blockMap &&
    gameState.blockMap.length > 0 &&
    !gameState.moonBlockMap
  ) {
    console.log("Saving Earth map before first moon generation");
    gameState.earthBlockMap = JSON.parse(JSON.stringify(gameState.blockMap));
  }

  // Check if the moon world is already generated
  if (gameState.moonBlockMap && gameState.moonBlockMap.length > 0) {
    console.log("Using existing moon map");
    
    // Use deep copy to avoid reference issues
    gameState.blockMap = JSON.parse(JSON.stringify(gameState.moonBlockMap));
    
    // Update visible blocks for the player's current position
    updateVisibleBlocks();
    
    // Position the rocket on the moon
    const moonSkyRows = gameState.skyRows;
    placeMoonRocket(moonSkyRows);
    
    return;
  }

  console.log("Generating new moon world");
  
  // Reset the ore cache to ensure we're using fresh data
  cachedOres = null;

  // Initialize the block map for moon
  gameState.blockMap = [];

  // Get ores for easier access
  const ores = getOres();

  // Define moon-specific blocks
  const moonStone = ores.stone;

  // Define how much sky we want
  const moonSkyRows = gameState.skyRows;

  // Generate the lunar terrain
  for (let y = 0; y < gameState.worldHeight; y++) {
    const row = [];
    for (let x = 0; x < gameState.worldWidth; x++) {
      // Sky area remains null (much more sky visible on moon)
      if (y < moonSkyRows) {
        row.push(null);
        continue;
      }

      // Generate moon surface and underground
      const block = getMoonBlockForPosition(x, y, moonStone, moonSkyRows);
      row.push(block);
    }
    gameState.blockMap.push(row);
  }

  // Generate moon ore veins in a second pass
  addMoonOreVeins();

  // Position the rocket on the moon
  placeMoonRocket(moonSkyRows);

  // Save the moon block map for future use (use deep copy)
  gameState.moonBlockMap = JSON.parse(JSON.stringify(gameState.blockMap));

  updateVisibleBlocks();
}

// Determine what block should be at a specific position on the moon
// Determine what block should be at a specific position on the moon
function getMoonBlockForPosition(x, y, moonStone, moonSkyRows) {
  const depthFromSurface = y - moonSkyRows;

  // Create more cratered surface with varying heights
  const surfaceVariation = Math.sin(x * 0.2) * 3 + Math.sin(x * 0.05) * 5;
  const adjustedSurface = Math.floor(surfaceVariation);

  // Surface layer
  if (
    depthFromSurface === adjustedSurface ||
    depthFromSurface === adjustedSurface + 1
  ) {
    // Only use stone for the surface
    return moonStone;
  }
  // Below surface is all stone
  else if (depthFromSurface > adjustedSurface) {
    return moonStone;
  }

  // Above surface is null (space)
  return null;
}

// Add ore veins throughout the moon
function addMoonOreVeins() {
  // Add regular ores but with different probabilities
  const oresCache = getOres();

  // Process each ore type
  gameState.ores.forEach((ore) => {
    // Skip basic terrain blocks
    if (ore.name.toLowerCase() === "dirt" || ore.name.toLowerCase() === "stone" || ore.name.toLowerCase() === "grass") {
      return;
    }

    // Skip Earth-only ores and ores that aren't moon-specific
    // Only allow moon-only ores or specially selected ores for the moon
    if (ore.earthOnly || (!ore.moonOnly && 
        !["diamond", "titanium", "lunarite", "silicon", "magnesium"].includes(ore.name.toLowerCase()))) {
      return;
    }

    // Adjust ore chance for moon
    let moonChanceMultiplier = 1.0;
    if (ore.moonOnly) {
      moonChanceMultiplier = 3.0; // Moon-exclusive ores are more common
    } else if (ore.name.toLowerCase() === "diamond") {
      moonChanceMultiplier = 1.5; // Only diamond is a bit more common on moon
    }

    // Clone ore config with moon adjustments
    const moonOreConfig = { ...ore, chance: ore.chance * moonChanceMultiplier };

    // Calculate total veins
    const worldArea = gameState.worldWidth * gameState.worldHeight;
    let totalVeins = Math.ceil(worldArea * moonOreConfig.chance * 0.0001);

    // Ensure reasonable minimum
    totalVeins = Math.max(totalVeins, 5);

    // Create the veins
    for (let i = 0; i < totalVeins; i++) {
      createOreVein(moonOreConfig);
    }

    console.log(`Moon ${ore.name}: Created total of ${totalVeins} veins`);
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
    console.log(`${ore.name} has invalid depth range: ${minY} to ${maxY}`);
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
    gameState.blockMap[startY][startX]?.name.toLowerCase() !== "stone"
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
        gameState.blockMap[ny][nx]?.name.toLowerCase() !== "stone"
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

  // Debug logging to verify modifiers are applied
  console.log(
    `Ore: ${ore.name}, Depth: ${depthFromSurface}, Base chance: ${ore.chance}, Modifier: ${modifier}, Adjusted: ${adjustedChance}`
  );

  return adjustedChance;
}

// Helper function to shuffle an array
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Place rocket on the moon surface
function placeMoonRocket(moonSkyRows) {
  // Position the rocket on a flat part of the moon's surface
  const startX = Math.floor(gameState.worldWidth / 2);
  
  // Find the flattest area within a reasonable range
  const flatSpotX = findFlatSpotOnSurface(startX, moonSkyRows);
  
  // Find the lunar surface at the flat spot
  let surfaceY = moonSkyRows;
  while (
    surfaceY < gameState.worldHeight &&
    !gameState.blockMap[surfaceY][flatSpotX]
  ) {
    surfaceY++;
  }

  // Make sure the rocket object exists
  if (!gameState.rocket) {
    gameState.rocket = { 
      width: 64,  // Default width
      height: 128 // Default height
    };
  }

  // Set both block and pixel coordinates
  gameState.rocketX = flatSpotX;
  gameState.rocketY = surfaceY - 5;
  
  // Convert block coordinates to pixel coordinates for rendering
  gameState.rocket.x = flatSpotX * gameState.blockSize;
  gameState.rocket.y = (surfaceY - 5) * gameState.blockSize;
  
  // Make sure rocket is enabled and placed
  gameState.hasRocket = true;
  gameState.rocketPlaced = true;
  
  console.log("Rocket placed on Moon at pixels:", 
      gameState.rocket.x, gameState.rocket.y, 
      "blocks:", gameState.rocketX, gameState.rocketY);
}

// Helper function to find a flat spot on the surface
function findFlatSpotOnSurface(startX, skyRows) {
  const minFlatLength = 6; // Number of flat blocks needed for rocket
  
  let bestFlatSpotX = startX;
  let bestFlatLength = 0;
  
  // Search in both directions from the center
  for (let direction of [1, -1]) {
    let x = startX;
    let consecutiveFlat = 0;
    let prevSurfaceY = -1;
    
    // Search up to half the world width
    for (let step = 0; step < gameState.worldWidth / 4; step++) {
      x += direction;
      
      // Stay within bounds
      if (x < 2 || x >= gameState.worldWidth - 2) break;
      
      // Find surface Y at this position
      let surfaceY = skyRows;
      while (
        surfaceY < gameState.worldHeight &&
        !gameState.blockMap[surfaceY][x]
      ) {
        surfaceY++;
      }
      
      // Check if we're on a flat surface
      if (prevSurfaceY === -1) {
        // First block
        prevSurfaceY = surfaceY;
        consecutiveFlat = 1;
      } else if (prevSurfaceY === surfaceY) {
        // Still flat
        consecutiveFlat++;
      } else {
        // Surface changed, reset counter
        consecutiveFlat = 1;
        prevSurfaceY = surfaceY;
      }
      
      // If this is the best flat area so far, remember it
      if (consecutiveFlat > bestFlatLength) {
        bestFlatLength = consecutiveFlat;
        // Place rocket in middle of flat area
        bestFlatSpotX = x - (direction * Math.floor(consecutiveFlat / 2));
        
        // If good enough, stop searching
        if (bestFlatLength >= minFlatLength) {
          return bestFlatSpotX;
        }
      }
    }
  }
  
  return bestFlatSpotX;
}  


// Setup moon background with CSS stars
function setupMoonBackground() {
  const background = document.getElementById("fixed-background");

  // Set the background dimensions to match your world size
  background.style.width = gameState.worldWidth * gameState.blockSize + "px";
  background.style.height = gameState.worldHeight * gameState.blockSize + "px";

  // Define how much sky we want
  const moonSkyRows = gameState.skyRows + 8;
  const skyHeight = moonSkyRows * gameState.blockSize;

  // Moon has gray and darker stone
  background.style.background = `
    linear-gradient(
      to bottom,
      #000000 0px,
      #111122 ${skyHeight * 0.3}px,
      #111133 ${skyHeight}px,
      #A0A0A0 ${skyHeight + 15}px, /* Moon surface */
      #909090 ${skyHeight + gameState.blockSize * 5}px,
      #808080 ${skyHeight + gameState.blockSize * 10}px,
      #707070 ${skyHeight + gameState.blockSize * 20}px,
      #606060 ${skyHeight + gameState.blockSize * 40}px
    )
  `;

  // Add CSS stars to the background
  addCSSStarsToBackground();

  // Add Earth in the sky
  addEarthToSky();
}

// Add stars to the moon background using CSS only
function addCSSStarsToBackground() {
  // Remove any existing star container
  const existingStars = document.getElementById("moon-stars");
  if (existingStars) {
    existingStars.remove();
  }

  // Create the star container
  const starsContainer = document.createElement("div");
  starsContainer.id = "moon-stars";
  starsContainer.style.height = `${gameState.skyRows * gameState.blockSize}px`;

  // Add stars directly to the DOM but with a more efficient approach
  const starCount = 150;

  // Create stars with a documentFragment for better performance
  const fragment = document.createDocumentFragment();
  
  for (let i = 0; i < starCount; i++) {
    const star = document.createElement("div");
    
    // Assign different classes for variety with less code
    const starType = Math.floor(Math.random() * 3) + 1;
    star.className = `star type-${starType}`;
    
    // Random position
    const x = Math.random() * 100;
    const y = Math.random() * 100;
    
    star.style.left = `${x}%`;
    star.style.top = `${y}%`;
    
    // Add some animation delay variation
    star.style.animationDelay = `${Math.random() * 5}s`;
    
    fragment.appendChild(star);
  }
  
  starsContainer.appendChild(fragment);
  document.getElementById("game-world").appendChild(starsContainer);

  // Add a few bright stars with CSS box-shadow for extra effect
  const brightStars = document.createElement("div");
  brightStars.id = "bright-stars";
  brightStars.style.height = `${gameState.skyRows * gameState.blockSize}px`;
  
  // Add 5 brighter stars
  for (let i = 0; i < 5; i++) {
    const brightStar = document.createElement("div");
    brightStar.className = "bright-star";
    
    // Random position for bright stars
    brightStar.style.left = `${Math.random() * 100}%`;
    brightStar.style.top = `${Math.random() * 100}%`;
    
    // Subtle pulse animation
    brightStar.style.animation = "twinkle-2 4s infinite";
    brightStar.style.animationDelay = `${Math.random() * 5}s`;
    
    brightStars.appendChild(brightStar);
  }
  
  document.getElementById("game-world").appendChild(brightStars);
}

// Add Earth in the moon sky
function addEarthToSky() {
  // Remove existing Earth if present
  const existingEarth = document.getElementById("earth-in-sky");
  if (existingEarth) {
    existingEarth.remove();
  }

  // Create Earth element
  const earth = document.createElement("div");
  earth.id = "earth-in-sky";

  document.getElementById("game-world").appendChild(earth);
}