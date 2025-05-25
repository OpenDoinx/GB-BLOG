/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { marked } from 'marked';

// DOM Elements
const blogContentElement = document.getElementById('blog-content');
const loadingIndicatorElement = document.getElementById('loading-indicator');
const generatePostButton = document.getElementById('generate-post-button') as HTMLButtonElement;

const audioPlayer = document.getElementById('audio-player') as HTMLAudioElement;
const playPauseButton = document.getElementById('play-pause-button') as HTMLButtonElement;
const prevTrackButton = document.getElementById('prev-track-button') as HTMLButtonElement;
const nextTrackButton = document.getElementById('next-track-button') as HTMLButtonElement;
const volumeSlider = document.getElementById('volume-slider') as HTMLInputElement;
const songTitleElement = document.getElementById('song-title');
const folderSelectorInput = document.getElementById('folder-selector-input') as HTMLInputElement; 
const playlistElement = document.getElementById('playlist') as HTMLUListElement;

// Ensure API_KEY is available (handled by the execution environment)
const API_KEY = process.env.API_KEY;
if (!API_KEY) {
  console.error("API_KEY is not set. Please ensure the API_KEY environment variable is configured.");
  // Do not overwrite McFlurry article with API key error unless it's not present
  if (blogContentElement && !blogContentElement.querySelector('.mcflurry-article-container')) { 
    blogContentElement.innerHTML = '<p style="color: red;">Configuration error: API Key not found. AI features disabled.</p>';
  }
  if (loadingIndicatorElement) loadingIndicatorElement.style.display = 'none';
  if (generatePostButton) generatePostButton.disabled = true;
}

const ai = API_KEY ? new GoogleGenAI({ apiKey: API_KEY }) : null;

let playlistFiles: File[] = [];
let currentTrackIndex = -1;

/**
 * Displays a temporary message (e.g., error or info) at the top of the blog content area.
 * @param message The message text.
 * @param isError If true, message is styled as an error (red). Defaults to true.
 */
function showTemporaryBlogMessage(message: string, isError: boolean = true) {
    if (!blogContentElement) return;
    const msgElement = document.createElement('p');
    msgElement.style.color = isError ? 'red' : '#888';
    msgElement.style.fontWeight = isError ? 'bold' : 'normal';
    msgElement.textContent = message;
    msgElement.setAttribute('role', 'alert');
    
    // Prepend to make it visible at the top
    blogContentElement.prepend(msgElement);
    setTimeout(() => {
        if (msgElement.parentNode) {
            msgElement.remove();
        }
    }, 5000);
}

/**
 * Renders the blog post content as HTML after parsing Markdown.
 * @param markdownText The Markdown string to render.
 */
async function renderBlogPost(markdownText: string | null) {
  if (blogContentElement) {
    if (markdownText) {
      // Clear any existing static content (like McFlurry article) before rendering AI content
      blogContentElement.innerHTML = ''; 
      blogContentElement.innerHTML = await marked.parse(markdownText);
    } else {
      blogContentElement.innerHTML = '<p>No content received from AI.</p>'; // This also clears McFlurry
    }
  }
}

/**
 * Fetches a new blog post from the Gemini API and displays it.
 */
async function fetchAndDisplayBlogPost() {
  if (!ai) {
    console.error("AI client not initialized due to missing API_KEY.");
    showTemporaryBlogMessage('AI client not initialized. API Key might be missing. Cannot generate new post.');
    if (loadingIndicatorElement) loadingIndicatorElement.style.display = 'none';
    // Button should already be disabled if API_KEY was missing initially.
    // If it became null later (not possible with current const ai), then disable:
    if (generatePostButton) generatePostButton.disabled = true; 
    return;
  }

  if (!ai.models) {
    console.error("AI client error: 'models' property is undefined. This might be due to an SDK initialization issue or an invalid/restricted API key.");
    showTemporaryBlogMessage('Error: AI models not accessible. Cannot generate new post.');
    if (loadingIndicatorElement) loadingIndicatorElement.style.display = 'none';
    if (generatePostButton) generatePostButton.disabled = true; // Ensure button is disabled
    return;
  }

  if (loadingIndicatorElement) loadingIndicatorElement.style.display = 'block';
  if (generatePostButton) generatePostButton.disabled = true;

  const prompt = `Generate a list of 3-5 business ideas, conceptualized through the lens of the settler colonial economic system. 
For each idea, briefly explain its connection to settler colonial principles such as resource extraction, land appropriation, creation of dependent markets, or labor exploitation. 
The tone should be analytical and critical. 
Present the output in Markdown format, with a main title (e.g., using H3), an introduction, and then each business idea as a sub-section (e.g., using H4 or bold text for the idea name followed by its explanation). Conclude briefly.`;

  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-04-17',
      contents: prompt,
      config: { temperature: 0.7 } // Temperature can be adjusted for creativity vs. factuality
    });
    
    const text = response.text;
    await renderBlogPost(text); // This will replace the McFlurry article

  } catch (error) {
    console.error("Error fetching blog post:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    showTemporaryBlogMessage(`Failed to load blog post. Error: ${errorMessage}`);
  } finally {
    if (loadingIndicatorElement) loadingIndicatorElement.style.display = 'none';
    // Re-enable button only if API key exists and AI models are presumably accessible
    // (though an error might have occurred, we allow retry).
    // If !ai.models was caught earlier, it remains disabled.
    if (generatePostButton && API_KEY && ai.models) {
         generatePostButton.disabled = false;
    } else if (generatePostButton) {
        generatePostButton.disabled = true; // Keep disabled if initial checks failed
    }
  }
}

/**
 * Music Player Logic
 */
function updatePlayerControlsState() {
    const hasTracks = playlistFiles.length > 0;
    const isTrackPotentiallyLoaded = currentTrackIndex !== -1 && audioPlayer.currentSrc && audioPlayer.currentSrc !== audioPlayer.baseURI;

    playPauseButton.disabled = !hasTracks;
    prevTrackButton.disabled = !hasTracks;
    nextTrackButton.disabled = !hasTracks;

    if (isTrackPotentiallyLoaded) {
        playPauseButton.textContent = audioPlayer.paused ? 'Play' : 'Pause';
        playPauseButton.setAttribute('aria-label', audioPlayer.paused ? 'Play music' : 'Pause music');
    } else if (hasTracks) {
        playPauseButton.textContent = 'Play';
        playPauseButton.setAttribute('aria-label', 'Play music');
    } else {
        playPauseButton.textContent = 'Play';
        playPauseButton.setAttribute('aria-label', 'Play music');
        if(songTitleElement) songTitleElement.textContent = "No track loaded";
    }
}

function highlightCurrentTrack() {
  if (!playlistElement) return;
  const items = playlistElement.getElementsByTagName('li');
  for (let i = 0; i < items.length; i++) {
    if (i === currentTrackIndex) {
      items[i].classList.add('playing');
      items[i].setAttribute('aria-current', 'true');
    } else {
      items[i].classList.remove('playing');
      items[i].removeAttribute('aria-current');
    }
  }
}

function playTrack(index: number) {
  if (index >= 0 && index < playlistFiles.length) {
    currentTrackIndex = index;
    const file = playlistFiles[index];
    const objectURL = URL.createObjectURL(file);
    
    if (audioPlayer.dataset.currentObjectUrl) {
        URL.revokeObjectURL(audioPlayer.dataset.currentObjectUrl);
    }
    audioPlayer.src = objectURL;
    audioPlayer.dataset.currentObjectUrl = objectURL; 

    if(songTitleElement) songTitleElement.textContent = file.name;
    audioPlayer.play()
      .then(() => {
        highlightCurrentTrack();
      })
      .catch(error => {
        console.error("Error playing track:", error);
        if(songTitleElement) songTitleElement.textContent = "Error loading track";
        updatePlayerControlsState(); 
      });
  }
}

function setupMusicPlayer() {
  if (!audioPlayer || !playPauseButton || !volumeSlider || !songTitleElement || !folderSelectorInput || !playlistElement || !prevTrackButton || !nextTrackButton) {
    console.warn("One or more music player elements not found. Music player setup incomplete.");
    if(playPauseButton) playPauseButton.disabled = true;
    if(prevTrackButton) prevTrackButton.disabled = true;
    if(nextTrackButton) nextTrackButton.disabled = true;
    if(volumeSlider) volumeSlider.disabled = true;
    if(folderSelectorInput && folderSelectorInput.previousElementSibling instanceof HTMLElement) {
        (folderSelectorInput.previousElementSibling as HTMLLabelElement).style.opacity = '0.5';
    }
    return;
  }

  folderSelectorInput.addEventListener('change', (event) => {
    const files = (event.target as HTMLInputElement).files;
    if (files && files.length > 0) {
      playlistFiles = Array.from(files).filter(file => 
        file.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|flac)$/i.test(file.name)
      );
      
      playlistElement.innerHTML = ''; 
      if (playlistFiles.length > 0) {
        playlistFiles.forEach((file, index) => {
          const listItem = document.createElement('li');
          listItem.textContent = file.name;
          listItem.setAttribute('role', 'button');
          listItem.setAttribute('tabindex', '0');
          listItem.setAttribute('aria-label', `Play ${file.name}`);
          listItem.addEventListener('click', () => playTrack(index));
          listItem.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault(); 
              playTrack(index);
            }
          });
          playlistElement.appendChild(listItem);
        });
        currentTrackIndex = -1; 
        if(songTitleElement) songTitleElement.textContent = "Select a track or press play";

      } else {
        if(songTitleElement) songTitleElement.textContent = "No audio files found in folder.";
        currentTrackIndex = -1;
      }
      updatePlayerControlsState();
    }
  });

  playPauseButton.addEventListener('click', () => {
    const isTrackPotentiallyLoaded = currentTrackIndex !== -1 && audioPlayer.currentSrc && audioPlayer.currentSrc !== audioPlayer.baseURI;
    if (isTrackPotentiallyLoaded) { 
      if (audioPlayer.paused) {
        audioPlayer.play().catch(e => console.error("Play error:", e));
      } else {
        audioPlayer.pause();
      }
    } else if (playlistFiles.length > 0) { 
      playTrack(0); 
    }
  });

  prevTrackButton.addEventListener('click', () => {
    if (playlistFiles.length === 0) return;
    let newIndex = currentTrackIndex - 1;
    if (newIndex < 0) {
        newIndex = playlistFiles.length -1; 
    }
    if (currentTrackIndex === -1 && playlistFiles.length > 0) { 
        newIndex = playlistFiles.length - 1;
    }
    playTrack(newIndex);
  });

  nextTrackButton.addEventListener('click', () => {
    if (playlistFiles.length === 0) return;
    let newIndex = (currentTrackIndex + 1) % playlistFiles.length;
     if (currentTrackIndex === -1 && playlistFiles.length > 0) { 
        newIndex = 0;
    }
    playTrack(newIndex);
  });

  volumeSlider.addEventListener('input', () => {
    audioPlayer.volume = parseFloat(volumeSlider.value);
  });

  audioPlayer.addEventListener('ended', () => {
    if (playlistFiles.length > 0) {
        const nextIndex = (currentTrackIndex + 1) % playlistFiles.length;
        playTrack(nextIndex);
    } else {
        updatePlayerControlsState();
    }
  });

  audioPlayer.addEventListener('play', updatePlayerControlsState);
  audioPlayer.addEventListener('pause', updatePlayerControlsState);
  audioPlayer.addEventListener('loadeddata', updatePlayerControlsState); 
  
  updatePlayerControlsState(); 
}

// --- Initial Setup ---
if (generatePostButton) {
  generatePostButton.addEventListener('click', fetchAndDisplayBlogPost);
  if (!API_KEY) { 
    generatePostButton.disabled = true;
  }
} else {
  console.warn("'Generate New AI Post' button not found.");
}

// No initial AI blog post fetch, static content from HTML will be shown.
if (loadingIndicatorElement) {
    loadingIndicatorElement.style.display = 'none';
}

setupMusicPlayer();

if (!folderSelectorInput) { 
    console.warn("Folder selector input with ID 'folder-selector-input' not found. Music loading from folder will not work.");
}
