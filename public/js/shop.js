// shop.js
import { gameState } from "./config.js";
import { createMoneyAnimation } from "./animations.js";
import { updateUI } from "./updates.js";
import { sendRocketPurchased } from "./multiplayer.js";
import {
  showMessage,
  purchaseSound,
  coinSound,
  buildingRocketSound,
  menuHoverSound,
  playSFX,
  ORIGINAL_VOLUMES,
} from "./setup.js";

const sellOptions = document.getElementById("sell-options");
const sellModal = document.getElementById("sell-modal");
const shop = document.getElementById("shop");

// Initialize shop inventory UI with improved layout
export function initializeShop() {
  shop.innerHTML = `
      <div class="shop-header">
        <div class="shop-title">MINER'S SHOP</div>
        <button class="shop-close" id="shop-close">&times;</button>
      </div>
      <button class="shop-sell-button" id="shop-sell-button">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 3h18v18H3zM12 8v8M8 12h8"/>
        </svg>
        Sell Your Ores
      </button>
      <div class="shop-items-container" id="shop-items-container"></div>
      
    `;

  const shopItemsContainer = document.getElementById("shop-items-container");
  const shopClose = document.getElementById("shop-close");
  const shopSellButton = document.getElementById("shop-sell-button");

  // Add event listeners
  shopClose.addEventListener("click", () => {
    gameState.shopOpen = false;
    shop.style.display = "none";
  });

  shopSellButton.addEventListener("click", openSellModal);

  // Create shop items
  shopItemsContainer.innerHTML = "";

  gameState.shopItems.forEach((item) => {
    if (item.id === "sell-ores") return; // Skip this as we now have a dedicated button

    // Add check for availability if the item has an available function
    if (item.available && !item.available()) return;

    let level = 1;
    if (item.id === "pickaxe-upgrade") level = gameState.pickaxeLevel;
    else if (item.id === "bag-upgrade") level = gameState.bagSize / 10;
    else if (item.id === "speed-upgrade") level = gameState.player.speed / 4;

    const price = item.getPrice(level);
    const canAfford = gameState.money >= price;

    const itemElement = document.createElement("div");
    itemElement.className = `shop-item ${!canAfford ? "disabled" : ""}`;
    itemElement.id = item.id;

    // Extra details based on item type
    let detailText = "";
    if (item.id === "pickaxe-upgrade") {
      detailText = `Level ${level} → ${level + 1} (Mining speed +${(
        0.5 * 100
      ).toFixed(0)}%)`;
    } else if (item.id === "bag-upgrade") {
      detailText = `Capacity ${gameState.bagSize} → ${
        gameState.bagSize + 5
      } ores`;
    } else if (item.id === "speed-upgrade") {
      detailText = `Current Speed: ${gameState.player.speed.toFixed(1)} → ${(
        gameState.player.speed + 0.5
      ).toFixed(1)}`;
    }

    itemElement.innerHTML = `
        <div class="shop-item-title">${item.name}</div>
        <div class="shop-item-desc">${item.description}${
      detailText ? "<br><br>" + detailText : ""
    }</div>
        <div class="shop-item-price ${
          !canAfford ? "expensive" : ""
        }">$${price.toLocaleString()}</div>
      `;

    // Add hover sound effect
    itemElement.addEventListener("mouseenter", () => {
      playSFX(menuHoverSound, ORIGINAL_VOLUMES.menuHoverSound, false);
    });

    itemElement.addEventListener("click", () => {
      if (canAfford) {
        handleShopItemClick(item);

        // Add purchase animation
        itemElement.classList.add("item-purchased");
        setTimeout(() => {
          itemElement.classList.remove("item-purchased");
        }, 600);

        // Add purchase sound
        playSFX(purchaseSound, ORIGINAL_VOLUMES.purchaseSound, false);

        // Show purchase message
        showMessage(`Purchased ${item.name}!`, 2000);
      } else {
        // Show "can't afford" message
        showMessage(
          `Not enough money! You need $${(
            price - gameState.money
          ).toLocaleString()} more.`,
          2000
        );
      }
    });

    shopItemsContainer.appendChild(itemElement);
  });

  // Add event listener for ESC key to close shop
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && gameState.shopOpen) {
      gameState.shopOpen = false;
      shop.style.display = "none";
    }
  });
}

function handleShopItemClick(item) {
  let level, price;
  if (item.id === "pickaxe-upgrade") {
    level = gameState.pickaxeLevel;
    price = item.getPrice(level);
    if (gameState.money >= price) {
      gameState.money -= price;
      gameState.pickaxeLevel++;
      // Increase mining speed (tweak the value as needed)
      gameState.pickaxeSpeed += 0.5;
    }
  } else if (item.id === "bag-upgrade") {
    // Here we use bag level as bagSize/10 (initially 10 gives level 1)
    level = gameState.bagSize / 10;
    price = item.getPrice(level);
    if (gameState.money >= price) {
      gameState.money -= price;
      // Increase bag capacity by 5
      gameState.bagSize += 5;
    }
  } else if (item.id === "speed-upgrade") {
    // Use player speed divided by 4 (initial speed 4 gives level 1)
    level = gameState.player.speed / 4;
    price = item.getPrice(level);
    if (gameState.money >= price) {
      gameState.money -= price;
      // Increase player speed by 0.5 (adjust as desired)
      gameState.player.speed += 0.5;
    }
  } else if (item.id === "jetpack") {
    price = item.getPrice();
    if (gameState.money >= price) {
      gameState.money -= price;
      gameState.hasJetpack = true;
      gameState.jetpackFuel = gameState.maxJetpackFuel; // Start with a full tank
    }
  } else if (item.id === "refill-jetpack") {
    price = item.getPrice();
    if (
      gameState.money >= price &&
      gameState.jetpackFuel < gameState.maxJetpackFuel
    ) {
      gameState.money -= price;
      gameState.jetpackFuel = gameState.maxJetpackFuel;
    }
  } else if (item.id === "bomb") {
    price = item.getPrice();
    if (gameState.money >= price && gameState.bombs < gameState.maxBombs) {
      gameState.money -= price;
      gameState.bombs++;
    } else if (gameState.bombs >= gameState.maxBombs) {
      showMessage(`Maximum bombs reached (${gameState.maxBombs})`, 2000);
    }
  } else if (item.id === "rocket") {
    price = item.getPrice();
    if (gameState.money >= price) {
      gameState.money -= price;
      gameState.hasRocket = true;

      // Play building rocket sound
      playSFX(buildingRocketSound, ORIGINAL_VOLUMES.buildingRocketSound, false);

      // Place the rocket near the surface in a clear area
      placeRocketInWorld();

      // Send purchase to multiplayer
      sendRocketPurchased();

      // Show purchase message
      showMessage("Rocket purchased! Find it on the surface.", 3000);
    }
  }
  updateUI();
  initializeShop(); // Refresh shop display to update price and level info
}

export function openSellModal() {
  sellOptions.innerHTML = "";
  const hasOres = Object.values(gameState.inventory).some((count) => count > 0);

  if (hasOres) {
    const totalValue = calculateTotalOreValue();

    const sellAllOption = document.createElement("div");
    sellAllOption.className = "sell-option sell-all-option";
    sellAllOption.innerHTML = `Sell All Ores for $${totalValue.toLocaleString()}`;
    sellAllOption.addEventListener("mouseenter", () => {
      playSFX(menuHoverSound, ORIGINAL_VOLUMES.menuHoverSound, false);
    });

    sellAllOption.addEventListener("click", () => {
      sellAllOres();
    });
    sellOptions.appendChild(sellAllOption);

    // Add individual ore selling options
    for (const [ore, count] of Object.entries(gameState.inventory)) {
      if (count > 0) {
        const oreData = gameState.ores.find((o) => o.name === ore);
        const value = oreData.value * gameState.pickaxeLevel;

        const sellOption = document.createElement("div");
        sellOption.className = "sell-option";

        sellOption.innerHTML = `
            <div class="sell-option-info">
              <div class="sell-ore-icon ${ore.toLowerCase()}"></div>
              <span class="sell-ore-name">${ore}</span>
              <span class="sell-ore-count">x${count}</span>
            </div>
            <div class="sell-option-price">$${(
              value * count
            ).toLocaleString()}</div>
          `;

        // Add hover sound effect
        sellOption.addEventListener("mouseenter", () => {
          playSFX(menuHoverSound, ORIGINAL_VOLUMES.menuHoverSound, false);
        });

        sellOption.addEventListener("click", () => {
          const saleAmount = value * count;
          gameState.money += saleAmount;
          gameState.inventory[ore] = 0;

          // Create money animation for individual sale
          createMoneyAnimation(saleAmount);

          // Show sale message
          showMessage(
            `Sold ${count} ${ore} for $${saleAmount.toLocaleString()}!`,
            2000
          );

          // Add coin sound effect
          playSFX(coinSound, ORIGINAL_VOLUMES.coinSound, false);

          updateUI();
          initializeShop(); // Refresh shop UI after sale

          // Add selling animation/feedback
          sellOption.classList.add("sold");
          setTimeout(() => {
            // Refresh the modal so that it stays open and updates for further selling
            openSellModal();
          }, 400);
        });

        sellOptions.appendChild(sellOption);
      }
    }
  } else {
    // No ores to sell
    const emptyMessage = document.createElement("div");
    emptyMessage.className = "empty-inventory-message";
    emptyMessage.innerHTML = `
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#aaa" stroke-width="2">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="8" y1="12" x2="16" y2="12"></line>
        </svg>
        <p>Your inventory is empty!<br>Mine some ores first.</p>
      `;
    sellOptions.appendChild(emptyMessage);
  }

  // Setup close button for modal
  const closeButton = document.getElementById("sell-modal-close");
  closeButton.addEventListener("click", () => {
    sellModal.style.display = "none";
  });

  // Also close modal with ESC key
  const escCloseHandler = (e) => {
    if (e.key === "Escape") {
      sellModal.style.display = "none";
      document.removeEventListener("keydown", escCloseHandler);
    }
  };
  document.addEventListener("keydown", escCloseHandler);

  sellModal.style.display = "flex";
}

// Calculate total value of all ores
function calculateTotalOreValue() {
  let totalValue = 0;

  for (const [ore, count] of Object.entries(gameState.inventory)) {
    if (count > 0) {
      const oreData = gameState.ores.find((o) => o.name === ore);
      if (oreData) {
        totalValue += oreData.value * count * gameState.pickaxeLevel;
      }
    }
  }

  return totalValue;
}

// Enhanced sell all ores function with animation
export function sellAllOres() {
  let totalValue = 0;
  const oreValues = {};
  let totalOres = 0;

  // Calculate value for each ore type
  for (const [ore, count] of Object.entries(gameState.inventory)) {
    const oreData = gameState.ores.find((o) => o.name === ore);
    if (oreData && count > 0) {
      const value = oreData.value * count * gameState.pickaxeLevel;
      oreValues[ore] = value;
      totalValue += value;
      totalOres += count;
    }
  }

  // Only proceed if there's something to sell
  if (totalValue > 0) {
    // Add coin sound effect
    playSFX(coinSound, ORIGINAL_VOLUMES.coinSound, false);

    // Create the money gain animation
    createMoneyAnimation(totalValue);

    // Show sale message
    showMessage(
      `Sold ${totalOres} ores for $${totalValue.toLocaleString()}!`,
      2500
    );

    // Update game state
    gameState.money += totalValue;
    gameState.inventory = {};
    updateUI();
    initializeShop(); // Refresh shop UI after sale
    sellModal.style.display = "none";
  }
}

function placeRocketInWorld() {
  // Use the rocket coordinates defined in gameState directly
  // Only set rocketPlaced flag to true
  gameState.rocketPlaced = true;

  console.log(
    `Rocket positioned at ${gameState.rocket.x}, ${gameState.rocket.y}`
  );
}
