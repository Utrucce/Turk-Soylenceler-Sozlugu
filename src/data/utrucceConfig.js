// Exact port of UtrucceBookModels.kt from İslam Vakti

export const READER_THEMES = {
  DAY: {
    id: 'DAY',
    title: 'Gündüz / Kağıt',
    backgroundColor: '#FBF9F5',
    textColor: '#1A1A1A',
    secondaryTextColor: '#6B655B',
    surfaceColor: '#F2EFE8',
    borderColor: '#DDD7CC',
    icon: '☀️',
  },
  SEPIA: {
    id: 'SEPIA',
    title: 'Sepya / Parşömen',
    backgroundColor: '#F4ECD8',
    textColor: '#3E3120',
    secondaryTextColor: '#7A6A53',
    surfaceColor: '#E8DDC4',
    borderColor: '#D8C7A5',
    icon: '📜',
  },
  NIGHT: {
    id: 'NIGHT',
    title: 'Gece / Koyu',
    backgroundColor: '#181A1D',
    textColor: '#E2E4E9',
    secondaryTextColor: '#8F96A3',
    surfaceColor: '#22262C',
    borderColor: '#2E333B',
    icon: '🌙',
  },
  OLED: {
    id: 'OLED',
    title: 'OLED Siyahı',
    backgroundColor: '#000000',
    textColor: '#D5D5D5',
    secondaryTextColor: '#777777',
    surfaceColor: '#121212',
    borderColor: '#222222',
    icon: '🖤',
  },
  MINT: {
    id: 'MINT',
    title: 'Huzur Yeşili / Adaçayı',
    backgroundColor: '#E9F3EC',
    textColor: '#1D3B27',
    secondaryTextColor: '#52755D',
    surfaceColor: '#DBEADB',
    borderColor: '#C3D8C3',
    icon: '🍵',
  },
  SUNSET: {
    id: 'SUNSET',
    title: 'Gül Kurusu / Mavi Işık',
    backgroundColor: '#F9EFE9',
    textColor: '#3E2723',
    secondaryTextColor: '#7A584F',
    surfaceColor: '#F1DFD5',
    borderColor: '#DFCCC1',
    icon: '🌅',
  },
  EMERALD: {
    id: 'EMERALD',
    title: 'Zümrüt İslami',
    backgroundColor: '#091F18',
    textColor: '#E4F3EC',
    secondaryTextColor: '#85B69E',
    surfaceColor: '#0F2E24',
    borderColor: '#1B4D3D',
    icon: '💎',
  },
};

export const PAGE_ANIMATION_MODES = [
  {
    id: 'CURL_3D',
    title: 'Üç Boyutlu Sayfa Kıvrılma',
    description: 'Gerçekçi kitap sayfası çevirme ve gölge efekti',
  },
  {
    id: 'SLIDE_PAGER',
    title: 'Yatay Kaydırma',
    description: 'Akıcı yatay sayfa geçişleri',
  },
  {
    id: 'FADE_FLOW',
    title: 'Süzülme / Geçiş',
    description: 'Yumuşak şeffaflık ile zarif geçiş',
  },
  {
    id: 'VERTICAL_SCROLL',
    title: 'Sürekli Akış',
    description: 'Aşağı doğru kesintisiz akıcı okuma',
  },
];

export const HIGHLIGHT_COLORS = [
  { id: 'YELLOW', title: 'Sarı Güneş', hex: '#FFEB3B' },
  { id: 'GREEN', title: 'Zümrüt Yeşili', hex: '#81C784' },
  { id: 'BLUE', title: 'Göktürk Mavisi', hex: '#64B5F6' },
  { id: 'PINK', title: 'Gül Pembesi', hex: '#F06292' },
  { id: 'ORANGE', title: 'Sıcak Kehribar', hex: '#FFB74D' },
  { id: 'GOLD', title: 'Asil Altın', hex: '#FFD54F' },
];

export const HIGHLIGHT_STYLES = [
  { id: 'HIGHLIGHT', title: 'Dolu Fosforlu Kalem' },
  { id: 'UNDERLINE', title: 'Düz Altı Çizili' },
  { id: 'SQUIGGLY', title: 'Dalgalı Alt Çizgi' },
  { id: 'STRIKETHROUGH', title: 'Üstü Çizili' },
];

export const RIBBON_COLORS = [
  { id: 'CRIMSON', title: 'Lal Kırmızısı', hex: '#C2185B' },
  { id: 'EMERALD', title: 'Zümrüt Yeşili', hex: '#00796B' },
  { id: 'GOLD', title: 'Osmanlı Altını', hex: '#FFB300' },
  { id: 'SAPPHIRE', title: 'Safir Mavisi', hex: '#1976D2' },
  { id: 'PURPLE', title: 'Mistik Mor', hex: '#7B1FA2' },
];

export const READER_FONTS = [
  { id: 'SERIF', title: 'Klasik Kitap (Serif)', css: "'Crimson Pro', Georgia, Cambria, serif" },
  { id: 'SANS', title: 'Modern Düz (Sans-Serif)', css: "'Plus Jakarta Sans', system-ui, sans-serif" },
  { id: 'MONOSPACE', title: 'Daktilo (Monospace)', css: "ui-monospace, 'Cascadia Code', monospace" },
  { id: 'DEFAULT', title: 'Sistem Yazı Tipi', css: "system-ui, -apple-system, sans-serif" },
];

export const DEFAULT_READER_SETTINGS = {
  themeId: 'SEPIA',
  fontId: 'SERIF',
  fontSizePx: 17,
  lineHeightMultiplier: 1.6,
  marginHorizontalPx: 28,
  pageAnimation: 'CURL_3D',
  soundEnabled: true,
  soundVolume: 0.85,
  ribbonColorId: 'CRIMSON',
  isJustified: true,
};
