// menuBackground.js - Enhanced world background for main menu with real textures

/**
 * A small version of the game world to display behind the main menu
 * with real blocks, ores, and animated clouds
 */

import { gameState } from "./config.js";

let menuBackgroundAnimationId = null;
let lastFrameTime = 0;
const FRAME_RATE = 60;
const FRAME_DELAY = 1000 / FRAME_RATE;

// Mini world dimensions (fills screen)
let MINI_WORLD_WIDTH;
let MINI_WORLD_HEIGHT;
const MINI_BLOCK_SIZE = 60; // Larger blocks as requested (60x60)
const MINI_SKY_ROWS_RATIO = 0.4; // 40% of height is sky
let MINI_SKY_ROWS;
const SURFACE_LAYER_DEPTH = 2; // Number of dirt blocks below grass

// Cache for the mini world blocks
let miniWorldBlockMap = [];
let miniWorldOres = null;

/**
 * Initialize the menu background with a miniature game world
 */
export function initializeMenuBackground() {
    // First check if background already exists
    if (document.getElementById("menu-background")) {
        return;
    }
    
    // Create the menu background container
    // Find the menu element to see where we should add our background
    const mainMenu = document.getElementById("main-menu");
    let parentElement = document.body;
    
    // If the menu exists, use its parent instead of body
    if (mainMenu && mainMenu.parentElement) {
        parentElement = mainMenu.parentElement;
    }
    
    // Create menu background
    const menuBackground = document.createElement("div");
    menuBackground.id = "menu-background";
    menuBackground.style.position = "absolute";
    menuBackground.style.top = "0";
    menuBackground.style.left = "0";
    menuBackground.style.width = "100%";
    menuBackground.style.height = "100%";
    menuBackground.style.zIndex = "-1"; // Behind the menu
    menuBackground.style.overflow = "hidden"; // Hide elements that go outside
    
    // Create a sky gradient as a base background
    const skyBackground = document.createElement("div");
    skyBackground.id = "menu-sky-background";
    skyBackground.style.position = "absolute";
    skyBackground.style.top = "0";
    skyBackground.style.left = "0";
    skyBackground.style.width = "100%";
    skyBackground.style.height = "100%";
    skyBackground.style.background = `linear-gradient(
        to bottom,
        #64B5F6 0%,
        #90CAF9 40%,
        #BBDEFB 70%
    )`;
    
    // Calculate world dimensions based on screen size
    calculateWorldDimensions();
    
    // Create container for the mini world
    const miniWorld = document.createElement("div");
    miniWorld.id = "menu-mini-world";
    miniWorld.style.position = "absolute";
    miniWorld.style.top = "0"; // Start from top
    miniWorld.style.left = "0"; // Start from left
    miniWorld.style.width = "100%";
    miniWorld.style.height = "100%";
    
    // Create the cloud layer for the menu
    const cloudLayer = document.createElement("div");
    cloudLayer.id = "menu-cloud-layer";
    cloudLayer.style.position = "absolute";
    cloudLayer.style.top = "0";
    cloudLayer.style.left = "0";
    cloudLayer.style.width = "100%";
    // Clouds appear only above the grass line
    cloudLayer.style.height = `${MINI_SKY_ROWS * MINI_BLOCK_SIZE}px`;
    cloudLayer.style.pointerEvents = "none"; // Don't block interactions
    
    // Add elements to the background
    menuBackground.appendChild(skyBackground);
    menuBackground.appendChild(miniWorld);
    menuBackground.appendChild(cloudLayer);
    
    // Add the background to the parent element
    parentElement.appendChild(menuBackground);
    
    // Generate mini world with blocks and ores
    generateMiniWorld(miniWorld);
    
    // Create initial clouds
    for (let i = 0; i < 8; i++) {
        createCloud(true);
    }
    
    // Add resize event listener to adjust world dimensions
    window.addEventListener('resize', handleResize);
    
    // Start the animation loop
    menuBackgroundAnimationId = requestAnimationFrame(updateMenuBackground);
}

/**
 * Calculate world dimensions based on screen size
 */
function calculateWorldDimensions() {
    // Calculate how many blocks can fit in the screen
    MINI_WORLD_WIDTH = Math.ceil(window.innerWidth / MINI_BLOCK_SIZE);
    MINI_WORLD_HEIGHT = Math.ceil(window.innerHeight / MINI_BLOCK_SIZE);
    // The sky rows calculation stays the same, but we'll move the grass down in getBlockForPosition
    MINI_SKY_ROWS = Math.floor(MINI_WORLD_HEIGHT * MINI_SKY_ROWS_RATIO);
}

/**
 * Handle window resize event
 */
function handleResize() {
    // Recalculate world dimensions
    calculateWorldDimensions();
    
    // Regenerate the world
    const miniWorld = document.getElementById("menu-mini-world");
    if (miniWorld) {
        generateMiniWorld(miniWorld);
    }
}

/**
 * Generate a small version of the game world with blocks and ores
 * @param {HTMLElement} miniWorldElement - The container element for the mini world
 */
function generateMiniWorld(miniWorldElement) {
    // Clear the container
    miniWorldElement.innerHTML = '';
    
    // Initialize ore references if needed
    if (!miniWorldOres) {
        initializeMiniWorldOres();
    }
    
    // Initialize the block map
    miniWorldBlockMap = [];
    
    // Create blocks for the mini world
    for (let y = 0; y < MINI_WORLD_HEIGHT; y++) {
        const row = [];
        for (let x = 0; x < MINI_WORLD_WIDTH; x++) {
            // Sky area remains null
            if (y < MINI_SKY_ROWS) {
                row.push(null);
                continue;
            }
            
            // Get the block type for this position
            const block = getBlockForPosition(x, y);
            row.push(block);
            
            // Create a visual block element if not sky
            if (block) {
                createVisualBlock(miniWorldElement, x, y, block);
            }
        }
        miniWorldBlockMap.push(row);
    }
    
    // Add ore veins in a second pass
    addOreVeins(miniWorldElement);
}

/**
 * Initialize ore references for the mini world
 */
function initializeMiniWorldOres() {
    miniWorldOres = {};
    
    // Add all Earth ores (exclude moonOnly ores)
    gameState.ores.forEach(ore => {
        if (!ore.moonOnly) {
            miniWorldOres[ore.name] = ore;
        }
    });
}

/**
 * Create a visual block element in the mini world using CSS classes for textures
 * @param {HTMLElement} container - The mini world container
 * @param {number} x - Block x position
 * @param {number} y - Block y position
 * @param {Object} blockType - Block type information
 */
function createVisualBlock(container, x, y, blockType) {
    const block = document.createElement("div");
    block.className = "block"; // Base class for all blocks
    block.classList.add(blockType.name); // Add specific block type class for texture
    block.dataset.x = x;
    block.dataset.y = y;
    block.dataset.type = blockType.name;
    
    // Position the block
    block.style.position = "absolute";
    block.style.left = `${x * MINI_BLOCK_SIZE}px`;
    block.style.top = `${y * MINI_BLOCK_SIZE}px`;
    block.style.width = `${MINI_BLOCK_SIZE}px`;
    block.style.height = `${MINI_BLOCK_SIZE}px`;
    
    container.appendChild(block);
    return block;
}

/**
 * Determine what block should be at a specific position in the mini world
 * @param {number} x - Block x position
 * @param {number} y - Block y position
 * @returns {Object} The block type
 */
function getBlockForPosition(x, y) {
    // Add 3 blocks of offset to move grass down
    const GRASS_OFFSET = 3;
    const depthFromSurface = y - (MINI_SKY_ROWS + GRASS_OFFSET);
    
    // Sky area even with offset
    if (depthFromSurface < 0) {
        return null;
    }
    // Surface layer is grass
    else if (depthFromSurface === 0) {
        return miniWorldOres.grass;
    }
    // Dirt layer
    else if (depthFromSurface <= SURFACE_LAYER_DEPTH) {
        return miniWorldOres.dirt;
    }
    // Below dirt layer is primarily stone
    else {
        const stoneChance = Math.min(0.9, 0.3 + (depthFromSurface - SURFACE_LAYER_DEPTH) * 0.1);
        return Math.random() < stoneChance ? miniWorldOres.stone : miniWorldOres.dirt;
    }
}

/**
 * Add ore veins to the mini world
 * @param {HTMLElement} container - The mini world container
 */
function addOreVeins(container) {
    // Add ore veins for Earth ores
    gameState.ores.forEach(ore => {
        // Skip basic terrain and moon-only ores
        if (['grass', 'dirt', 'stone'].includes(ore.name) || ore.moonOnly) {
            return;
        }
        
        // Number of veins is based on ore rarity (higher chance = more veins)
        const baseVeinCount = Math.max(1, Math.ceil(ore.chance / 5));
        // Scale vein count with world size
        const scaleFactor = (MINI_WORLD_WIDTH * MINI_WORLD_HEIGHT) / (30 * 20);
        const veinCount = Math.max(1, Math.floor(baseVeinCount * scaleFactor));
        
        for (let i = 0; i < veinCount; i++) {
            createOreVein(container, ore);
        }
    });
}

/**
 * Create a vein of a specific ore in the mini world
 * @param {HTMLElement} container - The mini world container
 * @param {Object} ore - The ore type to create
 */
function createOreVein(container, ore) {
    // Account for the 3-block grass offset when placing ores
    const GRASS_OFFSET = 3;
    // Calculate actual depth positions
    const minY = MINI_SKY_ROWS + GRASS_OFFSET + (ore.minDepth || 3);
    const maxY = Math.min(MINI_WORLD_HEIGHT - 1, MINI_SKY_ROWS + GRASS_OFFSET + (ore.maxDepth || 15));
    
    // Pick a random starting point for the vein
    const startY = Math.floor(Math.random() * (maxY - minY + 1)) + minY;
    const startX = Math.floor(Math.random() * MINI_WORLD_WIDTH);
    
    // Only place ores in stone blocks
    if (!miniWorldBlockMap[startY] || 
        !miniWorldBlockMap[startY][startX] || 
        miniWorldBlockMap[startY][startX]?.name !== "stone") {
        return;
    }
    
    // Determine vein size
    const veinSize = 3 + Math.floor(Math.random() * 3);
    
    // Use a simple algorithm to create a vein shape
    const queue = [{x: startX, y: startY}];
    const placed = new Set();
    const key = (x, y) => `${x},${y}`;
    
    // Place the first ore block
    miniWorldBlockMap[startY][startX] = ore;
    placed.add(key(startX, startY));
    
    // Update the visual block
    updateVisualBlock(container, startX, startY, ore);
    
    // Expand the vein
    while (queue.length > 0 && placed.size < veinSize) {
        const pos = queue.shift();
        
        // Define possible directions
        const directions = [
            {dx: -1, dy: 0}, {dx: 1, dy: 0}, 
            {dx: 0, dy: -1}, {dx: 0, dy: 1},
            {dx: -1, dy: -1}, {dx: 1, dy: 1},
            {dx: -1, dy: 1}, {dx: 1, dy: -1}
        ];
        
        // Shuffle directions for natural patterns
        shuffleArray(directions);
        
        // Try each direction
        for (const dir of directions) {
            const nx = pos.x + dir.dx;
            const ny = pos.y + dir.dy;
            
            // Skip if out of bounds
            if (nx < 0 || nx >= MINI_WORLD_WIDTH || ny < minY || ny > maxY) {
                continue;
            }
            
            // Skip if already placed or not stone
            if (placed.has(key(nx, ny)) || 
                !miniWorldBlockMap[ny] || 
                !miniWorldBlockMap[ny][nx] || 
                miniWorldBlockMap[ny][nx]?.name !== "stone") {
                continue;
            }
            
            // 50% chance to place an ore in this direction
            if (Math.random() < 0.5) {
                miniWorldBlockMap[ny][nx] = ore;
                placed.add(key(nx, ny));
                
                // Update the visual block
                updateVisualBlock(container, nx, ny, ore);
                
                // Add to queue for further expansion
                queue.push({x: nx, y: ny});
                
                // Break if we reached the target size
                if (placed.size >= veinSize) {
                    break;
                }
            }
        }
    }
}

/**
 * Update a visual block in the mini world using CSS classes for textures
 * @param {HTMLElement} container - The mini world container
 * @param {number} x - Block x position
 * @param {number} y - Block y position
 * @param {Object} blockType - The new block type
 */
function updateVisualBlock(container, x, y, blockType) {
    // Find the existing block element
    let block = container.querySelector(`.block[data-x="${x}"][data-y="${y}"]`);
    
    // If it doesn't exist, create it
    if (!block) {
        block = createVisualBlock(container, x, y, blockType);
    } else {
        // Update existing block - first remove all ore type classes
        const classList = [...block.classList];
        classList.forEach(className => {
            if (className !== 'block' && className !== 'menu-world-block') {
                block.classList.remove(className);
            }
        });
        
        // Add the new block type class
        block.classList.add(blockType.name);
        block.dataset.type = blockType.name;
    }
    
    return block;
}

/**
 * Create a single cloud for the menu background
 * @param {boolean} initialPlacement - Whether to place clouds across screen initially
 */
function createCloud(initialPlacement = false) {
    const cloudLayer = document.getElementById("menu-cloud-layer");
    if (!cloudLayer) return;
    
    const containerWidth = cloudLayer.clientWidth || window.innerWidth;
    // Use the actual cloud layer height which now matches the sky area
    const containerHeight = cloudLayer.clientHeight || (MINI_SKY_ROWS * MINI_BLOCK_SIZE);
    
    const cloud = document.createElement("div");
    cloud.className = "menu-cloud";
    
    // Random cloud size
    const cloudWidth = 100 + Math.random() * 150;
    const cloudHeight = 30 + Math.random() * 40;
    
    cloud.style.width = `${cloudWidth}px`;
    cloud.style.height = `${cloudHeight}px`;
    
    // Set cloud appearance
    cloud.style.backgroundColor = "rgba(255, 255, 255, 0.8)";
    const borderRadius = 15 + Math.random() * 15;
    cloud.style.borderRadius = `${borderRadius}px`;
    cloud.style.position = "absolute";
    
    // Add some volume/depth to the clouds
    cloud.style.boxShadow = "0 0 15px rgba(255, 255, 255, 0.5)";
    
    // Vary cloud opacity slightly
    const opacity = 0.7 + Math.random() * 0.3;
    cloud.style.opacity = opacity.toString();
    
    // Initial position
    let posX;
    if (initialPlacement) {
        // For initial placement, distribute clouds across the screen
        posX = Math.random() * containerWidth;
    } else {
        // For new clouds, start off-screen to the left
        posX = -cloudWidth;
    }
    
    // Random height but focus on the upper part of the sky
    const posY = Math.random() * (containerHeight * 0.7);
    
    cloud.style.transform = `translate(${posX}px, ${posY}px)`;
    
    // Set cloud speed (pixels per second)
    const speed = 10 + Math.random() * 20;
    cloud.dataset.speed = speed.toString();
    cloud.dataset.posX = posX.toString();
    cloud.dataset.posY = posY.toString();
    
    cloudLayer.appendChild(cloud);
    
    return cloud;
}

/**
 * Update the menu background animation
 * @param {DOMHighResTimeStamp} timestamp - The current timestamp
 */
function updateMenuBackground(timestamp) {
    // Check if the background still exists
    const menuBackground = document.getElementById("menu-background");
    if (!menuBackground) {
        // If background is gone, stop the animation
        if (menuBackgroundAnimationId) {
            cancelAnimationFrame(menuBackgroundAnimationId);
            menuBackgroundAnimationId = null;
        }
        return;
    }
    
    // Skip if menu is not visible
    const mainMenu = document.getElementById("main-menu");
    if (!mainMenu || mainMenu.style.display !== "flex") {
        menuBackgroundAnimationId = requestAnimationFrame(updateMenuBackground);
        return;
    }
    
    const elapsed = timestamp - lastFrameTime;
    
    if (elapsed > FRAME_DELAY) {
        lastFrameTime = timestamp - (elapsed % FRAME_DELAY);
        
        const cloudLayer = document.getElementById("menu-cloud-layer");
        if (cloudLayer) {
            const containerWidth = cloudLayer.clientWidth || window.innerWidth;
            const clouds = document.querySelectorAll(".menu-cloud");
            
            // Update each cloud position
            clouds.forEach(cloud => {
                const speed = parseFloat(cloud.dataset.speed) || 15;
                const deltaTime = elapsed / 1000; // Convert to seconds
                
                // Calculate new position
                let posX = parseFloat(cloud.dataset.posX || 0) + speed * deltaTime;
                const posY = parseFloat(cloud.dataset.posY || 0);
                
                // Update stored position
                cloud.dataset.posX = posX.toString();
                
                // Update visual position
                cloud.style.transform = `translate(${posX}px, ${posY}px)`;
                
                // Remove cloud if it's off-screen and create a new one
                if (posX > containerWidth) {
                    cloud.remove();
                    createCloud();
                }
            });
            
            // Add a new cloud occasionally
            if (clouds.length < 8 && Math.random() < 0.01) {
                createCloud();
            }
        }
    }
    
    // Continue the animation loop
    menuBackgroundAnimationId = requestAnimationFrame(updateMenuBackground);
}

/**
 * Clean up the menu background when starting the game
 */
export function cleanupMenuBackground() {
    // Cancel the animation frame
    if (menuBackgroundAnimationId) {
        cancelAnimationFrame(menuBackgroundAnimationId);
        menuBackgroundAnimationId = null;
    }
    
    // Remove resize event listener
    window.removeEventListener('resize', handleResize);
    
    // Remove the background element
    const menuBackground = document.getElementById("menu-background");
    if (menuBackground) {
        menuBackground.remove();
    }
    
    // Clear the mini world data
    miniWorldBlockMap = [];
}

/**
 * Helper function to shuffle an array
 * @param {Array} array - The array to shuffle
 * @returns {Array} The shuffled array
 */
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}