// moonGeneration.js
import { gameState } from "./config.js";
import { updateVisibleBlocks } from "./updates.js";
import { uploadWorldToServer, requestWorldData } from "./multiplayer.js";

// Cache common ore references to avoid repeated lookups
let cachedOres = null;

// Helper function to initialize ore cache
function getOres() {
  if (cachedOres === null) {
    cachedOres = {
      // Keep grass/dirt/stone for potential future use, though not used on moon surface gen now
      grass: gameState.ores.find((ore) => ore.name === "grass"),
      dirt: gameState.ores.find((ore) => ore.name === "dirt"),
      stone: gameState.ores.find((ore) => ore.name === "stone"),
    };

    // Add all other ores to the cache for quick access by name
    gameState.ores.forEach((ore) => {
      cachedOres[ore.name.toLowerCase()] = ore;
    });
  }
  return cachedOres;
}

// Generate a moon environment
export function generateMoonWorld() {
  // Set a flag so we know a moon generation is in progress
  gameState.generatingMoon = true;

  // Remove any existing clouds from the Earth world
  const cloudLayer = document.getElementById("cloud-layer");
  if (cloudLayer) {
    cloudLayer.remove();
  }

  // Initialize background for moon
  setupMoonBackground();

  // Check if the moon world is already generated or received from server
  if (gameState.moonBlockMap && gameState.moonBlockMap.length > 0) {
    console.log("Using existing moon map");
    // Use deep copy to avoid reference issues
    gameState.blockMap = JSON.parse(JSON.stringify(gameState.moonBlockMap));
    updateVisibleBlocks();
    const moonSkyRows = gameState.skyRows; // Use consistent skyrows
    placeMoonRocket(moonSkyRows);

    // Multiplayer: Host uploads existing map if needed
    if (gameState.isMultiplayer && gameState.isHost) {
      console.log("Host checking if existing Moon map needs upload");
      // Optionally force upload or check if it was previously uploaded successfully
      // Using the retry mechanism should cover cases where it didn't upload before
      scheduleRetryUploads("moon"); // Schedule uploads just in case
    }

    gameState.generatingMoon = false;
    return;
  }

  // Multiplayer: Client requests map from server first
  if (gameState.isMultiplayer && !gameState.isHost && !gameState.hasRequestedMoonData) {
    console.log("Client requesting moon blockmap from server");
    gameState.hasRequestedMoonData = true;
    requestWorldData("moon");

    setTimeout(() => {
      if (!gameState.moonBlockMap || gameState.moonBlockMap.length === 0) {
        console.log("No moon data received from server after timeout, proceeding with generation (client)");
        // Reset flag allows generation if server fails or host is gone
        gameState.hasRequestedMoonData = false;
        generateMoonWorld(); // Retry generation
      } else {
         console.log("Moon data received from server.");
         // Data should have been processed by the multiplayer handler, just need to ensure state is correct
         gameState.generatingMoon = false; // Ensure flag is cleared
         updateVisibleBlocks(); // Update view with received map
         const moonSkyRows = gameState.skyRows;
         placeMoonRocket(moonSkyRows); // Place rocket on received map
      }
    }, 5000); // Increased timeout for server response

    return; // Exit, wait for response or timeout
  }

  // --- Generate New Moon World ---

  // Save the Earth block map if switching from Earth for the first time
  if (gameState.currentPlanet === 'earth' && gameState.blockMap && gameState.blockMap.length > 0 && (!gameState.earthBlockMap || gameState.earthBlockMap.length === 0)) {
      console.log("Saving Earth map before first moon generation");
      gameState.earthBlockMap = JSON.parse(JSON.stringify(gameState.blockMap));
  }


  console.log("Generating new moon world...");

  // Reset the ore cache to ensure we're using fresh config data
  cachedOres = null;
  const ores = getOres(); // Re-initialize cache

  // Define moon-specific blocks using the cache
  const moonStone = ores.stone; // Assuming 'stone' is the base for moon rock
  if (!moonStone) {
      console.error("CRITICAL: 'stone' ore definition not found in config!");
      gameState.generatingMoon = false;
      return; // Cannot generate without base stone
  }


  // Initialize the block map for moon
  gameState.blockMap = [];
  const moonSkyRows = gameState.skyRows; // Number of sky rows for moon

  // Generate the lunar terrain (base stone)
  console.log("Generating moon terrain...");
  for (let y = 0; y < gameState.worldHeight; y++) {
    const row = [];
    for (let x = 0; x < gameState.worldWidth; x++) {
      // Sky area
      if (y < moonSkyRows) {
        row.push(null);
      } else {
        // Generate moon surface and underground using only stone initially
        const block = getMoonBlockForPosition(x, y, moonStone, moonSkyRows);
        row.push(block);
      }
    }
    gameState.blockMap.push(row);
  }
  console.log("Moon terrain generation complete.");


  // Generate moon ore veins in a second pass
  console.log("Adding moon ore veins...");
  addMoonOreVeins(); // Use the fixed function
  console.log("Moon ore vein generation complete.");


  // Position the rocket on the moon
  placeMoonRocket(moonSkyRows);


  // Save the newly generated moon block map (deep copy)
  console.log("Saving generated moon map to gameState.moonBlockMap");
  gameState.moonBlockMap = JSON.parse(JSON.stringify(gameState.blockMap));


  updateVisibleBlocks();


  // Multiplayer: Upload newly generated world data
  if (gameState.isMultiplayer) {
      if (gameState.isHost) {
          console.log("Host uploading newly generated Moon world to server");
          gameState.needToUploadWorld = true; // Ensure flag is set
          uploadWorldToServer("moon");
          scheduleRetryUploads("moon"); // Schedule retries for reliability
      } else if (gameState.hasRequestedMoonData === false) {
          // This case handles a client generating the world because the server/host didn't provide it
          console.log("Client uploading newly generated Moon world (fallback)");
          gameState.needToUploadWorld = true;
          uploadWorldToServer("moon", true); // Force upload as client generated it
          scheduleRetryUploads("moon");
      }
  }

  // Clear generation flag and request flag
  gameState.generatingMoon = false;
  gameState.hasRequestedMoonData = false; // Reset after successful generation/request cycle
  console.log("Moon generation process finished.");
}

// Helper function to schedule multiple upload retries (Unchanged)
function scheduleRetryUploads(planet) {
    const retryDelays = [2000, 5000, 8000]; // Delays in ms

    retryDelays.forEach((delay, index) => {
        setTimeout(() => {
            // Only retry if still needed (e.g., not switched planets again)
            if (gameState.needToUploadWorld && gameState.currentPlanet === 'moon' && planet === 'moon') {
                 console.log(`Retry ${index + 1} for ${planet} world upload...`);
                 // No need to set needToUploadWorld again, uploadWorldToServer checks it
                 uploadWorldToServer(planet);
            } else if (gameState.needToUploadWorld && gameState.currentPlanet === 'earth' && planet === 'earth') {
                 console.log(`Retry ${index + 1} for ${planet} world upload...`);
                 uploadWorldToServer(planet);
            }
        }, delay);
    });

    // Optionally, clear the flag after the last retry is scheduled,
    // assuming uploadWorldToServer handles its own success/failure state.
    // Or let uploadWorldToServer clear it on successful upload acknowledgement.
    // For now, leave it, as uploadWorldToServer likely handles it.
}


// Determine what block should be at a specific position on the moon (Terrain Only)
// (Unchanged - This function correctly generates the base stone terrain)
function getMoonBlockForPosition(x, y, moonStone, moonSkyRows) {
  const depthFromSurface = y - moonSkyRows;

  // Create more cratered surface with varying heights
  const surfaceVariation = Math.sin(x * 0.2) * 3 + Math.sin(x * 0.05) * 5;
  const adjustedSurfaceLevel = Math.floor(surfaceVariation); // The first solid block depth relative to skyRows

  // Ensure surface starts right below skyRows minimum
  const actualSurfaceY = moonSkyRows + Math.max(0, adjustedSurfaceLevel); // Don't allow surface above skyRows

  // Place stone at and below the calculated surface level
  if (y >= actualSurfaceY) {
    return moonStone;
  }

  // Above surface is null (space)
  return null;
}

// *** FIXED FUNCTION: Add ore veins throughout the moon ***
function addMoonOreVeins() {
  const oresCache = getOres(); // Get cached ore objects (includes .stone)
  const moonStoneName = oresCache.stone?.name?.toLowerCase();

  if (!moonStoneName) {
      console.error("Cannot add veins: Base 'stone' block not defined or cached.");
      return;
  }

  console.log("Starting vein generation for applicable ores...");

  // Process each ore type defined in gameState
  gameState.ores.forEach((ore) => {
    // Skip basic terrain blocks explicitly
    if (["grass", "dirt", "stone"].includes(ore.name.toLowerCase())) {
      return;
    }

    // --- Filtering Logic ---
    let shouldGenerateOnMoon = false;
    const allowedEarthOresOnMoon = ["diamond", "titanium", "silicon", "magnesium"];

    if (ore.moonOnly) {
        shouldGenerateOnMoon = true;
        // console.log(` -> ${ore.name}: Marked as moonOnly.`);
    } else if (!ore.earthOnly) {
        // If not earthOnly, check if it's one of the allowed Earth ores
        if (allowedEarthOresOnMoon.includes(ore.name.toLowerCase())) {
            shouldGenerateOnMoon = true;
            // console.log(` -> ${ore.name}: Allowed Earth ore on Moon.`);
        } else {
            // console.log(` -> ${ore.name}: Earth ore NOT allowed on Moon.`);
        }
    } else {
        // console.log(` -> ${ore.name}: Marked as earthOnly, skipping for Moon.`);
    }


    // Skip if this ore shouldn't be on the moon based on flags/rules
    if (!shouldGenerateOnMoon) {
      return;
    }

    // --- Chance Adjustment for Moon ---
    let moonChanceMultiplier = 1.0; // Default multiplier

    if (ore.moonOnly) {
      // Moon-exclusive ores might be more or less common based on design
      // Example: Make them generally more common than their Earth counterparts if tiered similarly
      moonChanceMultiplier = 1.5; // Example: 50% more common overall chance
       // Adjust specific moon ores if needed
       if (ore.name.toLowerCase() === 'silicon') moonChanceMultiplier = 2.5; // Make silicon very common
       if (ore.name.toLowerCase() === 'lunarite') moonChanceMultiplier = 1.2;
       if (ore.name.toLowerCase() === 'celestium') moonChanceMultiplier = 1.0; // Keep rarest as configured

    } else {
      // Adjust chance for allowed Earth ores on the moon
      switch (ore.name.toLowerCase()) {
        case "diamond":
          moonChanceMultiplier = 0.8; // Slightly rarer than peak on Earth
          break;
        case "titanium":
          moonChanceMultiplier = 1.0; // Similar rarity as on Earth (if it existed there)
          break;
        case "silicon": // Should be moonOnly based on config, but handle if misconfigured
        case "magnesium": // Should be moonOnly based on config
           moonChanceMultiplier = 1.0; // Use base chance if somehow not marked moonOnly
           break;
        default:
          moonChanceMultiplier = 0.5; // Other potential Earth ores are much rarer (safety net)
      }
    }

    // Create a temporary config object for this ore with moon-adjusted chance
    // Use base chance if multiplier is 1 to avoid floating point issues
    const adjustedBaseChance = moonChanceMultiplier === 1.0 ? ore.chance : ore.chance * moonChanceMultiplier;
    const moonOreConfig = { ...ore, chance: Math.max(0.1, adjustedBaseChance) }; // Ensure chance is at least slightly positive


    // --- Vein Count Calculation ---
    const worldArea = gameState.worldWidth * (gameState.worldHeight - gameState.skyRows); // Area below sky
    let baseFactor; // Determines vein density based on rarity

    // Tier the baseFactor based on the adjusted chance
    if (moonOreConfig.chance >= 30) baseFactor = 0.00025; // Very Common (e.g., Silicon)
    else if (moonOreConfig.chance >= 15) baseFactor = 0.00018; // Common (e.g., Aluminum, Magnesium)
    else if (moonOreConfig.chance >= 8) baseFactor = 0.00012; // Uncommon (e.g., Titanium)
    else if (moonOreConfig.chance >= 3) baseFactor = 0.00008; // Rare (e.g., Platinum, Diamond on moon)
    else baseFactor = 0.00005; // Very Rare (e.g., Lunarite, Celestium)


    // Calculate total veins: Area * DensityFactor * (Chance / NormalizationFactor)
    // Normalizing by 10 seems reasonable for percentage chances
    let totalVeins = worldArea * baseFactor * (moonOreConfig.chance / 10);

    // Add some randomness and ensure a minimum/maximum number of veins
    totalVeins = Math.ceil(totalVeins * (0.8 + Math.random() * 0.4)); // +/- 20% randomness
    totalVeins = Math.max(10, Math.min(totalVeins, 100)); // Clamp between 10 and 100 veins


    console.log(`Generating ${totalVeins} veins for Moon ${ore.name} (Adjusted Chance: ${moonOreConfig.chance.toFixed(2)})`);


    // Create the calculated number of veins
    for (let i = 0; i < totalVeins; i++) {
      // Pass the temporary moonOreConfig and the name of the base block to replace
      createOreVein(moonOreConfig, moonStoneName);
    }
  });
  console.log("Finished adding all moon ore veins.");
}


// *** FIXED FUNCTION: Create a vein of a specific ore type ***
function createOreVein(oreConfig, baseBlockName = "stone") {

  // Use ore's min/max depth from the passed config
  const minDepth = oreConfig.minDepth;
  let maxDepth = oreConfig.maxDepth;

  // Handle Infinity maxDepth gracefully -> bottom of world below sky
  if (maxDepth === Infinity || maxDepth > (gameState.worldHeight - gameState.skyRows - 1)) {
    maxDepth = gameState.worldHeight - gameState.skyRows - 1;
  }

  // Calculate actual Y coordinates factoring in sky rows
  const minY = gameState.skyRows + minDepth;
  const maxY = Math.min(
    gameState.worldHeight - 1, // Ensure within world bounds
    gameState.skyRows + maxDepth
  );

  // Validate depth range
  if (minY > maxY) {
    // console.warn(`Skipping ${oreConfig.name} vein: Invalid depth range after sky adjustment (${minY} > ${maxY}). MinDepth: ${minDepth}, MaxDepth: ${maxDepth}`);
    return;
  }
  if (minY < gameState.skyRows || minY >= gameState.worldHeight || maxY < gameState.skyRows || maxY >= gameState.worldHeight){
      // console.warn(`Skipping ${oreConfig.name} vein: Calculated Y range [${minY}-${maxY}] is out of world bounds [${gameState.skyRows}-${gameState.worldHeight-1}].`);
      return;
  }

  // Pick a random starting point within the *valid Y range*
  const startY = Math.floor(Math.random() * (maxY - minY + 1)) + minY;
  const startX = Math.floor(Math.random() * gameState.worldWidth);

  // --- Ensure starting point is valid ---
  // Check bounds first
   if (!gameState.blockMap[startY] || startX < 0 || startX >= gameState.worldWidth) {
    // console.warn(`Skipping ${oreConfig.name} vein: Start point (${startX}, ${startY}) out of map bounds.`);
    return;
   }
  // Check if the block at the start point is the replaceable base block (e.g., stone)
  const currentBlock = gameState.blockMap[startY][startX];
  if (!currentBlock || currentBlock.name.toLowerCase() !== baseBlockName.toLowerCase()) {
    // console.log(`Skipping ${oreConfig.name} vein: Start block at (${startX}, ${startY}) is not ${baseBlockName} (found ${currentBlock?.name}).`);
    return; // Cannot start vein here
  }

  // Calculate depth from surface for chance modification (relative to skyRows)
  const depthFromSurface = startY - gameState.skyRows;

  // Determine vein size using the ore's configuration
  const minSize = oreConfig.minVein || 2; // Ensure min size is at least 1-2
  const maxSize = oreConfig.maxVein || Math.max(minSize, 5); // Ensure max >= min
  const targetVeinSize = Math.floor(Math.random() * (maxSize - minSize + 1)) + minSize;

  // --- Vein Expansion ---
  const queue = [{ x: startX, y: startY, depth: 0 }]; // BFS-like queue
  const placed = new Set(); // Track placed blocks to avoid duplicates and cycles
  const key = (x, y) => `${x},${y}`;

  // Place the first ore block
  gameState.blockMap[startY][startX] = oreConfig; // Place the actual ore object
  placed.add(key(startX, startY));
  let placedCount = 1;

  // Get the ore's chance adjusted for the *starting depth*
  const adjustedChanceAtStart = getAdjustedOreChance(oreConfig, depthFromSurface);
  const normalizedBaseChance = Math.max(0.01, adjustedChanceAtStart / 100); // Normalize to 0-1, ensure > 0

  // Define base probability factor based on ore rarity (using adjusted chance)
  let rarityFactor;
  if (oreConfig.chance >= 30) rarityFactor = 0.85;  // Very Common -> High clumping
  else if (oreConfig.chance >= 15) rarityFactor = 0.75; // Common
  else if (oreConfig.chance >= 8) rarityFactor = 0.65; // Uncommon
  else if (oreConfig.chance >= 3) rarityFactor = 0.50; // Rare
  else rarityFactor = 0.40; // Very Rare -> Less clumping


  // Expand the vein
  while (queue.length > 0 && placedCount < targetVeinSize) {
    const currentPos = queue.shift(); // Get next position to expand from

    // Define potential neighbors (cardinal directions more likely)
    const directions = [
      { dx: -1, dy: 0, weight: 1.0 }, { dx: 1, dy: 0, weight: 1.0 }, // Horizontal
      { dx: 0, dy: -1, weight: 0.8 }, { dx: 0, dy: 1, weight: 0.8 }, // Vertical (slightly less likely to spread purely vertical)
      { dx: -1, dy: -1, weight: 0.4 }, { dx: -1, dy: 1, weight: 0.4 }, // Diagonal (less likely)
      { dx: 1, dy: -1, weight: 0.4 }, { dx: 1, dy: 1, weight: 0.4 }
    ];

    shuffleArray(directions); // Randomize direction order

    for (const dir of directions) {
      const nextX = currentPos.x + dir.dx;
      const nextY = currentPos.y + dir.dy;

      // --- Check neighbor validity ---
      // 1. Bounds check (world and depth range)
      if (nextX < 0 || nextX >= gameState.worldWidth || nextY < minY || nextY > maxY) {
        continue;
      }
      // 2. Already placed check
      if (placed.has(key(nextX, nextY))) {
        continue;
      }
      // 3. Is replaceable block check
      const neighborBlock = gameState.blockMap[nextY]?.[nextX]; // Safely access block
      if (!neighborBlock || neighborBlock.name.toLowerCase() !== baseBlockName.toLowerCase()) {
        continue;
      }

      // --- Calculate Placement Probability ---
      // Base probability: direction weight * rarity factor * normalized chance at vein start
      const basePlacementChance = dir.weight * rarityFactor * normalizedBaseChance;

      // Introduce slight decay based on distance from start (optional, makes veins less uniform)
      const depthDecay = Math.max(0.5, 1.0 - (currentPos.depth * 0.05)); // Reduces chance slightly further out
      let placementChance = basePlacementChance * depthDecay;

      // Ensure a minimum chance to allow veins to form, especially for rare ores
      const minPlacementChance = 0.10; // 10% minimum chance if checks pass
      placementChance = Math.max(placementChance, minPlacementChance);


      // --- Place the block ---
      if (Math.random() < placementChance) {
        gameState.blockMap[nextY][nextX] = oreConfig; // Place the ore
        placed.add(key(nextX, nextY));
        placedCount++;

        // Add the new block to the queue for further expansion
        queue.push({ x: nextX, y: nextY, depth: currentPos.depth + 1 });

        // Stop if target vein size is reached
        if (placedCount >= targetVeinSize) {
          break; // Exit direction loop
        }
      }
    }
      if (placedCount >= targetVeinSize) {
          break; // Exit while loop
      }
  }
   // console.log(` -> Created ${oreConfig.name} vein at (${startX}, ${startY}) with ${placedCount} blocks (target: ${targetVeinSize})`);
}


// *** FIXED FUNCTION: Get adjusted ore chance based on depth ***
function getAdjustedOreChance(oreConfig, depthFromSurface) {
  // Start with the ore's base chance (potentially already adjusted for Moon)
  let currentChance = oreConfig.chance;

  if (oreConfig.depthModifiers && oreConfig.depthModifiers.length > 0) {
    // Sort modifiers by depth ascending to apply correctly
    const sortedModifiers = [...oreConfig.depthModifiers].sort((a, b) => a.depth - b.depth);

    let appliedMultiplier = 1.0; // Default if below first modifier depth

    // Find the highest depth modifier that is shallower than or equal to the current depth
    for (const mod of sortedModifiers) {
      if (depthFromSurface >= mod.depth) {
        appliedMultiplier = mod.multiplier;
      } else {
        // Since modifiers are sorted, we've passed the relevant depth
        break;
      }
    }

    // Apply the multiplier
    currentChance = oreConfig.chance * appliedMultiplier;

    // Optional Debug Log:
    // console.log(`Adjusted ${oreConfig.name} chance: Base=${oreConfig.chance}, Depth=${depthFromSurface}, Multiplier=${appliedMultiplier.toFixed(2)}, Final=${currentChance.toFixed(2)}`);

  } else {
    // No modifiers, use the base chance
    // console.log(`Adjusted ${oreConfig.name} chance: Base=${oreConfig.chance} (no modifiers)`);
  }

  // Ensure chance doesn't go below a very small positive number (e.g., 0.01)
  return Math.max(0.01, currentChance);
}


// Helper function to shuffle an array (Fisher-Yates) (Unchanged)
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// --- Other Moon Setup Functions (Unchanged) ---

// Place rocket on the moon surface
function placeMoonRocket(moonSkyRows) {
  const startX = Math.floor(gameState.worldWidth / 2);
  const flatSpotX = findFlatSpotOnSurface(startX, moonSkyRows);

  let surfaceY = moonSkyRows;
  while (
    surfaceY < gameState.worldHeight -1 && // Prevent infinite loop if world bottom is sky somehow
    (!gameState.blockMap[surfaceY] || !gameState.blockMap[surfaceY][flatSpotX])
  ) {
    surfaceY++;
  }
   // Go one block up if we landed inside the ground
  if(gameState.blockMap[surfaceY]?.[flatSpotX]) {
      surfaceY--;
  }
  // Position rocket slightly above the surface block
  const rocketBaseBlockY = surfaceY + 1; // The Y index of the block the rocket sits ON
  const rocketHeightInBlocks = 5; // How many blocks tall the rocket visually is (adjust as needed)
  const rocketBlockY = rocketBaseBlockY - rocketHeightInBlocks; // Top-left block Y


  if (!gameState.rocket) {
    gameState.rocket = { width: 64, height: 128 }; // Default size if needed
  }

  // Set block coordinates (use center block X for consistency)
  gameState.rocketX = flatSpotX; // Block X where the rocket is centered
  gameState.rocketY = rocketBlockY; // Block Y for the top-left of the rocket

  // Convert block coordinates to pixel coordinates for rendering
  // Adjust pixel X to center the rocket image over the block X
  const rocketPixelX = (flatSpotX * gameState.blockSize) + (gameState.blockSize / 2) - (gameState.rocket.width / 2);
  const rocketPixelY = rocketBlockY * gameState.blockSize;

  gameState.rocket.x = rocketPixelX;
  gameState.rocket.y = rocketPixelY;

  gameState.hasRocket = true;
  gameState.rocketPlaced = true;

  console.log(`Rocket placed on Moon at pixels: (${Math.round(gameState.rocket.x)}, ${Math.round(gameState.rocket.y)}), blocks: (${gameState.rocketX}, ${gameState.rocketY}), surfaceY: ${surfaceY}`);
}

// Helper function to find a flat spot on the surface (Unchanged, but added safety)
function findFlatSpotOnSurface(startX, skyRows) {
  const minFlatLength = 6;
  let bestFlatSpotX = startX;
  let bestFlatLength = 0;

  for (let direction of [1, -1]) {
    let currentFlatLength = 0;
    let lastSurfaceY = -1;

    for (let offset = 0; offset < gameState.worldWidth / 3; offset++) {
      const currentX = startX + offset * direction;

      if (currentX < 1 || currentX >= gameState.worldWidth - 1) break; // Stay within bounds

      let currentSurfaceY = skyRows;
      while (currentSurfaceY < gameState.worldHeight - 1 && (!gameState.blockMap[currentSurfaceY] || !gameState.blockMap[currentSurfaceY][currentX])) {
        currentSurfaceY++;
      }
      // If we hit the bottom and found no block, treat it as surfaceY (unlikely)
       if(currentSurfaceY === gameState.worldHeight -1 && !gameState.blockMap[currentSurfaceY]?.[currentX]) {
           // Cannot place here, maybe return startX or log error
           console.warn(`Could not find solid ground at x=${currentX} for flat spot calculation.`);
           continue; // Try next spot
       }

      if (lastSurfaceY === -1) { // First block checked in this direction
        lastSurfaceY = currentSurfaceY;
        currentFlatLength = 1;
      } else if (currentSurfaceY === lastSurfaceY) { // Still flat
        currentFlatLength++;
      } else { // Height changed, reset
        lastSurfaceY = currentSurfaceY;
        currentFlatLength = 1;
      }

      if (currentFlatLength > bestFlatLength) {
        bestFlatLength = currentFlatLength;
        // Aim for the center of the discovered flat area
        bestFlatSpotX = currentX - direction * Math.floor(currentFlatLength / 2);

        if (bestFlatLength >= minFlatLength) {
          // Ensure the chosen center isn't out of bounds
          return Math.max(1, Math.min(gameState.worldWidth - 2, bestFlatSpotX));
        }
      }
    }
  }
    // Ensure the final fallback isn't out of bounds
  return Math.max(1, Math.min(gameState.worldWidth - 2, bestFlatSpotX));
}

// Setup moon background with CSS stars (Unchanged)
function setupMoonBackground() {
  const background = document.getElementById("fixed-background");
  if (!background) return;

  background.style.width = gameState.worldWidth * gameState.blockSize + "px";
  background.style.height = gameState.worldHeight * gameState.blockSize + "px";

  const skyHeightPixels = gameState.skyRows * gameState.blockSize;

  // Simplified gradient for moon
  background.style.background = `
    linear-gradient(
      to bottom,
      #000000 0%,         /* Deep space */
      #0a0a1a 30%,        /* Dark blue/black near space */
      #1a1a2a ${skyHeightPixels}px,  /* Darker near surface */
      #888888 ${skyHeightPixels + gameState.blockSize}px, /* Grey surface */
      #707070 ${skyHeightPixels + gameState.blockSize * 10}px, /* Darker grey below */
      #606060 ${skyHeightPixels + gameState.blockSize * 30}px  /* Even darker */
    )
  `;

  addCSSStarsToBackground();
  addEarthToSky();
}

// Add stars to the moon background using CSS only (Unchanged)
function addCSSStarsToBackground() {
    const gameWorld = document.getElementById("game-world");
    if(!gameWorld) return;

    const existingStars = document.getElementById("moon-stars");
    if (existingStars) existingStars.remove();
    const existingBrightStars = document.getElementById("bright-stars");
    if (existingBrightStars) existingBrightStars.remove();


    const starsContainer = document.createElement("div");
    starsContainer.id = "moon-stars";
    starsContainer.style.height = `${gameState.skyRows * gameState.blockSize}px`; // Limit stars to sky

    const fragment = document.createDocumentFragment();
    const starCount = 150;
    for (let i = 0; i < starCount; i++) {
        const star = document.createElement("div");
        const starType = Math.floor(Math.random() * 3) + 1;
        star.className = `star type-${starType}`;
        star.style.left = `${Math.random() * 100}%`;
        star.style.top = `${Math.random() * 95}%`; // Keep slightly away from horizon
        star.style.animationDelay = `${Math.random() * 6}s`;
        fragment.appendChild(star);
    }
    starsContainer.appendChild(fragment);
    gameWorld.appendChild(starsContainer);

    const brightStarsContainer = document.createElement("div");
    brightStarsContainer.id = "bright-stars";
    brightStarsContainer.style.height = `${gameState.skyRows * gameState.blockSize}px`;

    const brightFragment = document.createDocumentFragment();
    const brightStarCount = 7;
     for (let i = 0; i < brightStarCount; i++) {
        const brightStar = document.createElement("div");
        brightStar.className = 'bright-star'; // Assuming CSS defines .bright-star
        brightStar.style.left = `${Math.random() * 100}%`;
        brightStar.style.top = `${Math.random() * 90}%`; // Keep away from horizon
        brightStar.style.animation = `twinkle-2 ${4 + Math.random() * 4}s infinite linear`;
        brightStar.style.animationDelay = `${Math.random() * 5}s`;
        brightFragment.appendChild(brightStar);
    }
    brightStarsContainer.appendChild(brightFragment);
    gameWorld.appendChild(brightStarsContainer);
}


// Add Earth in the moon sky (Unchanged)
function addEarthToSky() {
    const gameWorld = document.getElementById("game-world");
    if(!gameWorld) return;

    const existingEarth = document.getElementById("earth-in-sky");
    if (existingEarth) existingEarth.remove();

    const earth = document.createElement("div");
    earth.id = "earth-in-sky"; // Assuming CSS defines #earth-in-sky position and appearance
    gameWorld.appendChild(earth);
}