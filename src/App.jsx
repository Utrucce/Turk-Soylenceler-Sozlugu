import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Compass,
  Download,
  Feather,
  Palette,
  RefreshCw,
  Search,
  Sparkles,
  Trophy,
  Zap,
} from 'lucide-react';
import UtrucceReader from './components/UtrucceReader';
import ConceptSearch from './components/ConceptSearch';
import MythQuiz from './components/MythQuiz';
import LightningOverlay from './components/LightningOverlay';
import { matchesSearchQuery } from './utils/turkish';

const PDF_URL = 'docs/Turk-Soylenceler-Sozlugu-Deniz-Karakurt.pdf';
const PDF_DOWNLOAD_NAME = 'Türk Söylenceler Sözlüğü - Deniz Karakurt.pdf';

export default function App() {
  const [view, setView] = useState('home'); // 'home' | 'reader' | 'search' | 'quiz'
  const [concepts, setConcepts] = useState([]);
  const [bookData, setBookData] = useState(null);
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [loadingMap, setLoadingMap] = useState({ concepts: true, book: false, quiz: false });

  // Deep-link states
  const [readerInitialPage, setReaderInitialPage] = useState(null);
  const [searchInitialQuery, setSearchInitialQuery] = useState('');
  const [searchInitialConcept, setSearchInitialConcept] = useState(null);

  // Hero Search & Featured Concept
  const [heroQuery, setHeroQuery] = useState('');
  const [featuredIdx, setFeaturedIdx] = useState(0);
  const [lightningEnabled, setLightningEnabled] = useState(true);

  // Load concepts immediately, then preload book & quiz in background
  useEffect(() => {
    let alive = true;
    fetch('data/concepts.json')
      .then((r) => r.json())
      .then((data) => {
        if (!alive) return;
        setConcepts(data);
        setLoadingMap((m) => ({ ...m, concepts: false }));
        if (data.length > 0) {
          const daySeed = new Date().getDate() + new Date().getMonth() * 31;
          setFeaturedIdx(daySeed % data.length);
        }
      })
      .catch(() => {
        if (alive) setLoadingMap((m) => ({ ...m, concepts: false }));
      });

    // Preload book & quiz quietly
    setLoadingMap((m) => ({ ...m, book: true, quiz: true }));
    fetch('data/book.json')
      .then((r) => r.json())
      .then((data) => {
        if (alive) {
          setBookData(data);
          setLoadingMap((m) => ({ ...m, book: false }));
        }
      })
      .catch(() => {
        if (alive) setLoadingMap((m) => ({ ...m, book: false }));
      });

    fetch('data/quiz.json')
      .then((r) => r.json())
      .then((data) => {
        if (alive) {
          setQuizQuestions(data);
          setLoadingMap((m) => ({ ...m, quiz: false }));
        }
      })
      .catch(() => {
        if (alive) setLoadingMap((m) => ({ ...m, quiz: false }));
      });

    return () => {
      alive = false;
    };
  }, []);

  const heroSuggestions = useMemo(() => {
    const q = heroQuery.trim();
    if (q.length < 2) return [];
    return concepts.filter((c) => matchesSearchQuery(`${c.title} ${c.shortDef}`, q)).slice(0, 6);
  }, [heroQuery, concepts]);

  const featuredConcept = concepts[featuredIdx] || null;

  const openReaderAtPage = (pageIdx = null) => {
    setReaderInitialPage(pageIdx);
    setView('reader');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openConceptSearch = (q = '', conceptObj = null) => {
    setSearchInitialQuery(q);
    setSearchInitialConcept(conceptObj);
    setView('search');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Fullscreen Utrucce Reader Mode
  if (view === 'reader') {
    if (!bookData) {
      return (
        <>
          <div className="myth-backdrop" style={{ backgroundImage: "url('images/turk-mitolojisi-bg.jpg')" }} />
          <div className="app-layer" style={{ alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div className="glass-panel-gold" style={{ borderRadius: 20, padding: 32, textAlign: 'center', maxWidth: 420 }}>
              <BookOpen size={40} color="var(--gold-bright)" style={{ marginBottom: 12 }} />
              <h2 className="font-display" style={{ fontSize: 20, color: 'var(--gold-bright)' }}>
                Kitap Hazırlanıyor...
              </h2>
              <p style={{ fontSize: 13.5, color: 'var(--text-muted)', marginTop: 8 }}>
                Türk Söylenceler Sözlüğü (907 sayfa) yükleniyor.
              </p>
            </div>
          </div>
        </>
      );
    }
    return (
      <UtrucceReader
        bookData={bookData}
        initialPage={readerInitialPage}
        onBack={() => {
          setReaderInitialPage(null);
          setView('home');
        }}
      />
    );
  }

  return (
    <>
      <div className="myth-backdrop" style={{ backgroundImage: "url('images/turk-mitolojisi-bg.jpg')" }} />
      {view === 'home' && <LightningOverlay enabled={lightningEnabled} />}
      <div className="app-layer">
        {/* ==================== NAVBAR ==================== */}
        <header
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 35,
            backgroundColor: 'rgba(7, 11, 18, 0.78)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderBottom: '1px solid rgba(229, 184, 92, 0.2)',
          }}
        >
          <div
            style={{
              maxWidth: 1220,
              margin: '0 auto',
              padding: '12px 20px',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <button
              onClick={() => setView('home')}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-main)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                textAlign: 'left',
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 11,
                  background: 'linear-gradient(135deg, rgba(229,184,92,0.28), rgba(45,212,191,0.2))',
                  border: '1px solid rgba(229,184,92,0.45)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--gold-bright)',
                  fontWeight: 800,
                }}
              >
                <BookOpen size={20} />
              </div>
              <div>
                <div className="font-display" style={{ fontSize: 16.5, fontWeight: 700, color: 'var(--gold-bright)' }}>
                  Türk Söylenceler Sözlüğü
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Deniz Karakurt • Türk Mitoloji Ansiklopedisi</div>
              </div>
            </button>

            <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <NavButton active={view === 'home'} onClick={() => setView('home')}>
                Ana Sayfa
              </NavButton>
              <NavButton active={view === 'reader'} onClick={() => openReaderAtPage(null)}>
                <BookOpen size={15} /> Kitabı Oku
              </NavButton>
              <NavButton active={view === 'search'} onClick={() => openConceptSearch('', null)}>
                <Search size={15} /> Kavram Arama
              </NavButton>
              <NavButton active={view === 'quiz'} onClick={() => setView('quiz')}>
                <Trophy size={15} /> Bilgi Yarışması
              </NavButton>
              <a
                href={PDF_URL}
                download={PDF_DOWNLOAD_NAME}
                style={{
                  padding: '8px 14px',
                  borderRadius: 10,
                  border: '1px solid rgba(45, 212, 191, 0.4)',
                  backgroundColor: 'rgba(45, 212, 191, 0.12)',
                  color: 'var(--turquoise)',
                  fontWeight: 700,
                  fontSize: 13,
                  textDecoration: 'none',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Download size={15} /> Belgeyi İndir
              </a>
            </nav>
          </div>
        </header>

        {/* ==================== MAIN CONTENT ==================== */}
        <main style={{ flex: 1 }}>
          {view === 'home' && (
            <div style={{ maxWidth: 1200, margin: '0 auto', padding: '42px 20px 64px' }}>
              {/* HERO */}
              <div style={{ textAlign: 'center', maxWidth: 820, margin: '0 auto 40px' }}>
                <div
                  style={{
                    display: 'inline-flex',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                    gap: 10,
                    marginBottom: 18,
                  }}
                >
                  <span
                    style={{
                      padding: '5px 13px',
                      borderRadius: 99,
                      backgroundColor: 'rgba(229, 184, 92, 0.16)',
                      border: '1px solid rgba(229, 184, 92, 0.42)',
                      color: 'var(--gold-bright)',
                      fontSize: 12,
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Feather size={13} /> Yazar: Deniz Karakurt
                  </span>
                  <span
                    style={{
                      padding: '5px 13px',
                      borderRadius: 99,
                      backgroundColor: 'rgba(45, 212, 191, 0.14)',
                      border: '1px solid rgba(45, 212, 191, 0.38)',
                      color: 'var(--turquoise)',
                      fontSize: 12,
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Palette size={13} /> Site Tasarımcısı: Sertan Çubukcu
                  </span>
                </div>

                <h1
                  className="font-display"
                  style={{
                    fontSize: 'clamp(2rem, 5vw, 3.6rem)',
                    lineHeight: 1.12,
                    fontWeight: 800,
                    color: '#fff9ea',
                    textShadow: '0 6px 28px rgba(0, 0, 0, 0.75)',
                    marginBottom: 16,
                  }}
                >
                  Türk Söylenceler Sözlüğü
                </h1>

                <p
                  style={{
                    fontSize: 'clamp(1rem, 1.8vw, 1.18rem)',
                    lineHeight: 1.65,
                    color: 'rgba(243, 240, 230, 0.9)',
                    textShadow: '0 2px 12px rgba(0,0,0,0.8)',
                    marginBottom: 24,
                  }}
                >
                  Kadim Türk mitolojisinin 907 sayfalık dev ansiklopedisini doğrudan tarayıcınızdan okuyun veya
                  indirin, yüzlerce mitolojik kavramı anında arayın ve{' '}
                  <strong>{quizQuestions.length > 0 ? quizQuestions.length.toLocaleString('tr-TR') : '3.868'}</strong>{' '}
                  soruluk dört şıklı bilgi yarışmasıyla bilginizi sınayın.
                </p>

                {/* HERO ACTION BUTTONS */}
                <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 26 }}>
                  <button
                    onClick={() => openReaderAtPage(null)}
                    style={{
                      padding: '12px 24px',
                      borderRadius: 14,
                      border: 'none',
                      background: 'linear-gradient(135deg, #e5b85c, #c99432)',
                      color: '#0a0f17',
                      fontWeight: 800,
                      fontSize: 14.5,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      boxShadow: '0 10px 26px rgba(229, 184, 92, 0.3)',
                    }}
                  >
                    <BookOpen size={18} /> Kitabı Oku
                  </button>
                  <a
                    href={PDF_URL}
                    download={PDF_DOWNLOAD_NAME}
                    style={{
                      padding: '12px 22px',
                      borderRadius: 14,
                      border: '1.5px solid rgba(45, 212, 191, 0.5)',
                      backgroundColor: 'rgba(7, 15, 22, 0.78)',
                      color: 'var(--turquoise)',
                      fontWeight: 700,
                      fontSize: 14.5,
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <Download size={18} /> Belgeyi İndir (PDF)
                  </a>
                </div>

                {/* HERO SEARCH BAR */}
                <div style={{ position: 'relative', maxWidth: 660, margin: '0 auto 22px' }}>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      openConceptSearch(heroQuery, null);
                    }}
                    style={{ position: 'relative' }}
                  >
                    <Search
                      size={20}
                      style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', color: 'var(--gold)' }}
                    />
                    <input
                      type="text"
                      value={heroQuery}
                      onChange={(e) => setHeroQuery(e.target.value)}
                      placeholder="Mitolojik kavram ara... (Örn: Ülgen, Umay, Erlik, Bozkurt, Ulukayın)"
                      style={{
                        width: '100%',
                        padding: '16px 125px 16px 48px',
                        borderRadius: 16,
                        border: '1.5px solid rgba(229, 184, 92, 0.45)',
                        backgroundColor: 'rgba(7, 11, 19, 0.86)',
                        backdropFilter: 'blur(16px)',
                        color: 'var(--text-main)',
                        fontSize: 15,
                        outline: 'none',
                        boxShadow: '0 18px 40px rgba(0, 0, 0, 0.48)',
                      }}
                    />
                    <button
                      type="submit"
                      style={{
                        position: 'absolute',
                        right: 7,
                        top: 7,
                        bottom: 7,
                        padding: '0 20px',
                        borderRadius: 11,
                        border: 'none',
                        background: 'linear-gradient(135deg, #e5b85c, #c99432)',
                        color: '#0a0f17',
                        fontWeight: 800,
                        fontSize: 13.5,
                        cursor: 'pointer',
                      }}
                    >
                      Kavram Ara
                    </button>
                  </form>

                  {/* Live Hero Suggestions Dropdown */}
                  {heroSuggestions.length > 0 && (
                    <div
                      className="glass-panel-gold"
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 8px)',
                        left: 0,
                        right: 0,
                        borderRadius: 16,
                        overflow: 'hidden',
                        zIndex: 30,
                        textAlign: 'left',
                      }}
                    >
                      {heroSuggestions.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => {
                            setHeroQuery('');
                            openConceptSearch(c.title, c);
                          }}
                          style={{
                            width: '100%',
                            padding: '11px 16px',
                            background: 'transparent',
                            border: 'none',
                            borderBottom: '1px solid rgba(255,255,255,0.07)',
                            color: 'var(--text-main)',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 12,
                            textAlign: 'left',
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--gold-bright)', fontSize: 14 }}>{c.title}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.shortDef.slice(0, 95)}...</div>
                          </div>
                          <span style={{ fontSize: 11, color: 'var(--turquoise)', whiteSpace: 'nowrap' }}>s. {c.page}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quick Hero Stats */}
                <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 18, fontSize: 13, color: 'var(--text-muted)' }}>
                  <span>📜 <strong style={{ color: 'var(--gold-bright)' }}>907</strong> Tam Kitap Sayfası</span>
                  <span>•</span>
                  <span>🧭 <strong style={{ color: 'var(--turquoise)' }}>{concepts.length || 874}</strong> Ansiklopedik Kavram</span>
                  <span>•</span>
                  <span>🏆 <strong style={{ color: '#fdba74' }}>{quizQuestions.length ? quizQuestions.length.toLocaleString('tr-TR') : '3.868'}</strong> Dört Şıklı Soru</span>
                </div>
              </div>

              {/* 3 MAIN FEATURE PORTAL CARDS */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
                  gap: 20,
                  marginBottom: 32,
                }}
              >
                <PortalCard
                  icon={<BookOpen size={26} />}
                  badge="Tam Eser • 907 Sayfa"
                  title="Kitabı Oku"
                  desc="Deniz Karakurt'un orijinal Türk Söylenceler Sözlüğü belgesini sayfaları çevirerek okuyun; 7 tema, ipek ayraç, not alma, kitap içi arama ve tek tıkla PDF indirme."
                  cta="Kitabı Okumaya Başla"
                  accent="var(--gold-bright)"
                  onClick={() => openReaderAtPage(null)}
                />

                <PortalCard
                  icon={<Compass size={26} />}
                  badge="Anlık Sözlük"
                  title="Kavram Arama & Ansiklopedi"
                  desc="874 mitolojik maddeyi Türkçe harf uyumlu arama, harf fihristi, kategori filtreleri, etimoloji ve Azerice karşılıklarıyla keşfedin."
                  cta="Kavramları Keşfet"
                  accent="var(--turquoise)"
                  onClick={() => openConceptSearch('', null)}
                />

                <PortalCard
                  icon={<Trophy size={26} />}
                  badge="Binlerce Soru"
                  title="Mitoloji Bilgi Yarışması"
                  desc="Kitabın sayfalarından ve etimolojilerinden üretilmiş 3.868 adet dört şıklı soru, %50 & Kitap İpucu jokerleri ve seri puanlama."
                  cta="Yarışmaya Başla"
                  accent="#fdba74"
                  onClick={() => setView('quiz')}
                />
              </div>

              {/* FEATURED CONCEPT + ABOUT GRID */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
                {/* Günün Söylencesi */}
                {featuredConcept && (
                  <div className="glass-panel-gold" style={{ borderRadius: 20, padding: '24px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 14 }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--turquoise)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          <Sparkles size={14} /> Rastgele Söylence Keşfi
                        </span>
                        <button
                          onClick={() => setFeaturedIdx(Math.floor(Math.random() * concepts.length))}
                          style={{
                            background: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.14)',
                            color: 'var(--text-muted)',
                            borderRadius: 8,
                            padding: '4px 9px',
                            fontSize: 11.5,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                          }}
                        >
                          <RefreshCw size={12} /> Değiştir
                        </button>
                      </div>

                      <h3 className="font-display" style={{ fontSize: 24, color: 'var(--gold-bright)', marginBottom: 6 }}>
                        {featuredConcept.title}
                      </h3>
                      <p style={{ fontSize: 14, lineHeight: 1.65, color: 'rgba(243,240,230,0.88)' }}>
                        {featuredConcept.shortDef}
                      </p>
                    </div>

                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <button
                        onClick={() => openConceptSearch(featuredConcept.title, featuredConcept)}
                        style={{
                          padding: '8px 14px',
                          borderRadius: 10,
                          border: '1px solid rgba(229,184,92,0.45)',
                          backgroundColor: 'rgba(229,184,92,0.14)',
                          color: 'var(--gold-bright)',
                          fontWeight: 700,
                          fontSize: 12.5,
                          cursor: 'pointer',
                        }}
                      >
                        Maddeyi İncele
                      </button>
                      <button
                        onClick={() => openReaderAtPage(Math.max(0, (featuredConcept.page || 1) - 1))}
                        style={{
                          padding: '8px 14px',
                          borderRadius: 10,
                          border: '1px solid rgba(45,212,191,0.4)',
                          backgroundColor: 'rgba(45,212,191,0.12)',
                          color: 'var(--turquoise)',
                          fontWeight: 700,
                          fontSize: 12.5,
                          cursor: 'pointer',
                        }}
                      >
                        Kitapta Oku (Sayfa {featuredConcept.page})
                      </button>
                    </div>
                  </div>
                )}

                {/* Künye & Tasarım Kartı */}
                <div className="glass-panel" style={{ borderRadius: 20, padding: '24px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                      Eser & Künye Bilgisi
                    </div>
                    <h3 className="font-display" style={{ fontSize: 21, color: '#fff9ea', marginBottom: 10 }}>
                      Türk Mitoloji Ansiklopedisi
                    </h3>
                    <p style={{ fontSize: 13.5, lineHeight: 1.7, color: 'var(--text-muted)' }}>
                      <strong style={{ color: 'var(--text-main)' }}>Yazar:</strong> Deniz Karakurt (2012, Elektronik dağıtımı serbest e-Kitap sürümü).
                      <br />
                      <strong style={{ color: 'var(--text-main)' }}>Site Tasarımcısı:</strong> Sertan Çubukcu
                    </p>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 12 }}>
                    <span style={{ fontSize: 12, color: 'rgba(229, 184, 92, 0.85)' }}>
                      “Kaynak göstermek kaydıyla her tür alıntı yapılabilir.”
                    </span>
                    <a
                      href={PDF_URL}
                      download={PDF_DOWNLOAD_NAME}
                      style={{
                        padding: '7px 13px',
                        borderRadius: 9,
                        backgroundColor: 'rgba(45, 212, 191, 0.14)',
                        border: '1px solid rgba(45, 212, 191, 0.4)',
                        color: 'var(--turquoise)',
                        fontSize: 12,
                        fontWeight: 700,
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <Download size={14} /> Belgeyi İndir (PDF)
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          {view === 'search' && (
            <ConceptSearch
              concepts={concepts}
              initialQuery={searchInitialQuery}
              initialConcept={searchInitialConcept}
              onOpenInReader={(pIdx) => openReaderAtPage(pIdx)}
            />
          )}

          {view === 'quiz' && (
            <MythQuiz
              questions={quizQuestions}
              onOpenInReader={(pIdx) => openReaderAtPage(pIdx)}
            />
          )}
        </main>

        {/* ==================== FOOTER ==================== */}
        <footer
          style={{
            borderTop: '1px solid rgba(255,255,255,0.09)',
            backgroundColor: 'rgba(6, 10, 17, 0.86)',
            padding: '18px 20px',
            textAlign: 'center',
            fontSize: 12.5,
            color: 'var(--text-muted)',
          }}
        >
          <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 12 }}>
            <span>
              Eser & Yazar: <strong style={{ color: 'var(--gold-bright)' }}>Türk Söylenceler Sözlüğü — Deniz Karakurt</strong>
            </span>
            <span>•</span>
            <span>
              Site Tasarımcısı: <strong style={{ color: 'var(--turquoise)' }}>Sertan Çubukcu</strong>
            </span>
            {view === 'home' && (
              <>
                <span>•</span>
                <button
                  onClick={() => setLightningEnabled((v) => !v)}
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.14)',
                    color: lightningEnabled ? 'var(--turquoise)' : 'var(--text-muted)',
                    borderRadius: 99,
                    padding: '3px 10px',
                    fontSize: 11.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Zap size={12} /> Şimşek Efekti: {lightningEnabled ? 'Açık' : 'Kapalı'}
                </button>
              </>
            )}
          </div>
        </footer>
      </div>
    </>
  );
}

function NavButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 14px',
        borderRadius: 10,
        border: active ? '1px solid rgba(229, 184, 92, 0.5)' : '1px solid transparent',
        backgroundColor: active ? 'rgba(229, 184, 92, 0.16)' : 'transparent',
        color: active ? 'var(--gold-bright)' : 'var(--text-muted)',
        fontWeight: 700,
        fontSize: 13,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {children}
    </button>
  );
}

function PortalCard({ icon, badge, title, desc, cta, accent, onClick }) {
  return (
    <div
      onClick={onClick}
      className="glass-panel-gold"
      style={{
        borderRadius: 20,
        padding: 24,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: 16,
        transition: 'transform 0.2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-4px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 14,
              backgroundColor: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: accent,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {icon}
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: accent, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {badge}
          </span>
        </div>

        <h3 className="font-display" style={{ fontSize: 21, color: '#fff9ea', marginBottom: 8 }}>
          {title}
        </h3>
        <p style={{ fontSize: 13.5, lineHeight: 1.65, color: 'var(--text-muted)' }}>{desc}</p>
      </div>

      <div style={{ fontSize: 13.5, fontWeight: 800, color: accent }}>{cta} →</div>
    </div>
  );
}
