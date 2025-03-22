// crafting.js
import { gameState } from "./config.js";
import { updateUI } from "./updates.js";
import { showMessage, equipSound, craftingSound, playSFX, ORIGINAL_VOLUMES } from "./setup.js";
// Import sendToolChanged from multiplayer.js to sync tool changes
import { sendToolChanged } from "./multiplayer.js";

// Define tool types
export const TOOL_TYPES = {
  PICKAXE: "pickaxe",
  LASER: "laser",
  BOOTS: "boots",
  DRILL: "drill",
};

// Map tool types to tabs
const TOOL_TYPE_TO_TAB = {
  [TOOL_TYPES.PICKAXE]: "pickaxes",
  [TOOL_TYPES.LASER]: "lasers",
  [TOOL_TYPES.DRILL]: "drills",
  [TOOL_TYPES.BOOTS]: "equipment"  // Move boots to equipment tab
};

// Define available tools
const availableTools = [
  // Pickaxes
  {
    id: "pickaxe-basic",
    name: "Basic Pickaxe",
    type: TOOL_TYPES.PICKAXE,
    description: "A simple pickaxe for mining.",
    speedMultiplier: 1.0,
    range: 1.5, // Can only mine adjacent blocks
    requirements: {}, // No requirements for starter tool
    unlocked: true, // Available from the start
  },
  {
    id: "pickaxe-iron",
    name: "Iron Pickaxe",
    type: TOOL_TYPES.PICKAXE,
    description: "A sturdy pickaxe that mines faster.",
    speedMultiplier: 2.0,
    range: 2.5, // Can mine blocks up to 2 blocks away
    requirements: {
      coal: 1,
    },
    unlocked: true, // Changed to true - available from the start
  },
  {
    id: "pickaxe-gold",
    name: "Gold Pickaxe",
    type: TOOL_TYPES.PICKAXE,
    description: "A high-quality pickaxe with excellent mining speed.",
    speedMultiplier: 3.0,
    range: 3.5, // Can mine blocks up to 2 blocks away
    requirements: {
      coal: 1,
      //gold: 10,
      //iron: 5,
    },
    unlocked: true, // Changed to true - available from the start
  },
  {
    id: "pickaxe-diamond",
    name: "Diamond Pickaxe",
    type: TOOL_TYPES.PICKAXE,
    description: "The ultimate mining tool.",
    speedMultiplier: 4.0,
    range: 4.5, // Can mine blocks up to 3 blocks away
    requirements: {
      coal: 1,
      //diamond: 5,
      //gold: 3,
      //iron: 2,
    },
    unlocked: true, // Changed to true - available from the start
  },
  // DRILLS - Add these new tools
  {
    id: "drill-basic",
    name: "Basic Drill",
    type: TOOL_TYPES.DRILL,
    description: "A rotary drill that cuts through rock efficiently.",
    speedMultiplier: 5.0,
    range: 1.5, // Can mine blocks up to 1 blocks away
    requirements: {
      coal: 1,
    },
    unlocked: true,
  },
  {
    id: "drill-ruby",
    name: "Ruby Drill",
    type: TOOL_TYPES.DRILL,
    description: "High-torque drill with enhanced mining speed.",
    speedMultiplier: 6.0,
    range: 2.5, // Can mine blocks up to 2 blocks away
    requirements: {
      coal: 1,
      //iron: 12,
      //gold: 5,
      //coal: 8,
    },
    unlocked: true,
  },
  {
    id: "drill-diamond",
    name: "Diamond Drill",
    type: TOOL_TYPES.DRILL,
    description: "Diamond-tipped drill that cuts through anything.",
    speedMultiplier: 7.0,
    range: 3.5, // Can mine blocks up to 3 blocks away
    requirements: {
      coal: 1,
      //diamond: 8,
      //gold: 4,
      //iron: 10,
    },
    unlocked: true,
  },
  // Laser tool
  {
    id: "laser",
    name: "Mining Laser",
    type: TOOL_TYPES.LASER,
    description: "High-tech mining laser that can mine from a distance.",
    speedMultiplier: 20.0,
    range: 5.5, // Can mine blocks up to 5 blocks away
    requirements: {
      coal: 1,
    },
    unlocked: true, // Changed to true - available from the start
  },
  // Moon Boots
  {
    id: "moon_boots",
    name: "Moon Boots",
    type: TOOL_TYPES.BOOTS,
    description: "Special boots made from lunar ore.",
    speedMultiplier: 1.0, // Not relevant for boots, but kept for consistency
    range: 0, // Not relevant for boots
    requirements: {
      coal: 1,
    },
    unlocked: true, // Changed to true - available from the start
  },
];

// Initialize crafting system
export function initializeCrafting() {
  
  // Default crafting station settings
  const defaultCraftingStation = {
    x: 200,
    y: 440,
    width: 240,
    height: 200,
  };

  // Add crafting state to gameState if not already present
  if (!gameState.crafting) {
    gameState.crafting = {
      equippedTools: {
        [TOOL_TYPES.PICKAXE]: "pickaxe-basic",
        [TOOL_TYPES.DRILL]: null,
        [TOOL_TYPES.LASER]: null,
        [TOOL_TYPES.BOOTS]: null,
      },
      craftedTools: ["pickaxe-basic"], // Track which tools have been crafted
      currentToolType: TOOL_TYPES.PICKAXE, // Default to pickaxe
      availableTools: [...availableTools],
      craftingStation: defaultCraftingStation,
      craftingStationImage: "./imgs/craftingHouse.svg", // SVG image path
    };
  } else {
    // Ensure craftingStation exists and has the required properties
    if (!gameState.crafting.craftingStation) {
      gameState.crafting.craftingStation = defaultCraftingStation;
    }
    
    // Add craftedTools array if upgrading from older save
    if (!gameState.crafting.craftedTools) {
      gameState.crafting.craftedTools = ["pickaxe-basic"];

      // Add any equipped tools to the crafted list
      Object.values(gameState.crafting.equippedTools).forEach((toolId) => {
        if (toolId && !gameState.crafting.craftedTools.includes(toolId)) {
          gameState.crafting.craftedTools.push(toolId);
        }
      });
    }
    
    // CRITICAL FIX: Make sure availableTools is properly set
    if (!gameState.crafting.availableTools || gameState.crafting.availableTools.length === 0) {
      gameState.crafting.availableTools = [...availableTools];
    }
  }

  // Set initial tool speeds
  if (!gameState.pickaxeSpeed) {
    gameState.pickaxeSpeed = 1.0;
  }

  // Set default laser state
  if (gameState.hasLaser === undefined) {
    gameState.hasLaser = false; // Laser is not equipped by default
  }

  // Set default moon boots state
  if (gameState.hasMoonBoots === undefined) {
    gameState.hasMoonBoots = false; // Moon boots are not equipped by default
  }
}

// Check if player is near crafting station
export function checkCraftingInteraction() {
  const craftingStation = document.getElementById("crafting-station");
  if (!craftingStation) return;

  const { x, y, width, height } = gameState.crafting.craftingStation;

  // Calculate screen position of crafting station
  const craftingScreenX = x - gameState.camera.x;
  const craftingScreenY = y - gameState.camera.y;

  // Calculate screen position of player
  const playerScreenX = gameState.player.x - gameState.camera.x;
  const playerScreenY = gameState.player.y - gameState.camera.y;

  // Calculate centers
  const playerCenterX = playerScreenX + gameState.player.width / 2;
  const playerCenterY = playerScreenY + gameState.player.height / 2;
  const craftingCenterX = craftingScreenX + width / 2;
  const craftingCenterY = craftingScreenY + height / 2;

  // Calculate distance
  const dx = playerCenterX - craftingCenterX;
  const dy = playerCenterY - craftingCenterY;
  const distance = Math.sqrt(dx * dx + dy * dy);

  // If player is within interaction range
  const interactionRange = 100;
  if (distance < interactionRange) {
    // Check for 'E' key press to toggle crafting menu
    if (gameState.keys.interact) {
      // Toggle crafting menu
      if (gameState.craftingOpen) {
        closeCraftingMenu();
      } else {
        openCraftingMenu();
      }
      // Reset interact key to prevent multiple toggles
      gameState.keys.interact = false;
    }
  } else {
    // Close crafting menu if open and player moves away
    if (gameState.craftingOpen) {
      closeCraftingMenu();
    }
  }
}

// Open the crafting menu
export function openCraftingMenu() {
  gameState.craftingOpen = true;

  // Show the crafting UI
  const craftingContainer = document.getElementById("crafting-container");
  if (!craftingContainer) {
    console.error("Crafting container not found in DOM!");
    return;
  }
  
  craftingContainer.style.display = "flex";

  // Determine which tab to show based on equipped tool
  const currentToolType = gameState.crafting.currentToolType;
  const tabToActivate = TOOL_TYPE_TO_TAB[currentToolType] || "pickaxes";
  
  // Activate that tab
  activateTab(tabToActivate);

  // Update the crafting UI with available tools
  updateCraftingUI();
}

// Close the crafting menu
export function closeCraftingMenu() {
  gameState.craftingOpen = false;

  // Hide the crafting UI
  const craftingContainer = document.getElementById("crafting-container");
  if (craftingContainer) {
    craftingContainer.style.display = "none";
  }
}

// Function to handle tab switching
function activateTab(tabId) {
  // Hide all tabs
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });
  
  // Remove active class from all tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Show the selected tab
  const tabContent = document.getElementById(`${tabId}-tab`);
  if (tabContent) {
    tabContent.classList.add('active');
  } else {
    console.error(`Tab content with id "${tabId}-tab" not found!`);
  }
  
  // Add active class to the clicked tab button
  const tabButton = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
  if (tabButton) {
    tabButton.classList.add('active');
  } else {
    console.error(`Tab button for "${tabId}" not found!`);
  }
}

// Update the crafting UI with available tools
function updateCraftingUI() {
  // Verify all required DOM elements exist
  const pickaxesList = document.getElementById("pickaxes-list");
  const drillsList = document.getElementById("drills-list");
  const lasersList = document.getElementById("lasers-list");
  const equipmentList = document.getElementById("equipment-list");
  
  if (!pickaxesList || !drillsList || !lasersList || !equipmentList) {
    console.error("One or more crafting list containers not found in DOM!");
    return;
  }
  
  // Clear all tab content
  pickaxesList.innerHTML = "";
  drillsList.innerHTML = "";
  lasersList.innerHTML = "";
  equipmentList.innerHTML = "";
  
  // Check if availableTools exists and has items
  if (!gameState.crafting.availableTools || gameState.crafting.availableTools.length === 0) {
    console.error("No available tools found in game state!");
    gameState.crafting.availableTools = [...availableTools]; // Reinitialize with default tools
  }
  
  // Group tools by tab
  const toolsByTab = {
    pickaxes: [],
    drills: [],
    lasers: [],
    equipment: []
  };
  
  // Distribute tools to appropriate tabs
  gameState.crafting.availableTools.forEach(tool => {
    // Check that the tool and its type exist
    if (!tool || !tool.type) {
      console.warn("Found invalid tool in availableTools:", tool);
      return;
    }
    
    const targetTab = TOOL_TYPE_TO_TAB[tool.type];
    if (targetTab && toolsByTab[targetTab]) {
      toolsByTab[targetTab].push(tool);
    } else {
      console.warn(`Could not map tool type "${tool.type}" to a tab`);
    }
  });
  
  // Populate each tab with its tools
  Object.entries(toolsByTab).forEach(([tabId, tools]) => {
    const tabContent = document.getElementById(`${tabId}-list`);
    if (!tabContent) {
      console.error(`Tab content list "${tabId}-list" not found!`);
      return;
    }
    
    // If no tools for this tab, add a placeholder
    if (tools.length === 0) {
      tabContent.innerHTML = `
        <div class="no-items-placeholder">
          No ${tabId} available at this time.
        </div>
      `;
      return;
    }
    
    // Add tools to this tab
    tools.forEach(tool => {
      addToolToUI(tool, tabContent);
    });
  });
}

// Helper function to add a tool to the UI
function addToolToUI(tool, container) {
  // Create tool item element
  const toolItem = document.createElement("div");
  toolItem.className = "crafting-item";
  toolItem.setAttribute("data-tool-id", tool.id);
  
  // Check if tool is already crafted
  const isCrafted = gameState.crafting.craftedTools.includes(tool.id);
  
  // For wearable items like boots, check if they are equipped in their slot
  let isCurrentlyEquipped = false;
  
  if (tool.type === TOOL_TYPES.BOOTS) {
    // For boots, just check if they're equipped in their slot
    isCurrentlyEquipped =
      gameState.crafting.equippedTools[tool.type] === tool.id;
  } else {
    // For handheld tools, check both the equipped status and if it's the current type
    isCurrentlyEquipped =
      gameState.crafting.equippedTools[tool.type] === tool.id &&
      gameState.crafting.currentToolType === tool.type;
  }
  
  if (isCurrentlyEquipped) {
    toolItem.classList.add("current");
  }
  
  // Check if player has enough resources for this tool
  const canCraft = !isCrafted && checkRequirements(tool.requirements);
  
  if (!isCrafted && !canCraft) {
    toolItem.classList.add("unavailable");
  } else if (isCrafted) {
    toolItem.classList.add("crafted");
  }
  
  // Create content for the tool item
  let buttonText = "Craft";
  let buttonDisabled = false;
  let buttonClass = "craft-button";
  
  if (isCrafted) {
    if (isCurrentlyEquipped) {
      buttonText = "Equipped";
      buttonDisabled = true;
    } else {
      buttonText = "Equip";
      buttonClass += " equip-button";
    }
  } else if (!canCraft) {
    buttonDisabled = true;
  }
  
  // Format mining speed bonus to be more user-friendly (for non-boots items)
  let statsHTML = "";
  if (tool.type !== TOOL_TYPES.BOOTS) {
    const speedBonus = Math.round((tool.speedMultiplier - 1) * 100);
    // Round down range to whole number for display purposes only
    const displayRange = Math.floor(tool.range);
    statsHTML = `
      <p class="item-stats">Mining Speed: +${speedBonus}%</p>
      <p class="item-stats">Mining Range: ${displayRange} block${
      displayRange > 1 ? "s" : ""
    }</p>
    `;
  } else {
    statsHTML = `
      <p class="item-stats">Negates all fall damage</p>
      <p class="item-stats">Doubles jump height</p>
    `;
  }
  
  toolItem.innerHTML = `
    <h3>${tool.name}</h3>
    <p class="item-description">${tool.description}</p>
    ${statsHTML}
    <div class="requirements">
      ${!isCrafted ? createRequirementsHTML(tool.requirements) : ""}
    </div>
    <button class="${buttonClass}" ${buttonDisabled ? "disabled" : ""}>
      ${buttonText}
    </button>
  `;
  
  // Add click event to craft/equip button
  const craftButton = toolItem.querySelector(
    `.${buttonClass.split(" ")[0]}`
  );
  
  if (craftButton && !buttonDisabled) {
    craftButton.addEventListener("click", () => {
      if (isCrafted) {
        equipTool(tool);
      } else {
        craftTool(tool);
      }
    });
  }
  
  // Add the tool item to the container
  container.appendChild(toolItem);
}

// Check if player has enough resources for the tool
function checkRequirements(requirements) {
  if (!requirements) {
    console.warn("Tool has undefined requirements");
    return true; // If no requirements, always craftable
  }
  
  for (const [resource, amount] of Object.entries(requirements)) {
    if (
      !gameState.inventory[resource] ||
      gameState.inventory[resource] < amount
    ) {
      return false;
    }
  }
  return true;
}

// Create HTML for displaying requirements
function createRequirementsHTML(requirements) {
  if (!requirements) return "";
  
  let html = "<ul>";
  for (const [resource, amount] of Object.entries(requirements)) {
    const hasEnough =
      gameState.inventory[resource] && gameState.inventory[resource] >= amount;
    html += `<li class="${hasEnough ? "available" : "missing"}">
      ${resource}: ${gameState.inventory[resource] || 0}/${amount}
    </li>`;
  }
  html += "</ul>";
  return html;
}

function craftTool(tool) {
  // Double-check requirements
  if (!checkRequirements(tool.requirements)) {
    showMessage("You don't have enough resources!", 2000);
    return;
  }

  // Consume resources
  for (const [resource, amount] of Object.entries(tool.requirements)) {
    gameState.inventory[resource] -= amount;
  }

  // Add to crafted tools list
  if (!gameState.crafting.craftedTools.includes(tool.id)) {
    gameState.crafting.craftedTools.push(tool.id);
  }

  // Show success message with tool name highlight
  showMessage(
    `<span style="color: #ffd700">Crafted ${tool.name}!</span>`,
    2000
  );

  // Add animation class to the crafted item
  const toolElement = document.querySelector(
    `.crafting-item[data-tool-id="${tool.id}"]`
  );
  if (toolElement) {
    toolElement.classList.add("item-crafted");
    setTimeout(() => {
      toolElement.classList.remove("item-crafted");
    }, 600); // Match animation duration
  }

  // Equip the newly crafted tool
  equipTool(tool);

  // Update UIs
  updateUI();
  updateCraftingUI();

  // Add sound effect
  playCraftSound(tool.type);
}

// Enhanced equipTool function to handle boots and multiplayer sync
function equipTool(tool) {
  // Update equipped tool for this type
  gameState.crafting.equippedTools[tool.type] = tool.id;

  // Set this as the current tool type (only for handheld tools like pickaxe/laser/drill)
  if (tool.type !== TOOL_TYPES.BOOTS) {
    gameState.crafting.currentToolType = tool.type;
    
    // If switching to a different tool type, activate the appropriate tab
    const tabToActivate = TOOL_TYPE_TO_TAB[tool.type];
    if (tabToActivate) {
      activateTab(tabToActivate);
    }
  }

  // Update game state based on tool type
  if (tool.type === TOOL_TYPES.PICKAXE || tool.type === TOOL_TYPES.DRILL) {
    gameState.pickaxeSpeed = tool.speedMultiplier;

    // Deactivate laser when switching to pickaxe or drill
    if (gameState.hasLaser) {
      import("./player.js").then((module) => {
        module.deactivateLaser();
      });
    }
    gameState.hasLaser = false;

    // Update the player's tool appearance based on tool type and ID
    import("./player.js").then((module) => {
      if (typeof module.updatePlayerTool === "function") {
        module.updatePlayerTool(tool.type);
      }
    });
  } else if (tool.type === TOOL_TYPES.LASER) {
    gameState.hasLaser = true;

    // Initialize the laser if needed
    import("./player.js").then((module) => {
      module.createLaserBeam();
      // Update the player tool visuals
      if (typeof module.updatePlayerTool === "function") {
        module.updatePlayerTool(tool.type);
      }
    });
  } else if (tool.type === TOOL_TYPES.BOOTS) {
    // Set moon boots state
    gameState.hasMoonBoots = tool.id === "moon_boots";

    // Update character appearance to show boots
    import("./player.js").then((module) => {
      if (typeof module.updateCharacterAppearance === "function") {
        module.updateCharacterAppearance();
      }
    });
  }

  // Show equip message with highlighted text
  showMessage(`<span style="color: #acf">Equipped ${tool.name}!</span>`, 2000);

  // Add visual feedback when equipping
  const allToolItems = document.querySelectorAll(".crafting-item");
  allToolItems.forEach((item) => {
    if (item.getAttribute("data-tool-id") !== tool.id) {
      // Only remove current class from same tool type
      const itemTool = gameState.crafting.availableTools.find(
        (t) => t.id === item.getAttribute("data-tool-id")
      );
      if (itemTool && itemTool.type === tool.type) {
        item.classList.remove("current");
      }
    }
  });

  const toolElement = document.querySelector(
    `.crafting-item[data-tool-id="${tool.id}"]`
  );
  if (toolElement) {
    // Add a brief highlight animation
    toolElement.classList.add("item-crafted");
    setTimeout(() => {
      toolElement.classList.remove("item-crafted");
      toolElement.classList.add("current");
    }, 600);
  }

  // Play equip sound
  playEquipSound(tool.type);

  // Update UIs
  updateUI();
  updateCraftingUI();
  
  // Save tool state to localStorage 
  // Add this line to ensure the tool state is saved when changing tools
  import("./player.js").then((module) => {
    if (typeof module.saveToolState === "function") {
      module.saveToolState();
    }
  });

  // MULTIPLAYER: Send tool change to server for other players
  sendToolChanged(tool.id);
}

// Setup event listeners for crafting UI
export function setupCraftingEventListeners() {
  // Close button event
  const closeButton = document.getElementById("crafting-close");
  if (closeButton) {
    closeButton.addEventListener("click", closeCraftingMenu);
  }

  // Tab switching event listeners
  document.querySelectorAll('.tab-btn').forEach(button => {
    button.addEventListener('click', function() {
      // Get the tab id from the data-tab attribute
      const tabId = this.getAttribute('data-tab');
      activateTab(tabId);
    });
  });
  
  // Escape key to close
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && gameState.craftingOpen) {
      closeCraftingMenu();
    }
  });

  // Reset the interact key when it's released
  document.addEventListener("keyup", (e) => {
    if (e.key === "e" || e.key === "E") {
      gameState.keys.interact = false;
    }
  });
}

// Get the currently equipped tool
export function getCurrentTool() {
  const toolType = gameState.crafting.currentToolType;
  const toolId = gameState.crafting.equippedTools[toolType];
  
  if (!toolId) {
    // No tool equipped for this type
    return null;
  }
  
  const tool = gameState.crafting.availableTools.find((tool) => tool.id === toolId);
  
  if (!tool) {
    console.warn(`Cannot find tool with ID ${toolId} in availableTools!`);
    return null;
  }
  
  return tool;
}

// Get whether moon boots are equipped
export function hasMoonBootsEquipped() {
  return (
    gameState.crafting &&
    gameState.crafting.equippedTools &&
    gameState.crafting.equippedTools[TOOL_TYPES.BOOTS] === "moon_boots"
  );
}

// Sound effects for crafting and equipping
function playCraftSound(toolType) {
  playSFX(craftingSound, ORIGINAL_VOLUMES.craftingSound, false);
}

function playEquipSound(toolType) {
  playSFX(equipSound, ORIGINAL_VOLUMES.equipSound, false);
}

export function isPlayerNearCraftingTable() {
  // Ensure crafting state exists first
  if (!gameState.crafting || !gameState.crafting.craftingStation) {
    return false;
  }

  const { x, y, width, height } = gameState.crafting.craftingStation;

  // Calculate player's position in absolute game world coordinates
  const playerX = gameState.player.x;
  const playerY = gameState.player.y;
  const playerW = gameState.player.width;
  const playerH = gameState.player.height;

  return !(
    playerX > x + width ||
    playerX + playerW < x ||
    playerY > y + height ||
    playerY + playerH < y
  );
}