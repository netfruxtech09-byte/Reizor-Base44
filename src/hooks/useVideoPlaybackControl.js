import { useEffect } from 'react';

/**
 * App-level video control hook.
 * Pauses all video/audio elements on the page when a modal is open.
 * @param {boolean} isModalOpen - True when any fullscreen modal is active
 */
export function useVideoPlaybackControl(isModalOpen) {
  useEffect(() => {
    if (!isModalOpen) return;

    // Pause all video and audio elements on the page
    const videos = document.querySelectorAll('video');
    const audios = document.querySelectorAll('audio');

    videos.forEach((video) => {
      video.pause();
    });
    audios.forEach((audio) => {
      audio.pause();
    });
  }, [isModalOpen]);
}

/**
 * Utility function to pause all videos on page.
 * Use this when opening any modal from outside a React component.
 */
export function pauseAllVideos() {
  const videos = document.querySelectorAll('video');
  const audios = document.querySelectorAll('audio');
  videos.forEach((video) => {
    video.pause();
  });
  audios.forEach((audio) => {
    audio.pause();
  });
}