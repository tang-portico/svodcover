"use client";

import React, { useState, useRef, useEffect, useCallback, ChangeEvent, MouseEvent, WheelEvent } from 'react';
import { Upload, Download, Layers, X, RefreshCw, MousePointer2, Plus, Minus, Maximize, Image as ImageIcon, Stamp, Trash2, Smartphone, Monitor, Move, ZoomIn, Check, ArrowLeft, Eye, Archive, Wand2, Palette, Sliders, RefreshCcw, Link2 } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { PRESET_GROUPS, FLAT_PRESETS, POSITIONS, WATERMARK_POSITIONS, MOD_LABEL_URL, PresetItem } from './constants';
import { useDebounce } from './hooks';

interface ImageObject {
  id: string;
  file: File;
  url: string;
  name: string;
  sourceType: 'landscape' | 'portrait';
  variants: Record<string, string>;
  edits: Record<string, any>; // Consider typing this further if possible
}

interface GradientSettings {
  id: string;
  enabled: boolean;
  color: string;
  size: number;
  offset: number;
  midpoint: number;
  start: { x: number; y: number };
  end: { x: number; y: number };
}

interface EditorState {
  imageId: string;
  presetId: string;
  imgObj: ImageObject;
  preset: PresetItem;
}

// --- Helper Functions ---
const getAverageColor = (img: HTMLImageElement) => '#1a1a1a'; // Placeholder for avg color
const getDateString = () => {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
};

export default function OTTImageGenerator() {

  // State
  const [images, setImages] = useState<ImageObject[]>([]);
  const [logo, setLogo] = useState<string | null>(null);
  const [watermark, setWatermark] = useState<string | null>('https://tang-portico.github.io/img/Ducktv_logo.png');
  const [overlayText, setOverlayText] = useState('');
  const [seriesName, setSeriesName] = useState('');
  const [enableUpscale, setEnableUpscale] = useState(false);

  const [activePresets, setActivePresets] = useState(FLAT_PRESETS.map(p => p.id));
  const [scale, setScale] = useState(0.35);
  const [pan, setPan] = useState({ x: 50, y: 50 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [isZipping, setIsZipping] = useState(false);

  // Editor State
  const [editingTarget, setEditingTarget] = useState<EditorState | null>(null);
  const [activeLayer, setActiveLayer] = useState('image');
  const [editorTransform, setEditorTransform] = useState({ x: 0, y: 0, scale: 1.0 });
  const [logoTransform, setLogoTransform] = useState({ x: 0, y: 0, scale: 1.0, baseW: 0, baseH: 0 });
  const [editorGradients, setEditorGradients] = useState<GradientSettings[]>([{
    id: 'default', enabled: true, color: '#000000', size: 100, offset: 0, midpoint: 50,
    start: { x: 0, y: 100 }, end: { x: 0, y: 70 }
  }]);
  const [activeGradientId, setActiveGradientId] = useState<string>('default');
  const [showGuides, setShowGuides] = useState(true);
  const [syncRatio, setSyncRatio] = useState(true);
  const [activeHandle, setActiveHandle] = useState<null | 'start' | 'end'>(null);
  const [isMounted, setIsMounted] = useState(false);

  // Refs for smooth rendering (decoupled from React cycle)
  const editorTransformRef = useRef({ x: 0, y: 0, scale: 1.0 });
  const logoTransformRef = useRef({ x: 0, y: 0, scale: 1.0, baseW: 0, baseH: 0 });
  const editorGradientsRef = useRef<GradientSettings[]>([{
    id: 'default', enabled: true, color: '#000000', size: 100, offset: 0, midpoint: 50,
    start: { x: 0, y: 100 }, end: { x: 0, y: 70 }
  }]);
  const activeLayerRef = useRef('image');
  const showGuidesRef = useRef(true);
  const logoRef = useRef<string | null>(null);

  // Sync state to refs when state changes from external controls
  useEffect(() => { editorTransformRef.current = editorTransform; }, [editorTransform]);
  useEffect(() => { logoTransformRef.current = logoTransform; }, [logoTransform]);
  useEffect(() => { editorGradientsRef.current = editorGradients; }, [editorGradients]);
  useEffect(() => { activeLayerRef.current = activeLayer; }, [activeLayer]);
  useEffect(() => { showGuidesRef.current = showGuides; }, [showGuides]);
  useEffect(() => { logoRef.current = logo; }, [logo]);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const [settings, setSettings] = useState({
    logoSize: 35, logoPosition: 'center-right', logoPadding: 50,
    textPosition: 'bottom-center', textSize: 60, textColor: '#ffffff', textBgColor: '#000000', textBgOpacity: 0.5,
  });

  const [wmSettings, setWmSettings] = useState({
    scale: 1.0, position: 'bottom-right', padding: 0, opacity: 100
  });

  const debouncedSettings = useDebounce(settings, 500);
  const debouncedWmSettings = useDebounce(wmSettings, 500);
  const debouncedOverlayText = useDebounce(overlayText, 500);

  const containerRef = useRef<HTMLDivElement>(null);
  const editorCanvasRef = useRef<HTMLCanvasElement>(null);

  // --- Handlers ---

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>, sourceType: 'landscape' | 'portrait') => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files) as File[];
    const newImages: ImageObject[] = files.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      url: URL.createObjectURL(file),
      name: file.name,
      sourceType: sourceType,
      variants: {},
      edits: {}
    }));
    setImages(prev => [...prev, ...newImages]);
  };

  const handleLogoUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => setLogo(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleWatermarkUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => setWatermark(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const downloadSingle = (dataUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    link.click();
  };

  const downloadAll = async () => {
    // JSZip and saveAs are imported, so no need to check window
    setIsZipping(true);
    const zip = new JSZip();
    const dateStr = getDateString();
    const safeSeriesName = seriesName.trim() || 'Untitled';

    images.forEach(img => {
      activePresets.forEach(presetId => {
        if (img.variants && img.variants[presetId]) {
          const preset = FLAT_PRESETS.find(p => p.id === presetId);
          if (!preset) return;
          const group = PRESET_GROUPS.find(g => g.items.some(i => i.id === presetId));
          const platformName = group ? group.category : 'OTT';

          const filename = `${dateStr}_${safeSeriesName}_${platformName}_${preset.width}x${preset.height}.jpg`;
          const imgData = img.variants[presetId].split(',')[1];
          zip.file(filename, imgData, { base64: true });
        }
      });
    });

    try {
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `${dateStr}_${safeSeriesName}_OTT_Assets.zip`);
    } catch (err) {
      console.error("Zip failed:", err);
    } finally {
      setIsZipping(false);
    }
  };

  const toggleGroup = (groupItems: { id: string }[]) => {
    const groupIds = groupItems.map(i => i.id);
    const allSelected = groupIds.every(id => activePresets.includes(id));
    if (allSelected) {
      setActivePresets(activePresets.filter(id => !groupIds.includes(id)));
    } else {
      const newIds = [...activePresets];
      groupIds.forEach(id => {
        if (!newIds.includes(id)) newIds.push(id);
      });
      setActivePresets(newIds);
    }
  };

  const getVariantForPreset = (presetId: string) => {
    for (const img of images) {
      if (img.variants && img.variants[presetId]) {
        return {
          url: img.variants[presetId],
          sourceName: img.name,
          imgObj: img
        };
      }
    }
    return null;
  };

  // --- Drawing Utils (Standalone) ---

  const calculatePortraitPlate = (canvasWidth: number, canvasHeight: number, position: string, padding: number) => {
    const refWidth = 640;
    const scaleFactor = canvasWidth / refWidth;
    const plateW = 478 * scaleFactor;
    const plateH = 256 * scaleFactor;
    // Center X, Top Y
    let x = (canvasWidth - plateW) / 2;
    let y = 0;
    return { x, y, w: plateW, h: plateH, radius: 30 * scaleFactor };
  };

  const calculateStandardLogoLayout = (canvasWidth: number, canvasHeight: number, imgW: number, imgH: number, sizePercent: number, position: string, padding: number) => {
    const aspectRatio = imgW / imgH;
    const drawWidth = (canvasWidth * sizePercent) / 100;
    const drawHeight = drawWidth / aspectRatio;
    let x = padding, y = padding;
    if (position.includes('right')) x = canvasWidth - drawWidth - padding;
    if (position.includes('center') || position === 'top-center' || position === 'bottom-center') x = (canvasWidth - drawWidth) / 2;
    if (position.includes('left')) x = padding;
    if (position.includes('bottom')) y = canvasHeight - drawHeight - padding;
    if (position.includes('center') || position === 'center-left' || position === 'center-right') y = (canvasHeight - drawHeight) / 2;
    if (position.includes('top')) y = padding;
    return { x, y, w: drawWidth, h: drawHeight };
  };

  const drawPortraitTitlePlate = (ctx: CanvasRenderingContext2D, rect: { x: number, y: number, w: number, h: number, radius: number }) => {
    const { x, y, w, h, radius } = rect;
    ctx.save(); ctx.globalAlpha = 0.7; ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h - radius); ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
    ctx.lineTo(x + radius, y + h); ctx.arcTo(x, y + h, x, y + h - radius, radius);
    ctx.lineTo(x, y);
    ctx.closePath(); ctx.fill(); ctx.restore();
  };

  const drawDuckTvWatermark = (ctx: CanvasRenderingContext2D, imgSource: string, canvasWidth: number, canvasHeight: number, scaleMultiplier: number, position: string, margin: number, opacity = 1.0, roundedCorner = 'top-left') => {
    return new Promise<void>((resolve) => {
      if (!imgSource) return resolve();
      const img = new Image(); img.crossOrigin = "Anonymous";
      img.onload = () => {
        const refDiagonal = Math.sqrt(1080 * 1080 + 1080 * 1080);
        const currentDiagonal = Math.sqrt(canvasWidth * canvasWidth + canvasHeight * canvasHeight);
        const baseScale = (currentDiagonal / refDiagonal) * scaleMultiplier;
        const boxW = 230 * baseScale; const boxH = 85 * baseScale;
        const r = Math.max(26 * baseScale, 4);
        let x = 0, y = 0;
        if (position.includes('right')) x = canvasWidth - boxW - margin; else x = margin;
        if (position.includes('bottom')) y = canvasHeight - boxH - margin; else y = margin;

        ctx.save(); ctx.globalAlpha = 0.7; ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        if (roundedCorner === 'bottom-left') {
          ctx.moveTo(x, y); ctx.lineTo(x + boxW, y); ctx.lineTo(x + boxW, y + boxH); ctx.lineTo(x + r, y + boxH); ctx.arcTo(x, y + boxH, x, y + boxH - r, r); ctx.lineTo(x, y);
        } else {
          ctx.moveTo(x + r, y); ctx.lineTo(x + boxW, y); ctx.lineTo(x + boxW, y + boxH); ctx.lineTo(x, y + boxH); ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r);
        }
        ctx.closePath(); ctx.fill(); ctx.restore();

        const maxLogoW = boxW - (20 * baseScale * 2); const maxLogoH = boxH - (5 * baseScale * 2);
        const ar = img.width / img.height;
        let dw = maxLogoW, dh = dw / ar;
        if (dh > maxLogoH) { dh = maxLogoH; dw = dh * ar; }
        const lx = x + (boxW - dw) / 2; const ly = y + (boxH - dh) / 2;

        ctx.save(); ctx.globalAlpha = opacity; ctx.drawImage(img, lx, ly, dw, dh); ctx.restore();
        resolve();
      };
      img.onerror = () => resolve();
      img.src = imgSource;
    });
  };

  const drawGradients = (ctx: CanvasRenderingContext2D, width: number, height: number, gradSettings: GradientSettings) => {
    if (!gradSettings.enabled) return;
    const { color, midpoint, start, end, size, offset } = gradSettings;

    const dx = (end.x - start.x) * (size / 100);
    const dy = (end.y - start.y) * (size / 100);
    const ox = ((end.x - start.x) * offset) / 100;
    const oy = ((end.y - start.y) * offset) / 100;

    const x0 = ((start.x + ox) / 100) * width;
    const y0 = ((start.y + oy) / 100) * height;
    const x1 = ((start.x + dx + ox) / 100) * width;
    const y1 = ((start.y + dy + oy) / 100) * height;

    const hexResult = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
    const rgb = hexResult ? `${parseInt(hexResult[1], 16)}, ${parseInt(hexResult[2], 16)}, ${parseInt(hexResult[3], 16)}` : '0,0,0';
    const mid = midpoint / 100;

    ctx.save();
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, `rgba(${rgb}, 1)`);
    g.addColorStop(mid, `rgba(${rgb}, 0.5)`);
    g.addColorStop(1, `rgba(${rgb}, 0)`);

    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  };

  const drawImageFromUrl = (ctx: CanvasRenderingContext2D, url: string, cw: number, ch: number, layoutFn: (img: HTMLImageElement) => { x: number, y: number, w: number, h: number }) => {
    return new Promise<void>(resolve => {
      const img = new Image(); img.src = url; img.crossOrigin = "Anonymous";
      img.onload = () => { const l = layoutFn(img); ctx.drawImage(img, l.x, l.y, l.w, l.h); resolve(); };
      img.onerror = () => resolve();
    });
  };

  const drawLogoImage = (ctx: CanvasRenderingContext2D, src: string, layoutFn: (img: HTMLImageElement) => { x: number, y: number, w: number, h: number }) => {
    return new Promise<void>(resolve => {
      const img = new Image(); img.src = src; img.crossOrigin = "Anonymous";
      img.onload = () => { const l = layoutFn(img); ctx.drawImage(img, l.x, l.y, l.w, l.h); resolve(); };
      img.onerror = () => resolve();
    });
  };

  // --- Processing ---

  const processSingleVariant = async (imgObj: ImageObject, preset: PresetItem, customEdits: any = null) => {
    const isPresetLandscape = preset.width > preset.height;
    const isPresetPortrait = preset.height > preset.width;
    const isPresetSquare = preset.width === preset.height;

    // Flexible Source: Removed strict orientation checks to allow any source to generate any preset.
    // The scaling logic below (Math.max cover) handles the fitting.
    // if (imgObj.sourceType === 'landscape' && (isPresetPortrait || isPresetSquare)) return null;
    // if (imgObj.sourceType === 'portrait' && isPresetLandscape) return null;

    return new Promise<string>(async (resolve) => {
      const EXPORT_QUALITY = 1.0;
      const SUPERSAMPLE_SCALE = 2.0;

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) return resolve('');

      canvas.width = preset.width * SUPERSAMPLE_SCALE;
      canvas.height = preset.height * SUPERSAMPLE_SCALE;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      const img = new Image(); img.src = imgObj.url;
      img.crossOrigin = "Anonymous";

      img.onload = async () => {
        const drawW = canvas.width;
        const drawH = canvas.height;

        // Base White
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, drawW, drawH);

        // Background Blur
        ctx.save();
        ctx.filter = 'blur(40px) brightness(1.1)';
        ctx.globalAlpha = 0.8;
        const blurScale = Math.max(drawW / img.width, drawH / img.height);
        const bx = (drawW / 2) - (img.width / 2) * blurScale;
        const by = (drawH / 2) - (img.height / 2) * blurScale;
        ctx.drawImage(img, bx - 20, by - 20, img.width * blurScale + 40, img.height * blurScale + 40);
        ctx.restore();

        // Main Image
        let scale, x, y;
        let imageEdit = null, logoEdit = null, gradEdit = null;
        if (customEdits) {
          if (customEdits.image) {
            imageEdit = customEdits.image;
            logoEdit = customEdits.logo;
            gradEdit = customEdits.gradient;
          } else {
            imageEdit = customEdits;
          }
        }

        if (imageEdit) {
          scale = imageEdit.scale * SUPERSAMPLE_SCALE;
          x = imageEdit.x * SUPERSAMPLE_SCALE;
          y = imageEdit.y * SUPERSAMPLE_SCALE;
        } else {
          scale = Math.max(drawW / img.width, drawH / img.height);
          x = (drawW / 2) - (img.width / 2) * scale;
          y = (drawH / 2) - (img.height / 2) * scale;
        }
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

        // Gradients
        if (gradEdit) {
          const grads = Array.isArray(gradEdit) ? gradEdit : [gradEdit];
          grads.forEach(g => {
            if (g.enabled) drawGradients(ctx, drawW, drawH, g);
          });
        }

        const isPortrait = canvas.height > canvas.width;
        const isSquare = canvas.width === canvas.height;
        const hasTitlePlate = isPortrait || isSquare;
        const shouldHideLogo = preset.id === 'mod_circle' || preset.id === 'friday_banner_web';

        if (hasTitlePlate && logo && !shouldHideLogo) {
          const plateRect = calculatePortraitPlate(drawW, drawH, settings.logoPosition, settings.logoPadding);
          drawPortraitTitlePlate(ctx, plateRect);
          await drawLogoImage(ctx, logo, (logoImg) => {
            let lx, ly, lw, lh;
            if (logoEdit) {
              lw = logoEdit.baseW * logoEdit.scale * SUPERSAMPLE_SCALE;
              lh = logoEdit.baseH * logoEdit.scale * SUPERSAMPLE_SCALE;
              lx = logoEdit.x * SUPERSAMPLE_SCALE;
              ly = logoEdit.y * SUPERSAMPLE_SCALE;
            } else {
              const logoRatio = logoImg.width / logoImg.height;
              const fillFactor = (settings.logoSize / 100) + 0.4;
              const maxW = plateRect.w * Math.min(fillFactor, 0.95);
              const maxH = plateRect.h * 0.95;
              lw = maxW;
              lh = lw / logoRatio;
              if (lh > maxH) { lh = maxH; lw = lh * logoRatio; }
              lx = plateRect.x + (plateRect.w - lw) / 2;
              ly = plateRect.y + (plateRect.h - lh) / 2;
            }
            return { x: lx, y: ly, w: lw, h: lh };
          });
        } else if (logo && !shouldHideLogo) {
          await drawLogoImage(ctx, logo, (logoImg) => {
            let lx, ly, lw, lh;
            if (logoEdit) {
              lw = logoEdit.baseW * logoEdit.scale * SUPERSAMPLE_SCALE;
              lh = logoEdit.baseH * logoEdit.scale * SUPERSAMPLE_SCALE;
              lx = logoEdit.x * SUPERSAMPLE_SCALE;
              ly = logoEdit.y * SUPERSAMPLE_SCALE;
            } else {
              const l = calculateStandardLogoLayout(drawW, drawH, logoImg.width, logoImg.height, settings.logoSize, settings.logoPosition, settings.logoPadding);
              lx = l.x; ly = l.y; lw = l.w; lh = l.h;
            }
            return { x: lx, y: ly, w: lw, h: lh };
          });
        }

        // Watermark
        const formatScaleMultiplier = (isPortrait || isSquare) ? 1.5 : 0.9;
        let targetWmPos = wmSettings.position;
        let targetWmCorner = 'top-left';
        if (preset.id === 'mod_new_logo') { targetWmPos = 'top-right'; targetWmCorner = 'bottom-left'; }

        if (preset.id !== 'mod_circle' && watermark) {
          await drawDuckTvWatermark(ctx, watermark, drawW, drawH, wmSettings.scale * formatScaleMultiplier, targetWmPos, wmSettings.padding * SUPERSAMPLE_SCALE, wmSettings.opacity / 100, targetWmCorner);
        }

        // Downsample to final size (Lanczos-like interpolation by browser)
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width = preset.width;
        finalCanvas.height = preset.height;
        const finalCtx = finalCanvas.getContext('2d');
        if (finalCtx) {
          finalCtx.imageSmoothingEnabled = true;
          finalCtx.imageSmoothingQuality = 'high';
          finalCtx.drawImage(canvas, 0, 0, finalCanvas.width, finalCanvas.height);
          resolve(finalCanvas.toDataURL('image/jpeg', EXPORT_QUALITY));
        } else {
          resolve(canvas.toDataURL('image/jpeg', EXPORT_QUALITY));
        }
      };
    });
  };

  useEffect(() => {
    if (images.length === 0) return;
    if (editingTarget) return;
    const runBatch = async () => {
      setIsProcessing(true);
      const newImages = [...images];
      await Promise.all(newImages.map(async (imgObj, index) => {
        const variants = { ...imgObj.variants };
        let hasChanges = false;
        for (const presetId of activePresets) {
          const preset = FLAT_PRESETS.find(p => p.id === presetId);
          if (preset) {
            const customEdits = imgObj.edits?.[presetId] || null;
            const result = await processSingleVariant(imgObj, preset, customEdits);
            if (result) { variants[presetId] = result; hasChanges = true; }
          }
        }
        if (hasChanges) { newImages[index] = { ...imgObj, variants }; }
      }));
      setImages(newImages);
      setIsProcessing(false);
    };

    runBatch(); // Debouncing is handled by the hook on inputs
  }, [logo, watermark, debouncedSettings, debouncedWmSettings, debouncedOverlayText, activePresets, images.length, editingTarget, enableUpscale]);

  // --- Canvas/Editor Logic ---
  const handleWheel = useCallback((e: WheelEvent<HTMLDivElement>) => {
    if (editingTarget) return;
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setScale(s => Math.min(Math.max(s * delta, 0.1), 3));
    } else {
      setPan(p => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
    }
  }, [editingTarget]);

  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => { if (e.button === 0 && !editingTarget) { setIsDragging(true); setLastMousePos({ x: e.clientX, y: e.clientY }); } };
  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => { if (!isDragging || editingTarget) return; const dx = e.clientX - lastMousePos.x; const dy = e.clientY - lastMousePos.y; setPan(p => ({ x: p.x + dx, y: p.y + dy })); setLastMousePos({ x: e.clientX, y: e.clientY }); };
  const handleMouseUp = () => { setIsDragging(false); };

  const openEditor = (imgObj: ImageObject, presetId: string) => {
    const preset = FLAT_PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    setActiveLayer('image');
    const existingEdit = imgObj.edits?.[presetId];

    // Initialize Image
    if (existingEdit && existingEdit.image) {
      setEditorTransform(existingEdit.image);
      editorTransformRef.current = existingEdit.image;
    } else {
      const img = new Image();
      img.src = imgObj.url;
      img.onload = () => {
        const scale = Math.max(preset.width / img.width, preset.height / img.height);
        const x = (preset.width / 2) - (img.width / 2) * scale;
        const y = (preset.height / 2) - (img.height / 2) * scale;
        const transform = { x, y, scale };
        setEditorTransform(transform);
        editorTransformRef.current = transform;
      };
    }

    // Initialize Logo
    if (logo) {
      if (existingEdit && existingEdit.logo) {
        setLogoTransform(existingEdit.logo);
        logoTransformRef.current = existingEdit.logo;
      } else {
        const logoImg = new Image();
        logoImg.src = logo;
        logoImg.onload = () => {
          const isPortrait = preset.height > preset.width;
          const isSquare = preset.width === preset.height;
          let lt;
          if (isPortrait || isSquare) {
            const plate = calculatePortraitPlate(preset.width, preset.height, settings.logoPosition, settings.logoPadding);
            const logoRatio = logoImg.width / logoImg.height;
            const fillFactor = (settings.logoSize / 100) + 0.4;
            const maxW = plate.w * Math.min(fillFactor, 0.95);
            const maxH = plate.h * 0.95;
            let lw = maxW, lh = lw / logoRatio;
            if (lh > maxH) { lh = maxH; lw = lh * logoRatio; }
            lt = {
              x: plate.x + (plate.w - lw) / 2,
              y: plate.y + (plate.h - lh) / 2,
              scale: 1.0,
              baseW: lw,
              baseH: lh
            };
          } else {
            const layout = calculateStandardLogoLayout(preset.width, preset.height, logoImg.width, logoImg.height, settings.logoSize, settings.logoPosition, settings.logoPadding);
            lt = {
              x: layout.x,
              y: layout.y,
              scale: 1.0,
              baseW: layout.w,
              baseH: layout.h
            };
          }
          setLogoTransform(lt);
          logoTransformRef.current = lt;
        };
      }
    }

    // Initialize Gradients
    if (existingEdit && existingEdit.gradient) {
      const gradData = Array.isArray(existingEdit.gradient) ? existingEdit.gradient : [existingEdit.gradient];
      setEditorGradients(gradData);
      editorGradientsRef.current = gradData;
      setActiveGradientId(gradData[0].id || 'default');
    } else {
      const defaultGrad = [{
        id: 'default', enabled: true, color: '#000000', size: 100, offset: 0, midpoint: 50,
        start: { x: 0, y: 100 }, end: { x: 0, y: 70 }
      }];
      setEditorGradients(defaultGrad);
      editorGradientsRef.current = defaultGrad;
      setActiveGradientId('default');
    }
    setEditingTarget({ imageId: imgObj.id, presetId, imgObj, preset });
  };

  const saveEditor = async () => {
    if (!editingTarget) return;
    const { imgObj, preset } = editingTarget;
    const img = new Image(); img.src = imgObj.url; await new Promise(r => img.onload = r);

    let syncTargets: { id: string; image: any; logo: any }[] = [];
    if (syncRatio) {
      const srcRatio = preset.width / preset.height;
      const srcCoverScale = Math.max(preset.width / img.width, preset.height / img.height);
      const srcZoom = editorTransform.scale / srcCoverScale;
      const srcCenterX = (preset.width - img.width * editorTransform.scale) / 2;
      const srcCenterY = (preset.height - img.height * editorTransform.scale) / 2;
      const deltaX = editorTransform.x - srcCenterX;
      const deltaY = editorTransform.y - srcCenterY;
      const relDeltaX = deltaX / preset.width;
      const relDeltaY = deltaY / preset.height;

      let logoMetrics = null;
      if (logo && logoTransform) {
        logoMetrics = { scale: logoTransform.scale, relX: logoTransform.x / preset.width, relY: logoTransform.y / preset.height };
      }

      FLAT_PRESETS.forEach(target => {
        if (target.id === preset.id) return;
        const tRatio = target.width / target.height;
        if (Math.abs(srcRatio - tRatio) < 0.05) {
          const tCover = Math.max(target.width / img.width, target.height / img.height);
          const tScale = tCover * srcZoom;
          const tCenterX = (target.width - img.width * tScale) / 2;
          const tCenterY = (target.height - img.height * tScale) / 2;
          const tX = tCenterX + (relDeltaX * target.width);
          const tY = tCenterY + (relDeltaY * target.height);
          let tLogo = null;
          if (logoMetrics && logoTransform) {
            const widthRatio = target.width / preset.width;
            const tBaseW = logoTransform.baseW * widthRatio;
            const tBaseH = logoTransform.baseH * widthRatio;
            tLogo = { scale: logoTransform.scale, baseW: tBaseW, baseH: tBaseH, x: logoTransform.x * widthRatio, y: logoTransform.y * (target.height / preset.height) };
          }
          syncTargets.push({ id: target.id, image: { x: tX, y: tY, scale: tScale }, logo: tLogo });
        }
      });
    }

    const newImages = images.map(i => {
      if (i.id === imgObj.id) {
        const newEdits = { ...i.edits };
        newEdits[preset.id] = { image: editorTransform, logo: logo ? logoTransform : null, gradient: editorGradients };
        syncTargets.forEach(t => { newEdits[t.id] = { ...newEdits[t.id], image: t.image, logo: t.logo, gradient: editorGradients }; });
        return { ...i, edits: newEdits };
      }
      return i;
    });
    setImages(newImages); setEditingTarget(null);
  };

  useEffect(() => {
    if (!editingTarget || !editorCanvasRef.current) return;
    const canvas = editorCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const { preset, imgObj } = editingTarget;
    canvas.width = preset.width; canvas.height = preset.height;
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    const img = new Image(); img.src = imgObj.url;

    const render = () => {
      const transform = editorTransformRef.current;
      const lTransform = logoTransformRef.current;
      const gradients = editorGradientsRef.current;
      const curActiveLayer = activeLayerRef.current;
      const curShowGuides = showGuidesRef.current;
      const curLogo = logoRef.current;

      // Updated Background Logic: White + Brightness + Alpha for cleaner look
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.filter = 'blur(40px) brightness(1.1)';
      ctx.globalAlpha = 0.8; // Semi-transparent blur to let white base shine
      const blurScale = Math.max(canvas.width / img.width, canvas.height / img.height);
      const bx = (canvas.width / 2) - (img.width / 2) * blurScale; const by = (canvas.height / 2) - (img.height / 2) * blurScale;
      ctx.drawImage(img, bx - 10, by - 10, img.width * blurScale + 20, img.height * blurScale + 20);
      ctx.restore();

      ctx.drawImage(img, transform.x, transform.y, img.width * transform.scale, img.height * transform.scale);

      // Render all enabled gradients
      gradients.forEach(g => {
        if (g.enabled) drawGradients(ctx, canvas.width, canvas.height, g);
      });

      const isPortrait = canvas.height > canvas.width;
      const isSquare = canvas.width === canvas.height;
      const hasTitlePlate = isPortrait || isSquare;
      const shouldHideLogo = preset.id === 'mod_circle' || preset.id === 'friday_banner_web';

      if (hasTitlePlate && !shouldHideLogo) {
        const plate = calculatePortraitPlate(canvas.width, canvas.height, settings.logoPosition, settings.logoPadding);
        drawPortraitTitlePlate(ctx, plate);
      }

      if (curLogo && !shouldHideLogo) {
        const logoImg = new Image(); logoImg.src = curLogo;
        const lw = lTransform.baseW * lTransform.scale;
        const lh = lTransform.baseH * lTransform.scale;
        if (logoImg.complete) { ctx.drawImage(logoImg, lTransform.x, lTransform.y, lw, lh); if (curActiveLayer === 'logo') { ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 4; ctx.strokeRect(lTransform.x, lTransform.y, lw, lh); } }
        else { logoImg.onload = () => { ctx.drawImage(logoImg, lTransform.x, lTransform.y, lw, lh); if (curActiveLayer === 'logo') { ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 4; ctx.strokeRect(lTransform.x, lTransform.y, lw, lh); } } }
      }
      if (preset.id === 'mod_new_logo') { const label = new Image(); label.src = MOD_LABEL_URL; if (label.complete) ctx.drawImage(label, canvas.width - label.width, canvas.height - label.height); }
      if (curShowGuides) {
        const hasGuide = preset.id === 'mod_banner_hd' || preset.id === 'mod_banner_sd' || preset.id === 'mod_home_c';
        if (hasGuide) {
          ctx.save();
          if (preset.id === 'mod_banner_hd' || preset.id === 'mod_banner_sd') {
            const baseW = 1280; const currentScale = preset.width / baseW; const leftGuideW = 286 * currentScale; const rightGuideW = 313 * currentScale; const edgeW = 48 * currentScale;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'; ctx.fillRect(0, 0, leftGuideW, canvas.height); ctx.fillRect(canvas.width - rightGuideW, 0, rightGuideW, canvas.height);
            ctx.fillStyle = 'rgba(255, 0, 0, 0.2)'; ctx.fillRect(0, 0, edgeW, canvas.height); ctx.fillRect(canvas.width - edgeW, 0, edgeW, canvas.height);
          }
          if (preset.id === 'mod_home_c') {
            const safeW = 720; const safeH = 420; const x = canvas.width - safeW; const y = canvas.height - safeH;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'; ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.globalCompositeOperation = 'destination-out'; ctx.fillRect(x, y, safeW, safeH);
            ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = '#00ff00'; ctx.lineWidth = 2; ctx.strokeRect(x, y, safeW, safeH);
            ctx.fillStyle = '#00ff00'; ctx.font = 'bold 16px sans-serif'; ctx.fillText('Safe Area 720x420', x + 20, y + 30);
          }
          ctx.restore();
        }
      }

      // Render Watermark in Editor
      if (watermark && preset.id !== 'mod_circle') {
        const formatScaleMultiplier = (isPortrait || isSquare) ? 1.5 : 0.9;
        let targetWmPos = wmSettings.position;
        let targetWmCorner = 'top-left';
        if (preset.id === 'mod_new_logo') { targetWmPos = 'top-right'; targetWmCorner = 'bottom-left'; }

        const wmImg = new Image();
        wmImg.crossOrigin = "Anonymous";
        wmImg.src = watermark;
        if (wmImg.complete) {
          drawDuckTvWatermark(ctx, watermark, canvas.width, canvas.height, wmSettings.scale * formatScaleMultiplier, targetWmPos, wmSettings.padding, wmSettings.opacity / 100, targetWmCorner);
        } else {
          wmImg.onload = () => {
            drawDuckTvWatermark(ctx, watermark, canvas.width, canvas.height, wmSettings.scale * formatScaleMultiplier, targetWmPos, wmSettings.padding, wmSettings.opacity / 100, targetWmCorner);
          };
        }
      }
    };
    if (img.complete) render(); else img.onload = render;
    let animFrame: number;
    const loop = () => {
      render();
      animFrame = requestAnimationFrame(loop);
    };
    animFrame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrame);
  }, [editingTarget]);

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-800 overflow-hidden select-none">
      <div className="w-80 bg-white border-r border-slate-200 flex flex-col shadow-xl z-10">
        <div className="p-4 border-b border-slate-100 bg-slate-50"><h1 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Layers className="w-5 h-5 text-blue-600" /> SVOD封面製作工具</h1><p className="text-xs text-slate-500 mt-1">v5.11</p></div>
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <section><h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">0. 專案設定</h3><input type="text" placeholder="輸入影集名稱 (例: ShapeHero)" value={seriesName} onChange={(e) => setSeriesName(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none mb-3" /><label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer p-2 hover:bg-slate-50 rounded border border-slate-200"><input type="checkbox" checked={enableUpscale} onChange={(e) => setEnableUpscale(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500" /><div className="flex items-center gap-1"><Wand2 className="w-3 h-3 text-purple-500" /><span>啟用超解析增強 (Waifu2x 模擬)</span></div></label></section>
          <section className="border-t border-slate-100 pt-5"><h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">1. 來源素材</h3><label className="flex flex-col items-center justify-center w-full h-16 border-2 border-dashed border-blue-200 rounded-lg cursor-pointer bg-blue-50 hover:bg-blue-100 hover:border-blue-400 transition-all group mb-2"><div className="flex items-center gap-2 text-blue-600"><Monitor className="w-4 h-4" /><span className="text-xs font-medium">匯入 橫式 底圖</span></div><input type="file" className="hidden" multiple accept="image/*" onChange={(e) => handleImageUpload(e, 'landscape')} /></label><label className="flex flex-col items-center justify-center w-full h-16 border-2 border-dashed border-purple-200 rounded-lg cursor-pointer bg-purple-50 hover:bg-purple-100 hover:border-purple-400 transition-all group"><div className="flex items-center gap-2 text-purple-600"><Smartphone className="w-4 h-4" /><span className="text-xs font-medium">匯入 直式 底圖</span></div><input type="file" className="hidden" multiple accept="image/*" onChange={(e) => handleImageUpload(e, 'portrait')} /></label>{images.length > 0 && (<div className="mt-3 space-y-1 max-h-32 overflow-y-auto pr-1">{images.map(img => (<div key={img.id} className="flex justify-between items-center text-[10px] p-2 bg-slate-50 rounded border border-slate-100"><div className="flex items-center gap-2 overflow-hidden"><span className={`w-1.5 h-1.5 rounded-full ${img.sourceType === 'landscape' ? 'bg-blue-500' : 'bg-purple-500'}`} /><span className="truncate max-w-[140px] text-slate-600" title={img.name}>{img.name}</span></div><button onClick={() => setImages(images.filter(i => i.id !== img.id))} className="text-slate-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button></div>))}</div>)}</section>
          <section className="border-t border-slate-100 pt-5"><h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">2. 節目標題</h3>{!logo ? (<label className="flex items-center justify-center w-full px-3 py-2 border border-slate-300 rounded-md cursor-pointer hover:bg-slate-50 text-sm text-slate-600 gap-2"><ImageIcon className="w-4 h-4" /> 上傳標題 PNG<input type="file" className="hidden" accept="image/png" onChange={handleLogoUpload} /></label>) : (<div className="space-y-3 bg-slate-50 p-3 rounded-lg border border-slate-200"><div className="flex items-center justify-between"><img src={logo} alt="logo" className="h-6 object-contain" /><button onClick={() => setLogo(null)}><X className="w-4 h-4 text-slate-400 hover:text-red-500" /></button></div><div className="grid grid-cols-2 gap-3"><div><label className="text-[10px] text-slate-500">尺寸 %</label><input type="range" min="10" max="90" value={settings.logoSize} onChange={(e) => setSettings({ ...settings, logoSize: Number(e.target.value) })} className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer" /></div><div><label className="text-[10px] text-slate-500">位置</label><select value={settings.logoPosition} onChange={(e) => setSettings({ ...settings, logoPosition: e.target.value })} className="w-full text-xs border rounded p-1">{POSITIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}</select></div></div></div>)}</section>
          <section className="border-t border-slate-100 pt-5"><h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">3. 頻道標籤</h3>{!watermark ? (<label className="flex items-center justify-center w-full px-3 py-2 border border-slate-300 rounded-md cursor-pointer hover:bg-slate-50 text-sm text-slate-600 gap-2"><Stamp className="w-4 h-4" /> 上傳浮水印 PNG<input type="file" className="hidden" accept="image/png" onChange={handleWatermarkUpload} /></label>) : (<div className="space-y-3 bg-slate-50 p-3 rounded-lg border border-slate-200"><div className="flex items-center justify-between"><img src={watermark} alt="watermark" className="h-6 object-contain" /><button onClick={() => setWatermark(null)} title="移除/更換" ><X className="w-4 h-4 text-slate-400 hover:text-red-500" /></button></div><div className="grid grid-cols-2 gap-3"><div><label className="text-[10px] text-slate-500">縮放</label><input type="range" min="0.5" max="2.5" step="0.1" value={wmSettings.scale} onChange={(e) => setWmSettings({ ...wmSettings, scale: Number(e.target.value) })} className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer" /></div><div><label className="text-[10px] text-slate-500">位置</label><select value={wmSettings.position} onChange={(e) => setWmSettings({ ...wmSettings, position: e.target.value })} className="w-full text-xs border rounded p-1">{WATERMARK_POSITIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}</select></div></div></div>)}</section>
          <section className="border-t border-slate-100 pt-5"><h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">4. 輸出規格</h3><div className="space-y-6 overflow-y-auto max-h-[40vh] pr-2 pb-10">{PRESET_GROUPS.map((group) => (<div key={group.category}><div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-100"><span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{group.label}</span><button onClick={() => toggleGroup(group.items)} className="text-[10px] text-slate-400 hover:text-blue-500">全選/取消</button></div><div className="space-y-1">{group.items.map(preset => (<label key={preset.id} className="flex items-start gap-2 text-xs text-slate-600 cursor-pointer hover:bg-slate-50 p-1.5 rounded transition-colors"><input type="checkbox" checked={activePresets.includes(preset.id)} onChange={(e) => { if (e.target.checked) setActivePresets([...activePresets, preset.id]); else setActivePresets(activePresets.filter(id => id !== preset.id)); }} className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 border-slate-300" /><div className="flex flex-col leading-tight"><span className="font-medium text-slate-700">{preset.name}</span><span className="text-[10px] text-slate-400 mt-0.5">{preset.desc}</span></div></label>))}</div></div>))}</div></section>
        </div>
        <div className="p-4 border-t border-slate-200 bg-white"><button onClick={downloadAll} disabled={images.length === 0 || isZipping} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all">{isZipping ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}{isZipping ? '打包中...' : '下載全部 (ZIP)'}</button></div>
      </div>

      {editingTarget ? (
        <div className="flex-1 flex flex-col bg-slate-800 relative z-0 overflow-hidden animate-in fade-in duration-300">
          <div className="px-6 py-4 border-b border-slate-700/50 flex justify-between items-center bg-slate-900 text-white shadow-md z-20"><div className="flex items-center gap-4"><button onClick={() => setEditingTarget(null)} className="p-2 hover:bg-slate-700 active:scale-95 rounded-full text-slate-400 hover:text-white transition-all"><ArrowLeft className="w-5 h-5" /></button><div><h3 className="text-lg font-bold flex items-center gap-2">{editingTarget.preset.name} <span className="text-xs bg-blue-600 px-2 py-0.5 rounded text-white">{editingTarget.preset.width}x{editingTarget.preset.height}</span></h3><p className="text-xs text-slate-400">拖曳移動 • 滾輪縮放 • 智慧填補背景</p></div></div><div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700 items-center gap-2"><button onClick={() => setActiveLayer('gradient')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 active:scale-95 ${activeLayer === 'gradient' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}><Palette className="w-4 h-4" /> 漸層</button>{(editingTarget.preset.id === 'mod_banner_hd' || editingTarget.preset.id === 'mod_banner_sd' || editingTarget.preset.id === 'mod_home_c') && (<button onClick={() => setShowGuides(!showGuides)} className={`ml-2 p-1.5 rounded-md transition-all active:scale-95 ${showGuides ? 'text-green-400 bg-green-400/10' : 'text-slate-500 hover:text-white'}`} title="切換安全區顯示"><Eye className="w-5 h-5" /></button>)}</div><div className="flex gap-2"><button onClick={saveEditor} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold flex items-center gap-2 shadow-lg transition-all hover:scale-105 active:scale-95"><Check className="w-4 h-4" /> 完成編輯</button></div></div>
          <div className="flex-1 flex flex-row overflow-hidden relative">
            <div className="flex-1 overflow-hidden relative flex items-center justify-center p-8 select-none bg-slate-900/50">
              <div onMouseDown={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const domScale = rect.width / editingTarget.preset.width;
                const clickX = (e.clientX - rect.left) / domScale;
                const clickY = (e.clientY - rect.top) / domScale;

                let nextLayer = activeLayer;
                let nextHandle: null | 'start' | 'end' = null;

                if (activeLayer === 'gradient') {
                  const screenHandleSize = 30;
                  const canvasHandleSize = screenHandleSize / domScale;
                  const px = clickX;
                  const py = clickY;

                  // Find handle hit across all enabled gradients
                  let foundGradId: string | null = null;
                  let foundHandle: 'start' | 'end' | null = null;

                  // Prioritize the active gradient first
                  const grads = [...editorGradientsRef.current];
                  const activeGradIdx = grads.findIndex(g => g.id === activeGradientId);
                  if (activeGradIdx > -1) {
                    const activeGrad = grads.splice(activeGradIdx, 1)[0];
                    grads.unshift(activeGrad); // Put active one at the front to check first
                  }

                  for (const g of grads) {
                    if (!g.enabled) continue;
                    const startX = (g.start.x / 100) * editingTarget.preset.width;
                    const startY = (g.start.y / 100) * editingTarget.preset.height;
                    const endX = (g.end.x / 100) * editingTarget.preset.width;
                    const endY = (g.end.y / 100) * editingTarget.preset.height;

                    const distS = Math.sqrt(Math.pow(px - startX, 2) + Math.pow(py - startY, 2));
                    const distE = Math.sqrt(Math.pow(px - endX, 2) + Math.pow(py - endY, 2));

                    if (distS < canvasHandleSize) {
                      foundGradId = g.id;
                      foundHandle = 'start';
                      break;
                    } else if (distE < canvasHandleSize) {
                      foundGradId = g.id;
                      foundHandle = 'end';
                      break;
                    }
                  }

                  if (foundGradId && foundHandle) {
                    nextLayer = 'gradient';
                    nextHandle = foundHandle;
                    setActiveGradientId(foundGradId);
                  } else {
                    // Check logo hit if no gradient handle was hit
                    const hasLogo = logo && !(editingTarget.preset.id === 'mod_circle' || editingTarget.preset.id === 'friday_banner_web');
                    if (hasLogo) {
                      const lw = logoTransformRef.current.baseW * logoTransformRef.current.scale;
                      const lh = logoTransformRef.current.baseH * logoTransformRef.current.scale;
                      if (clickX >= logoTransformRef.current.x && clickX <= logoTransformRef.current.x + lw &&
                        clickY >= logoTransformRef.current.y && clickY <= logoTransformRef.current.y + lh) {
                        nextLayer = 'logo';
                      }
                    }
                  }
                }

                if (!nextHandle && nextLayer !== 'gradient') {
                  const hasLogo = logo && !(editingTarget.preset.id === 'mod_circle' || editingTarget.preset.id === 'friday_banner_web');
                  if (hasLogo) {
                    const lw = logoTransformRef.current.baseW * logoTransformRef.current.scale;
                    const lh = logoTransformRef.current.baseH * logoTransformRef.current.scale;
                    if (clickX >= logoTransformRef.current.x && clickX <= logoTransformRef.current.x + lw &&
                      clickY >= logoTransformRef.current.y && clickY <= logoTransformRef.current.y + lh) {
                      nextLayer = 'logo';
                    } else {
                      nextLayer = 'image';
                    }
                  } else {
                    nextLayer = 'image';
                  }
                }

                setActiveLayer(nextLayer);
                setActiveHandle(nextHandle);

                const startMouseX = e.clientX;
                const startMouseY = e.clientY;
                const startXForm = nextLayer === 'image' ? editorTransformRef.current.x : logoTransformRef.current.x;
                const startYForm = nextLayer === 'image' ? editorTransformRef.current.y : logoTransformRef.current.y;

                const onMove = (moveEvent: globalThis.MouseEvent) => {
                  const dx = moveEvent.clientX - startMouseX;
                  const dy = moveEvent.clientY - startMouseY;

                  if (nextLayer === 'gradient' && nextHandle) {
                    const currentX = (moveEvent.clientX - rect.left) / domScale;
                    const currentY = (moveEvent.clientY - rect.top) / domScale;
                    const px = Math.min(100, Math.max(0, (currentX / editingTarget.preset.width) * 100));
                    const py = Math.min(100, Math.max(0, (currentY / editingTarget.preset.height) * 100));

                    const newGradients = editorGradientsRef.current.map(g =>
                      g.id === activeGradientId ? { ...g, [nextHandle]: { x: px, y: py } } : g
                    );
                    editorGradientsRef.current = newGradients;
                    setEditorGradients(newGradients);
                  } else if (nextLayer === 'image') {
                    const newTransform = { ...editorTransformRef.current, x: startXForm + dx, y: startYForm + dy };
                    editorTransformRef.current = newTransform;
                    setEditorTransform(newTransform);
                  } else if (nextLayer === 'logo') {
                    const newTransform = { ...logoTransformRef.current, x: startXForm + dx, y: startYForm + dy };
                    logoTransformRef.current = newTransform;
                    setLogoTransform(newTransform);
                  }
                };

                const onUp = () => {
                  setActiveHandle(null);
                  window.removeEventListener('mousemove', onMove);
                  window.removeEventListener('mouseup', onUp);
                };

                window.addEventListener('mousemove', onMove);
                window.addEventListener('mouseup', onUp);
              }} onWheel={(e) => {
                if (activeLayer === 'gradient') {
                  const delta = e.deltaY > 0 ? -2 : 2;
                  const newGradients = editorGradientsRef.current.map(g =>
                    g.id === activeGradientId ? { ...g, midpoint: Math.min(100, Math.max(0, g.midpoint + delta)) } : g
                  );
                  editorGradientsRef.current = newGradients;
                  setEditorGradients(newGradients);
                  return;
                };
                const delta = e.deltaY > 0 ? 0.95 : 1.05;
                if (activeLayer === 'image') {
                  const newTransform = { ...editorTransformRef.current, scale: Math.max(0.1, editorTransformRef.current.scale * delta) };
                  editorTransformRef.current = newTransform;
                  setEditorTransform(newTransform);
                }
                else if (activeLayer === 'logo') {
                  const newTransform = { ...logoTransformRef.current, scale: Math.max(0.1, logoTransformRef.current.scale * delta) };
                  logoTransformRef.current = newTransform;
                  setLogoTransform(newTransform);
                }
              }} className={`shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-4 ${activeLayer === 'logo' ? 'border-blue-500/30' : (activeLayer === 'gradient' ? 'border-purple-500/30' : 'border-white/10')} relative ${activeHandle ? 'cursor-grabbing' : 'cursor-move'} transition-all duration-300 ease-in-out flex-shrink-0`} style={{
                width: editingTarget.preset.width,
                height: editingTarget.preset.height,
                transform: `scale(${isMounted ? Math.min(1, (window.innerWidth - (activeLayer === 'gradient' ? 640 : 320) - 100) / editingTarget.preset.width, (window.innerHeight - 200) / editingTarget.preset.height) : 1})`
              }}>
                <canvas ref={editorCanvasRef} className="w-full h-full block bg-black" />
                {activeLayer === 'gradient' && editorGradients.find(g => g.id === activeGradientId) && (
                  <div className="absolute inset-0 pointer-events-none">
                    {(() => {
                      const g = editorGradients.find(grad => grad.id === activeGradientId)!;
                      return (
                        <>
                          <div className={`absolute w-7 h-7 bg-green-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-[10px] font-bold text-white shadow-[0_0_15px_rgba(0,0,0,0.6)] cursor-pointer transition-transform pointer-events-auto ${activeHandle === 'start' ? 'scale-125 ring-4 ring-green-400/50' : 'hover:scale-110'}`} style={{ left: `${g.start.x}%`, top: `${g.start.y}%`, transform: 'translate(-50%, -50%)', zIndex: 30 }}>S</div>
                          <div className={`absolute w-7 h-7 bg-red-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-[10px] font-bold text-white shadow-[0_0_15px_rgba(0,0,0,0.6)] cursor-pointer transition-transform pointer-events-auto ${activeHandle === 'end' ? 'scale-125 ring-4 ring-red-400/50' : 'hover:scale-110'}`} style={{ left: `${g.end.x}%`, top: `${g.end.y}%`, transform: 'translate(-50%, -50%)', zIndex: 30 }}>E</div>
                          <svg className="w-full h-full overflow-visible">
                            <defs>
                              <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                                <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
                                <feMerge>
                                  <feMergeNode in="coloredBlur" />
                                  <feMergeNode in="SourceGraphic" />
                                </feMerge>
                              </filter>
                            </defs>
                            <line x1={`${g.start.x}%`} y1={`${g.start.y}%`} x2={`${g.end.x}%`} y2={`${g.end.y}%`} stroke="#3b82f6" strokeWidth="3" strokeDasharray="6 4" opacity="0.8" style={{ filter: 'url(#glow)' }} />
                            <line x1={`${g.start.x}%`} y1={`${g.start.y}%`} x2={`${g.end.x}%`} y2={`${g.end.y}%`} stroke="white" strokeWidth="1.5" strokeDasharray="6 4" />
                          </svg>
                        </>
                      );
                    })()}
                  </div>
                )}
                <div className="absolute inset-0 border border-white/10 pointer-events-none">
                  <div className="absolute inset-0 border-dashed border-white/20 border-t-0 border-l-0 border-r-0 border-b w-full h-1/2 top-0" />
                  <div className="absolute inset-0 border-dashed border-white/20 border-t-0 border-l-0 border-b-0 border-r w-1/2 h-full left-0" />
                </div>
              </div>

              {/* Floating control bar */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 z-20">
                {activeLayer === 'gradient' && (
                  <div className="flex items-center gap-4 bg-slate-900/90 backdrop-blur-md px-6 py-2 rounded-xl border border-white/10 shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-300">
                    {(() => {
                      const g = editorGradients.find(grad => grad.id === activeGradientId);
                      if (!g) return null;
                      return (
                        <>
                          <div className="flex items-center gap-2 pr-3 border-r border-white/10">
                            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">顏色</label>
                            <input type="color" value={g.color} onChange={(e) => { const newGrads = editorGradients.map(p => p.id === g.id ? { ...p, color: e.target.value } : p); setEditorGradients(newGrads); editorGradientsRef.current = newGrads; }} className="w-7 h-7 rounded cursor-pointer bg-transparent border-none" />
                          </div>
                          <div className="flex items-center gap-3">
                            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">中點 {g.midpoint}%</label>
                            <input type="range" min="0" max="100" value={g.midpoint} onChange={(e) => { const val = Number(e.target.value); const newGrads = editorGradients.map(p => p.id === g.id ? { ...p, midpoint: val } : p); setEditorGradients(newGrads); editorGradientsRef.current = newGrads; }} className="w-24 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
                <div className="flex items-center gap-4 bg-slate-900/90 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10 shadow-2xl">
                  <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl">
                    <button onClick={() => setActiveLayer('image')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeLayer === 'image' ? 'bg-white text-slate-900 shadow-lg scale-105' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}><ImageIcon className="w-4 h-4" /> 底圖</button>
                    {logo && !(editingTarget.preset.id === 'mod_circle' || editingTarget.preset.id === 'friday_banner_web') && (
                      <button onClick={() => setActiveLayer('logo')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeLayer === 'logo' ? 'bg-white text-slate-900 shadow-lg scale-105' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}><Stamp className="w-4 h-4" /> 標題</button>
                    )}
                    <button onClick={() => setActiveLayer('gradient')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${activeLayer === 'gradient' ? 'bg-white text-slate-900 shadow-lg scale-105' : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}><Palette className="w-4 h-4" /> 漸層</button>
                  </div>
                  <div className="w-px h-6 bg-white/10 mx-2"></div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Minus className="w-4 h-4 text-slate-500" />
                      <input type="range" min="0.1" max="2.0" step="0.05" value={activeLayer === 'logo' ? logoTransform.scale : editorTransform.scale} onChange={(e) => {
                        const s = Number(e.target.value);
                        if (activeLayer === 'image') {
                          const t = { ...editorTransformRef.current, scale: s };
                          setEditorTransform(t);
                          editorTransformRef.current = t;
                        } else if (activeLayer === 'logo') {
                          const t = { ...logoTransformRef.current, scale: s };
                          setLogoTransform(t);
                          logoTransformRef.current = t;
                        }
                      }} className="w-32 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
                      <Plus className="w-4 h-4 text-slate-500" />
                    </div>
                    <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer hover:text-white transition-colors">
                      <input type="checkbox" checked={syncRatio} onChange={(e) => setSyncRatio(e.target.checked)} className="rounded text-blue-500 bg-slate-700 border-slate-600 focus:ring-offset-slate-900" />
                      <span>同步調整</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {activeLayer === 'gradient' && (
              <div className="flex-none w-80 bg-slate-900 border-l border-slate-700 flex flex-col animate-in slide-in-from-right duration-300 shadow-2xl">
                <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2"><Palette className="w-4 h-4 text-blue-400" /> 漸層圖層</h4>
                  <button onClick={() => {
                    const id = `grad_${Date.now()}`;
                    const newGrad = { id, enabled: true, color: '#000000', size: 100, offset: 0, midpoint: 50, start: { x: 0, y: 100 }, end: { x: 0, y: 70 } };
                    const newGrads = [...editorGradients, newGrad];
                    setEditorGradients(newGrads);
                    editorGradientsRef.current = newGrads;
                    setActiveGradientId(id);
                  }} className="p-1.5 bg-blue-600 hover:bg-blue-500 rounded-md text-white transition-all active:scale-95 shadow-lg"><Plus className="w-4 h-4" /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-slate-700">
                  {editorGradients.map((grad, idx) => (
                    <div key={grad.id} onClick={() => setActiveGradientId(grad.id)} className={`group p-3 rounded-xl border cursor-pointer transition-all duration-200 ${activeGradientId === grad.id ? 'bg-blue-600/10 border-blue-500 shadow-lg shadow-blue-900/10' : 'bg-slate-800/50 border-slate-700 hover:border-slate-500 hover:bg-slate-800'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-3.5 h-3.5 rounded-full border border-white/20 shadow-inner" style={{ backgroundColor: grad.color }} />
                          <span className="text-[11px] font-bold text-slate-200">漸層 #{idx + 1}</span>
                        </div>
                        <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                          <button onClick={(e) => { e.stopPropagation(); const newGrads = editorGradients.map(g => g.id === grad.id ? { ...g, enabled: !g.enabled } : g); setEditorGradients(newGrads); editorGradientsRef.current = newGrads; }} className={`p-1 rounded ${grad.enabled ? 'text-blue-400 hover:bg-blue-400/10' : 'text-slate-500 hover:bg-slate-500/10'}`}>{grad.enabled ? <Eye className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}</button>
                          {editorGradients.length > 1 && (
                            <button onClick={(e) => { e.stopPropagation(); const newGrads = editorGradients.filter(g => g.id !== grad.id); setEditorGradients(newGrads); editorGradientsRef.current = newGrads; if (activeGradientId === grad.id) { setActiveGradientId(newGrads[0].id); } }} className="p-1 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                          )}
                        </div>
                      </div>
                      {activeGradientId === grad.id && (
                        <div className="space-y-4 pt-3 border-t border-slate-700/50 animate-in slide-in-from-top-1 duration-200">
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center"><label className="text-[10px] text-slate-400 font-bold uppercase">範圍</label><span className="text-[10px] text-blue-400 font-mono">{grad.size}%</span></div>
                            <input type="range" min="10" max="250" value={grad.size} onChange={(e) => { const val = Number(e.target.value); const newGrads = editorGradients.map(p => p.id === grad.id ? { ...p, size: val } : p); setEditorGradients(newGrads); editorGradientsRef.current = newGrads; }} className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center"><label className="text-[10px] text-slate-400 font-bold uppercase">偏移</label><span className="text-[10px] text-blue-400 font-mono">{grad.offset}%</span></div>
                            <input type="range" min="-100" max="100" value={grad.offset} onChange={(e) => { const val = Number(e.target.value); const newGrads = editorGradients.map(p => p.id === grad.id ? { ...p, offset: val } : p); setEditorGradients(newGrads); editorGradientsRef.current = newGrads; }} className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer" />
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const newGrads = editorGradients.map(p => p.id === grad.id ? { ...p, start: { x: 0, y: 100 }, end: { x: 0, y: 70 }, midpoint: 50, size: 100, offset: 0 } : p);
                              setEditorGradients(newGrads);
                              editorGradientsRef.current = newGrads;
                            }}
                            className="w-full py-1.5 bg-slate-700 hover:bg-slate-600 text-[10px] font-bold rounded-lg transition-colors border border-white/5"
                          >
                            重置此漸層
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="p-4 bg-slate-800/80 border-t border-slate-700">
                  <p className="text-[10px] text-slate-500 italic text-center leading-relaxed">提示: 拖曳畫布上的綠點(S)與紅點(E)<br />來調整漸層角度與起始位置</p>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div ref={containerRef} className="flex-1 relative overflow-hidden bg-slate-100 cursor-grab active:cursor-grabbing" onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onWheel={handleWheel} style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: `${20 * scale}px ${20 * scale}px` }}>
          <div className="absolute origin-top-left transition-transform duration-75 ease-out" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}>
            {images.length === 0 ? (<div className="w-[800px] h-[600px] flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-3xl bg-white/50 backdrop-blur-sm"><MousePointer2 className="w-12 h-12 text-slate-300 mb-4" /><p className="text-2xl font-bold text-slate-400">拖曳圖片到左側開始</p><p className="text-slate-400 mt-2">支援雙素材上傳、自動拼貼、與即時編輯</p></div>) : (<div className="flex flex-col gap-16 p-16">{PRESET_GROUPS.map(group => { const validPresets = group.items.filter(preset => activePresets.includes(preset.id)); if (validPresets.length === 0) return null; return (<div key={group.category} className="flex flex-col gap-4"><div className="flex items-center gap-4 border-b-2 border-slate-200 pb-2 mb-2 w-full"><h2 className="text-4xl font-black text-slate-400 uppercase tracking-widest">{group.label}</h2></div><div className="flex gap-8 items-start flex-wrap">{validPresets.map(preset => { const variantData = getVariantForPreset(preset.id); return (<div key={preset.id} className="flex flex-col gap-2 group"><div onClick={() => variantData && openEditor(variantData.imgObj, preset.id)} style={{ width: preset.width, height: preset.height, borderRadius: preset.isCircle ? '50%' : '8px' }} className={`relative bg-white shadow-xl overflow-hidden flex-shrink-0 transition-transform hover:ring-4 ring-blue-400 cursor-pointer ${preset.isCircle ? 'rounded-full' : 'rounded-lg'}`}>{variantData ? (<><img src={variantData.url} alt="preview" className="w-full h-full object-cover bg-gray-900" /><div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><div className="bg-white/90 px-4 py-2 rounded-full font-bold text-slate-700 flex items-center gap-2"><Move className="w-4 h-4" /> 點擊編輯</div></div></>) : (<div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 text-slate-300 gap-2 border border-slate-200">{isProcessing ? <RefreshCw className="w-12 h-12 animate-spin" /> : <div className="text-center"><ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-30" /><span className="text-sm opacity-50">等待{preset.width > preset.height ? '橫' : '直'}式</span></div>}</div>)}</div><div className="flex justify-between items-center px-1" style={{ width: preset.width }}><span className="font-bold text-slate-700 text-lg">{preset.name} <span className="text-slate-400 text-xs ml-2">{preset.width}x{preset.height}</span></span>{variantData && <button onClick={(e) => { e.stopPropagation(); downloadSingle(variantData.url, `${group.category}_${preset.name}.jpg`); }} className="p-2 hover:bg-slate-200 rounded-full text-slate-500"><Download className="w-5 h-5" /></button>}</div></div>); })}</div></div>); })}</div>)}
          </div>
        </div>
      )}

      {!editingTarget && (<div className="absolute bottom-8 right-8 flex gap-2 z-30"><div className="bg-white rounded-lg shadow-lg border border-slate-200 p-1 flex items-center gap-1"><button onClick={() => setScale(s => Math.max(s - 0.1, 0.1))} className="p-2 hover:bg-slate-100 rounded text-slate-600"><Minus className="w-5 h-5" /></button><span className="w-12 text-center text-sm font-medium text-slate-600">{Math.round(scale * 100)}%</span><button onClick={() => setScale(s => Math.min(s + 0.1, 3))} className="p-2 hover:bg-slate-100 rounded text-slate-600"><Plus className="w-5 h-5" /></button></div><button onClick={() => { setPan({ x: 50, y: 50 }); setScale(0.35); }} className="bg-white p-3 rounded-lg shadow-lg border border-slate-200 text-slate-600 hover:text-blue-600" title="適應視窗"><Maximize className="w-5 h-5" /></button></div>)}
      {isProcessing && (<div className="absolute top-4 right-1/2 translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded-full flex items-center gap-2 shadow-xl z-50"><RefreshCw className="w-4 h-4 animate-spin" /><span className="text-sm font-medium">處理中...</span></div>)}
    </div>
  );
}
