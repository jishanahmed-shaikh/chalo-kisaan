/**
 * detectLanguage — Detect the script of user input text
 * 
 * Returns: 'hindi', 'marathi', 'punjabi', 'gujarati', 'english', or null if unclear
 */

/**
 * Detect dominant script in text
 * Returns language code or null if unmixed/unclear
 */
export function detectLanguage(text) {
  if (!text || text.trim().length === 0) return null;

  // Count characters in each script range
  const scriptCounts = {};
  let totalNonAscii = 0;

  for (const char of text) {
    const code = char.charCodeAt(0);

    // Check each script
    if (code >= 0x0900 && code <= 0x097F) {
      scriptCounts.devanagari = (scriptCounts.devanagari || 0) + 1;
      totalNonAscii++;
    } else if (code >= 0x0A00 && code <= 0x0A7F) {
      scriptCounts.gurmukhi = (scriptCounts.gurmukhi || 0) + 1;
      totalNonAscii++;
    } else if (code >= 0x0A80 && code <= 0x0AFF) {
      scriptCounts.gujarati = (scriptCounts.gujarati || 0) + 1;
      totalNonAscii++;
    }
  }

  // If >60% non-ASCII characters, detect script
  const nonAsciiRatio = totalNonAscii / text.length;

  if (nonAsciiRatio > 0.6) {
    // Strong indicator of Indic script
    if (scriptCounts.devanagari && scriptCounts.devanagari > 0) {
      // Could be Hindi or Marathi — default to Hindi, UI language would override
      return 'hindi';
    }
    if (scriptCounts.gurmukhi && scriptCounts.gurmukhi > 0) {
      return 'punjabi';
    }
    if (scriptCounts.gujarati && scriptCounts.gujarati > 0) {
      return 'gujarati';
    }
  }

  // Default to english for ASCII-heavy text
  return 'english';
}

/**
 * Determine response language:
 * 1. If user input is in a non-English script, respond in that language
 * 2. Otherwise, respond in the selected UI language
 */
export function getResponseLanguage(userInput, selectedLanguage) {
  const detectedLang = detectLanguage(userInput);

  // If detected a non-English script, respond in that script
  if (detectedLang && detectedLang !== 'english') {
    return detectedLang;
  }

  // Otherwise use the selected UI language
  return selectedLanguage || 'hindi';
}
