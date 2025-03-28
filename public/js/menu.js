import {
  gameMusic,
  menuClickSound,
  menuHoverSound,
  ORIGINAL_VOLUMES,
  menuMusic,
  playSFX,
  stopSFX,
  storyMusic,
} from "./setup.js";
import { gameState } from "./config.js";
import {
  startNewGame,
  loadExistingGame,
  joinMultiplayerGame,
  hostMultiplayerGame,
} from "./main.js";
import { initializeMenuBackground } from "./menuBackground.js";
// Add this at the top of menu.js, after the imports
export let multiplayerInitialized = false;

/**
 * Shows the main menu at game startup - Completely fixed version with proper button opacity
 */
export function showMainMenu() {

  // Initialize the menu background first
  initializeMenuBackground();

  // Get main menu reference
  const mainMenu = document.getElementById("main-menu-overlay");
  if (mainMenu) {
    mainMenu.style.display = "flex";

    // Stop game music if it's playing and start menu music
    if (gameMusic && !gameMusic.paused) {
      stopSFX(gameMusic);
    }
    if (storyMusic && !storyMusic.paused) {
      stopSFX(storyMusic);
    }

    // Start menu music if it's not already playing
    if (menuMusic.paused) {
      playSFX(menuMusic, ORIGINAL_VOLUMES.menuMusic, true);
    }

    // Check if we have a saved game
    const hasSavedGame = localStorage.getItem("pixelMinerSave") !== null;
    const continueButton = document.getElementById("load-game");

    // Either hide or show the continue button based on saved game existence
    if (!hasSavedGame && continueButton) {
      continueButton.style.display = "none"; // Hide the button completely
    } else if (continueButton) {
      continueButton.style.display = "block"; // Show the button
    }

    // Ensure multiplayer buttons exist and are visible
    ensureMultiplayerButtons();

    // Only remove and re-attach event listeners if multiplayer isn't initialized yet
    if (!multiplayerInitialized) {
      removeExistingEventListeners();
      attachMenuEventListeners(hasSavedGame);
    } else {
      console.log("Multiplayer already initialized, skipping event listener setup");
    }

    // FIXED: Make all buttons immediately visible
    const buttons = mainMenu.querySelectorAll(".main-menu-button");
    buttons.forEach(button => {
      // Set opacity to 1 immediately with no transition
      button.style.opacity = "1";
      button.style.transition = "none";
      
      // Only add sound events if not already initialized
      if (!multiplayerInitialized) {
        button.addEventListener("mouseenter", () => {
          playSFX(menuHoverSound, ORIGINAL_VOLUMES.menuHoverSound, false);
        });
        button.addEventListener("click", () => {
          playSFX(menuClickSound, ORIGINAL_VOLUMES.menuClickSound, false);
        });
      }
    });
  }
}

/**
 * Remove existing event listeners to prevent duplicates
 */
function removeExistingEventListeners() {
  const startNewGameBtn = document.getElementById("start-new-game");
  const loadGameBtn = document.getElementById("load-game");
  const joinGameBtn = document.getElementById("join-game");
  const hostGameBtn = document.getElementById("host-game");
  const gameOptionsBtn = document.getElementById("game-options");
  const backBtn = document.getElementById("back-to-menu");

  // Clone and replace buttons to remove all event listeners
  if (startNewGameBtn) {
    const newBtn = startNewGameBtn.cloneNode(true);
    startNewGameBtn.parentNode.replaceChild(newBtn, startNewGameBtn);
  }

  if (loadGameBtn) {
    const newBtn = loadGameBtn.cloneNode(true);
    loadGameBtn.parentNode.replaceChild(newBtn, loadGameBtn);
  }

  if (joinGameBtn) {
    const newBtn = joinGameBtn.cloneNode(true);
    joinGameBtn.parentNode.replaceChild(newBtn, joinGameBtn);
  }

  if (hostGameBtn) {
    const newBtn = hostGameBtn.cloneNode(true);
    hostGameBtn.parentNode.replaceChild(newBtn, hostGameBtn);
  }

  if (gameOptionsBtn) {
    const newBtn = gameOptionsBtn.cloneNode(true);
    gameOptionsBtn.parentNode.replaceChild(newBtn, gameOptionsBtn);
  }

  if (backBtn) {
    const newBtn = backBtn.cloneNode(true);
    backBtn.parentNode.replaceChild(newBtn, backBtn);
  }
}

/**
 * Ensure multiplayer buttons exist
 */
function ensureMultiplayerButtons() {
  const menuButtons = document.querySelector(".menu-buttons");
  if (!menuButtons) return;

  // Check if join game button exists
  let joinGameBtn = document.getElementById("join-game");
  if (!joinGameBtn) {
    joinGameBtn = document.createElement("button");
    joinGameBtn.id = "join-game";
    joinGameBtn.className = "main-menu-button";
    joinGameBtn.textContent = "Join Game";

    // Insert before options button
    const optionsBtn = document.getElementById("game-options");
    if (optionsBtn) {
      menuButtons.insertBefore(joinGameBtn, optionsBtn);
    } else {
      menuButtons.appendChild(joinGameBtn);
    }
  }

  // Check if host game button exists
  let hostGameBtn = document.getElementById("host-game");
  if (!hostGameBtn) {
    hostGameBtn = document.createElement("button");
    hostGameBtn.id = "host-game";
    hostGameBtn.className = "main-menu-button";
    hostGameBtn.textContent = "Host Game";

    // Insert before join game button
    menuButtons.insertBefore(hostGameBtn, joinGameBtn);
  }
}

/**
 * Attach event listeners to all menu buttons
 */
function attachMenuEventListeners(hasSavedGame) {

  // Attach event listeners for main menu buttons
  const startNewGameBtn = document.getElementById("start-new-game");
  if (startNewGameBtn) {
    startNewGameBtn.addEventListener("click", () => {
      startNewGame();
    });
  }

  // Only add event listener if the button is visible
  if (hasSavedGame) {
    const loadGameBtn = document.getElementById("load-game");
    if (loadGameBtn) {
      loadGameBtn.addEventListener("click", () => {
        loadExistingGame();
      });
    }
  }

  const gameOptionsBtn = document.getElementById("game-options");
  if (gameOptionsBtn) {
    gameOptionsBtn.addEventListener("click", () => {
      showOptions();
    });
  }

  // DO NOT attach multiplayer button handlers here
  // We'll let main.js handle these exclusively through setupMultiplayer()

  // Add back button listener for options
  const backBtn = document.getElementById("back-to-menu");
  if (backBtn) {
    backBtn.addEventListener("mouseenter", () => {
      playSFX(menuHoverSound, ORIGINAL_VOLUMES.menuHoverSound, false);
    });
    backBtn.addEventListener("click", () => {
      playSFX(menuClickSound, ORIGINAL_VOLUMES.menuClickSound, false);
      hideOptions();
    });
  }
  
  // Mark that we've initialized the basic menu functionality
  // but NOT the multiplayer buttons - that will be done in main.js
}

/**
 * Show join game dialog
 */
function showJoinGameDialog() {
  const joinDialog = document.getElementById("join-game-dialog");
  if (joinDialog) {
    joinDialog.style.display = "flex";

    // Attach button listeners
    const joinSubmitBtn = document.getElementById("join-game-submit");
    const joinCancelBtn = document.getElementById("join-game-cancel");

    if (joinSubmitBtn) {
      joinSubmitBtn.onclick = () => {
        joinDialog.style.display = "none";
        joinMultiplayerGame();
      };
    }

    if (joinCancelBtn) {
      joinCancelBtn.onclick = () => {
        joinDialog.style.display = "none";
      };
    }
  }
}

/**
 * Show host game dialog
 */
function showHostGameDialog() {
  const hostDialog = document.getElementById("host-game-dialog");
  if (hostDialog) {
    hostDialog.style.display = "flex";

    // Attach button listeners
    const hostSubmitBtn = document.getElementById("host-game-submit");
    const hostCancelBtn = document.getElementById("host-game-cancel");

    if (hostSubmitBtn) {
      hostSubmitBtn.onclick = () => {
        hostDialog.style.display = "none";
        hostMultiplayerGame();
      };
    }

    if (hostCancelBtn) {
      hostCancelBtn.onclick = () => {
        hostDialog.style.display = "none";
      };
    }
  }
}


/**
 * Shows the options menu
 */
function showOptions() {
  // FIXED: Changed from "main-menu" to "main-menu-overlay" to match the HTML ID
  document.getElementById("main-menu-overlay").style.display = "none";
  document.getElementById("options-modal").style.display = "flex";

  // Add hover and click sound events to all option controls
  const optionControls = document.querySelectorAll(
    "#options-modal button, #options-modal input"
  );
  optionControls.forEach((control) => {
    if (control.tagName === "BUTTON") {
      control.addEventListener("mouseenter", () => {
        playSFX(menuHoverSound, ORIGINAL_VOLUMES.menuHoverSound, false);
      });
      control.addEventListener("click", () => {
        playSFX(menuClickSound, ORIGINAL_VOLUMES.menuClickSound, false);
      });
    } else if (control.type === "range") {
      // For sliders, play sound when the thumb is released (mouseup) instead of grabbed
      control.addEventListener("mouseup", () => {
        playSFX(menuClickSound, ORIGINAL_VOLUMES.menuClickSound, false);
      });
    } else if (control.type === "checkbox") {
      control.addEventListener("change", () => {
        playSFX(menuClickSound, ORIGINAL_VOLUMES.menuClickSound, false);
      });
    }
  });

  // Load saved audio settings if they exist
  loadAudioSettings();
}


/**
 * Hides the options menu and shows the main menu
 */
function hideOptions() {
  // Save audio settings before closing
  saveAudioSettings();

  document.getElementById("options-modal").style.display = "none";
  // FIXED: Changed from "main-menu" to "main-menu-overlay" to match the HTML ID
  document.getElementById("main-menu-overlay").style.display = "flex";
}


/**
 * Initializes audio controls with saved values or defaults
 */
export function loadAudioSettings() {
  // Get saved values or use defaults
  const savedSettings =
    JSON.parse(localStorage.getItem("pixelMinerAudioSettings")) || {};

  // Set music volume slider
  const musicVolumeSlider = document.getElementById("music-volume");
  const musicVolumeValue = document.getElementById("music-volume-value");
  const musicVolume =
    savedSettings.musicVolume !== undefined ? savedSettings.musicVolume : 1.0;

  if (musicVolumeSlider && musicVolumeValue) {
    musicVolumeSlider.value = musicVolume * 100;
    musicVolumeValue.textContent = Math.round(musicVolume * 100) + "%";
  }

  // Set SFX volume slider
  const sfxVolumeSlider = document.getElementById("sfx-volume");
  const sfxVolumeValue = document.getElementById("sfx-volume-value");
  const sfxVolume =
    savedSettings.sfxVolume !== undefined ? savedSettings.sfxVolume : 1.0;

  if (sfxVolumeSlider && sfxVolumeValue) {
    sfxVolumeSlider.value = sfxVolume * 100;
    sfxVolumeValue.textContent = Math.round(sfxVolume * 100) + "%";
  }

  // Apply volume settings (with respect to original max volumes)
  applyAudioSettings(musicVolume, sfxVolume);

  // Set mute checkbox
  const muteCheckbox = document.getElementById("mute-all");
  const muteAll =
    savedSettings.muteAll !== undefined ? savedSettings.muteAll : false;

  if (muteCheckbox) {
    muteCheckbox.checked = muteAll;
  }

  // Store mute state in gameState for easy access
  gameState.muteAll = muteAll;

  // Apply mute setting
  applyMuteSetting(muteAll);

  // Add event listeners for sliders and checkbox
  setupAudioControls();
}

/**
 * Sets up event listeners for audio control elements
 */
export function setupAudioControls() {
  const musicVolumeSlider = document.getElementById("music-volume");
  const musicVolumeValue = document.getElementById("music-volume-value");
  const sfxVolumeSlider = document.getElementById("sfx-volume");
  const sfxVolumeValue = document.getElementById("sfx-volume-value");
  const muteCheckbox = document.getElementById("mute-all");

  // Update music volume when slider changes
  if (musicVolumeSlider && musicVolumeValue) {
    musicVolumeSlider.addEventListener("input", () => {
      const volume = musicVolumeSlider.value / 100;
      musicVolumeValue.textContent = Math.round(volume * 100) + "%";

      if (muteCheckbox && !muteCheckbox.checked) {
        applyMusicVolume(volume);
      }
    });
  }

  // Update SFX volume when slider changes
  if (sfxVolumeSlider && sfxVolumeValue) {
    sfxVolumeSlider.addEventListener("input", () => {
      const volume = sfxVolumeSlider.value / 100;
      sfxVolumeValue.textContent = Math.round(volume * 100) + "%";

      if (muteCheckbox && !muteCheckbox.checked) {
        applySFXVolume(volume);
      }
    });
  }

  // Handle mute checkbox
  if (muteCheckbox) {
    muteCheckbox.addEventListener("change", () => {
      gameState.muteAll = muteCheckbox.checked;
      applyMuteSetting(muteCheckbox.checked);
    });
  }
}

/**
 * Apply volume to music audio elements
 * @param {number} volume - Volume percentage (0-1)
 */
export function applyMusicVolume(volume) {
  // Apply volume to game music
  if (gameMusic) {
    gameMusic.volume = ORIGINAL_VOLUMES.gameMusic * volume;
  }

  // Also apply volume to menu music
  if (menuMusic) {
    menuMusic.volume = ORIGINAL_VOLUMES.menuMusic * volume;
  }

  // Apply volume to story music as well
  if (storyMusic) {
    storyMusic.volume = ORIGINAL_VOLUMES.storyMusic * volume;
  }
}

/**
 * Apply volume to SFX audio elements
 * @param {number} volume - Volume percentage (0-1)
 */
export function applySFXVolume(volume) {
  // Store the scaled volume in gameState for other modules
  gameState.sfxVolume = volume;

  // No need to set volume for each SFX here - they will use gameState.sfxVolume
  // when they're played in their respective modules
}

/**
 * Apply both music and SFX volume settings
 * @param {number} musicVolume - Music volume percentage (0-1)
 * @param {number} sfxVolume - SFX volume percentage (0-1)
 */
export function applyAudioSettings(musicVolume, sfxVolume) {
  applyMusicVolume(musicVolume);
  applySFXVolume(sfxVolume);
}

/**
 * Applies mute setting to all audio
 * @param {boolean} muted - Whether all audio should be muted
 */
export function applyMuteSetting(muted) {
  if (muted) {
    // Mute all audio
    if (gameMusic) {
      gameMusic.volume = 0;
    }
    if (menuMusic) {
      menuMusic.volume = 0;
    }
    if (storyMusic) {
      storyMusic.volume = 0;
    }
    gameState.sfxVolume = 0;
  } else {
    // Unmute using the current slider values
    const musicVolumeSlider = document.getElementById("music-volume");
    const sfxVolumeSlider = document.getElementById("sfx-volume");

    if (musicVolumeSlider && sfxVolumeSlider) {
      const musicVolume = musicVolumeSlider.value / 100;
      const sfxVolume = sfxVolumeSlider.value / 100;
      applyAudioSettings(musicVolume, sfxVolume);
    }
  }
}

/**
 * Saves current audio settings to localStorage
 */
export function saveAudioSettings() {
  const musicVolumeSlider = document.getElementById("music-volume");
  const sfxVolumeSlider = document.getElementById("sfx-volume");
  const muteCheckbox = document.getElementById("mute-all");

  if (musicVolumeSlider && sfxVolumeSlider && muteCheckbox) {
    const musicVolume = musicVolumeSlider.value / 100;
    const sfxVolume = sfxVolumeSlider.value / 100;
    const muteAll = muteCheckbox.checked;

    const audioSettings = {
      musicVolume,
      sfxVolume,
      muteAll,
    };

    localStorage.setItem(
      "pixelMinerAudioSettings",
      JSON.stringify(audioSettings)
    );
  }
}


// Create a loading screen function
export function showLoadingScreen(message) {
  // Remove any existing loading screen
  const existingLoadingScreen = document.getElementById("loading-screen");
  if (existingLoadingScreen) {
    document.body.removeChild(existingLoadingScreen);
  }

  // Remove any existing loading screen styles
  const existingStyles = document.getElementById("loading-screen-styles");
  if (existingStyles) {
    document.head.removeChild(existingStyles);
  }

  // Create loading screen element
  const loadingScreen = document.createElement("div");
  loadingScreen.id = "loading-screen";
  
  // Create content container
  const contentContainer = document.createElement("div");
  contentContainer.className = "loading-content";
  
  // Create game logo
  const logoContainer = document.createElement("div");
  logoContainer.className = "paused-game-logo";
  logoContainer.innerHTML = `<span>Pixel</span><span>Miner</span>`;
  
  // Create loading spinner with multiple rings for a more dynamic effect
  const spinner = document.createElement("div");
  spinner.className = "loading-spinner";
  
  // Inner rings
  for (let i = 1; i <= 3; i++) {
    const ring = document.createElement("div");
    ring.className = `spinner-ring ring-${i}`;
    spinner.appendChild(ring);
  }
  
  // Create message container with animated dots
  const messageContainer = document.createElement("div");
  messageContainer.className = "loading-message-container";
  
  // Create the message element
  const messageElement = document.createElement("div");
  messageElement.className = "loading-message";
  messageElement.textContent = message;
  
  // Create animated dots
  const dotsElement = document.createElement("div");
  dotsElement.className = "loading-dots";
  dotsElement.innerHTML = "<span>.</span><span>.</span><span>.</span>";
  
  // Assemble the message container
  messageContainer.appendChild(messageElement);
  messageContainer.appendChild(dotsElement);
  
  // Add progress bar
  const progressContainer = document.createElement("div");
  progressContainer.className = "progress-container";
  const progressBar = document.createElement("div");
  progressBar.className = "progress-bar";
  progressContainer.appendChild(progressBar);
  
  // Add elements to container
  contentContainer.appendChild(logoContainer);
  contentContainer.appendChild(spinner);
  contentContainer.appendChild(messageContainer);
  contentContainer.appendChild(progressContainer);
  
  // Add container to loading screen
  loadingScreen.appendChild(contentContainer);
  
  // Add to document
  document.body.appendChild(loadingScreen);
  
  // Animate the progress bar
  animateProgress(progressBar);
}

// Function to animate the progress bar in a more realistic way
function animateProgress(progressBar) {
  let width = 0;
  const interval = setInterval(() => {
    if (width >= 90) {
      // Stop at 90% to indicate waiting for response
      clearInterval(interval);
    } else {
      // Increase by a random amount to simulate variable loading
      width += Math.random() * 3;
      if (width > 90) width = 90;
      progressBar.style.width = width + '%';
    }
  }, 200);
  
  // Store the interval ID for cleanup
  progressBar.dataset.intervalId = interval;
}

// Function to hide loading screen
export function hideLoadingScreen() {
  const loadingScreen = document.getElementById("loading-screen");
  if (loadingScreen) {
    // Get progress bar and clear its animation interval
    const progressBar = loadingScreen.querySelector(".progress-bar");
    if (progressBar && progressBar.dataset.intervalId) {
      clearInterval(parseInt(progressBar.dataset.intervalId));
    }
    
    // Quickly finish the progress animation
    if (progressBar) {
      progressBar.style.transition = "width 0.5s ease-out";
      progressBar.style.width = "100%";
    }
    
    // Add fade-out effect after progress completes
    setTimeout(() => {
      loadingScreen.style.transition = "opacity 0.5s ease";
      loadingScreen.style.opacity = "0";
      
      // Remove from DOM after transition
      setTimeout(() => {
        if (loadingScreen.parentNode) {
          loadingScreen.parentNode.removeChild(loadingScreen);
        }
        
        // Clean up styles when done
        const styles = document.getElementById("loading-screen-styles");
        if (styles) {
          styles.parentNode.removeChild(styles);
        }
      }, 500);
    }, 300);
  }
}