import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bookmark,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Download,
  FileEdit,
  FileText,
  Highlighter,
  Search,
  SunMoon,
  Trash2,
  Type,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  DEFAULT_READER_SETTINGS,
  HIGHLIGHT_COLORS,
  HIGHLIGHT_STYLES,
  PAGE_ANIMATION_MODES,
  READER_FONTS,
  READER_THEMES,
  RIBBON_COLORS,
} from '../data/utrucceConfig';
import { matchesSearchQuery } from '../utils/turkish';
import { pdfCache, PDF_DOCUMENT_URL, PDF_DOWNLOAD_FILENAME } from '../utils/pdfCache';

const STORAGE_KEYS = {
  SETTINGS: 'utrucce_tss_settings_v1',
  PROGRESS: 'utrucce_tss_progress_v1',
  BOOKMARKS: 'utrucce_tss_bookmarks_v1',
  HIGHLIGHTS: 'utrucce_tss_highlights_v1',
  NOTES: 'utrucce_tss_notes_v1',
  VIEW_MODE: 'tss_reader_view_mode_v1',
};

function readStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota errors
  }
}

export default function UtrucceReader({ bookData, initialPage = null, onBack }) {
  const totalPages = bookData?.totalPages || bookData?.pages?.length || 907;

  const [settings, setSettings] = useState(() => ({
    ...DEFAULT_READER_SETTINGS,
    ...readStorage(STORAGE_KEYS.SETTINGS, {}),
  }));

  // 'pdf' = Orijinal Belge, 'text' = Metin & Tema Modu
  const [viewMode, setViewMode] = useState(() => readStorage(STORAGE_KEYS.VIEW_MODE, 'pdf'));
  const [pdfZoom, setPdfZoom] = useState(1);

  const [currentPage, setCurrentPage] = useState(() => {
    if (typeof initialPage === 'number' && initialPage >= 0 && initialPage < totalPages) {
      return initialPage;
    }
    const saved = readStorage(STORAGE_KEYS.PROGRESS, { page: 0 });
    return Math.min(Math.max(saved.page || 0, 0), Math.max(totalPages - 1, 0));
  });

  // Two-layer page-flip state for realistic Üç Boyutlu Sayfa Kıvrılma
  const [flipState, setFlipState] = useState(null); // { fromPage, toPage, direction: 'next' | 'prev' }
  const flipTimerRef = useRef(null);

  const [turnDirection, setTurnDirection] = useState('next');
  const [animTick, setAnimTick] = useState(0);
  const [isUiVisible, setIsUiVisible] = useState(true);

  // Rendered PDF image cache state in React so UI updates cleanly when pages finish rendering
  const [renderedPdfMap, setRenderedPdfMap] = useState({});
  const [pdfLoadError, setPdfLoadError] = useState(false);

  // Modals / Sheets
  const [activeModal, setActiveModal] = useState(null);
  const [bookmarksTab, setBookmarksTab] = useState(0);

  // Persistent Annotations
  const [bookmarks, setBookmarks] = useState(() => readStorage(STORAGE_KEYS.BOOKMARKS, []));
  const [highlights, setHighlights] = useState(() => readStorage(STORAGE_KEYS.HIGHLIGHTS, []));
  const [stickyNotes, setStickyNotes] = useState(() => readStorage(STORAGE_KEYS.NOTES, []));

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0);

  // Highlight selection
  const [selectedTextForHighlight, setSelectedTextForHighlight] = useState('');

  // Note creation
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');

  // Page jump input
  const [jumpPageInput, setJumpPageInput] = useState('');

  // TTS
  const [isTtsActive, setIsTtsActive] = useState(false);

  // Drag / Swipe tracking on book surface
  const dragStartRef = useRef(null);

  // Toast
  const [toast, setToast] = useState(null);
  const toastTimerRef = useRef(null);

  // Sound Ref
  const audioRef = useRef(null);

  const showToast = useCallback((msg) => {
    setToast(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 2400);
  }, []);

  useEffect(() => {
    if (typeof initialPage === 'number' && initialPage >= 0 && initialPage < totalPages) {
      setCurrentPage(initialPage);
    }
  }, [initialPage, totalPages]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.SETTINGS, settings);
  }, [settings]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.VIEW_MODE, viewMode);
  }, [viewMode]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.PROGRESS, { page: currentPage, updatedAt: Date.now() });
  }, [currentPage]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.BOOKMARKS, bookmarks);
  }, [bookmarks]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.HIGHLIGHTS, highlights);
  }, [highlights]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.NOTES, stickyNotes);
  }, [stickyNotes]);

  useEffect(() => {
    return () => {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
      if (flipTimerRef.current) clearTimeout(flipTimerRef.current);
    };
  }, []);

  // Render active PDF page + prefetch neighbors when in PDF mode
  const ensurePdfPage = useCallback(
    async (pageIdx0Based) => {
      const p1 = pageIdx0Based + 1;
      if (p1 < 1 || p1 > totalPages) return;
      const cached = pdfCache.getCachedPage(p1);
      if (cached) {
        setRenderedPdfMap((prev) => (prev[pageIdx0Based] ? prev : { ...prev, [pageIdx0Based]: cached }));
        pdfCache.prefetchAround(p1, totalPages);
        return;
      }
      try {
        const dataUrl = await pdfCache.renderPage(p1);
        if (dataUrl) {
          setRenderedPdfMap((prev) => ({ ...prev, [pageIdx0Based]: dataUrl }));
          pdfCache.prefetchAround(p1, totalPages);
        }
      } catch {
        setPdfLoadError(true);
      }
    },
    [totalPages]
  );

  useEffect(() => {
    if (viewMode !== 'pdf') return;
    ensurePdfPage(currentPage);
    if (currentPage + 1 < totalPages) ensurePdfPage(currentPage + 1);
    if (currentPage - 1 >= 0) ensurePdfPage(currentPage - 1);
  }, [viewMode, currentPage, totalPages, ensurePdfPage]);

  const theme = READER_THEMES[settings.themeId] || READER_THEMES.SEPIA;
  const fontObj = READER_FONTS.find((f) => f.id === settings.fontId) || READER_FONTS[0];
  const ribbonObj = RIBBON_COLORS.find((r) => r.id === settings.ribbonColorId) || RIBBON_COLORS[0];

  const playTurnSound = useCallback(() => {
    if (!settings.soundEnabled) return;
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio('audio/page_turn_soft.mp3');
      }
      audioRef.current.volume = settings.soundVolume ?? 0.85;
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    } catch {
      // ignore autoplay blocks
    }
  }, [settings.soundEnabled, settings.soundVolume]);

  const goToPage = useCallback(
    (targetIdx, playSound = true, animate = true) => {
      const clamped = Math.min(Math.max(targetIdx, 0), Math.max(totalPages - 1, 0));
      if (clamped === currentPage) return;

      if (window.speechSynthesis && isTtsActive) {
        window.speechSynthesis.cancel();
        setIsTtsActive(false);
      }

      const dir = clamped > currentPage ? 'next' : 'prev';
      setTurnDirection(dir);
      setAnimTick((t) => t + 1);

      if (animate && settings.pageAnimation === 'CURL_3D') {
        if (flipTimerRef.current) clearTimeout(flipTimerRef.current);
        setFlipState({ fromPage: currentPage, toPage: clamped, direction: dir });
        setCurrentPage(clamped);
        flipTimerRef.current = setTimeout(() => {
          setFlipState(null);
        }, 620);
      } else {
        setFlipState(null);
        setCurrentPage(clamped);
      }

      if (playSound) playTurnSound();
    },
    [currentPage, totalPages, playTurnSound, isTtsActive, settings.pageAnimation]
  );

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e) => {
      if (activeModal) {
        if (e.key === 'Escape') setActiveModal(null);
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        goToPage(currentPage + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        goToPage(currentPage - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeModal, currentPage, goToPage]);

  const currentChapter = useMemo(() => {
    const chapters = bookData?.chapters || [];
    for (let i = chapters.length - 1; i >= 0; i--) {
      if (chapters[i].pageStart <= currentPage) return chapters[i];
    }
    return chapters[0] || { title: 'Türk Söylenceler Sözlüğü' };
  }, [bookData, currentPage]);

  const isCurrentBookmarked = useMemo(
    () => bookmarks.some((b) => b.pageIndex === currentPage),
    [bookmarks, currentPage]
  );

  const toggleBookmark = () => {
    if (isCurrentBookmarked) {
      setBookmarks((prev) => prev.filter((b) => b.pageIndex !== currentPage));
      showToast('Sayfa ayracı kaldırıldı');
    } else {
      const rawText = (bookData?.pages?.[currentPage] || '').replace(/^#+\s*/gm, '').trim();
      const newBm = {
        id: `bm_${Date.now()}`,
        pageIndex: currentPage,
        chapterTitle: currentChapter?.title || `Sayfa ${currentPage + 1}`,
        noteSnippet: rawText.slice(0, 90),
        ribbonColorHex: ribbonObj.hex,
        createdAt: Date.now(),
      };
      setBookmarks((prev) => [newBm, ...prev]);
      showToast(`🔖 Sayfa ${currentPage + 1} ayracı takıldı`);
    }
  };

  // Search matches across all pages
  const searchMatches = useMemo(() => {
    const q = searchQuery.trim();
    if (q.length < 2 || !bookData?.pages) return [];
    const matches = [];
    for (let i = 0; i < bookData.pages.length; i++) {
      if (matchesSearchQuery(bookData.pages[i], q)) {
        matches.push(i);
      }
    }
    return matches;
  }, [searchQuery, bookData]);

  useEffect(() => {
    setCurrentMatchIdx(0);
  }, [searchQuery]);

  // TTS Toggle
  const toggleTts = () => {
    if (!window.speechSynthesis) {
      showToast('Tarayıcınız sesli okuma desteklemiyor.');
      return;
    }
    if (isTtsActive) {
      window.speechSynthesis.cancel();
      setIsTtsActive(false);
      return;
    }
    const text = (bookData?.pages?.[currentPage] || '').replace(/^#+\s*/gm, '').trim();
    if (!text) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'tr-TR';
    utter.rate = 1.0;
    utter.onend = () => setIsTtsActive(false);
    utter.onerror = () => setIsTtsActive(false);
    setIsTtsActive(true);
    window.speechSynthesis.speak(utter);
  };

  // Render Text Paragraphs
  const renderTextPageContent = (pageIdx) => {
    const raw = bookData?.pages?.[pageIdx] || '';
    const ch = (bookData?.chapters || []).find((c) => c.pageStart === pageIdx);
    const pHighlights = highlights.filter((h) => h.pageIndex === pageIdx);
    const pNotes = stickyNotes.filter((n) => n.pageIndex === pageIdx);
    const paragraphs = raw.split(/\n{2,}/);

    return (
      <div>
        {ch && (
          <div style={{ marginBottom: 18 }}>
            <h2
              style={{
                fontSize: `${settings.fontSizePx + 4}px`,
                fontWeight: 700,
                fontFamily: fontObj.css,
                color: theme.textColor,
                textAlign: 'center',
                padding: '8px 0',
              }}
            >
              {ch.title}
            </h2>
            <div style={{ height: 1, background: theme.borderColor, opacity: 0.6 }} />
          </div>
        )}

        {paragraphs.map((p, idx) => {
          const trimmed = p.trim();
          if (!trimmed) return null;
          if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
            return (
              <div
                key={idx}
                style={{ height: 1, background: theme.borderColor, opacity: 0.45, margin: '12px 0' }}
              />
            );
          }

          const isMainHeader = trimmed.startsWith('# ');
          const isSubHeader = trimmed.startsWith('## ');
          const cleanText = trimmed.replace(/^#{1,6}\s*/, '').replace(/\*\*/g, '').trim();
          const matchedHl = pHighlights.find((h) => cleanText.includes(h.selectedText));

          let hlStyle = {};
          if (matchedHl) {
            if (matchedHl.style === 'HIGHLIGHT') {
              hlStyle = { backgroundColor: `${matchedHl.colorHex}55`, borderRadius: 6, padding: '4px 6px' };
            } else if (matchedHl.style === 'UNDERLINE') {
              hlStyle = { textDecoration: 'underline', textDecorationColor: matchedHl.colorHex, textUnderlineOffset: '4px' };
            } else if (matchedHl.style === 'STRIKETHROUGH') {
              hlStyle = { textDecoration: 'line-through', textDecorationColor: matchedHl.colorHex };
            }
          }

          return (
            <p
              key={idx}
              onDoubleClick={() => {
                setSelectedTextForHighlight(cleanText.slice(0, 280));
                setActiveModal('highlight');
              }}
              title="Vurgulamak için çift tıklayın"
              className={matchedHl?.style === 'SQUIGGLY' ? 'squiggly-underline' : ''}
              style={{
                fontFamily: fontObj.css,
                fontSize: isMainHeader
                  ? `${settings.fontSizePx + 6}px`
                  : isSubHeader
                    ? `${settings.fontSizePx + 2}px`
                    : `${settings.fontSizePx}px`,
                fontWeight: isMainHeader || isSubHeader ? 700 : 400,
                lineHeight: settings.lineHeightMultiplier,
                color: theme.textColor,
                textAlign: isMainHeader ? 'center' : settings.isJustified ? 'justify' : 'left',
                marginBottom: `${Math.round(settings.lineHeightMultiplier * 10)}px`,
                textDecorationColor: matchedHl?.style === 'SQUIGGLY' ? matchedHl.colorHex : undefined,
                cursor: 'text',
                ...hlStyle,
              }}
            >
              {cleanText}
            </p>
          );
        })}

        {pNotes.length > 0 && (
          <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pNotes.map((note) => (
              <div
                key={note.id}
                style={{
                  background: theme.surfaceColor,
                  border: `1px solid ${theme.borderColor}`,
                  borderRadius: 10,
                  padding: '10px 12px',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 13, color: theme.textColor }}>📌 {note.noteTitle}</div>
                <div style={{ fontSize: 12.5, color: theme.secondaryTextColor, marginTop: 3 }}>
                  {note.noteContent}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Render a Single Page Surface (used for Base Layer & Turning Leaf)
  const renderSingleSheet = (pageIdx, isLeafOverlay = false) => {
    if (viewMode === 'pdf') {
      const imgUrl = renderedPdfMap[pageIdx];
      const pNotes = stickyNotes.filter((n) => n.pageIndex === pageIdx);

      return (
        <div
          style={{
            width: '100%',
            minHeight: '100%',
            backgroundColor: '#fcfaf5',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px 14px 20px',
          }}
        >
          {imgUrl ? (
            <img
              src={imgUrl}
              alt={`Sayfa ${pageIdx + 1}`}
              draggable={false}
              style={{
                width: `${Math.round(pdfZoom * 100)}%`,
                maxWidth: pdfZoom > 1 ? 'none' : '100%',
                height: 'auto',
                display: 'block',
                borderRadius: 4,
                userSelect: 'none',
              }}
            />
          ) : pdfLoadError ? (
            <div style={{ padding: 36, textAlign: 'center', color: '#3E3120' }}>
              <p style={{ fontWeight: 700, marginBottom: 10 }}>Belge sayfası yüklenemedi.</p>
              <button
                onClick={() => setViewMode('text')}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: 'none',
                  backgroundColor: ribbonObj.hex,
                  color: '#fff',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Metin Moduna Geç
              </button>
            </div>
          ) : (
            <div style={{ padding: '120px 20px', textAlign: 'center', color: '#7A6A53', fontSize: 13 }}>
              Sayfa {pageIdx + 1} hazırlanıyor...
            </div>
          )}

          {!isLeafOverlay && pNotes.length > 0 && (
            <div style={{ width: '100%', marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pNotes.map((note) => (
                <div
                  key={note.id}
                  style={{
                    background: '#f4ecd8',
                    border: '1px solid #d8c7a5',
                    borderRadius: 10,
                    padding: '10px 12px',
                    color: '#3E3120',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 13 }}>📌 {note.noteTitle}</div>
                  <div style={{ fontSize: 12.5, marginTop: 3 }}>{note.noteContent}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <div
        style={{
          width: '100%',
          minHeight: '100%',
          backgroundColor: theme.backgroundColor,
          color: theme.textColor,
          padding: `38px ${settings.marginHorizontalPx}px 44px`,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 18,
            paddingBottom: 8,
            borderBottom: `1px solid ${theme.borderColor}66`,
            fontSize: 11,
            color: theme.secondaryTextColor,
            letterSpacing: '0.04em',
          }}
        >
          <span>DENİZ KARAKURT • TÜRK SÖYLENCELER SÖZLÜĞÜ</span>
          {!isLeafOverlay && (
            <button
              onClick={() => setIsUiVisible((v) => !v)}
              style={{
                background: 'transparent',
                border: `1px solid ${theme.borderColor}`,
                color: theme.secondaryTextColor,
                fontSize: 10,
                padding: '2px 8px',
                borderRadius: 99,
                cursor: 'pointer',
              }}
            >
              {isUiVisible ? 'Odak Modu' : 'Araçları Göster'}
            </button>
          )}
        </div>
        {renderTextPageContent(pageIdx)}
      </div>
    );
  };

  const percent = totalPages > 0 ? Math.round(((currentPage + 1) / totalPages) * 100) : 0;
  const remainingMinutes = Math.max(1, Math.round((totalPages - currentPage - 1) * 1.5));

  const scrollPages = useMemo(() => {
    if (settings.pageAnimation !== 'VERTICAL_SCROLL') return [currentPage];
    const start = Math.max(0, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 3);
    const arr = [];
    for (let p = start; p <= end; p++) arr.push(p);
    return arr;
  }, [settings.pageAnimation, currentPage, totalPages]);

  const nonCurlAnimClass = useMemo(() => {
    if (animTick === 0 || settings.pageAnimation === 'CURL_3D') return '';
    if (settings.pageAnimation === 'SLIDE_PAGER') {
      return turnDirection === 'next' ? 'anim-slide-next' : 'anim-slide-prev';
    }
    if (settings.pageAnimation === 'FADE_FLOW') {
      return 'anim-fade-flow';
    }
    return '';
  }, [animTick, settings.pageAnimation, turnDirection]);

  // Pointer swipe to flip page
  const handlePointerDown = (e) => {
    if (e.target.closest('button, a, input')) return;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = (e) => {
    if (!dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    dragStartRef.current = null;
    if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      if (dx < 0 && currentPage < totalPages - 1) {
        goToPage(currentPage + 1);
      } else if (dx > 0 && currentPage > 0) {
        goToPage(currentPage - 1);
      }
    }
  };

  const activeStageBg = viewMode === 'pdf' ? '#12151c' : theme.backgroundColor;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 40,
        backgroundColor: activeStageBg,
        color: theme.textColor,
        display: 'flex',
        flexDirection: 'column',
        transition: 'background-color 0.25s ease, color 0.25s ease',
      }}
    >
      {/* ==================== TOP COMPACT TOOLBAR ==================== */}
      {isUiVisible && (
        <header
          style={{
            backgroundColor: theme.surfaceColor,
            borderBottom: `1px solid ${theme.borderColor}`,
            padding: '8px 14px',
            display: 'flex',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 8,
            zIndex: 30,
            boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
          }}
        >
          <button
            onClick={onBack}
            title="Ana Sayfaya Dön"
            style={{
              background: 'transparent',
              border: 'none',
              color: theme.textColor,
              cursor: 'pointer',
              padding: 6,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <ArrowLeft size={20} />
          </button>

          <div style={{ flex: 1, minWidth: 140 }}>
            <div
              style={{
                fontWeight: 700,
                fontSize: 14,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              Türk Söylenceler Sözlüğü
            </div>
            <div
              style={{
                fontSize: 11,
                color: theme.secondaryTextColor,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {currentChapter?.title} • Deniz Karakurt
            </div>
          </div>

          {/* Belge (PDF) / Metin Modu Geçişi */}
          <div
            style={{
              display: 'flex',
              borderRadius: 9,
              border: `1px solid ${theme.borderColor}`,
              backgroundColor: theme.backgroundColor,
              padding: 2,
              gap: 2,
            }}
          >
            <button
              onClick={() => setViewMode('pdf')}
              title="Orijinal PDF Belgesi"
              style={{
                padding: '4px 9px',
                borderRadius: 7,
                border: 'none',
                fontSize: 11.5,
                fontWeight: 700,
                cursor: 'pointer',
                backgroundColor: viewMode === 'pdf' ? ribbonObj.hex : 'transparent',
                color: viewMode === 'pdf' ? '#fff' : theme.secondaryTextColor,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <FileText size={13} /> Belge
            </button>
            <button
              onClick={() => setViewMode('text')}
              title="Metin & Tema Modu"
              style={{
                padding: '4px 9px',
                borderRadius: 7,
                border: 'none',
                fontSize: 11.5,
                fontWeight: 700,
                cursor: 'pointer',
                backgroundColor: viewMode === 'text' ? ribbonObj.hex : 'transparent',
                color: viewMode === 'text' ? '#fff' : theme.secondaryTextColor,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <BookOpen size={13} /> Metin
            </button>
          </div>

          {/* Belgeyi İndir (PDF) */}
          <a
            href={PDF_DOCUMENT_URL}
            download={PDF_DOWNLOAD_FILENAME}
            title="Orijinal Kitabı PDF Olarak İndir"
            style={{
              padding: '5px 11px',
              borderRadius: 8,
              backgroundColor: ribbonObj.hex,
              border: `1px solid ${ribbonObj.hex}`,
              color: '#ffffff',
              fontSize: 11.5,
              fontWeight: 700,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <Download size={14} /> Belgeyi İndir
          </a>

          {/* Search */}
          <ToolbarBtn theme={theme} title="Kitap İçi Arama" onClick={() => setActiveModal('search')}>
            <Search size={18} />
          </ToolbarBtn>

          {/* TTS */}
          <ToolbarBtn
            theme={theme}
            title={isTtsActive ? 'Sesli Okumayı Durdur' : 'Sesli Oku (Türkçe)'}
            active={isTtsActive}
            activeColor="#FFB300"
            onClick={toggleTts}
          >
            {isTtsActive ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </ToolbarBtn>

          {/* İçindekiler */}
          <ToolbarBtn theme={theme} title="İçindekiler (Fihrist)" onClick={() => setActiveModal('toc')}>
            <BookOpen size={18} />
          </ToolbarBtn>

          {/* Ayraçlar & Vurgular & Notlar */}
          <div style={{ position: 'relative' }}>
            <ToolbarBtn
              theme={theme}
              title="Ayraçlar, Vurgular & Notlar"
              onClick={() => setActiveModal('bookmarks')}
            >
              <Bookmark size={18} />
            </ToolbarBtn>
            {bookmarks.length > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  backgroundColor: ribbonObj.hex,
                  color: '#fff',
                  fontSize: 9,
                  fontWeight: 700,
                  borderRadius: 99,
                  minWidth: 15,
                  height: 15,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 3px',
                  pointerEvents: 'none',
                }}
              >
                {bookmarks.length}
              </span>
            )}
          </div>

          {viewMode === 'text' && (
            <>
              <ToolbarBtn
                theme={theme}
                title="Seçili Metni Vurgula"
                onClick={() => {
                  const sel = window.getSelection()?.toString()?.trim();
                  if (sel && sel.length >= 3) {
                    setSelectedTextForHighlight(sel.slice(0, 280));
                    setActiveModal('highlight');
                  } else {
                    showToast('Vurgulamak için metin seçin veya bir paragrafa çift tıklayın.');
                  }
                }}
              >
                <Highlighter size={18} />
              </ToolbarBtn>

              <ToolbarBtn theme={theme} title="Işık ve Okuma Teması" onClick={() => setActiveModal('themes')}>
                <SunMoon size={18} />
              </ToolbarBtn>
            </>
          )}

          {/* Tipografi & Sayfa Çevirme Ayarları */}
          <ToolbarBtn theme={theme} title="Mizanpaj, Sayfa Çevirme & Ses" onClick={() => setActiveModal('typography')}>
            <Type size={18} />
          </ToolbarBtn>

          {/* Quick Zoom Pill A- | %100 or 17 | A+ */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: `${theme.borderColor}66`,
              border: `1px solid ${theme.borderColor}`,
              borderRadius: 8,
              padding: '2px 4px',
              gap: 2,
            }}
          >
            <button
              onClick={() => {
                if (viewMode === 'pdf') {
                  setPdfZoom((z) => Math.max(0.75, +(z - 0.15).toFixed(2)));
                } else {
                  setSettings((s) => ({ ...s, fontSizePx: Math.max(12, s.fontSizePx - 2) }));
                }
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: theme.textColor,
                fontWeight: 700,
                fontSize: 11,
                cursor: 'pointer',
                padding: '2px 5px',
              }}
            >
              A-
            </button>
            <button
              onClick={() => {
                if (viewMode === 'pdf') setPdfZoom(1);
                else setSettings((s) => ({ ...s, fontSizePx: 17 }));
              }}
              title="Varsayılan boyuta sıfırla"
              style={{
                background: 'transparent',
                border: 'none',
                color: theme.secondaryTextColor,
                fontWeight: 700,
                fontSize: 10.5,
                cursor: 'pointer',
                padding: '2px 4px',
              }}
            >
              {viewMode === 'pdf' ? `%${Math.round(pdfZoom * 100)}` : settings.fontSizePx}
            </button>
            <button
              onClick={() => {
                if (viewMode === 'pdf') {
                  setPdfZoom((z) => Math.min(2.2, +(z + 0.15).toFixed(2)));
                } else {
                  setSettings((s) => ({ ...s, fontSizePx: Math.min(34, s.fontSizePx + 2) }));
                }
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: theme.textColor,
                fontWeight: 700,
                fontSize: 11,
                cursor: 'pointer',
                padding: '2px 5px',
              }}
            >
              A+
            </button>
          </div>
        </header>
      )}

      {/* ==================== BOOK READING STAGE ==================== */}
      <div
        className="book-stage"
        style={{
          flex: 1,
          position: 'relative',
          overflowY: 'auto',
          overflowX: 'hidden',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          padding: isUiVisible ? '20px 18px 28px' : '24px 18px',
        }}
      >
        <div
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          className={`book-volume-stack ${nonCurlAnimClass}`}
          key={settings.pageAnimation === 'CURL_3D' ? 'curl-stage' : `${currentPage}_${animTick}`}
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: viewMode === 'pdf' ? 760 : 780,
            minHeight: 'calc(100vh - 185px)',
            borderRadius: 14,
            border: `1px solid ${viewMode === 'pdf' ? '#d8ceb9' : theme.borderColor}`,
            backgroundColor: viewMode === 'pdf' ? '#fcfaf5' : theme.backgroundColor,
            transformStyle: 'preserve-3d',
          }}
        >
          {/* Left Spine Gutter Shadow */}
          <div className="book-spine-crease" />

          {/* Animated Satin Bookmark Ribbon (Top Right with V-notch) */}
          <button
            onClick={toggleBookmark}
            title={isCurrentBookmarked ? 'Ayracı Kaldır' : 'Bu Sayfaya Ayraç Tak'}
            style={{
              position: 'absolute',
              top: 0,
              right: 28,
              width: 28,
              height: isCurrentBookmarked ? 60 : 18,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              transition: 'height 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
              zIndex: 28,
              filter: 'drop-shadow(0 3px 5px rgba(0,0,0,0.28))',
            }}
          >
            <svg width="28" height="100%" viewBox="0 0 28 60" preserveAspectRatio="none">
              <path d="M0 0 H28 V60 L14 47 L0 60 Z" fill={ribbonObj.hex} />
              <path d="M0 0 H28 V60 L14 47 L0 60 Z" fill="rgba(0,0,0,0.12)" opacity={isCurrentBookmarked ? 0.15 : 0.35} />
            </svg>
          </button>

          {/* Base Layer Content */}
          {settings.pageAnimation === 'VERTICAL_SCROLL' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 28, padding: 12 }}>
              {scrollPages.map((pIdx) => (
                <div key={pIdx} style={{ borderBottom: `1px dashed ${theme.borderColor}`, paddingBottom: 20 }}>
                  <div style={{ fontSize: 11, color: '#7A6A53', marginBottom: 8, fontWeight: 700, paddingLeft: 12 }}>
                    Sayfa {pIdx + 1}
                  </div>
                  {renderSingleSheet(pIdx, false)}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ borderRadius: 14, overflow: viewMode === 'pdf' && pdfZoom > 1 ? 'auto' : 'hidden' }}>
              {renderSingleSheet(
                flipState && flipState.direction === 'prev' ? flipState.fromPage : currentPage,
                false
              )}
            </div>
          )}

          {/* Cast Shadow Over Base Page During 3D Turn */}
          {flipState && (
            <div
              className={flipState.direction === 'next' ? 'anim-under-fade' : 'anim-under-rise'}
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 14,
                background: 'linear-gradient(90deg, rgba(0,0,0,0.48) 0%, rgba(0,0,0,0.18) 55%, transparent 100%)',
                pointerEvents: 'none',
                zIndex: 20,
              }}
            />
          )}

          {/* Real Two-Sided 3D Turning Leaf Overlay */}
          {flipState && (
            <div
              key={`leaf_${flipState.fromPage}_${flipState.toPage}`}
              className={`turning-leaf-wrapper ${flipState.direction === 'next' ? 'anim-leaf-next' : 'anim-leaf-prev'}`}
            >
              {/* Front Face of Turning Leaf */}
              <div
                className="turning-leaf-face"
                style={{
                  border: `1px solid ${viewMode === 'pdf' ? '#d8ceb9' : theme.borderColor}`,
                  backgroundColor: viewMode === 'pdf' ? '#fcfaf5' : theme.backgroundColor,
                }}
              >
                {renderSingleSheet(
                  flipState.direction === 'next' ? flipState.fromPage : flipState.toPage,
                  true
                )}
                {/* Bending Paper Specular Highlight */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background:
                      'linear-gradient(90deg, rgba(0,0,0,0.14) 0%, rgba(255,255,255,0.22) 48%, rgba(0,0,0,0.08) 100%)',
                    pointerEvents: 'none',
                  }}
                />
              </div>

              {/* Back Face of Turning Leaf (Reverse side of page in mid-air) */}
              <div
                className="turning-leaf-face turning-leaf-back"
                style={{
                  background:
                    viewMode === 'pdf'
                      ? 'linear-gradient(135deg, #efe6d3 0%, #e5d8be 55%, #d6c5a4 100%)'
                      : theme.surfaceColor,
                  border: `1px solid ${viewMode === 'pdf' ? '#cbb894' : theme.borderColor}`,
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    opacity: 0.16,
                    transform: 'scaleX(-1)',
                    filter: 'blur(1px)',
                    pointerEvents: 'none',
                  }}
                >
                  {renderSingleSheet(
                    flipState.direction === 'next' ? flipState.fromPage : flipState.toPage,
                    true
                  )}
                </div>
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background:
                      'linear-gradient(90deg, rgba(0,0,0,0.18) 0%, rgba(255,255,255,0.12) 40%, rgba(0,0,0,0.22) 100%)',
                    pointerEvents: 'none',
                  }}
                />
              </div>
            </div>
          )}

          {/* Interactive Curled Page Corners */}
          {settings.pageAnimation === 'CURL_3D' && currentPage < totalPages - 1 && (
            <button
              className="corner-peel-btn"
              onClick={() => goToPage(currentPage + 1)}
              title="Sayfayı Çevir (Sonraki)"
              aria-label="Sonraki Sayfa Köşesi"
            >
              <span className="corner-peel-fold" />
            </button>
          )}
          {settings.pageAnimation === 'CURL_3D' && currentPage > 0 && (
            <button
              className="corner-peel-left"
              onClick={() => goToPage(currentPage - 1)}
              title="Sayfayı Çevir (Önceki)"
              aria-label="Önceki Sayfa Köşesi"
            >
              <span className="corner-peel-left-fold" />
            </button>
          )}
        </div>

        {/* Floating Side Page Buttons */}
        <button
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage === 0}
          aria-label="Önceki Sayfa"
          style={{
            position: 'fixed',
            left: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 42,
            height: 68,
            borderRadius: 12,
            background: `${theme.surfaceColor}DD`,
            border: `1px solid ${theme.borderColor}`,
            color: theme.textColor,
            cursor: currentPage === 0 ? 'default' : 'pointer',
            opacity: currentPage === 0 ? 0.2 : 0.82,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 26,
          }}
        >
          <ChevronLeft size={24} />
        </button>

        <button
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage >= totalPages - 1}
          aria-label="Sonraki Sayfa"
          style={{
            position: 'fixed',
            right: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 42,
            height: 68,
            borderRadius: 12,
            background: `${theme.surfaceColor}DD`,
            border: `1px solid ${theme.borderColor}`,
            color: theme.textColor,
            cursor: currentPage >= totalPages - 1 ? 'default' : 'pointer',
            opacity: currentPage >= totalPages - 1 ? 0.2 : 0.82,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 26,
          }}
        >
          <ChevronRight size={24} />
        </button>
      </div>

      {/* ==================== BOTTOM COMPACT TOOLBAR ==================== */}
      {isUiVisible && (
        <footer
          style={{
            backgroundColor: theme.surfaceColor,
            borderTop: `1px solid ${theme.borderColor}`,
            padding: '8px 16px 10px',
            zIndex: 30,
          }}
        >
          <div style={{ maxWidth: 820, margin: '0 auto' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 4,
              }}
            >
              <button
                onClick={() => {
                  setJumpPageInput(String(currentPage + 1));
                  setActiveModal('jumpPage');
                }}
                title="Sayfaya Git"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: theme.textColor,
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Sayfa {currentPage + 1} / {totalPages} ▾
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button
                  onClick={() => setActiveModal('addNote')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: theme.textColor,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 11.5,
                    fontWeight: 600,
                  }}
                >
                  <FileEdit size={15} /> Not Ekle
                </button>
                <span style={{ fontSize: 11, color: theme.secondaryTextColor }}>
                  %{percent} • ~{remainingMinutes} dk
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage === 0}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: currentPage > 0 ? theme.textColor : theme.secondaryTextColor,
                  opacity: currentPage > 0 ? 1 : 0.35,
                  cursor: 'pointer',
                }}
              >
                <ChevronLeft size={20} />
              </button>

              <input
                type="range"
                min={0}
                max={Math.max(totalPages - 1, 1)}
                value={currentPage}
                onChange={(e) => goToPage(Number(e.target.value), false, false)}
                style={{ flex: 1, accentColor: ribbonObj.hex, cursor: 'pointer' }}
              />

              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage >= totalPages - 1}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: currentPage < totalPages - 1 ? theme.textColor : theme.secondaryTextColor,
                  opacity: currentPage < totalPages - 1 ? 1 : 0.35,
                  cursor: 'pointer',
                }}
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        </footer>
      )}

      {/* ==================== TOAST ==================== */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 84,
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#111827',
            color: '#f9fafb',
            padding: '8px 16px',
            borderRadius: 99,
            fontSize: 12.5,
            fontWeight: 600,
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
            zIndex: 90,
          }}
        >
          {toast}
        </div>
      )}

      {/* ==================== MODALS ==================== */}
      {activeModal === 'themes' && (
        <ReaderModal title="Işık ve Okuma Teması" theme={theme} onClose={() => setActiveModal(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Object.values(READER_THEMES).map((tm) => {
              const selected = settings.themeId === tm.id;
              return (
                <button
                  key={tm.id}
                  onClick={() => setSettings((s) => ({ ...s, themeId: tm.id }))}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 14px',
                    borderRadius: 12,
                    backgroundColor: tm.backgroundColor,
                    color: tm.textColor,
                    border: selected ? '2.5px solid #FFB300' : `1px solid ${tm.borderColor}`,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: 20 }}>{tm.icon}</span>
                  <span style={{ flex: 1, fontWeight: 700, fontSize: 14 }}>{tm.title}</span>
                  {selected && <CheckCircle2 size={20} color="#FFB300" />}
                </button>
              );
            })}
          </div>
        </ReaderModal>
      )}

      {activeModal === 'typography' && (
        <ReaderModal title="Mizanpaj, Sayfa Çevirme & Tipografi" theme={theme} onClose={() => setActiveModal(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {viewMode === 'text' && (
              <>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                    <span>Yazı Boyutu ({settings.fontSizePx}px)</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => setSettings((s) => ({ ...s, fontSizePx: Math.max(12, s.fontSizePx - 1) }))}
                        style={chipStyle(theme, false)}
                      >
                        A-
                      </button>
                      <button
                        onClick={() => setSettings((s) => ({ ...s, fontSizePx: Math.min(34, s.fontSizePx + 1) }))}
                        style={chipStyle(theme, false)}
                      >
                        A+
                      </button>
                    </div>
                  </div>
                  <input
                    type="range"
                    min={12}
                    max={34}
                    value={settings.fontSizePx}
                    onChange={(e) => setSettings((s) => ({ ...s, fontSizePx: Number(e.target.value) }))}
                    style={{ width: '100%', accentColor: ribbonObj.hex }}
                  />
                </div>

                <div>
                  <div style={{ fontSize: 13, marginBottom: 6 }}>
                    Satır Boşluğu: {settings.lineHeightMultiplier.toFixed(1)}x
                  </div>
                  <input
                    type="range"
                    min={1.2}
                    max={2.2}
                    step={0.1}
                    value={settings.lineHeightMultiplier}
                    onChange={(e) => setSettings((s) => ({ ...s, lineHeightMultiplier: Number(e.target.value) }))}
                    style={{ width: '100%', accentColor: ribbonObj.hex }}
                  />
                </div>

                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Yazı Karakteri:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {READER_FONTS.map((rf) => (
                      <button
                        key={rf.id}
                        onClick={() => setSettings((s) => ({ ...s, fontId: rf.id }))}
                        style={chipStyle(theme, settings.fontId === rf.id, ribbonObj.hex)}
                      >
                        {rf.title.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Sayfa Çevirme Efekti:</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {PAGE_ANIMATION_MODES.map((pm) => (
                  <button
                    key={pm.id}
                    onClick={() => setSettings((s) => ({ ...s, pageAnimation: pm.id }))}
                    style={{
                      ...chipStyle(theme, settings.pageAnimation === pm.id, ribbonObj.hex),
                      textAlign: 'left',
                      padding: '8px 10px',
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{pm.title}</div>
                  </button>
                ))}
              </div>
            </div>

            {viewMode === 'text' && (
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, cursor: 'pointer' }}>
                <span>İki Yana Yaslı Metin</span>
                <input
                  type="checkbox"
                  checked={settings.isJustified}
                  onChange={(e) => setSettings((s) => ({ ...s, isJustified: e.target.checked }))}
                />
              </label>
            )}

            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, cursor: 'pointer' }}>
              <span>📖 Gerçek Sayfa Çevirme Sesi</span>
              <input
                type="checkbox"
                checked={settings.soundEnabled}
                onChange={(e) => setSettings((s) => ({ ...s, soundEnabled: e.target.checked }))}
              />
            </label>

            <div>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Kitap Ayracı İpek Rengi:</div>
              <div style={{ display: 'flex', gap: 10 }}>
                {RIBBON_COLORS.map((rc) => (
                  <button
                    key={rc.id}
                    title={rc.title}
                    onClick={() => setSettings((s) => ({ ...s, ribbonColorId: rc.id }))}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      backgroundColor: rc.hex,
                      border: settings.ribbonColorId === rc.id ? '3px solid #fff' : '1px solid rgba(0,0,0,0.2)',
                      boxShadow: settings.ribbonColorId === rc.id ? `0 0 0 2px ${rc.hex}` : 'none',
                      cursor: 'pointer',
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </ReaderModal>
      )}

      {activeModal === 'toc' && (
        <ReaderModal title="İçindekiler & Bölümler (Fihrist)" theme={theme} onClose={() => setActiveModal(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '60vh', overflowY: 'auto' }}>
            {(bookData?.chapters || []).map((ch) => {
              const isCur = currentPage >= ch.pageStart && currentPage <= ch.pageEnd;
              return (
                <button
                  key={ch.id}
                  onClick={() => {
                    setActiveModal(null);
                    goToPage(ch.pageStart);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 10,
                    backgroundColor: isCur ? `${theme.borderColor}66` : 'transparent',
                    border: 'none',
                    color: theme.textColor,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontWeight: 700, color: isCur ? ribbonObj.hex : theme.secondaryTextColor, fontSize: 13 }}>
                    {ch.index + 1}.
                  </span>
                  <span style={{ flex: 1, fontWeight: isCur ? 700 : 500, fontSize: 13.5 }}>{ch.title}</span>
                  <span style={{ fontSize: 11.5, color: theme.secondaryTextColor }}>s. {ch.pageStart + 1}</span>
                </button>
              );
            })}
          </div>
        </ReaderModal>
      )}

      {activeModal === 'bookmarks' && (
        <ReaderModal title="Ayraçlar, Altı Çizilenler & Notlar" theme={theme} onClose={() => setActiveModal(null)}>
          <div style={{ display: 'flex', borderBottom: `1px solid ${theme.borderColor}`, marginBottom: 14 }}>
            {[
              `Ayraçlar (${bookmarks.length})`,
              `Altı Çizilenler (${highlights.length})`,
              `Notlar (${stickyNotes.length})`,
            ].map((lbl, idx) => (
              <button
                key={idx}
                onClick={() => setBookmarksTab(idx)}
                style={{
                  flex: 1,
                  padding: '8px 6px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: bookmarksTab === idx ? `2.5px solid ${ribbonObj.hex}` : '2.5px solid transparent',
                  color: bookmarksTab === idx ? ribbonObj.hex : theme.secondaryTextColor,
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                {lbl}
              </button>
            ))}
          </div>

          <div style={{ maxHeight: '50vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {bookmarksTab === 0 &&
              (bookmarks.length === 0 ? (
                <p style={{ fontSize: 12.5, color: theme.secondaryTextColor }}>
                  Henüz ayraç eklenmedi. Sayfanın sağ üstündeki ipek şeride tıklayarak ayraç takabilirsiniz.
                </p>
              ) : (
                bookmarks.map((bm) => (
                  <div
                    key={bm.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: 10,
                      borderRadius: 10,
                      border: `1px solid ${theme.borderColor}`,
                      backgroundColor: theme.backgroundColor,
                    }}
                  >
                    <div style={{ width: 10, height: 28, borderRadius: 3, backgroundColor: bm.ribbonColorHex }} />
                    <button
                      onClick={() => {
                        setActiveModal(null);
                        goToPage(bm.pageIndex);
                      }}
                      style={{ flex: 1, background: 'transparent', border: 'none', textAlign: 'left', color: theme.textColor, cursor: 'pointer' }}
                    >
                      <div style={{ fontWeight: 700, fontSize: 13 }}>
                        Sayfa {bm.pageIndex + 1} • {bm.chapterTitle}
                      </div>
                      {bm.noteSnippet && (
                        <div style={{ fontSize: 11.5, color: theme.secondaryTextColor }}>{bm.noteSnippet}</div>
                      )}
                    </button>
                    <button
                      onClick={() => setBookmarks((prev) => prev.filter((x) => x.id !== bm.id))}
                      style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              ))}

            {bookmarksTab === 1 &&
              (highlights.length === 0 ? (
                <p style={{ fontSize: 12.5, color: theme.secondaryTextColor }}>
                  Henüz altı çizilen metin yok. Metin modunda bir paragrafa çift tıklayarak veya metin seçip vurgulayabilirsiniz.
                </p>
              ) : (
                highlights.map((hl) => (
                  <div
                    key={hl.id}
                    style={{
                      padding: 10,
                      borderRadius: 10,
                      border: `1px solid ${theme.borderColor}`,
                      backgroundColor: theme.backgroundColor,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: hl.colorHex }} />
                      <button
                        onClick={() => {
                          setActiveModal(null);
                          goToPage(hl.pageIndex);
                        }}
                        style={{ background: 'transparent', border: 'none', color: theme.secondaryTextColor, fontWeight: 700, fontSize: 11.5, cursor: 'pointer', flex: 1, textAlign: 'left' }}
                      >
                        Sayfa {hl.pageIndex + 1}
                      </button>
                      <button
                        onClick={() => {
                          navigator.clipboard?.writeText(hl.selectedText);
                          showToast('Metin kopyalandı');
                        }}
                        style={{ background: 'transparent', border: 'none', color: theme.secondaryTextColor, cursor: 'pointer' }}
                      >
                        <Copy size={15} />
                      </button>
                      <button
                        onClick={() => setHighlights((prev) => prev.filter((x) => x.id !== hl.id))}
                        style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <div style={{ fontSize: 12.5, fontFamily: fontObj.css }}>{hl.selectedText}</div>
                  </div>
                ))
              ))}

            {bookmarksTab === 2 &&
              (stickyNotes.length === 0 ? (
                <p style={{ fontSize: 12.5, color: theme.secondaryTextColor }}>
                  Henüz not eklenmedi. Alt çubuktaki «Not Ekle» düğmesinden notlarınızı kaydedebilirsiniz.
                </p>
              ) : (
                stickyNotes.map((note) => (
                  <div
                    key={note.id}
                    style={{
                      padding: 10,
                      borderRadius: 10,
                      border: `1px solid ${theme.borderColor}`,
                      backgroundColor: theme.backgroundColor,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <button
                        onClick={() => {
                          setActiveModal(null);
                          goToPage(note.pageIndex);
                        }}
                        style={{ background: 'transparent', border: 'none', color: ribbonObj.hex, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}
                      >
                        📌 Sayfa {note.pageIndex + 1}
                      </button>
                      <button
                        onClick={() => setStickyNotes((prev) => prev.filter((x) => x.id !== note.id))}
                        style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{note.noteTitle}</div>
                    <div style={{ fontSize: 12, color: theme.secondaryTextColor }}>{note.noteContent}</div>
                  </div>
                ))
              ))}
          </div>
        </ReaderModal>
      )}

      {activeModal === 'search' && (
        <ReaderModal title="Kitap İçi Arama" theme={theme} onClose={() => setActiveModal(null)}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Aranacak kelime veya kavram..."
            autoFocus
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: 10,
              border: `1px solid ${theme.borderColor}`,
              backgroundColor: theme.backgroundColor,
              color: theme.textColor,
              fontSize: 14,
            }}
          />
          {searchMatches.length > 0 ? (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 12.5, color: theme.secondaryTextColor }}>
                  {currentMatchIdx + 1} / {searchMatches.length} sayfa eşleşmesi
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    disabled={currentMatchIdx <= 0}
                    onClick={() => {
                      const next = currentMatchIdx - 1;
                      setCurrentMatchIdx(next);
                      goToPage(searchMatches[next]);
                    }}
                    style={chipStyle(theme, false)}
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button
                    disabled={currentMatchIdx >= searchMatches.length - 1}
                    onClick={() => {
                      const next = currentMatchIdx + 1;
                      setCurrentMatchIdx(next);
                      goToPage(searchMatches[next]);
                    }}
                    style={chipStyle(theme, false)}
                  >
                    <ChevronDown size={16} />
                  </button>
                </div>
              </div>
              <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {searchMatches.slice(0, 40).map((pIdx, idx) => (
                  <button
                    key={pIdx}
                    onClick={() => {
                      setCurrentMatchIdx(idx);
                      goToPage(pIdx);
                      setActiveModal(null);
                    }}
                    style={{
                      textAlign: 'left',
                      padding: '8px 10px',
                      borderRadius: 8,
                      border: `1px solid ${theme.borderColor}`,
                      backgroundColor: idx === currentMatchIdx ? `${ribbonObj.hex}22` : theme.backgroundColor,
                      color: theme.textColor,
                      cursor: 'pointer',
                      fontSize: 12.5,
                    }}
                  >
                    <strong>Sayfa {pIdx + 1}:</strong>{' '}
                    {(bookData.pages[pIdx] || '').replace(/^#+\s*/gm, '').slice(0, 110)}...
                  </button>
                ))}
              </div>
            </div>
          ) : searchQuery.trim().length >= 2 ? (
            <p style={{ marginTop: 12, fontSize: 12.5, color: theme.secondaryTextColor }}>Eşleşme bulunamadı.</p>
          ) : null}
        </ReaderModal>
      )}

      {activeModal === 'highlight' && (
        <ReaderModal title="Vurgula & Altını Çiz" theme={theme} onClose={() => setActiveModal(null)}>
          <p style={{ fontSize: 12.5, fontStyle: 'italic', color: theme.secondaryTextColor, marginBottom: 14 }}>
            «{selectedTextForHighlight.slice(0, 140)}...»
          </p>
          <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>Fosforlu Kalem Rengi:</div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            {HIGHLIGHT_COLORS.map((hc) => (
              <button
                key={hc.id}
                title={hc.title}
                onClick={() => {
                  setHighlights((prev) => [
                    ...prev,
                    {
                      id: `hl_${Date.now()}`,
                      pageIndex: currentPage,
                      selectedText: selectedTextForHighlight,
                      colorHex: hc.hex,
                      style: 'HIGHLIGHT',
                    },
                  ]);
                  setActiveModal(null);
                  showToast(`${hc.title} ile vurgulandı`);
                }}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  backgroundColor: hc.hex,
                  border: '1px solid rgba(0,0,0,0.2)',
                  cursor: 'pointer',
                }}
              />
            ))}
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>Çizgi Stili:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {HIGHLIGHT_STYLES.map((hs) => (
              <button
                key={hs.id}
                onClick={() => {
                  setHighlights((prev) => [
                    ...prev,
                    {
                      id: `hl_${Date.now()}`,
                      pageIndex: currentPage,
                      selectedText: selectedTextForHighlight,
                      colorHex: '#FFD54F',
                      style: hs.id,
                    },
                  ]);
                  setActiveModal(null);
                  showToast(`${hs.title} uygulandı`);
                }}
                style={chipStyle(theme, false)}
              >
                {hs.title}
              </button>
            ))}
          </div>
        </ReaderModal>
      )}

      {activeModal === 'addNote' && (
        <ReaderModal title={`Sayfa ${currentPage + 1}'e Not Ekle`} theme={theme} onClose={() => setActiveModal(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input
              type="text"
              placeholder="Not Başlığı"
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              style={{
                padding: '9px 12px',
                borderRadius: 8,
                border: `1px solid ${theme.borderColor}`,
                backgroundColor: theme.backgroundColor,
                color: theme.textColor,
              }}
            />
            <textarea
              rows={3}
              placeholder="Düşünceleriniz veya şerh..."
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              style={{
                padding: '9px 12px',
                borderRadius: 8,
                border: `1px solid ${theme.borderColor}`,
                backgroundColor: theme.backgroundColor,
                color: theme.textColor,
                resize: 'vertical',
              }}
            />
            <button
              onClick={() => {
                if (!noteContent.trim()) return;
                setStickyNotes((prev) => [
                  ...prev,
                  {
                    id: `note_${Date.now()}`,
                    pageIndex: currentPage,
                    noteTitle: noteTitle.trim() || 'Not',
                    noteContent: noteContent.trim(),
                  },
                ]);
                setNoteTitle('');
                setNoteContent('');
                setActiveModal(null);
                showToast('Not kaydedildi');
              }}
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                border: 'none',
                backgroundColor: ribbonObj.hex,
                color: '#fff',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Kaydet
            </button>
          </div>
        </ReaderModal>
      )}

      {activeModal === 'jumpPage' && (
        <ReaderModal title="Sayfaya Git" theme={theme} onClose={() => setActiveModal(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const num = parseInt(jumpPageInput, 10);
              if (!Number.isNaN(num) && num >= 1 && num <= totalPages) {
                setActiveModal(null);
                goToPage(num - 1);
              }
            }}
            style={{ display: 'flex', gap: 8 }}
          >
            <input
              type="number"
              min={1}
              max={totalPages}
              value={jumpPageInput}
              onChange={(e) => setJumpPageInput(e.target.value)}
              autoFocus
              style={{
                flex: 1,
                padding: '9px 12px',
                borderRadius: 8,
                border: `1px solid ${theme.borderColor}`,
                backgroundColor: theme.backgroundColor,
                color: theme.textColor,
              }}
            />
            <button
              type="submit"
              style={{
                padding: '9px 16px',
                borderRadius: 8,
                border: 'none',
                backgroundColor: ribbonObj.hex,
                color: '#fff',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Git
            </button>
          </form>
        </ReaderModal>
      )}
    </div>
  );
}

function ToolbarBtn({ theme, title, onClick, active, activeColor, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: 'transparent',
        border: 'none',
        color: active ? activeColor : theme.textColor,
        cursor: 'pointer',
        padding: 6,
        borderRadius: 8,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </button>
  );
}

function ReaderModal({ title, theme, onClose, children }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        zIndex: 80,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 460,
          backgroundColor: theme.surfaceColor,
          color: theme.textColor,
          border: `1px solid ${theme.borderColor}`,
          borderRadius: 16,
          padding: 20,
          boxShadow: '0 24px 60px rgba(0,0,0,0.45)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <h3 style={{ fontWeight: 700, fontSize: 16 }}>{title}</h3>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: theme.secondaryTextColor, cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function chipStyle(theme, selected, accent = '#FFB300') {
  return {
    padding: '6px 11px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    backgroundColor: selected ? `${accent}26` : theme.backgroundColor,
    color: selected ? accent : theme.textColor,
    border: selected ? `1.5px solid ${accent}` : `1px solid ${theme.borderColor}`,
  };
}
