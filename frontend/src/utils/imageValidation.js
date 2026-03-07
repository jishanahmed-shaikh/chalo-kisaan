/**
 * Image Validation Utilities
 * Ensures farm photos meet quality standards for AI analysis
 */

export const IMAGE_VALIDATION_RULES = {
  MAX_SIZE_MB: 10,
  MIN_WIDTH_PX: 400,
  MIN_HEIGHT_PX: 400,
  MAX_ASPECT_RATIO: 4.0,
  MIN_ASPECT_RATIO: 0.25,
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
};

/**
 * Validates a file before upload
 * @param {File} file - The image file to validate
 * @returns {Promise<{valid: boolean, error?: string}>}
 */
export async function validateImageFile(file) {
  // Check 1: File type
  if (!IMAGE_VALIDATION_RULES.ALLOWED_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `❌ Invalid file type. Supported: JPG, PNG, WebP. Your file: ${file.type || 'unknown'}`,
    };
  }

  // Check 2: File size
  const sizeInMB = file.size / 1024 / 1024;
  if (sizeInMB > IMAGE_VALIDATION_RULES.MAX_SIZE_MB) {
    return {
      valid: false,
      error: `❌ Image too large (${sizeInMB.toFixed(1)}MB). Max: ${IMAGE_VALIDATION_RULES.MAX_SIZE_MB}MB`,
    };
  }

  // Check 3: Image dimensions
  const result = await validateImageDimensions(file);
  if (!result.valid) {
    return result;
  }

  return { valid: true };
}

/**
 * Validates image dimensions by loading the image
 * @param {File} file - The image file
 * @returns {Promise<{valid: boolean, error?: string, width?: number, height?: number}>}
 */
export function validateImageDimensions(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        const { width, height } = img;
        const aspectRatio = width / height;

        // Check minimum dimensions
        if (
          width < IMAGE_VALIDATION_RULES.MIN_WIDTH_PX ||
          height < IMAGE_VALIDATION_RULES.MIN_HEIGHT_PX
        ) {
          resolve({
            valid: false,
            error: `❌ Image too small (${width}×${height}px). Minimum: ${IMAGE_VALIDATION_RULES.MIN_WIDTH_PX}×${IMAGE_VALIDATION_RULES.MIN_HEIGHT_PX}px`,
            width,
            height,
          });
          return;
        }

        // Check aspect ratio
        if (
          aspectRatio > IMAGE_VALIDATION_RULES.MAX_ASPECT_RATIO ||
          aspectRatio < IMAGE_VALIDATION_RULES.MIN_ASPECT_RATIO
        ) {
          resolve({
            valid: false,
            error: `❌ Image aspect ratio unusual (${aspectRatio.toFixed(1)}:1). Please use a normal farm photo taken from ground level.`,
            width,
            height,
          });
          return;
        }

        resolve({
          valid: true,
          width,
          height,
        });
      };

      img.onerror = () => {
        resolve({
          valid: false,
          error: '❌ Could not load image. File may be corrupted.',
        });
      };

      img.src = e.target.result;
    };

    reader.onerror = () => {
      resolve({
        valid: false,
        error: '❌ Error reading file. Please try again.',
      });
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Formats validation error message for display
 * @param {string} error - The error message
 * @returns {string} Formatted error message with emoji
 */
export function formatValidationError(error) {
  if (error.includes('file type')) {
    return `📷 ${error}`;
  }
  if (error.includes('too large')) {
    return `📊 ${error}`;
  }
  if (error.includes('too small')) {
    return `🔍 ${error}`;
  }
  if (error.includes('aspect ratio')) {
    return `📐 ${error}`;
  }
  if (error.includes('corrupted')) {
    return `⚠️ ${error}`;
  }
  return error;
}

/**
 * Gets helpful suggestions based on validation error
 * @param {string} error - The error message
 * @returns {string} Helpful suggestion
 */
export function getValidationSuggestion(error) {
  if (error.includes('file type')) {
    return '💡 Try uploading a JPG or PNG file from your phone or camera.';
  }
  if (error.includes('too large')) {
    return '💡 Use a photo editor or phone to compress the image, then try again.';
  }
  if (error.includes('too small')) {
    return '💡 Use a high-quality photo from your phone camera or a digital camera.';
  }
  if (error.includes('aspect ratio')) {
    return '💡 Take a normal photo from your device—not a panorama or screenshot.';
  }
  if (error.includes('corrupted')) {
    return '💡 Try a different image file or take a new photo.';
  }
  return '💡 Please check the image and try again.';
}
