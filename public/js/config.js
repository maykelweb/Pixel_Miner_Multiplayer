// config.js
import { updateUI } from "./updates.js";
import { showMessage } from "./setup.js";

export const gameState = {
  playerId: null, // Stores the socket ID for this player
  multiplayer: {
    active: false,
    isHost: false,
    roomCode: null,
    playerName: "Player",
    connectedPlayers: [],
  },
  money: 10000,
  depth: 0,
  mouseHeld: false,
  pickaxeLevel: 1,
  pickaxeSpeed: 1,
  bagSize: 1000,
  maxBagSize: 990,
  inventory: {},
  blockSize: 60,
  worldWidth: 50, // blocks
  worldHeight: 500, // blocks
  skyRows: 10, // Height of sky in blocks
  visibleBlocks: [],
  gravity: 0.5,
  blockMap: [],
  hasJetpack: false,
  jetpackLevel: 1,
  jetpackFuel: 0,
  maxJetpackFuel: 100,
  jetpackRefillCost: 50,
  jetpackSpeed: 0.7,
  jetpackMaxSpeed: 5,
  jetpackUsage: 0.1, // Fuel usage per frame while flying
  bombs: 0, // Number of bombs in inventory
  maxBombs: 99, // Maximum number of bombs player can carry
  bombRadius: 3, // Explosion radius in blocks
  bombTimer: 3000, // Time until explosion in milliseconds
  activeBombs: [], // Array to track placed bombs
  activeExplosions: [], // Array to track active explosions
  laserSpeed: 3, // How fast the laser mines (1.5x faster than pickaxe)
  laserMineTimer: 0, // Timer for laser mining
  laserMiningTarget: null, // Current block being mined with laser
  hasLaser: true, // Whether the player has unlocked the laser
  isPlayerDead: false,
  blockMiningDuration: 1000, //base duration for mining a block in ms
  miningTarget: null,
  targetBlock: null, // Current block being targeted
  miningLocked: false,
  miningSound: null,
  crafting: {
    availableTools: [],
    equippedTools: {},
    currentToolType: "pickaxe",
  },
  craftingOpen: false,
  hasRocket: false,
  rocketPlaced: false,
  rocket: {
    x: 1400,
    y: 300,
    width: 300,
    height: 300,
  },
  currentPlanet: "earth",
  earthBlockMap: [], // Store Earth blockMap separately
  moonBlockMap: [], // Store Moon blockMap separately
  isJoiningMultiplayer: false, // Flag to indicate we're joining someone else's game
  needToUploadWorld: false, // Flag for hosts to upload world data
  playerId: null, // Will be set when connected to server
  forceNewWorld: false, // Flag to force new world generation for hosting
  isWaitingForWorldData: false, // Flag when waiting to load world when joining
  // EARTH ORES
  ores: [
    // Basic surface materials
    {
      name: "grass",
      value: 1,
      color: "grass",
      minVein: 0,
      maxVein: 0,
      minDepth: 0,
      maxDepth: 1,
      chance: 1,
    },
    {
      name: "dirt",
      value: 0,
      color: "dirt",
      minVein: 3,
      maxVein: 15,
      minDepth: 0,
      maxDepth: Infinity,
      chance: 1,
    },
    {
      name: "stone",
      value: 0,
      color: "stone",
      minVein: 0,
      maxVein: 0,
      minDepth: 2,
      maxDepth: Infinity,
      chance: 0.7,
    },

    // Tier 1 - Early Game Resources
    {
      name: "coal",
      value: 5,
      color: "coal",
      minVein: 4,
      maxVein: 14,
      minDepth: 1,
      maxDepth: 220, // Extended range
      chance: 25,
      depthModifiers: [
        { depth: 30, multiplier: 0.8 },
        { depth: 100, multiplier: 0.5 },
        { depth: 170, multiplier: 0.3 },
        { depth: 200, multiplier: 0.1 }, // Rare but still present at deeper levels
      ],
    },
    {
      name: "iron",
      value: 12,
      color: "iron",
      minVein: 3,
      maxVein: 10,
      minDepth: 5,
      maxDepth: 280, // Extended range
      chance: 12,
      depthModifiers: [
        { depth: 40, multiplier: 1.2 },
        { depth: 120, multiplier: 0.8 },
        { depth: 200, multiplier: 0.5 },
        { depth: 240, multiplier: 0.2 },
      ],
    },

    // Tier 2 - Mid Game Resources
    {
      name: "gold",
      value: 30,
      color: "gold",
      minVein: 2,
      maxVein: 8,
      minDepth: 35,
      maxDepth: 320, // Extended range
      chance: 7,
      depthModifiers: [
        { depth: 70, multiplier: 1.3 },
        { depth: 150, multiplier: 2.0 },
        { depth: 220, multiplier: 1.6 },
        { depth: 280, multiplier: 0.6 },
      ],
    },
    {
      name: "emerald",
      value: 55,
      color: "emerald",
      minVein: 2,
      maxVein: 7,
      minDepth: 70,
      maxDepth: 370, // Extended range
      chance: 20.5,
      depthModifiers: [
        { depth: 160, multiplier: 10.5 },
        { depth: 250, multiplier: 28.8 },
        { depth: 350, multiplier: 5.2 },
        { depth: 450, multiplier: 12.7 },
      ],
    },

    // Tier 3 - End Game Earth Resources
    {
      name: "ruby",
      value: 85,
      color: "ruby",
      minVein: 1,
      maxVein: 6,
      minDepth: 100,
      maxDepth: 420, // Extended range
      chance: 20,
      depthModifiers: [
        { depth: 100, multiplier: 0.1 },
        { depth: 160, multiplier: 10.5 },
        { depth: 250, multiplier: 28.8 },
        { depth: 350, multiplier: 5.2 },
        { depth: 450, multiplier: 12.7 },
      ],
    },
    {
      name: "diamond",
      value: 120,
      color: "diamond",
      minVein: 1,
      maxVein: 5,
      minDepth: 220,
      maxDepth: 500, // Extended to max depth
      chance: 8.5,
      depthModifiers: [
        { depth: 250, multiplier: 3.0 },
        { depth: 350, multiplier: 5.0 }, // Peak chance in deep areas
        { depth: 450, multiplier: 7.0 }, // More common at the deepest levels
      ],
    },

    // MOON ORES

    // Tier 1 - Basic Moon Resources
    {
      name: "silicon",
      value: 25,
      color: "silicon",
      hardness: 2,
      minVein: 4,
      maxVein: 12,
      minDepth: 1,
      maxDepth: 200, // Extended range
      chance: 10,
      depthModifiers: [
        { depth: 30, multiplier: 2 },
        { depth: 100, multiplier: 0.1 },
      ],
      moonOnly: true,
    },
    {
      name: "aluminum",
      value: 35,
      color: "aluminum",
      hardness: 2,
      minVein: 3,
      maxVein: 10,
      minDepth: 10,
      maxDepth: 230, // Extended range
      chance: 12,
      depthModifiers: [
        { depth: 40, multiplier: 1.2 },
        { depth: 120, multiplier: 0.8 },
        { depth: 200, multiplier: 0.5 },
        { depth: 240, multiplier: 0.2 },
      ],
      moonOnly: true,
    },

    // Tier 2 - Intermediate Moon Resources
    {
      name: "magnesium",
      value: 60,
      color: "magnesium",
      hardness: 3,
      minVein: 2,
      maxVein: 8,
      minDepth: 70,
      maxDepth: 280, // Extended range
      chance: 14,
      depthModifiers: [
        { depth: 70, multiplier: 1.3 },
        { depth: 150, multiplier: 2.0 },
        { depth: 220, multiplier: 1.6 },
        { depth: 280, multiplier: 0.6 },
      ],
      moonOnly: true,
    },
    {
      name: "titanium",
      value: 100,
      color: "titanium",
      hardness: 4,
      minVein: 2,
      maxVein: 6,
      minDepth: 60,
      maxDepth: 320, // Extended range
      chance: 10.5,
      depthModifiers: [
        { depth: 120, multiplier: 2 },
        { depth: 200, multiplier: 3 },
        { depth: 220, multiplier: 3 },
        { depth: 240, multiplier: 3 },
        { depth: 260, multiplier: 3 },
        { depth: 280, multiplier: 2 },
        { depth: 330, multiplier: 1 },
      ],
      moonOnly: true,
    },

    // Tier 3 - Advanced Moon Resources
    {
      name: "platinum",
      value: 180,
      color: "platinum",
      hardness: 5,
      minVein: 2,
      maxVein: 6,
      minDepth: 100,
      maxDepth: 420, // Extended range
      chance: 20,
      depthModifiers: [
        { depth: 100, multiplier: 0.1 },
        { depth: 160, multiplier: 10.5 },
        { depth: 250, multiplier: 28.8 },
        { depth: 350, multiplier: 5.2 },
      ],
      moonOnly: true,
    },
    {
      name: "lunarite",
      value: 350,
      color: "lunarite",
      hardness: 6,
      minVein: 1,
      maxVein: 4,
      minDepth: 180,
      maxDepth: 440, // Extended range
      chance: 4.5,
      depthModifiers: [
        { depth: 250, multiplier: 3.0 },
        { depth: 350, multiplier: 4.0 }, // Peak chance in deep areas
        { depth: 450, multiplier: 5.0 }, // More common at the deepest levels
      ],
      moonOnly: true,
    },

    // Tier 4 - Ultimate Moon Resource
    {
      name: "celestium",
      value: 650,
      color: "celestium",
      hardness: 7,
      minVein: 1,
      maxVein: 2,
      minDepth: 250,
      maxDepth: 500, // Extended to max depth
      chance: 1,
      depthModifiers: [
        { depth: 300, multiplier: 1.5 },
        { depth: 370, multiplier: 2.0 },
        { depth: 430, multiplier: 2.5 }, // Significantly more common at the deepest levels
        { depth: 480, multiplier: 3.0 }, // Greatest chance at near-maximum depth
      ],
      moonOnly: true,
    },
  ],

  player: {
    x: 280,
    y: 550,
    lastX: 280,
    lastY: 550,
    width: 40,
    height: 50,
    health: 100,
    maxHealth: 100,
    speed: 6,
    jumpPower: 12,
    jumpCount: 0,
    velocityX: 0,
    velocityY: 0,
    isJumping: false,
    onGround: false,
    direction: 1, // 1 for right, -1 for left
    mining: false,
    fallDamageThreshold: 12, // Velocity threshold before taking fall damage
    fallDamageMultiplier: 5, // How much damage per unit of excess velocity
    invulnerableTime: 0, // Tracks invulnerability after taking damage
    maxInvulnerableTime: 1000, // 1 second of invulnerability after damage
  },
  camera: {
    x: 0,
    y: 0,
  },
  keys: {
    left: false,
    right: false,
    up: false,
    down: false,
    jump: false,
    mine: false,
    bomb: false,
    interact: false,
  },
  lastTime: 0,
  deltaTime: 0,
  mineTimer: 0,
  shopSign: {
    x: 950,
    y: 410,
    width: 100,
    height: 190,
  },
  shopItems: [
    {
      id: "bag-upgrade",
      name: "Bigger Bag",
      basePrice: 100,
      description: "+5 capacity",
      getPrice: (level) => Math.round(500 * (level / 2)),
      available: () => gameState.bagSize < gameState.maxBagSize,
    },
    {
      id: "jetpack",
      name: "Jetpack",
      description:
        "Allows you to fly temporarily. Hold SPACE to activate while in the air.",
      getPrice: () => 100, // Set price for jetpack
      available: () => !gameState.hasJetpack, // Only available if the player doesn't have it
    },
    {
      id: "jetpack-upgrade",
      name: "Jetpack Upgrade",
      description:
        "Improves your jetpack by reducing fuel consumption and increasing max speed.",
      getPrice: (level) => (level === 1 ? 1000 : 5000), // Level 1->2: $1,000, Level 2->3: $5,000
      available: () => gameState.hasJetpack && gameState.jetpackLevel < 3, // Available if player has jetpack and level is below 3
    },
    {
      id: "health-restore",
      name: "Health Kit",
      description:
        "Restore your health to maximum. Price based on health needed.",
      getPrice: () => {
        // Calculate percentage of health missing (0 to 1)
        const healthPercentMissing =
          1 - gameState.player.health / gameState.player.maxHealth;
        // Calculate price based on missing health
        return Math.ceil(50 * healthPercentMissing);
      },
      available: () => gameState.player.health < gameState.player.maxHealth,
    },
    {
      id: "refill-jetpack",
      name: "Refill Jetpack",
      description:
        "Fill your jetpack tank with fuel. Price based on fuel needed.",
      getPrice: () => {
        // Calculate percentage of fuel missing (0 to 1)
        const fuelPercentMissing =
          1 - gameState.jetpackFuel / gameState.maxJetpackFuel;
        // Calculate price based on missing fuel
        return Math.ceil(gameState.jetpackRefillCost * fuelPercentMissing);
      },
      available: () =>
        gameState.hasJetpack &&
        gameState.jetpackFuel < gameState.maxJetpackFuel,
    },
    {
      id: "bomb",
      name: "Bomb",
      description: "Explodes to clear multiple blocks at once. Press B to use.",
      getPrice: () => 100,
      available: () => gameState.bombs < gameState.maxBombs,
    },
    {
      id: "sell-ores",
      name: "Sell Ores",
      basePrice: 0,
      description: "Sell your ores",
      getPrice: () => 0,
    },
    {
      id: "rocket",
      name: "Space Rocket",
      description:
        "A powerful rocket that allows you to travel to the moon! Explore new territory and mine rare lunar ores.",
      getPrice: () => 5000,
      available: () => !gameState.hasRocket,
    },
  ],
  shopOpen: false,
  menuOpen: false,
  respawn: function () {
    this.player.x = 280;
    this.player.y = 550;
    this.player.health = 100;
    this.inventory = {};
    this.player.velocityX = 0;
    this.player.velocityY = 0;
    updateUI();
  },

  // Function to sync current blockmap to planet blockmap for save
  syncCurrentMapToPlanet: function () {
    // Always ensure we're updating the correct planet's map before saving
    if (this.currentPlanet === "earth" && this.blockMap) {
      // Deep clone to avoid reference issues
      this.earthBlockMap = JSON.parse(JSON.stringify(this.blockMap));
    } else if (this.currentPlanet === "moon" && this.blockMap) {
      // Deep clone to avoid reference issues
      this.moonBlockMap = JSON.parse(JSON.stringify(this.blockMap));
    }
  },

  // Save game with multiplayer awareness
  saveGame: function () {
    // Don't save if in multiplayer mode and not the host
    if (this.multiplayer.active && !this.multiplayer.isHost) {
      showMessage("Only the host can save in multiplayer mode", 3000);
      return false;
    }

    // Sync current blockMap to appropriate planet map before saving
    this.syncCurrentMapToPlanet();

    // Compress current blockMap: store ore name if block exists, or null otherwise
    const compressedBlockMap = [];
    if (this.blockMap && this.blockMap.length > 0) {
      for (let y = 0; y < this.blockMap.length; y++) {
        if (!this.blockMap[y]) continue;

        const row = [];
        for (let x = 0; x < this.blockMap[y].length; x++) {
          const block = this.blockMap[y][x];
          if (block) {
            // Store both name and className in an object
            row.push({
              name: block.name,
              className: block.className || `${block.name}1`, // Fallback to default className if not set
            });
          } else {
            row.push(null);
          }
        }
        compressedBlockMap.push(row);
      }
    }

    // Compress earthBlockMap if it exists
    const compressedEarthBlockMap = [];
    if (this.earthBlockMap && this.earthBlockMap.length > 0) {
      for (let y = 0; y < this.earthBlockMap.length; y++) {
        if (!this.earthBlockMap[y]) continue;

        const row = [];
        for (let x = 0; x < this.earthBlockMap[y].length; x++) {
          const block = this.earthBlockMap[y][x];
          if (block) {
            // Store both name and className in an object
            row.push({
              name: block.name,
              className: block.className || `${block.name}1`, // Fallback to default className if not set
            });
          } else {
            row.push(null);
          }
        }
        compressedEarthBlockMap.push(row);
      }
    }

    // Compress moonBlockMap if it exists
    const compressedMoonBlockMap = [];
    if (this.moonBlockMap && this.moonBlockMap.length > 0) {
      for (let y = 0; y < this.moonBlockMap.length; y++) {
        if (!this.moonBlockMap[y]) continue;

        const row = [];
        for (let x = 0; x < this.moonBlockMap[y].length; x++) {
          const block = this.moonBlockMap[y][x];
          if (block) {
            // Store both name and className in an object
            row.push({
              name: block.name,
              className: block.className || `${block.name}1`, // Fallback to default className if not set
            });
          } else {
            row.push(null);
          }
        }
        compressedMoonBlockMap.push(row);
      }
    }

    // Save the compressed data structure
    const gameData = {
      player: {
        health: this.player.health,
        maxHealth: this.player.maxHealth,
        speed: this.player.speed, // Added player speed
        x: this.player.x,
        y: this.player.y,
      },
      inventory: this.inventory,
      money: this.money,
      jetpackLevel: this.jetpackLevel,
      jetpackUsage: this.jetpackUsage,
      jetpackSpeed: this.jetpackSpeed,
      jetpackMaxSpeed: this.jetpackMaxSpeed,
      jetpackFuel: this.jetpackFuel,
      maxJetpackFuel: this.maxJetpackFuel,
      hasJetpack: this.hasJetpack,
      bombCount: this.bombs,
      bagSize: this.bagSize,
      pickaxeLevel: this.pickaxeLevel, // Added pickaxe level
      pickaxeSpeed: this.pickaxeSpeed,
      activeBombs: this.activeBombs, // Added activeBombs
      activeExplosions: this.activeExplosions, // Added activeExplosions
      hasLaser: this.hasLaser, // Added laser equipment
      hasMoonBoots: this.hasMoonBoots, // Added moon boots
      hasRocket: this.hasRocket, // Added rocket property
      rocketPlaced: this.rocketPlaced, // Added rocket placement state
      rocket: this.rocket, // Added rocket details
      compressedBlockMap: compressedBlockMap,
      compressedEarthBlockMap: compressedEarthBlockMap,
      compressedMoonBlockMap: compressedMoonBlockMap,
      worldWidth: this.worldWidth,
      worldHeight: this.worldHeight,
      skyRows: this.skyRows,
      blockMiningDuration: this.blockMiningDuration,
      currentPlanet: this.currentPlanet,
      depth: this.depth,
      crafting: {
        availableTools: this.crafting.availableTools,
        equippedTools: this.crafting.equippedTools,
        currentToolType: this.crafting.currentToolType,
      },
    };

    try {
      // Log the size of the save data for debugging
      const saveString = JSON.stringify(gameData);

      // Attempt to save
      localStorage.setItem("pixelMinerSave", saveString);

      showMessage("Game Saved!", 2000);
      return true;
    } catch (error) {
      console.error("Failed to save game:", error);
      console.error("Error details:", error.message);
      console.error("Stack trace:", error.stack);
      showMessage("Failed to save game!", 2000);
      return false;
    }
  },

  // Updated loadGame function that handles compressed block maps
  loadGame: function () {
    // In multiplayer mode as a client, don't load from localStorage
    if (this.multiplayer.active && !this.multiplayer.isHost) {
      return false;
    }

    const savedData = localStorage.getItem("pixelMinerSave");
    if (!savedData) {
      return false;
    }

    try {
      const gameData = JSON.parse(savedData);

      // Load player data (including speed)
      if (gameData.player) {
        this.player.health = gameData.player.health || 100;
        this.player.maxHealth = gameData.player.maxHealth || 100;
        this.player.speed = gameData.player.speed || 6; // Restoring player speed
        this.player.x = gameData.player.x || 280;
        this.player.y = gameData.player.y || 550;
      }

      // Load inventory and resources
      this.inventory = gameData.inventory || {};
      this.money = gameData.money || 0;
      this.jetpackLevel = gameData.jetpackLevel || 1;
      this.jetpackSpeed = gameData.jetpackSpeed || 0.7;
      this.jetpackMaxSpeed = gameData.jetpackMaxSpeed || 0.5;
      this.jetpackUsage = gameData.jetpackUsage || 0.1;
      this.jetpackFuel = gameData.jetpackFuel || 0;
      this.maxJetpackFuel = gameData.maxJetpackFuel || 100;
      this.hasJetpack = gameData.hasJetpack || false;
      this.bombs = gameData.bombCount || 0;
      this.bagSize = gameData.bagSize || 20;

      // Load additional properties
      this.pickaxeLevel = gameData.pickaxeLevel || 1;
      this.pickaxeSpeed = gameData.pickaxeSpeed || 1.0;
      this.blockMiningDuration = gameData.blockMiningDuration || 1000;
      this.activeBombs = gameData.activeBombs || [];
      this.activeExplosions = gameData.activeExplosions || [];
      this.hasLaser = gameData.hasLaser || false;
      this.hasMoonBoots = gameData.hasMoonBoots || false;
      this.hasRocket = gameData.hasRocket || false;
      this.rocketPlaced = gameData.rocketPlaced || false;
      this.rocket = gameData.rocket || {
        x: 1200,
        y: 300,
        width: 300,
        height: 300,
      };

      // Load world dimensions
      this.worldWidth = gameData.worldWidth || 50;
      this.worldHeight = gameData.worldHeight || 1000;
      this.skyRows = gameData.skyRows || 10;
      this.currentPlanet = gameData.currentPlanet || "earth";
      this.depth = gameData.depth || 0;

      // Function to expand compressed map back into full ore objects
      const expandCompressedMap = (compressedMap) => {
        if (!compressedMap || compressedMap.length === 0) {
          return [];
        }
      
        const expandedMap = [];
        for (let y = 0; y < compressedMap.length; y++) {
          expandedMap[y] = [];
          for (let x = 0; x < compressedMap[y].length; x++) {
            const blockData = compressedMap[y][x];
            if (blockData === null) {
              expandedMap[y][x] = null;
            } else {
              // Check if we have new format (object with name and className) or old format (just name string)
              if (typeof blockData === 'object' && blockData.name) {
                // New format - use both name and className
                const oreName = blockData.name;
                const className = blockData.className;
                
                // Find the matching ore object by name
                const ore = this.ores.find((ore) => ore.name === oreName);
                
                if (ore) {
                  // Create a copy of the ore and add the className
                  const newBlock = { ...ore };
                  newBlock.className = className;
                  expandedMap[y][x] = newBlock;
                } else {
                  expandedMap[y][x] = null; // Ore not found
                }
              } else {
                // Old format (backward compatibility) - just ore name string
                const oreName = blockData;
                const ore = this.ores.find((ore) => ore.name === oreName);
                
                if (ore) {
                  // Create a copy of the ore and add a random className
                  const newBlock = { ...ore };
                  const variant = Math.floor(Math.random() * 4) + 1;
                  newBlock.className = `${oreName}${variant}`;
                  expandedMap[y][x] = newBlock;
                } else {
                  expandedMap[y][x] = null; // Ore not found
                }
              }
            }
          }
        }
        return expandedMap;
      };

      // IMPORTANT: Check if we have any map data - log extensive debugging info
      let mapLoaded = false;

      // Check if we have the new compressed format or old format
      if (
        gameData.compressedBlockMap &&
        gameData.compressedBlockMap.length > 0
      ) {
        // New compressed format
        this.blockMap = expandCompressedMap(gameData.compressedBlockMap);
        mapLoaded = true;
      } else if (gameData.blockMap && gameData.blockMap.length > 0) {
        // Old uncompressed format - keep for backward compatibility
        this.blockMap = gameData.blockMap;
        mapLoaded = true;
      } else {
        console.warn("No blockMap data found in save!");
      }

      // Handle earth block map
      if (
        gameData.compressedEarthBlockMap &&
        gameData.compressedEarthBlockMap.length > 0
      ) {
        this.earthBlockMap = expandCompressedMap(
          gameData.compressedEarthBlockMap
        );
      } else if (gameData.earthBlockMap && gameData.earthBlockMap.length > 0) {
        this.earthBlockMap = gameData.earthBlockMap;
      } else {
      }

      // Handle moon block map
      if (
        gameData.compressedMoonBlockMap &&
        gameData.compressedMoonBlockMap.length > 0
      ) {
        this.moonBlockMap = expandCompressedMap(
          gameData.compressedMoonBlockMap
        );
      } else if (gameData.moonBlockMap && gameData.moonBlockMap.length > 0) {
        this.moonBlockMap = gameData.moonBlockMap;
      } else {
      }

      // Load crafting state
      if (gameData.crafting) {
        this.crafting.availableTools = gameData.crafting.availableTools || [];
        this.crafting.equippedTools = gameData.crafting.equippedTools || {};
        this.crafting.currentToolType =
          gameData.crafting.currentToolType || "pickaxe";
      }

      return true;
    } catch (error) {
      console.error("Failed to load game:", error);
      // If there's an error, provide more detailed information
      console.error("Error details:", error.message);
      console.error("Stack trace:", error.stack);
      return false;
    }
  },
};
