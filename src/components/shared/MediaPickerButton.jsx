import { useMediaPicker } from '@/hooks/useMediaPicker';
import { Button } from '@/components/ui/button';
import { Camera, Upload, Image as ImageIcon } from 'lucide-react';

/**
 * Reusable media picker button component
 * 
 * Props:
 *   onFileSelect - callback when file is selected
 *   mode - 'camera', 'gallery', 'file', or 'auto'
 *   accept - file type filter (default: 'image/*')
 *   label - button label
 *   icon - which icon to show
 *   variant - button variant
 *   size - button size
 *   disabled - disable button
 *   loading - show loading state
 */
export default function MediaPickerButton({
  onFileSelect,
  mode = 'auto',
  accept = 'image/*',
  label,
  icon,
  variant = 'outline',
  size = 'default',
  disabled = false,
  loading = false,
  className = '',
}) {
  const { openCamera, openGallery, openFile, openMediaWithFallback } = useMediaPicker();

  const handleClick = () => {
    const options = { accept };
    
    switch (mode) {
      case 'camera':
        openCamera(onFileSelect, options);
        break;
      case 'gallery':
        openGallery(onFileSelect, options);
        break;
      case 'file':
        openFile(onFileSelect, options);
        break;
      case 'auto':
      default:
        openMediaWithFallback(onFileSelect, options);
        break;
    }
  };

  const getIcon = () => {
    if (icon) return icon;
    
    switch (mode) {
      case 'camera':
        return <Camera className="w-4 h-4" />;
      case 'gallery':
        return <ImageIcon className="w-4 h-4" />;
      case 'file':
        return <Upload className="w-4 h-4" />;
      case 'auto':
      default:
        return <Camera className="w-4 h-4" />;
    }
  };

  const getLabel = () => {
    if (label) return label;
    
    switch (mode) {
      case 'camera':
        return 'Take Photo';
      case 'gallery':
        return 'Choose Image';
      case 'file':
        return 'Upload File';
      case 'auto':
      default:
        return 'Add Media';
    }
  };

  return (
    <Button
      onClick={handleClick}
      disabled={disabled || loading}
      variant={variant}
      size={size}
      className={className}
    >
      {getIcon()}
      {getLabel()}
    </Button>
  );
}