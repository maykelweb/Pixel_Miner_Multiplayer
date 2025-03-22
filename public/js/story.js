// story.js
import { initGame } from "./main.js";
import { menuMusic, storyMusic, gameMusic, ORIGINAL_VOLUMES, playSFX, crossFadeAudio, stopSFX } from "./setup.js";

export function showStorySequence() {
  // Cross-fade from menu music to story music
  crossFadeAudio(menuMusic, storyMusic, 500, true);
  
  // Explicitly stop menu music after the cross-fade completes
  setTimeout(() => {
    stopSFX(menuMusic);
  }, 600);

  // Create the story overlay container
  const storyOverlay = document.createElement("div");
  storyOverlay.id = "story-overlay";
  storyOverlay.className = "story-overlay";

  // Create the story content container
  const storyContainer = document.createElement("div");
  storyContainer.className = "image-container";

  // Add the three image pairs
  storyContainer.innerHTML = `
      <!-- First pair of images -->
      <div class="image-pair active" id="pair1">
          <img src="/story/player-keys1.jpeg" alt="Image 1A" class="image" id="image1a">
          <img src="/story/player-keys2.jpeg" alt="Image 1B" class="image" id="image1b">
          <div class="caption" id="caption1">This is Tom</div>
      </div>
      
      <!-- Second pair of images -->
      <div class="image-pair" id="pair2">
          <img src="/story/keys-fall1.jpeg" alt="Image 2A" class="image" id="image2a">
          <img src="/story/keys-fall2.jpeg" alt="Image 2B" class="image" id="image2b">
          <div class="caption" id="caption2">Tom lost his keys</div>
      </div>
      
      <!-- Third pair of images -->
      <div class="image-pair" id="pair3">
          <img src="/story/player-mining1.jpeg" alt="Image 3A" class="image" id="image3a">
          <img src="/story/player-mining2.jpeg" alt="Image 3B" class="image" id="image3b">
          <div class="caption" id="caption3">Now he needs to go mining for them</div>
      </div>
    `;

  // Append elements to the DOM
  storyOverlay.appendChild(storyContainer);
  document.body.appendChild(storyOverlay);

  // Story animation logic
  const pairs = [
    document.getElementById("pair1"),
    document.getElementById("pair2"),
    document.getElementById("pair3"),
  ];

  let currentPairIndex = 0;
  let animationInterval = null;
  let autoAdvanceTimeout = null;
  
  // Reading time for each caption in milliseconds (4 seconds)
  const readingTime = 3000;

  // Function to toggle between images within a pair
  function toggleImagesInCurrentPair() {
    const currentPair = pairs[currentPairIndex];
    const images = currentPair.querySelectorAll(".image");

    if (images[0].classList.contains("visible")) {
      images[0].classList.remove("visible");
      images[1].classList.add("visible");
    } else {
      images[1].classList.remove("visible");
      images[0].classList.add("visible");
    }
  }

  // Function to advance to the next image pair
  function advanceToNextPair() {
    // Clear auto-advance timeout if it exists
    if (autoAdvanceTimeout) {
      clearTimeout(autoAdvanceTimeout);
      autoAdvanceTimeout = null;
    }
    
    currentPairIndex++;

    if (currentPairIndex < 3) {
      // Initialize the next pair
      initImagePair(currentPairIndex);
    } else {
      // Stop animation after the third pair
      clearInterval(animationInterval);
      
      // Create a fade-to-black overlay
      const fadeOverlay = document.createElement("div");
      fadeOverlay.className = "fade-overlay";
      document.body.appendChild(fadeOverlay);
      
      // Fade to black first
      fadeOverlay.style.opacity = "0";
      fadeOverlay.style.display = "block";
      
      setTimeout(() => {
        // Animate fade to black
        fadeOverlay.style.opacity = "1";
        
        // After fade to black completes, remove story and prepare for fade in
        setTimeout(() => {
          // Cross-fade from story music to game music
          crossFadeAudio(storyMusic, gameMusic, 500, true);
          
          // Explicitly stop story music after crossfade
          setTimeout(() => {
            stopSFX(storyMusic);
          }, 600);
          
          // Remove story overlay
          storyOverlay.remove();
          
          // Set flag in localStorage to indicate story has been shown
          localStorage.setItem("pixelMinerStoryShown", "true");
          
          // Initialize game (but it will be behind black overlay)
          initGame();
          
          // Fade from black to game
          setTimeout(() => {
            fadeOverlay.style.opacity = "0";
            
            // Remove the fade overlay after transition completes
            setTimeout(() => {
              fadeOverlay.remove();
            }, 500);
          }, 200);
        }, 500);
      }, 50);
    }
  }

  // Function to initialize an image pair for animation
  function initImagePair(pairIndex) {
    // Hide all pairs
    pairs.forEach((pair) => pair.classList.remove("active"));

    // Show current pair
    pairs[pairIndex].classList.add("active");

    // Initialize the first image to be visible
    const currentPair = pairs[pairIndex];
    const images = currentPair.querySelectorAll(".image");
    images.forEach((img) => img.classList.remove("visible"));
    images[0].classList.add("visible");
    
    // Set up auto-advance to next pair after reading time
    autoAdvanceTimeout = setTimeout(advanceToNextPair, readingTime);
  }

  // Initialize first pair
  initImagePair(0);

  // Start animation immediately for the first pair
  animationInterval = setInterval(toggleImagesInCurrentPair, 200);

  // Handle clicks to progress through image pairs
  storyContainer.addEventListener("click", function () {
    // Manual advance by user click
    advanceToNextPair();
  });
}