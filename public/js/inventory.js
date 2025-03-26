// inventory.js
import { gameState } from "./config.js";
import { showMessage } from "./setup.js";
import { updateUI } from "./updates.js";

// DOM Elements
let inventoryContainer = null;
let inventoryGrid = null;
let inventoryClose = null;

// Variables to track player movement
let lastPlayerX = 0;
let lastPlayerY = 0;
const MOVEMENT_THRESHOLD = 10; // pixels of movement to trigger inventory close

// Initialize the inventory UI
export function initializeInventory() {
  // Create inventory container if it doesn't exist
  if (!document.getElementById("inventory-container")) {
    createInventoryUI();
  }

  // Get DOM references
  inventoryContainer = document.getElementById("inventory-container");
  inventoryGrid = document.getElementById("inventory-grid");
  inventoryClose = document.getElementById("inventory-close");

  // Setup event listeners
  setupInventoryListeners();

  // Initialize last position tracking
  lastPlayerX = gameState.player.x;
  lastPlayerY = gameState.player.y;
}

// Create the inventory UI elements
function createInventoryUI() {
  const container = document.createElement("div");
  container.id = "inventory-container";
  container.className = "game-modal";

  // Create header
  const header = document.createElement("div");
  header.className = "inventory-header";

  // Create header content wrapper (left side)
  const headerContent = document.createElement("div");
  headerContent.className = "inventory-header-content";

  const title = document.createElement("h2");
  title.textContent = "Inventory";

  // Create bag capacity indicator
  const capacityContainer = document.createElement("div");
  capacityContainer.className = "capacity-container";

  const capacityLabel = document.createElement("span");
  capacityLabel.textContent = "Capacity: ";

  const capacityValue = document.createElement("span");
  capacityValue.id = "inventory-capacity";

  capacityContainer.appendChild(capacityLabel);
  capacityContainer.appendChild(capacityValue);

  // Add title and capacity to header content
  headerContent.appendChild(title);
  headerContent.appendChild(capacityContainer);

  // Create close button
  const closeBtn = document.createElement("button");
  closeBtn.id = "inventory-close";
  closeBtn.className = "modal-close";
  closeBtn.innerHTML = "&times;";

  // Assemble the header
  header.appendChild(headerContent);
  header.appendChild(closeBtn);

  // Create inventory grid
  const inventoryGrid = document.createElement("div");
  inventoryGrid.id = "inventory-grid";

  // Assemble the UI
  container.appendChild(header);
  container.appendChild(inventoryGrid);

  document.body.appendChild(container);
}

// Set up event listeners for the inventory
function setupInventoryListeners() {
  // Close button
  inventoryClose.addEventListener("click", closeInventory);

  // Close on Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && gameState.inventoryOpen) {
      closeInventory();
    }
  });

  // Toggle inventory with 'I' key
  document.addEventListener("keydown", (e) => {
    if (
      (e.key === "i" || e.key === "I") &&
      !gameState.menuOpen &&
      !gameState.shopOpen
    ) {
      toggleInventory();
    }
  });
}

// Open the inventory
export function openInventory() {
  if (gameState.shopOpen || gameState.craftingOpen || gameState.menuOpen) {
    showMessage("Close other menus first!", 1500);
    return;
  }

  gameState.inventoryOpen = true;
  gameState.physicsPaused = true; // Pause physics when inventory is open
  inventoryContainer.classList.add("visible");
  updateInventoryDisplay();

  // Store current player position when inventory is opened
  lastPlayerX = gameState.player.x;
  lastPlayerY = gameState.player.y;
}

// Close the inventory
export function closeInventory() {
  gameState.inventoryOpen = false;
  gameState.physicsPaused = false; // Resume physics when inventory is closed
  inventoryContainer.classList.remove("visible");
}

// Toggle the inventory
export function toggleInventory() {
  if (gameState.inventoryOpen) {
    closeInventory();
  } else {
    openInventory();
  }
}

// Check if player has moved significantly since inventory was opened
export function checkPlayerMovement() {
  if (!gameState.inventoryOpen) return;

  // Calculate distance moved
  const deltaX = Math.abs(gameState.player.x - lastPlayerX);
  const deltaY = Math.abs(gameState.player.y - lastPlayerY);

  // Close inventory if player has moved beyond threshold
  if (deltaX > MOVEMENT_THRESHOLD || deltaY > MOVEMENT_THRESHOLD) {
    closeInventory();
  }
}

// Helper function to get current tool
function getCurrentTool() {
  if (!gameState.crafting || !gameState.crafting.currentToolType) {
    return null;
  }

  const toolId =
    gameState.crafting.equippedTools[gameState.crafting.currentToolType];
  if (!toolId) return null;

  return gameState.crafting.availableTools.find((t) => t.id === toolId);
}

// Helper function to get equipped boots
function getEquippedBoots() {
  if (!gameState.crafting || !gameState.crafting.equippedTools) {
    return null;
  }

  const bootId = gameState.crafting.equippedTools.boots;
  if (!bootId) return null;

  return gameState.crafting.availableTools.find((t) => t.id === bootId);
}

// Helper function to check if jetpack is equipped
function hasJetpack() {
  return gameState.hasJetpack || false;
}

// Update the inventory display with current items
export function updateInventoryDisplay() {
  if (!gameState.inventoryOpen) return;

  // Update capacity display
  const inventoryCapacity = document.getElementById("inventory-capacity");
  const currentCount = Object.values(gameState.inventory).reduce(
    (sum, count) => sum + count,
    0
  );
  inventoryCapacity.textContent = `${currentCount} / ${gameState.bagSize}`;

  // Clear the grid
  inventoryGrid.innerHTML = "";

  // Add currently equipped items section
  addCategoryHeader("Equipped Items");

  // Add current tool if equipped
  const currentTool = getCurrentTool();
  
  // Check if we have any equipped items
  let hasEquippedItems = false;

  if (currentTool) {
    hasEquippedItems = true;
    
    // Create a mapping for tool types to display names
    const toolTypeDisplayNames = {
      pickaxe: "Pickaxe",
      laser: "Laser",
      drill: "Drill",
      boots: "Boots",
    };

    const itemElement = createInventoryItemElement(
      currentTool.id,
      `${currentTool.name}`,
      1,
      `imgs/${currentTool.id}.svg`,
      true,
      null,
      currentTool.type
    );

    // Add details about the tool in the tooltip
    if (currentTool.type === "boots") {
      itemElement.title = `${currentTool.name}: Negates fall damage, doubles jump height`;
    } else {
      itemElement.title = `${currentTool.name}: Speed x${
        currentTool.speedMultiplier
      }, Range: ${Math.floor(currentTool.range)} blocks`;
    }

    inventoryGrid.appendChild(itemElement);
  }

  // Add boots if equipped and different from the current tool
  const equippedBoots = getEquippedBoots();
  if (equippedBoots && (!currentTool || currentTool.id !== equippedBoots.id)) {
    hasEquippedItems = true;
    
    const bootElement = createInventoryItemElement(
      equippedBoots.id,
      `${equippedBoots.name}`,
      1,
      `imgs/${equippedBoots.id}.svg`,
      true,
      null,
      "boots"
    );

    bootElement.title = `${equippedBoots.name}: Negates fall damage, doubles jump height`;
    inventoryGrid.appendChild(bootElement);
  }

  // Add jetpack if equipped
  if (hasJetpack()) {
    hasEquippedItems = true;
    
    const jetpackElement = createInventoryItemElement(
      "jetpack",
      "Jetpack",
      1,
      "imgs/jetpack.svg",
      true,
      null,
      "jetpack"
    );

    jetpackElement.title = "Jetpack: Allows you to fly for short periods";
    inventoryGrid.appendChild(jetpackElement);
  }
  
  // Show message if no items are equipped
  if (!hasEquippedItems) {
    const emptyMessage = document.createElement("div");
    emptyMessage.className = "inventory-empty";
    emptyMessage.textContent = "No items equipped!";
    inventoryGrid.appendChild(emptyMessage);
  }

  // Add resources category (without subcategories)
  addCategoryHeader("Resources");

  // Check if inventory is empty
  const resources = Object.entries(gameState.inventory).filter(
    ([_, count]) => count > 0
  );

  if (resources.length === 0) {
    addEmptyMessage();
  } else {
    // Sort resources by value (highest first)
    resources.sort((a, b) => {
      const blockInfoA = getBlockInfoByName(a[0]);
      const blockInfoB = getBlockInfoByName(b[0]);
      const valueA = blockInfoA ? blockInfoA.value : 0;
      const valueB = blockInfoB ? blockInfoB.value : 0;
      return valueB - valueA;
    });

    // Add all resources without categorization
    resources.forEach(([itemName, count]) => {
      // Get block info using the improved function
      const blockInfo = getBlockInfoByName(itemName);

      // Determine the color - use the block's color or a backup if not available
      let color = "#CCCCCC"; // Default gray fallback

      if (blockInfo) {
        if (typeof blockInfo.color === "string") {
          // If color is a named color like "gold", "diamond", etc.
          // Check if it's a CSS color
          const isValidCSSColor = /^(#|rgb|hsl|transparent|inherit)/.test(
            blockInfo.color
          );

          if (isValidCSSColor) {
            color = blockInfo.color;
          } else {
            // Map ore name colors to actual CSS colors
            const colorMap = {
              dirt: "#8B4513", // Brown
              stone: "#808080", // Gray
              coal: "#333333", // Dark gray
              iron: "#C0C0C0", // Silver
              gold: "#FFD700", // Gold
              emerald: "#50C878", // Emerald green
              ruby: "#E0115F", // Ruby red
              diamond: "#B9F2FF", // Light blue
              grass: "#7CFC00", // Lawn green
              silicon: "#4a6b8a", 
              aluminum: "#d4d7db", 
              magnesium: "#b8a99e", 
              titanium: "#1a6050",
              platinum: "#a7a7a7", 
              lunarite: "#65c8e6", 
              celestium: "#ac269d",
            };

            color =
              colorMap[blockInfo.color] ||
              colorMap[blockInfo.name] ||
              "#CCCCCC";
          }
        } else {
          // Default color if not a string
          color = "#CCCCCC";
        }
      }

      const itemElement = createInventoryItemElement(
        itemName,
        formatDisplayName(itemName),
        count,
        null,
        false,
        color
      );

      inventoryGrid.appendChild(itemElement);
    });
  }

  // Add consumables if available
  if (gameState.bombs > 0) {
    addCategoryHeader("Consumables");

    const bombElement = createInventoryItemElement(
      "bomb",
      "Bombs",
      gameState.bombs,
      "imgs/bomb.png",
      false
    );
    inventoryGrid.appendChild(bombElement);
  }
}

// Helper function to add a category header
function addCategoryHeader(title) {
  const header = document.createElement("div");
  header.className = "inventory-category";
  header.textContent = title;
  inventoryGrid.appendChild(header);
}

// Helper function to add an empty message
function addEmptyMessage() {
  const emptyMessage = document.createElement("div");
  emptyMessage.className = "inventory-empty";
  emptyMessage.textContent = "Your inventory is empty!";
  inventoryGrid.appendChild(emptyMessage);
}

// Helper function to create an inventory item element
function createInventoryItemElement(
  id,
  displayName,
  count,
  iconPath,
  isEquipped,
  color,
  toolType
) {
  const itemElement = document.createElement("div");
  itemElement.className = "inventory-item";
  itemElement.dataset.itemId = id;

  if (isEquipped) {
    itemElement.classList.add("equipped");
  }

  if (toolType) {
    itemElement.dataset.toolType = toolType;
  }

  const iconElement = document.createElement("div");
  iconElement.className = "inventory-item-icon";

  if (iconPath) {
    iconElement.style.backgroundImage = `url(${iconPath})`;
  } else {
    // Use color block for resources
    iconElement.style.backgroundColor = color || "#FFFFFF";
    iconElement.style.border = "1px solid rgba(255,255,255,0.3)";
    iconElement.style.borderRadius = "4px";
  }

  const countElement = document.createElement("div");
  countElement.className = "inventory-item-count";
  countElement.textContent = count;

  // Hide count for equipped items
  if (isEquipped) {
    countElement.style.display = "none";
  }

  const nameElement = document.createElement("div");
  nameElement.className = "inventory-item-name";
  nameElement.textContent = displayName;

  itemElement.appendChild(iconElement);
  itemElement.appendChild(countElement);
  itemElement.appendChild(nameElement);

  // Add tooltip with more information
  itemElement.title = itemElement.title || `${displayName} (${count})`;

  return itemElement;
}

// Helper function to format display name
function formatDisplayName(itemName) {
  // Handle special cases (specific names that need custom formatting)
  const specialNames = {
    lunarite: "Lunarite",
    silicon: "Silicon",
    titanium: "Titanium",
    platinum: "Platinum",
    magnesium: "Magnesium",
  };

  if (specialNames[itemName]) {
    return specialNames[itemName];
  }

  // Standard formatting for other names
  return itemName
    .replace(/_/g, " ") // Replace underscores with spaces
    .replace(/\s+/g, " ") // Replace multiple spaces with single space
    .replace(/([A-Z])/g, " $1") // Insert space before capital letters
    .split(" ") // Split into words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()) // Capitalize first letter of each word
    .join(" ") // Join back with spaces
    .trim(); // Remove any extra spaces
}

// Helper function to get block information by name
function getBlockInfoByName(name) {
  // First try direct match
  let blockInfo = gameState.ores.find((ore) => ore.name === name);

  if (!blockInfo) {
    // Try case-insensitive match
    blockInfo = gameState.ores.find(
      (ore) => ore.name.toLowerCase() === name.toLowerCase()
    );
  }

  if (!blockInfo) {
    // Try with normalized name (handling formatting differences)
    const normalizedName = name.toLowerCase().replace(/[\s_-]/g, "");
    blockInfo = gameState.ores.find(
      (ore) => ore.name.toLowerCase().replace(/[\s_-]/g, "") === normalizedName
    );
  }

  return (
    blockInfo || {
      name: name,
      value: 0,
      color: "#CCCCCC", // Default gray color for unknown blocks
    }
  );
}

// Update inventory when items are added or removed
export function updateInventory() {
  updateUI();

  if (gameState.inventoryOpen) {
    updateInventoryDisplay();

    // Also check if player has moved when updating inventory
    checkPlayerMovement();
  }
}

// Initialize inventory system
export function setupInventorySystem() {
  if (gameState.inventoryOpen === undefined) {
    gameState.inventoryOpen = false;
  }

  initializeInventory();
}