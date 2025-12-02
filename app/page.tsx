// @ts-nocheck
"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Download, Layers, X, RefreshCw, MousePointer2, Plus, Minus, Maximize, Image as ImageIcon, Stamp, Trash2, Smartphone, Monitor, Move, ZoomIn, Check, ArrowLeft, Eye, Archive, Wand2, Palette, Sliders, RefreshCcw, Link2 } from 'lucide-react';

// --- Constants ---
const PRESET_GROUPS = [
  {
    category: 'friDay_Video',
    label: 'friDay 影音',
    items: [
      { id: 'friday_banner_app', name: '大網 Banner (App)', desc: '1242x828', width: 1242, height: 828 },
      { id: 'friday_banner_web', name: '大網 Banner (Web)', desc: '1920x720 (無Logo)', width: 1920, height: 720 },
      { id: 'friday_poster_port', name: '直式海報', desc: '405x600', width: 405, height: 600 },
      { id: 'friday_poster_land', name: '橫式海報', desc: '1920x1280', width: 1920, height: 1280 },
      { id: 'friday_banner_std', name: '橫式 Banner', desc: '1920x1080', width: 1920, height: 1080 },
      { id: 'friday_fb_post', name: 'FB 貼文', desc: '1080x1080', width: 1080, height: 1080 },
    ]
  },
  {
    category: 'MyVideo',
    label: 'MyVideo',
    items: [
      { id: 'myvideo_cover', name: 'MyVideo 封面圖', desc: '640x910', width: 640, height: 910 },
      { id: 'myvideo_landscape', name: 'MyVideo 橫式圖檔', desc: '2016x1134 (16:9)', width: 2016, height: 1134 },
    ]
  },
  {
    category: 'Hami_Video',
    label: 'Hami Video',
    items: [
      { id: 'hami_banner_thin', name: 'Hami 橫幅 (細)', desc: '1200x400', width: 1200, height: 400 },
      { id: 'hami_banner_large', name: 'Hami 大橫幅', desc: '1200x676', width: 1200, height: 676 },
    ]
  },
  {
    category: 'MOD',
    label: 'MOD',
    items: [
      { id: 'mod_poster', name: '海報封面', desc: '440x620', width: 440, height: 620 },
      { id: 'mod_home_c', name: 'HomeC-VSM (無框)', desc: '926x520', width: 926, height: 520 },
      { id: 'mod_banner_hd', name: 'G-Banner HD', desc: '1280x392', width: 1280, height: 392 },
      { id: 'mod_banner_sd', name: 'G-Banner SD', desc: '720x221', width: 720, height: 221 },
      { id: 'mod_new_logo', name: '新平台橫圖', desc: '500x165', width: 500, height: 165 },
      { id: 'mod_circle', name: '圓形 Icon', desc: '500x500 (無Logo)', width: 500, height: 500, isCircle: true },
    ]
  }
];

const FLAT_PRESETS = PRESET_GROUPS.flatMap(g => g.items);

const POSITIONS = [
  { label: '左上', value: 'top-left' }, { label: '中上', value: 'top-center' }, { label: '右上', value: 'top-right' },
  { label: '左中', value: 'center-left' }, { label: '正中', value: 'center' }, { label: '右中', value: 'center-right' },
  { label: '左下', value: 'bottom-left' }, { label: '中下', value: 'bottom-center' }, { label: '右下', value: 'bottom-right' },
];

const WATERMARK_POSITIONS = [
  { label: '↗ 右上角', value: 'top-right' }, { label: '↘ 右下角', value: 'bottom-right' },
  { label: '↙ 左下角', value: 'bottom-left' }, { label: '↖ 左上角', value: 'top-left' },
];

const MOD_LABEL_URL = 'https://tang-portico.github.io/img/rightbottomlabel.png';

// --- Helper Functions ---
const getAverageColor = (img) => '#1a1a1a'; // Placeholder for avg color
const getDateString = () => {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
};

// Helper to load scripts dynamically
const useScript = (src) => {
  useEffect(() => {
    if (document.querySelector(`script[src="${src}"]`)) return;
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    document.body.appendChild(script);
    return () => {
      // Optional: remove script on unmount, but usually we want to keep libs
    };
  }, [src]);
};

export default function OTTImageGenerator() {
  // Load external libs
  useScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
  useScript('https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js');

  // State
  const [images, setImages] = useState([]); 
  const [logo, setLogo] = useState(null); 
  const [watermark, setWatermark] = useState('https://tang-portico.github.io/img/Ducktv_logo.png');
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
  const [editingTarget, setEditingTarget] = useState(null); 
  const [activeLayer, setActiveLayer] = useState('image'); 
  const [editorTransform, setEditorTransform] = useState({ x: 0, y: 0, scale: 1.0 });
  const [logoTransform, setLogoTransform] = useState({ x: 0, y: 0, scale: 1.0, baseW: 0, baseH: 0 });
  const [editorGradient, setEditorGradient] = useState({
      enabled: false, color: '#000000', size: 30, offset: 0, midpoint: 50, top: false, bottom: false, left: false, right: false
  });
  const [showGuides, setShowGuides] = useState(true);
  const [syncRatio, setSyncRatio] = useState(true);

  const [settings, setSettings] = useState({
    logoSize: 35, logoPosition: 'center-right', logoPadding: 50,
    textPosition: 'bottom-center', textSize: 60, textColor: '#ffffff', textBgColor: '#000000', textBgOpacity: 0.5,
  });

  const [wmSettings, setWmSettings] = useState({
    scale: 1.0, position: 'bottom-right', padding: 0, opacity: 100
  });

  const containerRef = useRef(null);
  const editorCanvasRef = useRef(null);

  // --- Handlers ---

  const handleImageUpload = (e, sourceType) => {
    const files = Array.from(e.target.files);
    const newImages = files.map(file => ({
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

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => setLogo(e.target.result);
        reader.readAsDataURL(file);
    }
  };

  const handleWatermarkUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => setWatermark(e.target.result);
        reader.readAsDataURL(file);
    }
  };

  const downloadSingle = (dataUrl, filename) => {
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataUrl;
    link.click();
  };

  const downloadAll = async () => {
    if (!window.JSZip || !window.saveAs) {
        console.warn("壓縮元件載入中，請稍後再試...");
        return;
    }

    setIsZipping(true);
    const zip = new window.JSZip();
    const dateStr = getDateString();
    const safeSeriesName = seriesName.trim() || 'Untitled';

    images.forEach(img => {
        activePresets.forEach(presetId => {
            if(img.variants && img.variants[presetId]) {
                const preset = FLAT_PRESETS.find(p => p.id === presetId);
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
        window.saveAs(content, `${dateStr}_${safeSeriesName}_OTT_Assets.zip`);
    } catch (err) {
        console.error("Zip failed:", err);
    } finally {
        setIsZipping(false);
    }
  };

  const toggleGroup = (groupItems) => {
    const groupIds = groupItems.map(i => i.id);
    const allSelected = groupIds.every(id => activePresets.includes(id));
    if (allSelected) {
      setActivePresets(activePresets.filter(id => !groupIds.includes(id)));
    } else {
      const newIds = [...activePresets];
      groupIds.forEach(id => {
        if(!newIds.includes(id)) newIds.push(id);
      });
      setActivePresets(newIds);
    }
  };

  const getVariantForPreset = (presetId) => {
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

  const calculatePortraitPlate = (canvasWidth, canvasHeight, position, padding) => {
    const refWidth = 640;
    const scaleFactor = canvasWidth / refWidth;
    const plateW = 478 * scaleFactor;
    const plateH = 256 * scaleFactor;
    // Center X, Top Y
    let x = (canvasWidth - plateW) / 2;
    let y = 0; 
    return { x, y, w: plateW, h: plateH, radius: 30 * scaleFactor };
  };

  const calculateStandardLogoLayout = (canvasWidth, canvasHeight, imgW, imgH, sizePercent, position, padding) => {
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

  const drawPortraitTitlePlate = (ctx, rect) => {
    const { x, y, w, h, radius } = rect;
    ctx.save(); ctx.globalAlpha = 0.7; ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x + w, y); 
    ctx.lineTo(x + w, y + h - radius); ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius); 
    ctx.lineTo(x + radius, y + h); ctx.arcTo(x, y + h, x, y + h - radius, radius); 
    ctx.lineTo(x, y); 
    ctx.closePath(); ctx.fill(); ctx.restore();
  };

  const drawDuckTvWatermark = (ctx, imgSource, canvasWidth, canvasHeight, scaleMultiplier, position, margin, opacity = 1.0, roundedCorner = 'top-left') => {
    return new Promise((resolve) => {
      if (!imgSource) return resolve();
      const img = new Image(); img.crossOrigin = "Anonymous";
      img.onload = () => {
        const refDiagonal = Math.sqrt(1080*1080 + 1080*1080);
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
            ctx.moveTo(x, y); ctx.lineTo(x+boxW, y); ctx.lineTo(x+boxW, y+boxH); ctx.lineTo(x+r, y+boxH); ctx.arcTo(x, y+boxH, x, y+boxH-r, r); ctx.lineTo(x, y);
        } else {
            ctx.moveTo(x+r, y); ctx.lineTo(x+boxW, y); ctx.lineTo(x+boxW, y+boxH); ctx.lineTo(x, y+boxH); ctx.lineTo(x, y+r); ctx.arcTo(x, y, x+r, y, r);
        }
        ctx.closePath(); ctx.fill(); ctx.restore();

        const maxLogoW = boxW - (20 * baseScale * 2); const maxLogoH = boxH - (5 * baseScale * 2);
        const ar = img.width / img.height;
        let dw = maxLogoW, dh = dw / ar;
        if (dh > maxLogoH) { dh = maxLogoH; dw = dh * ar; }
        const lx = x + (boxW - dw)/2; const ly = y + (boxH - dh)/2;
        
        ctx.save(); ctx.globalAlpha = opacity; ctx.drawImage(img, lx, ly, dw, dh); ctx.restore();
        resolve();
      };
      img.onerror = resolve; img.src = imgSource;
    });
  };

  const drawGradients = (ctx, width, height, gradSettings) => {
      if (!gradSettings.enabled) return;
      const size = Math.min(width, height) * (gradSettings.size / 100);
      const offset = Math.min(width, height) * ((gradSettings.offset || 0) / 100);
      const midpoint = (gradSettings.midpoint || 50) / 100;
      
      let rgb = '0,0,0';
      const hexResult = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(gradSettings.color);
      if(hexResult) rgb = `${parseInt(hexResult[1], 16)}, ${parseInt(hexResult[2], 16)}, ${parseInt(hexResult[3], 16)}`;
      
      const cSolid = `rgba(${rgb}, 1)`; const cMid = `rgba(${rgb}, 0.5)`; const cTrans = `rgba(${rgb}, 0)`;

      ctx.save();
      const createGrad = (x0, y0, x1, y1) => {
          const g = ctx.createLinearGradient(x0, y0, x1, y1);
          g.addColorStop(0, cSolid); g.addColorStop(midpoint, cMid); g.addColorStop(1, cTrans);
          return g;
      };
      if(gradSettings.top) { 
          if(offset > 0) { ctx.fillStyle = cSolid; ctx.fillRect(0, 0, width, offset); }
          const g = createGrad(0, offset, 0, offset+size); ctx.fillStyle = g; ctx.fillRect(0, offset, width, size); 
      }
      if(gradSettings.bottom) { 
          if(offset > 0) { ctx.fillStyle = cSolid; ctx.fillRect(0, height-offset, width, offset); }
          const g = ctx.createLinearGradient(0, height-offset-size, 0, height-offset); 
          g.addColorStop(0, cTrans); g.addColorStop(1-midpoint, cMid); g.addColorStop(1, cSolid); 
          ctx.fillStyle = g; ctx.fillRect(0, height-offset-size, width, size); 
      }
      if(gradSettings.left) { 
          if(offset > 0) { ctx.fillStyle = cSolid; ctx.fillRect(0, 0, offset, height); }
          const g = createGrad(offset, 0, offset+size, 0); ctx.fillStyle = g; ctx.fillRect(offset, 0, size, height); 
      }
      if(gradSettings.right) { 
          if(offset > 0) { ctx.fillStyle = cSolid; ctx.fillRect(width-offset, 0, offset, height); }
          const g = ctx.createLinearGradient(width-offset-size, 0, width-offset, 0); 
          g.addColorStop(0, cTrans); g.addColorStop(1-midpoint, cMid); g.addColorStop(1, cSolid); 
          ctx.fillStyle = g; ctx.fillRect(width-offset-size, 0, size, height); 
      }
      ctx.restore();
  };

  const drawImageFromUrl = (ctx, url, cw, ch, layoutFn) => {
      return new Promise(resolve => {
          const img = new Image(); img.src = url; img.crossOrigin = "Anonymous";
          img.onload = () => { const l = layoutFn(img); ctx.drawImage(img, l.x, l.y, l.w, l.h); resolve(); };
          img.onerror = resolve;
      });
  };

  const drawLogoImage = (ctx, src, layoutFn) => {
    return new Promise(resolve => {
        const img = new Image(); img.src = src; img.crossOrigin = "Anonymous";
        img.onload = () => { const l = layoutFn(img); ctx.drawImage(img, l.x, l.y, l.w, l.h); resolve(); };
        img.onerror = resolve;
    });
  };

  // --- Processing ---

  const processSingleVariant = async (imgObj, preset, customEdits = null) => {
    const isPresetLandscape = preset.width > preset.height;
    const isPresetPortrait = preset.height > preset.width;
    const isPresetSquare = preset.width === preset.height;

    if (imgObj.sourceType === 'landscape' && (isPresetPortrait || isPresetSquare)) return null;
    if (imgObj.sourceType === 'portrait' && isPresetLandscape) return null;

    return new Promise(async (resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      
      canvas.width = preset.width; canvas.height = preset.height;
      const img = new Image(); img.src = imgObj.url;

      img.onload = async () => {
        const UPSCALE_FACTOR = 2.0;
        let drawSource = img;
        if (enableUpscale) {
            const offCanvas = document.createElement('canvas');
            offCanvas.width = img.width * UPSCALE_FACTOR; offCanvas.height = img.height * UPSCALE_FACTOR;
            const offCtx = offCanvas.getContext('2d'); offCtx.imageSmoothingEnabled = true; offCtx.imageSmoothingQuality = 'high';
            offCtx.drawImage(img, 0, 0, offCanvas.width, offCanvas.height);
            drawSource = offCanvas;
        }

        // Updated Background Logic: White base + High brightness + Transparency
        ctx.fillStyle = '#ffffff'; 
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.save(); 
        ctx.filter = 'blur(30px) brightness(1.1)'; 
        ctx.globalAlpha = 0.8; // Let white show through
        const blurScale = Math.max(canvas.width/drawSource.width, canvas.height/drawSource.height);
        const bx = (canvas.width/2)-(drawSource.width/2)*blurScale; const by = (canvas.height/2)-(drawSource.height/2)*blurScale;
        ctx.drawImage(drawSource, bx-10, by-10, drawSource.width*blurScale+20, drawSource.height*blurScale+20);
        ctx.restore();

        let scale, x, y;
        let imageEdit = null, logoEdit = null, gradEdit = null;
        if (customEdits) {
            if (customEdits.image) { imageEdit = customEdits.image; logoEdit = customEdits.logo; gradEdit = customEdits.gradient; } 
            else { imageEdit = customEdits; }
        }

        if (imageEdit) {
            scale = imageEdit.scale;
            if (enableUpscale) scale = scale / UPSCALE_FACTOR;
            x = imageEdit.x; y = imageEdit.y;
        } else {
            scale = Math.max(canvas.width/drawSource.width, canvas.height/drawSource.height);
            x = (canvas.width/2)-(drawSource.width/2)*scale; y = (canvas.height/2)-(drawSource.height/2)*scale;
        }
        ctx.drawImage(drawSource, x, y, drawSource.width*scale, drawSource.height*scale);

        if (gradEdit && gradEdit.enabled) drawGradients(ctx, canvas.width, canvas.height, gradEdit);

        const isPortrait = canvas.height > canvas.width;
        const isSquare = canvas.width === canvas.height;
        const hasTitlePlate = isPortrait || isSquare;
        const shouldHideLogo = preset.id === 'mod_circle' || preset.id === 'friday_banner_web';

        if (hasTitlePlate && logo && !shouldHideLogo) {
            const plateRect = calculatePortraitPlate(canvas.width, canvas.height, settings.logoPosition, settings.logoPadding);
            drawPortraitTitlePlate(ctx, plateRect);
            await drawLogoImage(ctx, logo, (logoImg) => {
                 let lx, ly, lw, lh;
                 if (logoEdit) {
                     lw = logoEdit.baseW * logoEdit.scale; lh = logoEdit.baseH * logoEdit.scale;
                     lx = logoEdit.x; ly = logoEdit.y;
                 } else {
                     const logoRatio = logoImg.width / logoImg.height;
                     const fillFactor = (settings.logoSize / 100) + 0.4; 
                     const maxW = plateRect.w * Math.min(fillFactor, 0.95); const maxH = plateRect.h * 0.95;
                     lw = maxW; lh = lw / logoRatio; if(lh > maxH) { lh = maxH; lw = lh * logoRatio; }
                     lx = plateRect.x + (plateRect.w - lw) / 2; ly = plateRect.y + (plateRect.h - lh) / 2;
                 }
                 return { x: lx, y: ly, w: lw, h: lh };
            });
        } else if (logo && !shouldHideLogo) {
            await drawLogoImage(ctx, logo, (logoImg) => {
                let lx, ly, lw, lh;
                if (logoEdit) {
                    lw = logoEdit.baseW * logoEdit.scale; lh = logoEdit.baseH * logoEdit.scale;
                    lx = logoEdit.x; ly = logoEdit.y;
                } else {
                     const l = calculateStandardLogoLayout(canvas.width, canvas.height, logoImg.width, logoImg.height, settings.logoSize, settings.logoPosition, settings.logoPadding);
                     lx = l.x; ly = l.y; lw = l.w; lh = l.h;
                }
                return { x: lx, y: ly, w: lw, h: lh };
            });
        }

        const formatScaleMultiplier = (isPortrait || isSquare) ? 1.5 : 0.9;
        let targetWmPos = wmSettings.position;
        let targetWmCorner = 'top-left';
        if (preset.id === 'mod_new_logo') { targetWmPos = 'top-right'; targetWmCorner = 'bottom-left'; }

        if (preset.id !== 'mod_circle' && watermark) {
            await drawDuckTvWatermark(ctx, watermark, canvas.width, canvas.height, wmSettings.scale * formatScaleMultiplier, targetWmPos, wmSettings.padding, wmSettings.opacity / 100, targetWmCorner);
        }
        if (preset.id === 'mod_new_logo') {
            await drawImageFromUrl(ctx, MOD_LABEL_URL, canvas.width, canvas.height, (img) => ({ x: canvas.width - img.width, y: canvas.height - img.height, w: img.width, h: img.height }));
        }
        resolve(canvas.toDataURL('image/jpeg', 1.0));
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
    const timer = setTimeout(runBatch, 500);
    return () => clearTimeout(timer);
  }, [logo, watermark, settings, wmSettings, overlayText, activePresets, images.length, editingTarget, enableUpscale]);

  // --- Canvas/Editor Logic ---
  const handleWheel = useCallback((e) => {
    if (editingTarget) return; 
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setScale(s => Math.min(Math.max(s * delta, 0.1), 3));
    } else {
      setPan(p => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }));
    }
  }, [editingTarget]);

  const handleMouseDown = (e) => { if(e.button === 0 && !editingTarget) { setIsDragging(true); setLastMousePos({ x: e.clientX, y: e.clientY }); } };
  const handleMouseMove = (e) => { if (!isDragging || editingTarget) return; const dx = e.clientX - lastMousePos.x; const dy = e.clientY - lastMousePos.y; setPan(p => ({ x: p.x + dx, y: p.y + dy })); setLastMousePos({ x: e.clientX, y: e.clientY }); };
  const handleMouseUp = () => { setIsDragging(false); };

  const openEditor = (imgObj, presetId) => {
    const preset = FLAT_PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    setActiveLayer('image'); 
    const existingEdit = imgObj.edits?.[presetId];
    if (existingEdit && existingEdit.image) { setEditorTransform(existingEdit.image); } else { const img = new Image(); img.src = imgObj.url; img.onload = () => { const scale = Math.max(preset.width/img.width, preset.height/img.height); const x = (preset.width/2) - (img.width/2)*scale; const y = (preset.height/2) - (img.height/2)*scale; setEditorTransform({ x, y, scale }); }; }
    if (logo) {
        if (existingEdit && existingEdit.logo) { setLogoTransform(existingEdit.logo); } else {
            const isPortrait = preset.height > preset.width;
            const logoImg = new Image(); logoImg.src = logo; logoImg.onload = () => {
                let initLayout;
                if (isPortrait) {
                    const plate = calculatePortraitPlate(preset.width, preset.height, settings.logoPosition, settings.logoPadding);
                    const logoRatio = logoImg.width / logoImg.height;
                    const fillFactor = (settings.logoSize / 100) + 0.4; 
                    const maxW = plate.w * Math.min(fillFactor, 0.95); const maxH = plate.h * 0.95;
                    let lw = maxW, lh = lw / logoRatio; if(lh > maxH) { lh = maxH; lw = lh * logoRatio; }
                    const lx = plate.x + (plate.w - lw) / 2; const ly = plate.y + (plate.h - lh) / 2;
                    initLayout = { x: lx, y: ly, w: lw, h: lh };
                } else { initLayout = calculateStandardLogoLayout(preset.width, preset.height, logoImg.width, logoImg.height, settings.logoSize, settings.logoPosition, settings.logoPadding); }
                setLogoTransform({ x: initLayout.x, y: initLayout.y, scale: 1.0, baseW: initLayout.w, baseH: initLayout.h });
            };
        }
    }
    if (existingEdit && existingEdit.gradient) { setEditorGradient(existingEdit.gradient); } else { setEditorGradient({ enabled: false, color: '#000000', size: 30, offset: 0, midpoint: 50, top: false, bottom: false, left: false, right: false }); }
    setEditingTarget({ imageId: imgObj.id, presetId, imgObj, preset });
  };

  const saveEditor = async () => {
    if (!editingTarget) return;
    const { imgObj, preset } = editingTarget;
    const img = new Image(); img.src = imgObj.url; await new Promise(r => img.onload = r);
    
    let syncTargets = [];
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
                syncTargets.push({ id: target.id, image: {x: tX, y: tY, scale: tScale}, logo: tLogo });
            }
        });
    }

    const newImages = images.map(i => {
        if (i.id === imgObj.id) {
            const newEdits = { ...i.edits };
            newEdits[preset.id] = { image: editorTransform, logo: logo ? logoTransform : null, gradient: editorGradient };
            syncTargets.forEach(t => { newEdits[t.id] = { image: t.image, logo: t.logo, gradient: editorGradient }; });
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
    const { preset, imgObj } = editingTarget;
    canvas.width = preset.width; canvas.height = preset.height;
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    const img = new Image(); img.src = imgObj.url;

    const render = () => {
        // Updated Background Logic: White + Brightness + Alpha for cleaner look
        ctx.fillStyle = '#ffffff'; 
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.save(); 
        ctx.filter = 'blur(30px) brightness(1.1)'; 
        ctx.globalAlpha = 0.8; // Semi-transparent blur to let white base shine
        const blurScale = Math.max(canvas.width/img.width, canvas.height/img.height);
        const bx = (canvas.width/2)-(img.width/2)*blurScale; const by = (canvas.height/2)-(img.height/2)*blurScale;
        ctx.drawImage(img, bx-10, by-10, img.width*blurScale+20, img.height*blurScale+20);
        ctx.restore();

        ctx.drawImage(img, editorTransform.x, editorTransform.y, img.width * editorTransform.scale, img.height * editorTransform.scale);
        drawGradients(ctx, canvas.width, canvas.height, editorGradient);

        const isPortrait = canvas.height > canvas.width;
        const isSquare = canvas.width === canvas.height;
        const hasTitlePlate = isPortrait || isSquare;
        const shouldHideLogo = preset.id === 'mod_circle' || preset.id === 'friday_banner_web';

        if (hasTitlePlate && !shouldHideLogo) {
             const plate = calculatePortraitPlate(canvas.width, canvas.height, settings.logoPosition, settings.logoPadding);
             drawPortraitTitlePlate(ctx, plate);
        }

        if (logo && !shouldHideLogo) {
            const logoImg = new Image(); logoImg.src = logo;
            const lw = logoTransform.baseW * logoTransform.scale;
            const lh = logoTransform.baseH * logoTransform.scale;
            if (logoImg.complete) { ctx.drawImage(logoImg, logoTransform.x, logoTransform.y, lw, lh); if (activeLayer === 'logo') { ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 4; ctx.strokeRect(logoTransform.x, logoTransform.y, lw, lh); } } 
            else { logoImg.onload = () => { ctx.drawImage(logoImg, logoTransform.x, logoTransform.y, lw, lh); if (activeLayer === 'logo') { ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 4; ctx.strokeRect(logoTransform.x, logoTransform.y, lw, lh); } } }
        }
        if (preset.id === 'mod_new_logo') { const label = new Image(); label.src = MOD_LABEL_URL; if(label.complete) ctx.drawImage(label, canvas.width-label.width, canvas.height-label.height); }
        if (showGuides) {
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
    };
    if (img.complete) render(); else img.onload = render;
    const anim = requestAnimationFrame(function loop(){ render(); requestAnimationFrame(loop); });
    return () => cancelAnimationFrame(anim);
  }, [editingTarget, editorTransform, logoTransform, activeLayer, showGuides, editorGradient]);

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-800 overflow-hidden select-none">
      <div className="w-80 bg-white border-r border-slate-200 flex flex-col shadow-xl z-10">
        <div className="p-4 border-b border-slate-100 bg-slate-50"><h1 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Layers className="w-5 h-5 text-blue-600" /> SVOD封面製作工具</h1><p className="text-xs text-slate-500 mt-1">v5.11</p></div>
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <section><h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">0. 專案設定</h3><input type="text" placeholder="輸入影集名稱 (例: ShapeHero)" value={seriesName} onChange={(e) => setSeriesName(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none mb-3" /><label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer p-2 hover:bg-slate-50 rounded border border-slate-200"><input type="checkbox" checked={enableUpscale} onChange={(e) => setEnableUpscale(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500" /><div className="flex items-center gap-1"><Wand2 className="w-3 h-3 text-purple-500" /><span>啟用超解析增強 (Waifu2x 模擬)</span></div></label></section>
          <section className="border-t border-slate-100 pt-5"><h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">1. 來源素材</h3><label className="flex flex-col items-center justify-center w-full h-16 border-2 border-dashed border-blue-200 rounded-lg cursor-pointer bg-blue-50 hover:bg-blue-100 hover:border-blue-400 transition-all group mb-2"><div className="flex items-center gap-2 text-blue-600"><Monitor className="w-4 h-4" /><span className="text-xs font-medium">匯入 橫式 底圖</span></div><input type="file" className="hidden" multiple accept="image/*" onChange={(e) => handleImageUpload(e, 'landscape')} /></label><label className="flex flex-col items-center justify-center w-full h-16 border-2 border-dashed border-purple-200 rounded-lg cursor-pointer bg-purple-50 hover:bg-purple-100 hover:border-purple-400 transition-all group"><div className="flex items-center gap-2 text-purple-600"><Smartphone className="w-4 h-4" /><span className="text-xs font-medium">匯入 直式 底圖</span></div><input type="file" className="hidden" multiple accept="image/*" onChange={(e) => handleImageUpload(e, 'portrait')} /></label>{images.length > 0 && (<div className="mt-3 space-y-1 max-h-32 overflow-y-auto pr-1">{images.map(img => (<div key={img.id} className="flex justify-between items-center text-[10px] p-2 bg-slate-50 rounded border border-slate-100"><div className="flex items-center gap-2 overflow-hidden"><span className={`w-1.5 h-1.5 rounded-full ${img.sourceType === 'landscape' ? 'bg-blue-500' : 'bg-purple-500'}`} /><span className="truncate max-w-[140px] text-slate-600" title={img.name}>{img.name}</span></div><button onClick={() => setImages(images.filter(i => i.id !== img.id))} className="text-slate-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button></div>))}</div>)}</section>
          <section className="border-t border-slate-100 pt-5"><h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">2. 節目標題</h3>{!logo ? (<label className="flex items-center justify-center w-full px-3 py-2 border border-slate-300 rounded-md cursor-pointer hover:bg-slate-50 text-sm text-slate-600 gap-2"><ImageIcon className="w-4 h-4" /> 上傳標題 PNG<input type="file" className="hidden" accept="image/png" onChange={handleLogoUpload} /></label>) : (<div className="space-y-3 bg-slate-50 p-3 rounded-lg border border-slate-200"><div className="flex items-center justify-between"><img src={logo} alt="logo" className="h-6 object-contain" /><button onClick={() => setLogo(null)}><X className="w-4 h-4 text-slate-400 hover:text-red-500" /></button></div><div className="grid grid-cols-2 gap-3"><div><label className="text-[10px] text-slate-500">尺寸 %</label><input type="range" min="10" max="90" value={settings.logoSize} onChange={(e) => setSettings({...settings, logoSize: Number(e.target.value)})} className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer" /></div><div><label className="text-[10px] text-slate-500">位置</label><select value={settings.logoPosition} onChange={(e) => setSettings({...settings, logoPosition: e.target.value})} className="w-full text-xs border rounded p-1">{POSITIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}</select></div></div></div>)}</section>
          <section className="border-t border-slate-100 pt-5"><h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">3. 頻道標籤</h3>{!watermark ? (<label className="flex items-center justify-center w-full px-3 py-2 border border-slate-300 rounded-md cursor-pointer hover:bg-slate-50 text-sm text-slate-600 gap-2"><Stamp className="w-4 h-4" /> 上傳浮水印 PNG<input type="file" className="hidden" accept="image/png" onChange={handleWatermarkUpload} /></label>) : (<div className="space-y-3 bg-slate-50 p-3 rounded-lg border border-slate-200"><div className="flex items-center justify-between"><img src={watermark} alt="watermark" className="h-6 object-contain" /><button onClick={() => setWatermark(null)} title="移除/更換" ><X className="w-4 h-4 text-slate-400 hover:text-red-500" /></button></div><div className="grid grid-cols-2 gap-3"><div><label className="text-[10px] text-slate-500">縮放</label><input type="range" min="0.5" max="2.5" step="0.1" value={wmSettings.scale} onChange={(e) => setWmSettings({...wmSettings, scale: Number(e.target.value)})} className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer" /></div><div><label className="text-[10px] text-slate-500">位置</label><select value={wmSettings.position} onChange={(e) => setWmSettings({...wmSettings, position: e.target.value})} className="w-full text-xs border rounded p-1">{WATERMARK_POSITIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}</select></div></div></div>)}</section>
          <section className="border-t border-slate-100 pt-5"><h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">4. 輸出規格</h3><div className="space-y-6 overflow-y-auto max-h-[40vh] pr-2 pb-10">{PRESET_GROUPS.map((group) => (<div key={group.category}><div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-100"><span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{group.label}</span><button onClick={() => toggleGroup(group.items)} className="text-[10px] text-slate-400 hover:text-blue-500">全選/取消</button></div><div className="space-y-1">{group.items.map(preset => (<label key={preset.id} className="flex items-start gap-2 text-xs text-slate-600 cursor-pointer hover:bg-slate-50 p-1.5 rounded transition-colors"><input type="checkbox" checked={activePresets.includes(preset.id)} onChange={(e) => { if(e.target.checked) setActivePresets([...activePresets, preset.id]); else setActivePresets(activePresets.filter(id => id !== preset.id)); }} className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 border-slate-300" /><div className="flex flex-col leading-tight"><span className="font-medium text-slate-700">{preset.name}</span><span className="text-[10px] text-slate-400 mt-0.5">{preset.desc}</span></div></label>))}</div></div>))}</div></section>
        </div>
        <div className="p-4 border-t border-slate-200 bg-white"><button onClick={downloadAll} disabled={images.length === 0 || isZipping} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all">{isZipping ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}{isZipping ? '打包中...' : '下載全部 (ZIP)'}</button></div>
      </div>

      {editingTarget ? (
        <div className="flex-1 flex flex-col bg-slate-800 relative z-0 overflow-hidden">
             <div className="px-6 py-4 border-b border-slate-700/50 flex justify-between items-center bg-slate-900 text-white shadow-md z-20"><div className="flex items-center gap-4"><button onClick={() => setEditingTarget(null)} className="p-2 hover:bg-slate-700 rounded-full text-slate-400 hover:text-white transition-colors"><ArrowLeft className="w-5 h-5" /></button><div><h3 className="text-lg font-bold flex items-center gap-2">{editingTarget.preset.name} <span className="text-xs bg-blue-600 px-2 py-0.5 rounded text-white">{editingTarget.preset.width}x{editingTarget.preset.height}</span></h3><p className="text-xs text-slate-400">拖曳移動 • 滾輪縮放 • 智慧填補背景</p></div></div><div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700 items-center gap-2"><button onClick={() => setActiveLayer('gradient')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeLayer === 'gradient' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}><Palette className="w-4 h-4" /> 漸層</button>{(editingTarget.preset.id === 'mod_banner_hd' || editingTarget.preset.id === 'mod_banner_sd' || editingTarget.preset.id === 'mod_home_c') && (<button onClick={() => setShowGuides(!showGuides)} className={`ml-2 p-1.5 rounded-md transition-all ${showGuides ? 'text-green-400 bg-green-400/10' : 'text-slate-500 hover:text-white'}`} title="切換安全區顯示"><Eye className="w-5 h-5" /></button>)}</div><div className="flex gap-2"><button onClick={saveEditor} className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold flex items-center gap-2 shadow-lg transition-all hover:scale-105"><Check className="w-4 h-4" /> 完成編輯</button></div></div>
            <div className="flex-1 overflow-hidden relative flex items-center justify-center p-8 select-none bg-slate-900/50">
                <div onMouseDown={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const domScale = rect.width / editingTarget.preset.width; 
                    const clickX = (e.clientX - rect.left) / domScale;
                    const clickY = (e.clientY - rect.top) / domScale;

                    let nextLayer = activeLayer;
                    
                    if (activeLayer !== 'gradient') {
                        nextLayer = 'image'; 
                        const hasLogo = logo && !(editingTarget.preset.id === 'mod_circle' || editingTarget.preset.id === 'friday_banner_web');
                        
                        if (hasLogo) {
                            const lw = logoTransform.baseW * logoTransform.scale;
                            const lh = logoTransform.baseH * logoTransform.scale;
                            if (clickX >= logoTransform.x && clickX <= logoTransform.x + lw &&
                                clickY >= logoTransform.y && clickY <= logoTransform.y + lh) {
                                nextLayer = 'logo';
                            }
                        }
                        setActiveLayer(nextLayer);
                    }

                    const startX = e.clientX;
                    const startY = e.clientY;
                    const startXForm = nextLayer === 'image' ? editorTransform.x : logoTransform.x;
                    const startYForm = nextLayer === 'image' ? editorTransform.y : logoTransform.y;
                    
                    const onMove = (moveEvent) => {
                        const dx = moveEvent.clientX - startX;
                        const dy = moveEvent.clientY - startY;
                        
                        if (nextLayer === 'gradient') {
                            const sensitivity = 0.2; 
                            const pxToPercent = (1 / Math.min(rect.width, rect.height)) * 100;
                            
                            let deltaOffset = 0;
                            if (editorGradient.left) deltaOffset += dx; 
                            if (editorGradient.right) deltaOffset -= dx; 
                            if (editorGradient.top) deltaOffset += dy; 
                            if (editorGradient.bottom) deltaOffset -= dy; 

                            const change = deltaOffset * pxToPercent * sensitivity;
                            
                            setEditorGradient(prev => ({
                                ...prev,
                                offset: Math.min(100, Math.max(0, prev.offset + change))
                            }));

                        } else if (nextLayer === 'image') {
                            setEditorTransform(prev => ({ ...prev, x: startXForm + dx, y: startYForm + dy }));
                        } else if (nextLayer === 'logo') {
                            setLogoTransform(prev => ({ ...prev, x: startXForm + dx, y: startYForm + dy }));
                        }
                    };
                    
                    const onUp = () => {
                        window.removeEventListener('mousemove', onMove);
                        window.removeEventListener('mouseup', onUp);
                    };
                    
                    window.addEventListener('mousemove', onMove);
                    window.addEventListener('mouseup', onUp);
                }} onWheel={(e) => { 
                    if (activeLayer === 'gradient') {
                        const delta = e.deltaY > 0 ? -2 : 2;
                        setEditorGradient(prev => ({
                                ...prev,
                                offset: Math.min(100, Math.max(0, prev.offset + delta))
                        }));
                        return;
                    }; 
                    const delta = e.deltaY > 0 ? 0.95 : 1.05; 
                    if (activeLayer === 'image') { setEditorTransform(prev => ({ ...prev, scale: Math.max(0.1, prev.scale * delta) })); } 
                    else if (activeLayer === 'logo') { setLogoTransform(prev => ({ ...prev, scale: Math.max(0.1, prev.scale * delta) })); } 
                }} className={`shadow-[0_20px_50px_rgba(0,0,0,0.5)] border-4 ${activeLayer === 'logo' ? 'border-blue-500/30' : (activeLayer === 'gradient' ? 'border-purple-500/30' : 'border-white/10')} relative cursor-move transition-colors flex-shrink-0`} style={{ width: editingTarget.preset.width, height: editingTarget.preset.height, transform: `scale(${Math.min(1, (window.innerWidth - 320 - 100) / editingTarget.preset.width, (window.innerHeight - 200) / editingTarget.preset.height)})` }}>
                    <canvas ref={editorCanvasRef} className="w-full h-full block bg-black" />
                    <div className="absolute inset-0 border border-white/10 pointer-events-none"><div className="absolute inset-0 border-dashed border-white/20 border-t-0 border-l-0 border-r-0 border-b w-full h-1/2 top-0"></div><div className="absolute inset-0 border-dashed border-white/20 border-t-0 border-l-0 border-b-0 border-r w-1/2 h-full left-0"></div></div>
                </div>
            </div>
            <div className="px-4 py-3 border-t border-slate-700 bg-slate-900 flex justify-between items-center text-white z-20 overflow-x-auto whitespace-nowrap scrollbar-hide">
                <div className="flex items-center gap-4 flex-shrink-0">
                   <div className="text-xs text-slate-400 flex items-center gap-2"><div className={`w-2 h-2 rounded-full ${activeLayer === 'image' ? 'bg-blue-500' : (activeLayer === 'logo' ? 'bg-green-500' : 'bg-purple-500')}`}></div>目前控制層: <span className="font-bold">{activeLayer === 'image' ? '底圖' : (activeLayer === 'logo' ? 'Logo' : '漸層')}</span></div>
                   <div className="h-4 w-px bg-slate-700"></div>
                   <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer hover:text-white transition-colors"><input type="checkbox" checked={syncRatio} onChange={(e) => setSyncRatio(e.target.checked)} className="rounded text-blue-500 bg-slate-700 border-slate-600 focus:ring-offset-slate-900" /><span>同步調整</span></label>
                </div>
                {activeLayer === 'gradient' ? (<div className="flex gap-2 items-center flex-shrink-0 ml-4"><div className="flex items-center gap-2 border-r border-slate-700 pr-3"><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={editorGradient.enabled} onChange={(e) => setEditorGradient(p => ({...p, enabled: e.target.checked}))} className="rounded text-purple-500" /><span className="text-sm">啟用</span></label><input type="color" value={editorGradient.color} onChange={(e) => setEditorGradient(p => ({...p, color: e.target.value}))} className="w-6 h-6 rounded border-none cursor-pointer" /></div><div className="flex gap-1 text-xs">{['top', 'bottom', 'left', 'right'].map(side => (<button key={side} onClick={() => setEditorGradient(p => ({...p, [side]: !p[side]}))} className={`px-2 py-1 rounded border ${editorGradient[side] ? 'bg-purple-600 border-purple-500' : 'border-slate-600 hover:bg-slate-800'}`}>{side === 'top' ? '上' : side === 'bottom' ? '下' : side === 'left' ? '左' : '右'}</button>))}</div><div className="flex items-center gap-2 border-l border-slate-700 pl-3"><span className="text-xs text-slate-400">強度</span><input type="range" min="0" max="100" value={editorGradient.size} onChange={(e) => setEditorGradient(p => ({...p, size: Number(e.target.value)}))} className="w-16 h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer" /></div><div className="flex items-center gap-2 border-l border-slate-700 pl-3"><span className="text-xs text-slate-400">延伸</span><input type="range" min="0" max="100" value={editorGradient.offset} onChange={(e) => setEditorGradient(p => ({...p, offset: Number(e.target.value)}))} className="w-16 h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer" /></div><div className="flex items-center gap-2 border-l border-slate-700 pl-3"><span className="text-xs text-slate-400">中點</span><input type="range" min="0" max="100" value={editorGradient.midpoint} onChange={(e) => setEditorGradient(p => ({...p, midpoint: Number(e.target.value)}))} className="w-16 h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer" /></div></div>) : (<div className="flex gap-4"><div className="flex items-center gap-3"><ZoomIn className="w-4 h-4 text-slate-400" /><input type="range" min="0.1" max="3" step="0.05" value={activeLayer === 'image' ? editorTransform.scale : logoTransform.scale} onChange={(e) => { const val = Number(e.target.value); if(activeLayer === 'image') setEditorTransform(prev => ({ ...prev, scale: val })); else setLogoTransform(prev => ({ ...prev, scale: val })); }} className="w-32 h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer" /><span className="text-xs w-10 text-right">{( (activeLayer === 'image' ? editorTransform.scale : logoTransform.scale) * 100 ).toFixed(0)}%</span></div></div>)}
            </div>
        </div>
      ) : (
        <div ref={containerRef} className="flex-1 relative overflow-hidden bg-slate-100 cursor-grab active:cursor-grabbing" onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp} onWheel={handleWheel} style={{ backgroundImage: 'radial-gradient(#cbd5e1 1px, transparent 1px)', backgroundSize: `${20 * scale}px ${20 * scale}px` }}>
            <div className="absolute origin-top-left transition-transform duration-75 ease-out" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}>
            {images.length === 0 ? (<div className="w-[800px] h-[600px] flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-3xl bg-white/50 backdrop-blur-sm"><MousePointer2 className="w-12 h-12 text-slate-300 mb-4" /><p className="text-2xl font-bold text-slate-400">拖曳圖片到左側開始</p><p className="text-slate-400 mt-2">支援雙素材上傳、自動拼貼、與即時編輯</p></div>) : (<div className="flex flex-col gap-16 p-16">{PRESET_GROUPS.map(group => { const validPresets = group.items.filter(preset => activePresets.includes(preset.id)); if (validPresets.length === 0) return null; return (<div key={group.category} className="flex flex-col gap-4"><div className="flex items-center gap-4 border-b-2 border-slate-200 pb-2 mb-2 w-full"><h2 className="text-4xl font-black text-slate-400 uppercase tracking-widest">{group.label}</h2></div><div className="flex gap-8 items-start flex-wrap">{validPresets.map(preset => { const variantData = getVariantForPreset(preset.id); return (<div key={preset.id} className="flex flex-col gap-2 group"><div onClick={() => variantData && openEditor(variantData.imgObj, preset.id)} style={{ width: preset.width, height: preset.height, borderRadius: preset.isCircle ? '50%' : '8px' }} className={`relative bg-white shadow-xl overflow-hidden flex-shrink-0 transition-transform hover:ring-4 ring-blue-400 cursor-pointer ${preset.isCircle ? 'rounded-full' : 'rounded-lg'}`}>{variantData ? (<><img src={variantData.url} alt="preview" className="w-full h-full object-cover bg-gray-900" /><div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"><div className="bg-white/90 px-4 py-2 rounded-full font-bold text-slate-700 flex items-center gap-2"><Move className="w-4 h-4" /> 點擊編輯</div></div></>) : (<div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 text-slate-300 gap-2 border border-slate-200">{isProcessing ? <RefreshCw className="w-12 h-12 animate-spin" /> : <div className="text-center"><ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-30"/><span className="text-sm opacity-50">等待{preset.width > preset.height ? '橫' : '直'}式</span></div>}</div>)}</div><div className="flex justify-between items-center px-1" style={{ width: preset.width }}><span className="font-bold text-slate-700 text-lg">{preset.name} <span className="text-slate-400 text-xs ml-2">{preset.width}x{preset.height}</span></span>{variantData && <button onClick={(e) => { e.stopPropagation(); downloadSingle(variantData.url, `${group.category}_${preset.name}.jpg`); }} className="p-2 hover:bg-slate-200 rounded-full text-slate-500"><Download className="w-5 h-5" /></button>}</div></div>); })}</div></div>); })}</div>)}
            </div>
        </div>
      )}

      {!editingTarget && (<div className="absolute bottom-8 right-8 flex gap-2 z-30"><div className="bg-white rounded-lg shadow-lg border border-slate-200 p-1 flex items-center gap-1"><button onClick={() => setScale(s => Math.max(s - 0.1, 0.1))} className="p-2 hover:bg-slate-100 rounded text-slate-600"><Minus className="w-5 h-5"/></button><span className="w-12 text-center text-sm font-medium text-slate-600">{Math.round(scale * 100)}%</span><button onClick={() => setScale(s => Math.min(s + 0.1, 3))} className="p-2 hover:bg-slate-100 rounded text-slate-600"><Plus className="w-5 h-5"/></button></div><button onClick={() => { setPan({x: 50, y: 50}); setScale(0.35); }} className="bg-white p-3 rounded-lg shadow-lg border border-slate-200 text-slate-600 hover:text-blue-600" title="適應視窗"><Maximize className="w-5 h-5" /></button></div>)}
      {isProcessing && (<div className="absolute top-4 right-1/2 translate-x-1/2 bg-black/80 text-white px-4 py-2 rounded-full flex items-center gap-2 shadow-xl z-50"><RefreshCw className="w-4 h-4 animate-spin" /><span className="text-sm font-medium">處理中...</span></div>)}
    </div>
  );
}
