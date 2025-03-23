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
  money: 1000,
  depth: 0,
  mouseHeld: false,
  pickaxeLevel: 1,
  pickaxeSpeed: 1,
  bagSize: 10,
  inventory: {},
  blockSize: 60,
  worldWidth: 50, // blocks
  worldHeight: 1000, // blocks
  skyRows: 10, // Height of sky in blocks
  visibleBlocks: [],
  gravity: 0.5,
  blockMap: [],
  hasJetpack: false,
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
  ores: [
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
    {
      name: "coal",
      value: 5,
      color: "coal",
      minVein: 3,
      maxVein: 12,
      minDepth: 1,
      maxDepth: 100,
      chance: 20,
      depthModifiers: [
        { depth: 25, multiplier: 0.5 },
        { depth: 50, multiplier: 0.2 },
      ],
    },
    {
      name: "iron",
      value: 10,
      color: "iron",
      minVein: 4,
      maxVein: 12,
      minDepth: 10,
      maxDepth: 100,
      chance: 8,
      depthModifiers: [{ depth: 75, multiplier: 0.5 }],
    },
    {
      name: "gold",
      value: 25,
      color: "gold",
      minVein: 3,
      maxVein: 12,
      minDepth: 50,
      maxDepth: 150,
      chance: 5,
    },
    {
      name: "emerald",
      value: 50,
      color: "emerald",
      minVein: 3,
      maxVein: 12,
      minDepth: 100,
      maxDepth: 200,
      chance: 5,
    },
    {
      name: "ruby",
      value: 75,
      color: "ruby",
      minVein: 3,
      maxVein: 12,
      minDepth: 100,
      maxDepth: 250,
      chance: 5,
    },
    {
      name: "diamond",
      value: 100,
      color: "diamond",
      minVein: 3,
      maxVein: 12,
      minDepth: 200,
      maxDepth: 300,
      chance: 3,
    },
    /*{ // Could be used later for harder moon rock
      name: "basalt",
      value: 0,
      color: "basalt", // Dark gray
      hardness: 2,
      minVein: 0,
      maxVein: 0,
      minDepth: 2,
      maxDepth: Infinity,
      chance: 0.7,
      moonOnly: true,
    },*/
    {
      name: "silicon",
      value: 15,
      color: "silicon", // Silver-gray
      hardness: 2,
      minVein: 4,
      maxVein: 12,
      minDepth: 1,
      maxDepth: 80,
      chance: 15,
      depthModifiers: [{ depth: 40, multiplier: 0.5 }],
      moonOnly: true,
    },
    /*{
      name: "aluminum",
      value: 20,
      color: "aluminum", // Silver-white
      hardness: 2,
      minVein: 3,
      maxVein: 10,
      minDepth: 5,
      maxDepth: 90,
      chance: 12,
      depthModifiers: [
        { depth: 50, multiplier: 0.5 },
      ],
      moonOnly: true,
    }, */
    {
      name: "magnesium",
      value: 40,
      color: "magnesium", // Bright white
      hardness: 3,
      minVein: 3,
      maxVein: 8,
      minDepth: 30,
      maxDepth: 120,
      chance: 8,
      moonOnly: true,
    },
    {
      name: "titanium",
      value: 75,
      color: "titanium", // Metallic gray
      hardness: 4,
      minVein: 2,
      maxVein: 7,
      minDepth: 50,
      maxDepth: 150,
      chance: 6,
      moonOnly: true,
    },
    {
      name: "platinum",
      value: 150,
      color: "platinum", // Bright silver
      hardness: 5,
      minVein: 1,
      maxVein: 5,
      minDepth: 100,
      maxDepth: 200,
      chance: 4,
      moonOnly: true,
    },
    {
      name: "lunarite",
      value: 300,
      color: "lunarite", // Bright blue
      hardness: 6,
      minVein: 1,
      maxVein: 3,
      minDepth: 160,
      maxDepth: 250,
      chance: 2,
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
    y: 450,
    width: 150,
    height: 150,
  },
  shopItems: [
    {
      id: "pickaxe-upgrade",
      name: "Better Pickaxe",
      basePrice: 50,
      description: "Mine faster",
      getPrice: (level) => 50 * level,
    },
    {
      id: "bag-upgrade",
      name: "Bigger Bag",
      basePrice: 100,
      description: "+5 capacity",
      getPrice: (level) => 100 * (level / 2),
    },
    {
      id: "jetpack",
      name: "Jetpack",
      description:
        "Allows you to fly temporarily. Hold SPACE to activate while in the air.",
      getPrice: () => 10, // Set price for jetpack
      available: () => !gameState.hasJetpack, // Only available if the player doesn't have it
    },
    {
      id: "refill-jetpack",
      name: "Refill Jetpack",
      description: "Fill your jetpack tank with fuel.",
      getPrice: () => gameState.jetpackRefillCost,
      available: () =>
        gameState.hasJetpack &&
        gameState.jetpackFuel < gameState.maxJetpackFuel,
    },
    {
      id: "speed-upgrade",
      name: "Movement Speed",
      basePrice: 75,
      description: "Move faster",
      getPrice: (level) => 75 * level,
    },
    {
      id: "bomb",
      name: "Bomb",
      description: "Explodes to clear multiple blocks at once. Press B to use.",
      getPrice: () => 10,
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
      getPrice: () => 20,
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
          row.push(this.blockMap[y][x] ? this.blockMap[y][x].name : null);
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
          row.push(
            this.earthBlockMap[y][x] ? this.earthBlockMap[y][x].name : null
          );
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
          row.push(
            this.moonBlockMap[y][x] ? this.moonBlockMap[y][x].name : null
          );
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
            const oreName = compressedMap[y][x];
            if (oreName === null) {
              expandedMap[y][x] = null;
            } else {
              // Find the matching ore object by name
              const ore = this.ores.find((ore) => ore.name === oreName);
              expandedMap[y][x] = ore || null; // Use null as fallback if ore not found
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
