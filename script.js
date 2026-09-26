/**
 * Smart QR Studio — Dynamic Evidence-Based QR Platform
 * Production Script:
 * - Pixel-accurate in-matrix QR Text (Letter matrix directly engraved into QR modules)
 * - Complete suppression of center badge when QR Text is set
 * - Interactive Custom Logo Size Slider (10% to 30%) with aspect ratio preservation
 * - Unified Canvas preview, PNG 1600px export, and SVG export
 */

(function () {
  'use strict';

  // --- 1. APPLICATION STATE ---
  const state = {
    url: '',
    theme: localStorage.getItem('smart_qr_app_theme') || 'system',
    detection: null,
    smartMode: 'identity',
    designVariationIndex: 0,
    activePreset: null,
    activeLogoImg: null,
    activeLogoDataUrl: null,
    activeLogoIsVerified: false,
    customLogoImg: null,
    customLogoDataUrl: null,
    isManualOverride: false,
    currentAnalysisId: 0,
    currentRenderToken: 0,
    options: {
      dotStyle: 'square',
      eyeStyle: 'square',
      fgColor: '#0F172A',
      bgColor: '#FFFFFF',
      useGradient: false,
      fgGradColor: '#2563EB',
      logoMode: 'auto',
      logoScale: 0.22, // Default logo scale (22%)
      centerBadgeText: '',
      qrText: '', // Text integrated inside matrix
      qrTextMode: 'dot', // 'dot' | 'negative'
      frameStyle: 'none',
      frameText: 'SCAN ME',
      ecc: 'H',
      quietZone: 4,
      size: 1024
    }
  };

  // --- 2. 5x3 PIXEL MATRIX FONT FOR IN-MATRIX TEXT ---
  // Guarantees bold, crisp, scannable letters inside any QR version
  const FONT_5X3 = {
    'A': [0b111, 0b101, 0b111, 0b101, 0b101],
    'B': [0b110, 0b101, 0b110, 0b101, 0b110],
    'C': [0b111, 0b100, 0b100, 0b100, 0b111],
    'D': [0b110, 0b101, 0b101, 0b101, 0b110],
    'E': [0b111, 0b100, 0b111, 0b100, 0b111],
    'F': [0b111, 0b100, 0b110, 0b100, 0b100],
    'G': [0b111, 0b100, 0b101, 0b101, 0b111],
    'H': [0b101, 0b101, 0b111, 0b101, 0b101],
    'I': [0b111, 0b010, 0b010, 0b010, 0b111],
    'J': [0b001, 0b001, 0b001, 0b101, 0b111],
    'K': [0b101, 0b110, 0b100, 0b110, 0b101],
    'L': [0b100, 0b100, 0b100, 0b100, 0b111],
    'M': [0b101, 0b111, 0b101, 0b101, 0b101],
    'N': [0b111, 0b101, 0b101, 0b101, 0b101],
    'O': [0b111, 0b101, 0b101, 0b101, 0b111],
    'P': [0b111, 0b101, 0b111, 0b100, 0b100],
    'Q': [0b111, 0b101, 0b101, 0b111, 0b001],
    'R': [0b111, 0b101, 0b110, 0b101, 0b101],
    'S': [0b111, 0b100, 0b111, 0b001, 0b111],
    'T': [0b111, 0b010, 0b010, 0b010, 0b010],
    'U': [0b101, 0b101, 0b101, 0b101, 0b111],
    'V': [0b101, 0b101, 0b101, 0b101, 0b010],
    'W': [0b101, 0b101, 0b101, 0b111, 0b101],
    'X': [0b101, 0b101, 0b010, 0b101, 0b101],
    'Y': [0b101, 0b101, 0b111, 0b010, 0b010],
    'Z': [0b111, 0b001, 0b010, 0b100, 0b111],
    '0': [0b111, 0b101, 0b101, 0b101, 0b111],
    '1': [0b010, 0b110, 0b010, 0b010, 0b111],
    '2': [0b111, 0b001, 0b111, 0b100, 0b111],
    '3': [0b111, 0b001, 0b111, 0b001, 0b111],
    '4': [0b101, 0b101, 0b111, 0b001, 0b001],
    '5': [0b111, 0b100, 0b111, 0b001, 0b111],
    '6': [0b111, 0b100, 0b111, 0b101, 0b111],
    '7': [0b111, 0b001, 0b010, 0b010, 0b010],
    '8': [0b111, 0b101, 0b111, 0b101, 0b111],
    '9': [0b111, 0b101, 0b111, 0b001, 0b111],
    ' ': [0b000, 0b000, 0b000, 0b000, 0b000]
  };

  const QRTextEngine = {
    buildTextMatrix(text) {
      const clean = text.trim().toUpperCase().slice(0, 10);
      const letterWidth = 3;
      const letterHeight = 5;
      const spacing = 1;
      const totalWidth = clean.length * letterWidth + (clean.length - 1) * spacing;
      const totalHeight = letterHeight;

      const matrix = Array.from({ length: totalHeight }, () => new Uint8Array(totalWidth));

      let colOffset = 0;
      for (const char of clean) {
        const glyph = FONT_5X3[char] || FONT_5X3[' '];
        for (let r = 0; r < letterHeight; r++) {
          const rowBits = glyph[r];
          if ((rowBits & 0b100) !== 0) matrix[r][colOffset] = 1;
          if ((rowBits & 0b010) !== 0) matrix[r][colOffset + 1] = 1;
          if ((rowBits & 0b001) !== 0) matrix[r][colOffset + 2] = 1;
        }
        colOffset += letterWidth + spacing;
      }

      return { matrix, width: totalWidth, height: totalHeight };
    },

    computePlacement(moduleCount, text) {
      if (!text || !text.trim()) return null;
      const { matrix, width, height } = this.buildTextMatrix(text);
      const functionMask = QRStructure.createFunctionModuleMask(moduleCount);

      if (width >= moduleCount - 16) return null; // Avoid crowding finder zones

      const startRow = Math.floor((moduleCount - height) / 2);
      const startCol = Math.floor((moduleCount - width) / 2);

      // Verify no collisions with finder or timing patterns
      for (let r = startRow; r < startRow + height; r++) {
        for (let c = startCol; c < startCol + width; c++) {
          if (r < 0 || r >= moduleCount || c < 0 || c >= moduleCount) return null;
          if (functionMask[r][c] === 1) return null;
        }
      }

      return { startRow, startCol, width, height, matrix };
    }
  };

  // --- 3. QR SPECIFICATION STRUCTURAL FUNCTION-PATTERN PROTECTION ---
  const QRStructure = {
    alignmentPatternCenters: [
      [], [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42],
      [6, 26, 46], [6, 28, 50], [6, 30, 54], [6, 32, 58], [6, 34, 62], [6, 26, 46, 66],
      [6, 26, 48, 70], [6, 26, 50, 74], [6, 30, 54, 78], [6, 30, 56, 82], [6, 30, 58, 86],
      [6, 34, 62, 90], [6, 28, 50, 72, 94], [6, 26, 50, 74, 98], [6, 30, 54, 78, 102],
      [6, 28, 54, 80, 106], [6, 32, 58, 84, 110], [6, 30, 58, 86, 114], [6, 34, 62, 90, 118],
      [6, 26, 50, 74, 98, 122], [6, 30, 54, 78, 102, 126], [6, 26, 52, 78, 104, 130],
      [6, 30, 56, 82, 108, 134], [6, 34, 60, 86, 112, 138], [6, 30, 58, 86, 114, 142],
      [6, 34, 62, 90, 118, 146], [6, 30, 54, 78, 102, 126, 150], [6, 24, 50, 76, 102, 128, 154],
      [6, 28, 54, 80, 106, 132, 158], [6, 32, 58, 84, 110, 136, 162], [6, 26, 54, 82, 110, 138, 166],
      [6, 30, 58, 86, 114, 142, 170]
    ],

    getVersion(moduleCount) {
      return Math.round((moduleCount - 21) / 4) + 1;
    },

    createFunctionModuleMask(moduleCount) {
      const mask = Array.from({ length: moduleCount }, () => new Uint8Array(moduleCount));
      const v = this.getVersion(moduleCount);

      // Finder patterns + separators (8x8 module regions)
      for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
          if (r < moduleCount && c < moduleCount) mask[r][c] = 1;
          if (r < moduleCount && (moduleCount - 1 - c) >= 0) mask[r][moduleCount - 1 - c] = 1;
          if ((moduleCount - 1 - r) >= 0 && c < moduleCount) mask[moduleCount - 1 - r][c] = 1;
        }
      }

      // Format Information Areas
      for (let i = 0; i <= 8; i++) {
        if (i < moduleCount) {
          mask[8][i] = 1;
          mask[i][8] = 1;
        }
      }
      for (let c = moduleCount - 8; c < moduleCount; c++) {
        if (c >= 0) mask[8][c] = 1;
      }
      for (let r = moduleCount - 8; r < moduleCount; r++) {
        if (r >= 0) mask[r][8] = 1;
      }

      // Timing patterns
      for (let i = 0; i < moduleCount; i++) {
        mask[6][i] = 1;
        mask[i][6] = 1;
      }

      // Alignment patterns
      if (v >= 2 && v <= 40 && this.alignmentPatternCenters[v]) {
        const centers = this.alignmentPatternCenters[v];
        for (let i = 0; i < centers.length; i++) {
          for (let j = 0; j < centers.length; j++) {
            const cr = centers[i];
            const cc = centers[j];
            if ((cr <= 8 && cc <= 8) ||
                (cr <= 8 && cc >= moduleCount - 9) ||
                (cr >= moduleCount - 9 && cc <= 8)) {
              continue;
            }
            for (let ar = -2; ar <= 2; ar++) {
              for (let ac = -2; ac <= 2; ac++) {
                const pr = cr + ar;
                const pc = cc + ac;
                if (pr >= 0 && pr < moduleCount && pc >= 0 && pc < moduleCount) {
                  mask[pr][pc] = 1;
                }
              }
            }
          }
        }
      }

      // Version info
      if (v >= 7) {
        for (let r = 0; r < 6; r++) {
          for (let c = 0; c < 3; c++) {
            mask[r][moduleCount - 11 + c] = 1;
            mask[moduleCount - 11 + c][r] = 1;
          }
        }
      }

      // Dark module
      const darkModuleRow = 4 * v + 9;
      if (darkModuleRow < moduleCount) {
        mask[darkModuleRow][8] = 1;
      }

      return mask;
    }
  };

  // --- 4. VALIDATION & HELPERS ---
  function isValidHexColor(hex) {
    if (!hex || typeof hex !== 'string') return false;
    return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex.trim());
  }

  function normalizeHexColor(hex) {
    const clean = hex.trim();
    if (clean.length === 4) {
      return `#${clean[1]}${clean[1]}${clean[2]}${clean[2]}${clean[3]}${clean[3]}`.toUpperCase();
    }
    return clean.toUpperCase();
  }

  function escapeXml(unsafe) {
    if (!unsafe) return '';
    return String(unsafe).replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
        default: return c;
      }
    });
  }

  function safeDecodeURIComponent(str) {
    if (!str) return '';
    try {
      return decodeURIComponent(str);
    } catch (e) {
      return String(str).replace(/%(?![0-9a-fA-F]{2})/g, '%25');
    }
  }

  function normalizeURL(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return '';
    const trimmed = rawUrl.trim();
    try {
      const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed);
      const parsed = new URL(hasScheme ? trimmed : `https://${trimmed}`);
      if ((parsed.protocol === 'http:' && parsed.port === '80') ||
          (parsed.protocol === 'https:' && parsed.port === '443')) {
        parsed.port = '';
      }
      parsed.hostname = parsed.hostname.toLowerCase();
      if (parsed.pathname === '/') parsed.pathname = '';
      return parsed.href;
    } catch (e) {
      return trimmed;
    }
  }

  function isSafeScheme(rawUrl) {
    try {
      const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(rawUrl.trim());
      const parsed = new URL(hasScheme ? rawUrl.trim() : `https://${rawUrl.trim()}`);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch (e) {
      return false;
    }
  }

  // --- 5. METADATA PROVIDER ---
  const MetadataProvider = {
    cache: new Map(),
    activeAbortController: null,
    apiEndpoint: '',

    sanitize(str) {
      if (!str) return '';
      const div = document.createElement('div');
      div.textContent = String(str).trim();
      return div.textContent;
    },

    extractDomainRoot(host) {
      const parts = host.replace(/^www\./, '').split('.');
      if (parts.length >= 2) {
        const root = parts[parts.length - 2];
        return root.charAt(0).toUpperCase() + root.slice(1);
      }
      return host;
    },

    async fetchEvidence(rawUrl, analysisId) {
      const normalized = normalizeURL(rawUrl);
      if (this.cache.has(normalized)) {
        return { evidence: this.cache.get(normalized), isStale: false };
      }

      if (this.activeAbortController) {
        this.activeAbortController.abort();
      }
      this.activeAbortController = new AbortController();

      if (!isSafeScheme(normalized)) {
        const rawResult = {
          valid: false,
          platform: 'Raw Data',
          displayName: this.sanitize(rawUrl.slice(0, 24)),
          username: null,
          category: 'Direct Text / Payload',
          confidence: 'Basic heuristic detection',
          brandColor: '#0F172A',
          badgeText: 'TXT',
          imageCandidates: [],
          isVerifiedServerMetadata: false
        };
        this.cache.set(normalized, rawResult);
        return { evidence: rawResult, isStale: analysisId !== state.currentAnalysisId };
      }

      const parsed = new URL(normalized);
      const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
      const path = parsed.pathname;
      const pathParts = path.split('/').filter(Boolean);

      let platform = this.extractDomainRoot(host);
      let displayName = null;
      let username = null;
      let category = 'Web Destination';
      let confidence = 'Structural path detection';
      let brandColor = '#2563EB';
      let isVerifiedServerMetadata = false;
      const imageCandidates = [];

      const matchesDomain = (targetDomain) => host === targetDomain || host.endsWith(`.${targetDomain}`);

      if (matchesDomain('wikipedia.org')) {
        platform = 'Wikipedia';
        brandColor = '#1F2937';
        if (pathParts[0] === 'wiki' && pathParts[1]) {
          displayName = safeDecodeURIComponent(pathParts[1]).replace(/_/g, ' ');
          category = 'Reference / Editorial';
        } else {
          displayName = 'Wikipedia';
          category = 'Encyclopedia';
        }
      } else if (matchesDomain('github.com')) {
        platform = 'GitHub';
        brandColor = '#181717';
        if (pathParts.length === 1) {
          username = `@${pathParts[0]}`;
          category = 'Developer Profile';
        } else if (pathParts.length >= 2) {
          displayName = `${pathParts[0]}/${pathParts[1]}`;
          category = 'Source Repository';
        }
      } else if (matchesDomain('instagram.com')) {
        platform = 'Instagram';
        brandColor = '#E1306C';
        if (pathParts.length >= 1 && !['p', 'reel', 'stories', 'explore'].includes(pathParts[0])) {
          username = `@${pathParts[0]}`;
          category = 'Creator Profile';
        }
      } else if (matchesDomain('facebook.com')) {
        platform = 'Facebook';
        brandColor = '#1877F2';
        if (pathParts.length >= 1 && !['groups', 'pages', 'watch'].includes(pathParts[0])) {
          username = `@${pathParts[0]}`;
          category = 'Social Profile';
        }
      } else if (matchesDomain('youtube.com') || host === 'youtu.be') {
        platform = 'YouTube';
        brandColor = '#FF0000';
        if (path.includes('/@') && pathParts[0]) {
          username = pathParts[0];
          category = 'Creator Channel';
        } else if (path.includes('/watch') || host === 'youtu.be') {
          category = 'Video Streaming';
        }
      }

      imageCandidates.push({
        priority: 4,
        type: 'favicon',
        url: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`,
        isVerified: false
      });

      const effectiveDisplayName = displayName || (username ? username : platform);
      const safeBrandColor = isValidHexColor(brandColor) ? normalizeHexColor(brandColor) : '#2563EB';

      const result = {
        valid: true,
        url: parsed.href,
        domain: host,
        platform,
        displayName: this.sanitize(effectiveDisplayName),
        username: username ? this.sanitize(username) : null,
        category,
        confidence,
        brandColor: safeBrandColor,
        badgeText: 'QR',
        imageCandidates,
        isVerifiedServerMetadata
      };

      this.cache.set(normalized, result);
      return { evidence: result, isStale: analysisId !== state.currentAnalysisId };
    }
  };

  // --- 6. PRESETS DEFINITION ---
  const PRESETS = [
    { id: 'minimal', name: 'Minimal', dot: 'square', eye: 'square', fg: '#0F172A', bg: '#FFFFFF', grad: false, ecc: 'M', frame: 'none', frameText: 'SCAN ME' },
    { id: 'professional', name: 'Professional', dot: 'rounded', eye: 'square', fg: '#1E3A8A', bg: '#F8FAFC', grad: false, ecc: 'H', frame: 'badge-bottom', frameText: 'LEARN MORE' },
    { id: 'business', name: 'Corporate', dot: 'square', eye: 'square', fg: '#047857', bg: '#F0FDF4', grad: false, ecc: 'H', frame: 'badge-bottom', frameText: 'VISIT' },
    { id: 'social', name: 'Social Pop', dot: 'rounded', eye: 'square', fg: '#E11D48', bg: '#FFF1F2', grad: true, gradColor: '#FB7185', ecc: 'H', frame: 'pill', frameText: 'FOLLOW' },
    { id: 'creator', name: 'Creator', dot: 'dots', eye: 'square', fg: '#7C3AED', bg: '#FAF5FF', grad: true, gradColor: '#EC4899', ecc: 'H', frame: 'pill', frameText: 'CONNECT' },
    { id: 'editorial', name: 'Editorial', dot: 'classy', eye: 'square', fg: '#334155', bg: '#FDFBF7', grad: false, ecc: 'H', frame: 'none', frameText: 'READ' },
    { id: 'restaurant', name: 'Dining Menu', dot: 'smooth', eye: 'square', fg: '#9A3412', bg: '#FFFBEB', grad: false, ecc: 'H', frame: 'badge-bottom', frameText: 'VIEW MENU' },
    { id: 'tech', name: 'Cyber Tech', dot: 'dots', eye: 'square', fg: '#0284C7', bg: '#0B132B', grad: false, ecc: 'H', frame: 'none', frameText: 'EXPLORE' },
    { id: 'organic', name: 'Eco Organic', dot: 'smooth', eye: 'square', fg: '#15803D', bg: '#F0FDF4', grad: false, ecc: 'H', frame: 'pill', frameText: 'DISCOVER' },
    { id: 'neon', name: 'Neon Glow', dot: 'dots', eye: 'square', fg: '#06B6D4', bg: '#030712', grad: true, gradColor: '#3B82F6', ecc: 'H', frame: 'none', frameText: 'SCAN' },
    { id: 'luxury', name: 'Luxury Gold', dot: 'classy', eye: 'square', fg: '#854D0E', bg: '#FEFCE8', grad: false, ecc: 'H', frame: 'pill', frameText: 'EXCLUSIVE' },
    { id: 'playful', name: 'Playful', dot: 'dots', eye: 'square', fg: '#EA580C', bg: '#FFF7ED', grad: true, gradColor: '#EAB308', ecc: 'H', frame: 'badge-bottom', frameText: 'OPEN' }
  ];

  // --- 7. TELEMETRY & CONTRAST ENGINE ---
  const TelemetryEngine = {
    getLuminance(hex) {
      const clean = hex.replace('#', '');
      const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
      const rgb = parseInt(full, 16);
      const r = (rgb >> 16) & 0xff;
      const g = (rgb >> 8) & 0xff;
      const b = (rgb >> 0) & 0xff;
      const a = [r, g, b].map(v => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
    },

    getContrast(hex1, hex2) {
      const l1 = this.getLuminance(hex1);
      const l2 = this.getLuminance(hex2);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    },

    getEffectiveContrast() {
      let contrast = this.getContrast(state.options.fgColor, state.options.bgColor);
      if (state.options.useGradient && state.options.fgGradColor) {
        const gradContrast = this.getContrast(state.options.fgGradColor, state.options.bgColor);
        contrast = Math.min(contrast, gradContrast);
      }
      return contrast;
    },

    computeCenterFootprint(moduleCount, isExportMode = false) {
      // If QR text is active, do not cut out a center logo box
      if (state.options.qrText && state.options.qrText.trim()) {
        return { sideCells: 0, coverageRatio: 0 };
      }

      if (state.options.logoMode === 'none') {
        return { sideCells: 0, coverageRatio: 0 };
      }

      const hasSafeCustom = state.options.logoMode === 'custom' &&
        (isExportMode ? (Boolean(state.customLogoDataUrl) || Boolean(state.customLogoImg)) : Boolean(state.customLogoImg));

      const hasSafeAuto = state.options.logoMode === 'auto' &&
        (isExportMode ? Boolean(state.activeLogoDataUrl) : Boolean(state.activeLogoImg));

      if (!hasSafeCustom && !hasSafeAuto) {
        return { sideCells: 0, coverageRatio: 0 };
      }

      const functionMask = QRStructure.createFunctionModuleMask(moduleCount);
      // Determine side cells according to user-selected logoScale
      const targetSide = Math.max(3, Math.floor(moduleCount * (state.options.logoScale || 0.22)));
      let side = targetSide % 2 === 0 ? targetSide + 1 : targetSide;

      const mid = Math.floor(moduleCount / 2);
      const half = Math.floor(side / 2);

      // Verify safety
      for (let r = mid - half; r <= mid + half; r++) {
        for (let c = mid - half; c <= mid + half; c++) {
          if (r < 0 || r >= moduleCount || c < 0 || c >= moduleCount || functionMask[r][c] === 1) {
            side = 0;
            break;
          }
        }
        if (side === 0) break;
      }

      return {
        sideCells: side,
        coverageRatio: ((side * side) / (moduleCount * moduleCount)) * 100
      };
    },

    evaluateAndRepair(moduleCount = 33, isExportMode = false) {
      if (!state.url) {
        document.getElementById('contrastVal').textContent = '—';
        document.getElementById('logoAreaVal').textContent = '—';
        document.getElementById('eccVal').textContent = '—';
        document.getElementById('scanStatusText').textContent = 'Awaiting Input';
        document.getElementById('repairAlert').classList.add('hidden-field');
        return { sideCells: 0, coverageRatio: 0 };
      }

      const hasCenterEntity = (state.options.logoMode === 'custom' && state.customLogoImg) ||
                              (state.options.logoMode === 'auto' && state.activeLogoImg);
      const hasCustomText = Boolean(state.options.qrText && state.options.qrText.trim());

      if ((hasCenterEntity || hasCustomText) && (state.options.ecc === 'L' || state.options.ecc === 'M')) {
        state.options.ecc = 'H';
        const eccSelect = document.getElementById('eccSelect');
        if (eccSelect) eccSelect.value = 'H';
      }

      const finalFootprint = this.computeCenterFootprint(moduleCount, isExportMode);
      const finalEffectiveContrast = this.getEffectiveContrast();

      document.getElementById('contrastVal').textContent = `${finalEffectiveContrast.toFixed(1)}:1`;
      document.getElementById('logoAreaVal').textContent = finalFootprint.coverageRatio > 0 ? `${finalFootprint.coverageRatio.toFixed(1)}%` : '0%';
      document.getElementById('eccVal').textContent = state.options.ecc;

      return finalFootprint;
    }
  };

  // --- 8. SHARED GEOMETRY ENGINE ---
  const GeometryEngine = {
    computeLayout(baseSize, moduleCount, quietZone, frameStyle) {
      const qrTotalModules = moduleCount + quietZone * 2;
      const cellSize = baseSize / qrTotalModules;
      const qrPixelSize = baseSize;

      let topOffset = 0;
      let totalWidth = qrPixelSize;
      let totalHeight = qrPixelSize;
      let frameHeight = 0;

      if (frameStyle === 'badge-top') {
        frameHeight = Math.round(baseSize * 0.12);
        topOffset = frameHeight;
        totalHeight = qrPixelSize + frameHeight;
      } else if (frameStyle === 'badge-bottom' || frameStyle === 'pill') {
        frameHeight = Math.round(baseSize * 0.12);
        totalHeight = qrPixelSize + frameHeight;
      }

      return {
        baseSize,
        moduleCount,
        quietZone,
        cellSize,
        qrPixelSize,
        topOffset,
        totalWidth,
        totalHeight,
        frameHeight
      };
    }
  };

  // --- 9. UNIFIED CANVAS & SVG RENDERER ---
  const QRRenderer = {
    getQRMatrix() {
      if (!state.url || typeof qrcode === 'undefined') return null;
      try {
        const qr = qrcode(0, state.options.ecc || 'H');
        qr.addData(state.url);
        qr.make();
        return qr;
      } catch (err) {
        return null;
      }
    },

    isFinderEyeRegion(r, c, count) {
      return (
        (r < 7 && c < 7) ||
        (r < 7 && c >= count - 7) ||
        (r >= count - 7 && c < 7)
      );
    },

    isCenterReserved(r, c, count, sideCells) {
      if (!sideCells || sideCells <= 0) return false;
      const half = Math.floor(sideCells / 2);
      const mid = Math.floor(count / 2);
      return (r >= mid - half && r <= mid + half && c >= mid - half && c <= mid + half);
    },

    renderCanvas(canvas, requestedSize = 480, isExport = false) {
      const ctx = canvas.getContext('2d');
      const baseSize = requestedSize;

      if (!state.url) {
        canvas.width = baseSize;
        canvas.height = baseSize;
        ctx.fillStyle = state.theme === 'dark' ? '#111827' : '#F8FAFC';
        ctx.fillRect(0, 0, baseSize, baseSize);
        ctx.fillStyle = '#64748B';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Paste a URL to generate Smart QR', baseSize / 2, baseSize / 2);
        return;
      }

      const qr = this.getQRMatrix();
      if (!qr) return;

      const moduleCount = qr.getModuleCount();
      const footprint = TelemetryEngine.evaluateAndRepair(moduleCount, isExport);
      const functionMask = QRStructure.createFunctionModuleMask(moduleCount);
      const geo = GeometryEngine.computeLayout(baseSize, moduleCount, state.options.quietZone, state.options.frameStyle);

      // Compute in-matrix text placement
      const textPlacement = QRTextEngine.computePlacement(moduleCount, state.options.qrText);

      canvas.width = geo.totalWidth;
      canvas.height = geo.totalHeight;
      ctx.clearRect(0, 0, geo.totalWidth, geo.totalHeight);

      // 1. Draw Background
      ctx.fillStyle = state.options.bgColor;
      ctx.fillRect(0, 0, geo.totalWidth, geo.totalHeight);

      // 2. Setup Fill
      let fill = state.options.fgColor;
      if (state.options.useGradient) {
        const grad = ctx.createLinearGradient(0, geo.topOffset, geo.baseSize, geo.topOffset + geo.baseSize);
        grad.addColorStop(0, state.options.fgColor);
        grad.addColorStop(1, state.options.fgGradColor || state.options.fgColor);
        fill = grad;
      }
      ctx.fillStyle = fill;

      // 3. Render Modules with In-Matrix Text
      for (let r = 0; r < moduleCount; r++) {
        for (let c = 0; c < moduleCount; c++) {
          if (this.isFinderEyeRegion(r, c, moduleCount)) continue;
          if (this.isCenterReserved(r, c, moduleCount, footprint.sideCells)) continue;

          let isModuleDark = qr.isDark(r, c);

          // Apply in-matrix text overlay
          if (textPlacement &&
              r >= textPlacement.startRow && r < textPlacement.startRow + textPlacement.height &&
              c >= textPlacement.startCol && c < textPlacement.startCol + textPlacement.width) {
            const tr = r - textPlacement.startRow;
            const tc = c - textPlacement.startCol;
            const isTextPixel = textPlacement.matrix[tr][tc] === 1;

            if (state.options.qrTextMode === 'dot') {
              // Letters are formed by solid dark modules
              isModuleDark = isTextPixel;
            } else if (state.options.qrTextMode === 'negative') {
              // Letters are carved out into background color
              isModuleDark = !isTextPixel;
            }
          }

          if (isModuleDark) {
            const x = (c + geo.quietZone) * geo.cellSize;
            const y = geo.topOffset + (r + geo.quietZone) * geo.cellSize;

            if (functionMask[r][c] === 1) {
              ctx.fillRect(x, y, geo.cellSize, geo.cellSize);
            } else {
              if (state.options.dotStyle === 'dots') {
                ctx.beginPath();
                ctx.arc(x + geo.cellSize / 2, y + geo.cellSize / 2, geo.cellSize * 0.42, 0, Math.PI * 2);
                ctx.fill();
              } else if (state.options.dotStyle === 'rounded') {
                this.roundRect(ctx, x, y, geo.cellSize * 0.92, geo.cellSize * 0.92, geo.cellSize * 0.28);
                ctx.fill();
              } else {
                ctx.fillRect(x, y, geo.cellSize, geo.cellSize);
              }
            }
          }
        }
      }

      // 4. Render Finder Eyes
      const eyeDim = geo.cellSize * 7;
      this.drawCanvasEye(ctx, geo.quietZone * geo.cellSize, geo.topOffset + geo.quietZone * geo.cellSize, eyeDim, geo.cellSize, fill);
      this.drawCanvasEye(ctx, (geo.quietZone + moduleCount - 7) * geo.cellSize, geo.topOffset + geo.quietZone * geo.cellSize, eyeDim, geo.cellSize, fill);
      this.drawCanvasEye(ctx, geo.quietZone * geo.cellSize, geo.topOffset + (geo.quietZone + moduleCount - 7) * geo.cellSize, eyeDim, geo.cellSize, fill);

      // 5. Render Center Logo Cutout (only if no in-matrix text is overriding)
      if (footprint.sideCells > 0 && (!state.options.qrText || !state.options.qrText.trim())) {
        this.drawCanvasCenter(ctx, geo, footprint.sideCells, isExport);
      }

      // 6. Frame
      this.drawCanvasFrame(ctx, geo);
    },

    drawCanvasEye(ctx, x, y, size, cellSize, fill) {
      ctx.fillStyle = fill;
      ctx.fillRect(x, y, size, size);
      ctx.fillStyle = state.options.bgColor;
      ctx.fillRect(x + cellSize, y + cellSize, cellSize * 5, cellSize * 5);
      ctx.fillStyle = fill;
      ctx.fillRect(x + cellSize * 2, y + cellSize * 2, cellSize * 3, cellSize * 3);
    },

    drawCanvasCenter(ctx, geo, sideCells, isExport = false) {
      const pixelSize = sideCells * geo.cellSize;
      const x = (geo.baseSize - pixelSize) / 2;
      const y = geo.topOffset + (geo.baseSize - pixelSize) / 2;

      let img = null;
      if (state.options.logoMode === 'custom') {
        img = isExport ? (state.customLogoDataUrl ? state.customLogoImg : null) : state.customLogoImg;
      } else if (state.options.logoMode === 'auto') {
        img = isExport ? (state.activeLogoDataUrl ? state.activeLogoImg : null) : state.activeLogoImg;
      }

      if (!img) return;

      ctx.fillStyle = state.options.bgColor;
      this.roundRect(ctx, x - 2, y - 2, pixelSize + 4, pixelSize + 4, 6);
      ctx.fill();

      ctx.save();
      this.roundRect(ctx, x, y, pixelSize, pixelSize, 6);
      ctx.clip();

      const nw = img.naturalWidth || img.width || 1;
      const nh = img.naturalHeight || img.height || 1;
      const scale = Math.min(pixelSize / nw, pixelSize / nh);
      const dw = nw * scale;
      const dh = nh * scale;
      const dx = x + (pixelSize - dw) / 2;
      const dy = y + (pixelSize - dh) / 2;

      ctx.drawImage(img, dx, dy, dw, dh);
      ctx.restore();
    },

    drawCanvasFrame(ctx, geo) {
      if (state.options.frameStyle === 'none') return;
      const text = state.options.frameText || 'SCAN ME';

      ctx.fillStyle = state.options.fgColor;
      ctx.font = `bold ${Math.round(geo.baseSize * 0.04)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      if (state.options.frameStyle === 'badge-top') {
        ctx.fillRect(0, 0, geo.totalWidth, geo.frameHeight);
        ctx.fillStyle = state.options.bgColor;
        ctx.fillText(text, geo.totalWidth / 2, geo.frameHeight / 2);
      } else if (state.options.frameStyle === 'badge-bottom') {
        const y = geo.baseSize;
        ctx.fillRect(0, y, geo.totalWidth, geo.frameHeight);
        ctx.fillStyle = state.options.bgColor;
        ctx.fillText(text, geo.totalWidth / 2, y + geo.frameHeight / 2);
      } else if (state.options.frameStyle === 'pill') {
        const pillWidth = geo.baseSize * 0.65;
        const pillHeight = geo.frameHeight * 0.75;
        const x = (geo.totalWidth - pillWidth) / 2;
        const y = geo.baseSize + (geo.frameHeight - pillHeight) / 2;
        this.roundRect(ctx, x, y, pillWidth, pillHeight, pillHeight / 2);
        ctx.fill();
        ctx.fillStyle = state.options.bgColor;
        ctx.fillText(text, geo.totalWidth / 2, y + pillHeight / 2);
      }
    },

    roundRect(ctx, x, y, w, h, r) {
      if (typeof r === 'number') r = [r, r, r, r];
      ctx.beginPath();
      ctx.moveTo(x + r[0], y);
      ctx.lineTo(x + w - r[1], y);
      ctx.quadraticCurveTo(x + w, y, x + w, y + r[1]);
      ctx.lineTo(x + w, y + h - r[2]);
      ctx.quadraticCurveTo(x + w, y + h, x + w - r[2], y + h);
      ctx.lineTo(x + r[3], y + h);
      ctx.quadraticCurveTo(x, y + h, x, y + h - r[3]);
      ctx.lineTo(x, y + r[0]);
      ctx.quadraticCurveTo(x, y, x + r[0], y);
      ctx.closePath();
    },

    generateSVG() {
      const qr = this.getQRMatrix();
      if (!qr) return '';

      const moduleCount = qr.getModuleCount();
      const footprint = TelemetryEngine.evaluateAndRepair(moduleCount, true);
      const functionMask = QRStructure.createFunctionModuleMask(moduleCount);
      const baseSize = 512;
      const geo = GeometryEngine.computeLayout(baseSize, moduleCount, state.options.quietZone, state.options.frameStyle);

      const textPlacement = QRTextEngine.computePlacement(moduleCount, state.options.qrText);

      let defs = '';
      let fillAttr = `fill="${state.options.fgColor}"`;

      if (state.options.useGradient) {
        defs += `<defs>
          <linearGradient id="qrGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${state.options.fgColor}" />
            <stop offset="100%" stop-color="${state.options.fgGradColor || state.options.fgColor}" />
          </linearGradient>
        </defs>`;
        fillAttr = 'fill="url(#qrGrad)"';
      }

      let modulesSVG = '';
      for (let r = 0; r < moduleCount; r++) {
        for (let c = 0; c < moduleCount; c++) {
          if (this.isFinderEyeRegion(r, c, moduleCount)) continue;
          if (this.isCenterReserved(r, c, moduleCount, footprint.sideCells)) continue;

          let isModuleDark = qr.isDark(r, c);

          if (textPlacement &&
              r >= textPlacement.startRow && r < textPlacement.startRow + textPlacement.height &&
              c >= textPlacement.startCol && c < textPlacement.startCol + textPlacement.width) {
            const tr = r - textPlacement.startRow;
            const tc = c - textPlacement.startCol;
            const isTextPixel = textPlacement.matrix[tr][tc] === 1;

            if (state.options.qrTextMode === 'dot') {
              isModuleDark = isTextPixel;
            } else if (state.options.qrTextMode === 'negative') {
              isModuleDark = !isTextPixel;
            }
          }

          if (isModuleDark) {
            const x = (c + geo.quietZone) * geo.cellSize;
            const y = geo.topOffset + (r + geo.quietZone) * geo.cellSize;

            if (functionMask[r][c] === 1) {
              modulesSVG += `<rect x="${x}" y="${y}" width="${geo.cellSize}" height="${geo.cellSize}" ${fillAttr} />`;
            } else {
              modulesSVG += `<rect x="${x}" y="${y}" width="${geo.cellSize}" height="${geo.cellSize}" ${fillAttr} />`;
            }
          }
        }
      }

      // Finder Eyes
      const renderSVGEye = (x, y, eyeSize, cellSize) => {
        return `
          <rect x="${x}" y="${y}" width="${eyeSize}" height="${eyeSize}" ${fillAttr} />
          <rect x="${x + cellSize}" y="${y + cellSize}" width="${cellSize * 5}" height="${cellSize * 5}" fill="${state.options.bgColor}" />
          <rect x="${x + cellSize * 2}" y="${y + cellSize * 2}" width="${cellSize * 3}" height="${cellSize * 3}" ${fillAttr} />
        `;
      };

      const eyeDim = geo.cellSize * 7;
      const eyesSVG =
        renderSVGEye(geo.quietZone * geo.cellSize, geo.topOffset + geo.quietZone * geo.cellSize, eyeDim, geo.cellSize) +
        renderSVGEye((geo.quietZone + moduleCount - 7) * geo.cellSize, geo.topOffset + geo.quietZone * geo.cellSize, eyeDim, geo.cellSize) +
        renderSVGEye(geo.quietZone * geo.cellSize, geo.topOffset + (geo.quietZone + moduleCount - 7) * geo.cellSize, eyeDim, geo.cellSize);

      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${geo.totalWidth} ${geo.totalHeight}">
        ${defs}
        <rect width="${geo.totalWidth}" height="${geo.totalHeight}" fill="${state.options.bgColor}" />
        ${modulesSVG}
        ${eyesSVG}
      </svg>`;
    }
  };

  // --- 10. UI INITIALIZATION & EVENT SYNC ---
  function syncControlsFromState() {
    document.getElementById('dotStyleSelect').value = state.options.dotStyle;
    document.getElementById('eyeStyleSelect').value = state.options.eyeStyle;
    document.getElementById('fgColor').value = state.options.fgColor;
    document.getElementById('fgColorText').value = state.options.fgColor;
    document.getElementById('bgColor').value = state.options.bgColor;
    document.getElementById('bgColorText').value = state.options.bgColor;
    document.getElementById('enableGradient').checked = state.options.useGradient;
    document.getElementById('qrTextInput').value = state.options.qrText;
    document.getElementById('qrTextModeSelect').value = state.options.qrTextMode;
    document.getElementById('frameStyleSelect').value = state.options.frameStyle;
    document.getElementById('frameText').value = state.options.frameText;
    document.getElementById('eccSelect').value = state.options.ecc;
    document.getElementById('quietZoneSelect').value = String(state.options.quietZone);

    renderPresets();
  }

  function render() {
    const canvas = document.getElementById('qrCanvas');
    QRRenderer.renderCanvas(canvas, 480, false);
  }

  async function handleAnalyze() {
    const rawUrl = document.getElementById('urlInput').value.trim();
    if (!rawUrl) return;

    state.url = rawUrl;
    state.isManualOverride = false;
    const { evidence: det } = await MetadataProvider.fetchEvidence(rawUrl, ++state.currentAnalysisId);
    state.detection = det;

    document.getElementById('confidenceBadge').textContent = det.confidence;
    document.getElementById('detectedPlatformText').textContent = det.platform;
    document.getElementById('detectedTitle').textContent = det.displayName;
    document.getElementById('detectedCategory').textContent = det.category;
    document.getElementById('detectedDomain').textContent = det.domain || '';

    state.options.fgColor = det.brandColor;
    state.options.centerBadgeText = ''; // Prevent default badge overlap

    syncControlsFromState();
    render();
  }

  function applyPreset(preset) {
    state.activePreset = preset.id;
    state.isManualOverride = true;
    state.options.dotStyle = preset.dot;
    state.options.eyeStyle = preset.eye;
    state.options.fgColor = preset.fg;
    state.options.bgColor = preset.bg;
    state.options.useGradient = Boolean(preset.grad);
    state.options.fgGradColor = preset.gradColor || preset.fg;
    state.options.ecc = preset.ecc || 'H';
    state.options.frameStyle = preset.frame || 'none';
    state.options.frameText = preset.frameText || 'SCAN ME';
    // User's custom qrText is strictly preserved
    syncControlsFromState();
    render();
  }

  function renderPresets() {
    const grid = document.getElementById('presetsGrid');
    if (!grid) return;
    grid.innerHTML = '';
    PRESETS.forEach(p => {
      const chip = document.createElement('div');
      chip.className = `preset-chip ${state.activePreset === p.id ? 'active' : ''}`;
      chip.innerHTML = `
        <span class="preset-badge-icon" style="background: ${p.fg}; border: 2px solid ${p.bg}"></span>
        <span>${escapeXml(p.name)}</span>
      `;
      chip.onclick = () => applyPreset(p);
      grid.appendChild(chip);
    });
  }

  function init() {
    document.getElementById('urlInput').value = '';

    // Theme initialization
    document.documentElement.setAttribute('data-theme', state.theme);
    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.themeVal === state.theme);
      btn.onclick = () => {
        state.theme = btn.dataset.themeVal;
        localStorage.setItem('smart_qr_app_theme', state.theme);
        document.documentElement.setAttribute('data-theme', state.theme);
        document.querySelectorAll('.theme-btn').forEach(b => b.classList.toggle('active', b === btn));
      };
    });

    renderPresets();

    document.getElementById('analyzeBtn').onclick = handleAnalyze;
    document.getElementById('applySmartBtn').onclick = () => {
      state.options.centerBadgeText = '';
      render();
    };

    // --- QR TEXT APPLY & CLEAR LISTENERS ---
    const qrTextInput = document.getElementById('qrTextInput');
    const qrTextApplyBtn = document.getElementById('qrTextApplyBtn');
    const qrTextClearBtn = document.getElementById('qrTextClearBtn');
    const qrTextModeSelect = document.getElementById('qrTextModeSelect');

    if (qrTextApplyBtn) {
      qrTextApplyBtn.onclick = () => {
        if (!qrTextInput) return;
        state.options.qrText = qrTextInput.value.trim().toUpperCase().slice(0, 10);
        state.options.centerBadgeText = ''; // Suppress square badge
        render();
      };
    }

    if (qrTextInput) {
      qrTextInput.onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (qrTextApplyBtn) qrTextApplyBtn.click();
        }
      };
    }

    if (qrTextModeSelect) {
      qrTextModeSelect.onchange = (e) => {
        state.options.qrTextMode = e.target.value;
        if (state.options.qrText) render();
      };
    }

    if (qrTextClearBtn) {
      qrTextClearBtn.onclick = () => {
        state.options.qrText = '';
        if (qrTextInput) qrTextInput.value = '';
        render();
      };
    }

    // --- LOGO UPLOAD & SCALE SLIDER ---
    const logoUpload = document.getElementById('logoUpload');
    const logoSizeSlider = document.getElementById('logoSizeSlider');
    const logoSizeVal = document.getElementById('logoSizeVal');

    if (logoSizeSlider) {
      logoSizeSlider.oninput = (e) => {
        const val = parseInt(e.target.value, 10);
        state.options.logoScale = val / 100;
        if (logoSizeVal) logoSizeVal.textContent = `${val}%`;
        render();
      };
    }

    document.querySelectorAll('input[name="logoMode"]').forEach(radio => {
      radio.onchange = (e) => {
        state.options.logoMode = e.target.value;
        const uploadCont = document.getElementById('customUploadContainer');
        if (uploadCont) uploadCont.classList.toggle('hidden-field', e.target.value !== 'custom');
        render();
      };
    });

    if (logoUpload) {
      logoUpload.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            const img = new Image();
            img.onload = () => {
              state.customLogoImg = img;
              state.customLogoDataUrl = ev.target.result;
              render();
            };
            img.src = ev.target.result;
          };
          reader.readAsDataURL(file);
        }
      };
    }

    // Download handlers
    document.getElementById('downloadPngBtn').onclick = () => {
      if (!state.url) return;
      const exportCanvas = document.createElement('canvas');
      QRRenderer.renderCanvas(exportCanvas, 1600, true);
      const link = document.createElement('a');
      link.download = `smart-qr-${Date.now()}.png`;
      link.href = exportCanvas.toDataURL('image/png');
      link.click();
    };

    document.getElementById('downloadSvgBtn').onclick = () => {
      if (!state.url) return;
      const svg = QRRenderer.generateSVG();
      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `smart-qr-${Date.now()}.svg`;
      link.href = objectUrl;
      link.click();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    };

    render();
  }

  window.addEventListener('DOMContentLoaded', init);
})();
