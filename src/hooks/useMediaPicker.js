import { useCallback } from 'react';
import { toast } from 'sonner';

/**
 * Global media picker hook for camera, gallery, and file uploads
 * Works on desktop browsers, mobile browsers, Android app, and iOS app
 * 
 * Usage:
 *   const { openCamera, openGallery, openFile } = useMediaPicker();
 *   <button onClick={() => openCamera()}>Take Photo</button>
 */

// Check and request camera permissions
async function requestCameraPermission() {
  try {
    // Check if the Permissions API is available
    if (!navigator.permissions || !navigator.permissions.query) {
      return true; // Assume granted if API not available
    }

    const permResult = await navigator.permissions.query({ name: 'camera' });
    
    if (permResult.state === 'denied') {
      toast.error('Camera access was denied. Please enable it in settings.');
      return false;
    }

    if (permResult.state === 'prompt') {
      // Try to actually use the camera to trigger the permission prompt
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        stream.getTracks().forEach(track => track.stop());
        return true;
      } catch (err) {
        if (err.name === 'NotAllowedError') {
          toast.error('Camera permission denied. Please try again.');
          return false;
        }
        // Other errors (device not found, etc.) — fallback to file input
        return true;
      }
    }

    return true; // granted
  } catch (error) {
    console.error('Permission check error:', error);
    return true; // Fallback to trying the input
  }
}

export function useMediaPicker() {
  const openCamera = useCallback(async (onFileSelect, options = {}) => {
    const { accept = 'image/*', capture = 'environment' } = options;
    
    try {
      // Request camera permission first (on supported browsers)
      const hasPermission = await requestCameraPermission();
      if (!hasPermission) return;

      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.capture = capture; // 'environment' for rear camera, 'user' for front
      
      input.onchange = (e) => {
        const file = e.target.files?.[0];
        if (file) onFileSelect(file);
      };
      
      input.onerror = () => {
        toast.error('Camera access failed. Try using gallery instead.');
      };
      
      input.click();
    } catch (error) {
      console.error('Camera error:', error);
      toast.error('Could not open camera. Try uploading from gallery instead.');
    }
  }, []);

  const openGallery = useCallback(async (onFileSelect, options = {}) => {
    const { accept = 'image/*' } = options;
    
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      
      input.onchange = (e) => {
        const file = e.target.files?.[0];
        if (file) onFileSelect(file);
      };
      
      input.click();
    } catch (error) {
      console.error('Gallery error:', error);
      toast.error('Could not open gallery. Please try again.');
    }
  }, []);

  const openFile = useCallback(async (onFileSelect, options = {}) => {
    const { accept = '*' } = options;
    
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      
      input.onchange = (e) => {
        const file = e.target.files?.[0];
        if (file) onFileSelect(file);
      };
      
      input.click();
    } catch (error) {
      console.error('File picker error:', error);
      toast.error('Could not open file picker. Please try again.');
    }
  }, []);

  // Fallback: try camera, if fails offer gallery
  const openMediaWithFallback = useCallback(async (onFileSelect, options = {}) => {
    const { accept = 'image/*' } = options;
    
    try {
      // Detect device type
      const isMobile = /iPhone|iPad|Android|Mobile|Opera Mini/.test(navigator.userAgent);
      const isAndroidApp = window.ReactNativeWebView || navigator.userAgent.includes('wv');
      const isIOSApp = navigator.userAgent.includes('Mobile') && !navigator.userAgent.includes('Android');
      
      if (isMobile || isAndroidApp || isIOSApp) {
        // On mobile devices/apps, try camera first with permission check
        const hasPermission = await requestCameraPermission();
        if (hasPermission) {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = accept;
          input.capture = 'environment'; // Rear camera by default
          
          input.onchange = (e) => {
            const file = e.target.files?.[0];
            if (file) onFileSelect(file);
          };
          
          input.onerror = () => {
            // Camera failed — fallback to gallery
            openGallery(onFileSelect, { accept });
          };
          
          input.click();
        } else {
          // Permission denied — offer gallery as fallback
          openGallery(onFileSelect, { accept });
        }
      } else {
        // Desktop: skip camera, go straight to gallery
        openGallery(onFileSelect, { accept });
      }
    } catch (error) {
      console.error('Media picker error:', error);
      // Final fallback: always try gallery
      openGallery(onFileSelect, { accept });
    }
  }, [openGallery]);

  return {
    openCamera,
    openGallery,
    openFile,
    openMediaWithFallback,
  };
}