import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Award,
  BookOpen,
  CheckCircle2,
  Clock,
  Flame,
  HelpCircle,
  Lightbulb,
  Play,
  RotateCcw,
  Sparkles,
  Trophy,
  XCircle,
} from 'lucide-react';

const STATS_KEY = 'tss_quiz_stats_v1';

const QUIZ_CATEGORIES = [
  'Tümü',
  'Tanım & Kavram',
  'Mitolojik Varlıklar & İyeler',
  'Etimoloji & Köken',
  'Özellikler & Destan',
];

const DIFFICULTIES = ['Tümü', 'Kolay', 'Orta', 'Zor'];

const ROUND_LENGTHS = [
  { label: '10 Soru (Hızlı)', value: 10 },
  { label: '25 Soru (Klasik)', value: 25 },
  { label: '50 Soru (Destan)', value: 50 },
  { label: '100 Soru (Maraton)', value: 100 },
  { label: 'Tüm Havuz', value: 99999 },
];

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getRank(acc) {
  if (acc >= 90) return { title: 'Gök Bilgesi (Kam)', color: '#ffd982', desc: 'Türk söylence dünyasına tam hâkimiyet!' };
  if (acc >= 75) return { title: 'Ulu Ozan', color: '#5eead4', desc: 'Kadim mitoloji bilginiz göz kamaştırıyor.' };
  if (acc >= 55) return { title: 'Bozkurt Yolcusu', color: '#fdba74', desc: 'Söylenceler evreninde güçlü bir ilerleyiş!' };
  return { title: 'Söylence Çırağı', color: '#a5b4fc', desc: 'Kitaptan yeni kavramlar keşfederek ustalığa ulaşın.' };
}

export default function MythQuiz({ questions, onOpenInReader }) {
  const [phase, setPhase] = useState('lobby'); // 'lobby' | 'playing' | 'summary'
  const [selectedCategory, setSelectedCategory] = useState('Tümü');
  const [selectedDifficulty, setSelectedDifficulty] = useState('Tümü');
  const [roundLength, setRoundLength] = useState(25);
  const [timedMode, setTimedMode] = useState(false);

  const [stats, setStats] = useState(() => {
    try {
      const raw = localStorage.getItem(STATS_KEY);
      return raw ? JSON.parse(raw) : { bestScore: 0, totalAnswered: 0, totalCorrect: 0, gamesPlayed: 0 };
    } catch {
      return { bestScore: 0, totalAnswered: 0, totalCorrect: 0, gamesPlayed: 0 };
    }
  });

  // Active Game State
  const [deck, setDeck] = useState([]);
  const [qIndex, setQIndex] = useState(0);
  const [selectedOpt, setSelectedOpt] = useState(null);
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [eliminatedOpts, setEliminatedOpts] = useState([]);
  const [fiftyUsesLeft, setFiftyUsesLeft] = useState(3);
  const [hintUsesLeft, setHintUsesLeft] = useState(3);
  const [hintShown, setHintShown] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(30);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    try {
      localStorage.setItem(STATS_KEY, JSON.stringify(stats));
    } catch {
      // ignore
    }
  }, [stats]);

  const filteredPool = useMemo(() => {
    return questions.filter((q) => {
      if (selectedCategory !== 'Tümü' && q.category !== selectedCategory) return false;
      if (selectedDifficulty !== 'Tümü' && q.difficulty !== selectedDifficulty) return false;
      return true;
    });
  }, [questions, selectedCategory, selectedDifficulty]);

  const currentQ = deck[qIndex] || null;

  const startQuiz = () => {
    if (filteredPool.length === 0) return;
    const shuffled = shuffleArray(filteredPool).slice(0, Math.min(roundLength, filteredPool.length));
    setDeck(shuffled);
    setQIndex(0);
    setSelectedOpt(null);
    setScore(0);
    setCorrectCount(0);
    setStreak(0);
    setBestStreak(0);
    setEliminatedOpts([]);
    setFiftyUsesLeft(shuffled.length >= 50 ? 5 : 3);
    setHintUsesLeft(shuffled.length >= 50 ? 5 : 3);
    setHintShown(false);
    setSecondsLeft(30);
    setHistory([]);
    setPhase('playing');
  };

  const handleAnswer = useCallback(
    (optIdx) => {
      if (selectedOpt !== null || !currentQ) return;
      setSelectedOpt(optIdx);
      const isCorrect = optIdx === currentQ.correctIndex;
      if (isCorrect) {
        const nextStreak = streak + 1;
        const bonus = Math.min(nextStreak * 5, 50);
        const basePts = currentQ.difficulty === 'Zor' ? 150 : currentQ.difficulty === 'Orta' ? 120 : 100;
        setScore((s) => s + basePts + bonus);
        setCorrectCount((c) => c + 1);
        setStreak(nextStreak);
        setBestStreak((b) => Math.max(b, nextStreak));
      } else {
        setStreak(0);
      }
      setHistory((prev) => [
        ...prev,
        {
          question: currentQ,
          picked: optIdx,
          isCorrect,
        },
      ]);
    },
    [selectedOpt, currentQ, streak]
  );

  // Timer tick when timedMode is active
  useEffect(() => {
    if (phase !== 'playing' || !timedMode || selectedOpt !== null) return;
    if (secondsLeft <= 0) {
      handleAnswer(-1); // Timeout counts as unanswered/wrong
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [phase, timedMode, selectedOpt, secondsLeft, handleAnswer]);

  const finishGame = useCallback(
    (finalScore, finalCorrect, totalQ) => {
      setStats((prev) => ({
        bestScore: Math.max(prev.bestScore, finalScore),
        totalAnswered: prev.totalAnswered + totalQ,
        totalCorrect: prev.totalCorrect + finalCorrect,
        gamesPlayed: prev.gamesPlayed + 1,
      }));
      setPhase('summary');
    },
    []
  );

  const nextQuestion = useCallback(() => {
    if (qIndex + 1 >= deck.length) {
      finishGame(score, correctCount, deck.length);
    } else {
      setQIndex((i) => i + 1);
      setSelectedOpt(null);
      setEliminatedOpts([]);
      setHintShown(false);
      setSecondsLeft(30);
    }
  }, [qIndex, deck.length, finishGame, score, correctCount]);

  // Keyboard shortcuts during quiz (1-4 or A-D, Enter for next)
  useEffect(() => {
    if (phase !== 'playing') return;
    const onKey = (e) => {
      if (selectedOpt === null) {
        const keyMap = { '1': 0, '2': 1, '3': 2, '4': 3, a: 0, b: 1, c: 2, d: 3, A: 0, B: 1, C: 2, D: 3 };
        if (e.key in keyMap) {
          const idx = keyMap[e.key];
          if (!eliminatedOpts.includes(idx)) handleAnswer(idx);
        }
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        nextQuestion();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, selectedOpt, eliminatedOpts, handleAnswer, nextQuestion]);

  const useFiftyFifty = () => {
    if (fiftyUsesLeft <= 0 || selectedOpt !== null || eliminatedOpts.length > 0 || !currentQ) return;
    const wrongIndices = [0, 1, 2, 3].filter((i) => i !== currentQ.correctIndex);
    const toRemove = shuffleArray(wrongIndices).slice(0, 2);
    setEliminatedOpts(toRemove);
    setFiftyUsesLeft((u) => u - 1);
  };

  const useHint = () => {
    if (hintUsesLeft <= 0 || hintShown || selectedOpt !== null || !currentQ) return;
    setHintShown(true);
    setHintUsesLeft((u) => u - 1);
  };

  // ==================== LOBBY ====================
  if (phase === 'lobby') {
    const overallAcc = stats.totalAnswered > 0 ? Math.round((stats.totalCorrect / stats.totalAnswered) * 100) : 0;

    return (
      <section style={{ maxWidth: 1020, width: '100%', margin: '0 auto', padding: '24px 20px 64px' }}>
        <div className="glass-panel-gold" style={{ borderRadius: 24, padding: '32px 28px' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 18, marginBottom: 24 }}>
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--gold)', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                <Trophy size={15} /> Mitoloji Bilgi Yarışması
              </div>
              <h2 className="font-display" style={{ fontSize: 'clamp(1.5rem, 3vw, 2.2rem)', color: 'var(--gold-bright)', marginTop: 4 }}>
                Türk Söylenceleri Bilge Sınavı
              </h2>
              <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 6, maxWidth: 620 }}>
                Deniz Karakurt’un <em>Türk Söylenceler Sözlüğü</em> eserinden özenle türetilmiş{' '}
                <strong style={{ color: 'var(--turquoise)' }}>{questions.length.toLocaleString('tr-TR')}</strong> adet
                dört şıklı özgün soruyla Türk mitolojisi bilginizi sınayın.
              </p>
            </div>

            {/* Personal Stats */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <StatPill label="En Yüksek Puan" value={stats.bestScore.toLocaleString('tr-TR')} color="var(--gold-bright)" />
              <StatPill label="Doğruluk" value={`%${overallAcc}`} color="var(--turquoise)" />
              <StatPill label="Çözülen" value={stats.totalAnswered.toLocaleString('tr-TR')} color="#f9a8d4" />
            </div>
          </div>

          <div className="orkhon-divider" style={{ marginBottom: 22 }} />

          {/* Config Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20, marginBottom: 26 }}>
            {/* Category */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--gold)', marginBottom: 10 }}>
                Soru Kategorisi
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {QUIZ_CATEGORIES.map((cat) => {
                  const active = selectedCategory === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      style={{
                        textAlign: 'left',
                        padding: '10px 14px',
                        borderRadius: 11,
                        fontSize: 13.5,
                        fontWeight: 600,
                        cursor: 'pointer',
                        backgroundColor: active ? 'rgba(229, 184, 92, 0.18)' : 'rgba(255,255,255,0.04)',
                        color: active ? 'var(--gold-bright)' : 'var(--text-muted)',
                        border: active ? '1px solid var(--gold)' : '1px solid rgba(255,255,255,0.08)',
                      }}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Difficulty & Length & Timer */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--gold)', marginBottom: 10 }}>
                  Zorluk Seviyesi
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                  {DIFFICULTIES.map((diff) => {
                    const active = selectedDifficulty === diff;
                    return (
                      <button
                        key={diff}
                        onClick={() => setSelectedDifficulty(diff)}
                        style={{
                          padding: '9px 12px',
                          borderRadius: 10,
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: 'pointer',
                          backgroundColor: active ? 'var(--turquoise-dim)' : 'rgba(255,255,255,0.04)',
                          color: active ? 'var(--turquoise)' : 'var(--text-muted)',
                          border: active ? '1px solid rgba(45,212,191,0.55)' : '1px solid rgba(255,255,255,0.08)',
                        }}
                      >
                        {diff}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--gold)', marginBottom: 10 }}>
                  Soru Sayısı
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {ROUND_LENGTHS.map((rl) => {
                    const active = roundLength === rl.value;
                    return (
                      <button
                        key={rl.value}
                        onClick={() => setRoundLength(rl.value)}
                        style={{
                          padding: '8px 12px',
                          borderRadius: 10,
                          fontSize: 12.5,
                          fontWeight: 600,
                          cursor: 'pointer',
                          backgroundColor: active ? 'rgba(229, 184, 92, 0.2)' : 'rgba(255,255,255,0.04)',
                          color: active ? 'var(--gold-bright)' : 'var(--text-muted)',
                          border: active ? '1px solid var(--gold)' : '1px solid rgba(255,255,255,0.08)',
                        }}
                      >
                        {rl.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13.5, color: 'var(--text-main)' }}>
                  <input
                    type="checkbox"
                    checked={timedMode}
                    onChange={(e) => setTimedMode(e.target.checked)}
                    style={{ width: 17, height: 17, accentColor: 'var(--gold)' }}
                  />
                  <Clock size={16} color="var(--gold)" />
                  Soru Başına 30 Saniye Süre Sınırı
                </label>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 14, paddingTop: 18, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ fontSize: 13.5, color: 'var(--text-muted)' }}>
              Seçili filtreye uygun{' '}
              <strong style={{ color: 'var(--gold-bright)' }}>{filteredPool.length.toLocaleString('tr-TR')}</strong> soru hazır.
            </div>
            <button
              onClick={startQuiz}
              disabled={filteredPool.length === 0}
              style={{
                padding: '13px 28px',
                borderRadius: 14,
                border: 'none',
                background: 'linear-gradient(135deg, #e5b85c, #c99432)',
                color: '#0a0f17',
                fontWeight: 800,
                fontSize: 15,
                cursor: filteredPool.length === 0 ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 9,
                boxShadow: '0 10px 28px rgba(229, 184, 92, 0.3)',
              }}
            >
              <Play size={18} fill="#0a0f17" /> Yarışmayı Başlat
            </button>
          </div>
        </div>
      </section>
    );
  }

  // ==================== SUMMARY ====================
  if (phase === 'summary') {
    const accuracy = deck.length > 0 ? Math.round((correctCount / deck.length) * 100) : 0;
    const rank = getRank(accuracy);

    return (
      <section style={{ maxWidth: 900, width: '100%', margin: '0 auto', padding: '24px 20px 64px' }}>
        <div className="glass-panel-gold" style={{ borderRadius: 24, padding: '32px 26px', textAlign: 'center' }}>
          <Award size={48} color={rank.color} style={{ margin: '0 auto 10px' }} />
          <div style={{ fontSize: 12, fontWeight: 700, color: rank.color, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Yarışma Tamamlandı
          </div>
          <h2 className="font-display" style={{ fontSize: 'clamp(1.6rem, 3vw, 2.3rem)', color: 'var(--gold-bright)', marginTop: 6 }}>
            {rank.title}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>{rank.desc}</p>

          <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 14, margin: '24px 0' }}>
            <StatPill label="Toplam Puan" value={score.toLocaleString('tr-TR')} color="var(--gold-bright)" />
            <StatPill label="Doğru / Toplam" value={`${correctCount} / ${deck.length}`} color="var(--turquoise)" />
            <StatPill label="Başarı Oranı" value={`%${accuracy}`} color="#86efac" />
            <StatPill label="En İyi Seri" value={`🔥 ${bestStreak}`} color="#fdba74" />
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 28 }}>
            <button
              onClick={startQuiz}
              style={{
                padding: '12px 24px',
                borderRadius: 12,
                border: 'none',
                background: 'linear-gradient(135deg, #e5b85c, #c99432)',
                color: '#0a0f17',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <RotateCcw size={17} /> Aynı Ayarlarla Tekrar Oyna
            </button>
            <button
              onClick={() => setPhase('lobby')}
              style={{
                padding: '12px 22px',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.18)',
                backgroundColor: 'rgba(255,255,255,0.06)',
                color: 'var(--text-main)',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Ayarlara Dön
            </button>
          </div>

          {/* Review Wrong / All Answers */}
          <div style={{ textAlign: 'left', marginTop: 18 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--gold)', marginBottom: 12 }}>
              Soru İncelemesi ({history.filter((h) => !h.isCorrect).length} Yanlış)
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 380, overflowY: 'auto' }}>
              {history.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: 14,
                    borderRadius: 12,
                    backgroundColor: 'rgba(6, 10, 18, 0.7)',
                    border: `1px solid ${item.isCorrect ? 'rgba(74,222,128,0.28)' : 'rgba(248,113,113,0.35)'}`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: item.isCorrect ? '#86efac' : '#fca5a5' }}>
                      {idx + 1}. {item.isCorrect ? '✓ Doğru' : '✗ Yanlış'}
                    </span>
                    <button
                      onClick={() => onOpenInReader(Math.max(0, (item.question.page || 1) - 1))}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--turquoise)',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Kitapta Oku (s. {item.question.page}) →
                    </button>
                  </div>
                  <div style={{ fontSize: 13.5, marginBottom: 6 }}>{item.question.question}</div>
                  <div style={{ fontSize: 12.5, color: '#86efac' }}>
                    Doğru Cevap: <strong>{item.question.options[item.question.correctIndex]}</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ==================== PLAYING ARENA ====================
  if (!currentQ) return null;
  const progressPct = ((qIndex + 1) / deck.length) * 100;

  return (
    <section style={{ maxWidth: 880, width: '100%', margin: '0 auto', padding: '20px 20px 64px' }}>
      <div className="glass-panel-gold" style={{ borderRadius: 24, padding: '24px 24px 28px' }}>
        {/* Top Arena HUD */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--gold-bright)' }}>
              Soru {qIndex + 1} / {deck.length}
            </span>
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                padding: '3px 9px',
                borderRadius: 99,
                backgroundColor: 'rgba(255,255,255,0.07)',
                color: 'var(--text-muted)',
              }}
            >
              {currentQ.category}
            </span>
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 700,
                padding: '3px 9px',
                borderRadius: 99,
                backgroundColor:
                  currentQ.difficulty === 'Zor'
                    ? 'rgba(248,113,113,0.18)'
                    : currentQ.difficulty === 'Orta'
                      ? 'rgba(229,184,92,0.18)'
                      : 'rgba(74,222,128,0.16)',
                color:
                  currentQ.difficulty === 'Zor'
                    ? '#fca5a5'
                    : currentQ.difficulty === 'Orta'
                      ? 'var(--gold-bright)'
                      : '#86efac',
              }}
            >
              {currentQ.difficulty}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {timedMode && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  fontWeight: 800,
                  fontSize: 13.5,
                  color: secondsLeft <= 8 ? '#fca5a5' : 'var(--turquoise)',
                }}
              >
                <Clock size={15} /> {secondsLeft}s
              </span>
            )}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 700, fontSize: 13.5, color: '#fdba74' }}>
              <Flame size={16} /> {streak} Seri
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 800, fontSize: 14, color: 'var(--gold-bright)' }}>
              <Sparkles size={15} /> {score}
            </span>
            <button
              onClick={() => finishGame(score, correctCount, history.length)}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.14)',
                color: 'var(--text-muted)',
                borderRadius: 8,
                padding: '4px 10px',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Bitir
            </button>
          </div>
        </div>

        {/* Progress Bar */}
        <div style={{ height: 6, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: 20 }}>
          <div
            style={{
              height: '100%',
              width: `${progressPct}%`,
              background: 'linear-gradient(90deg, var(--turquoise), var(--gold-bright))',
              transition: 'width 0.3s ease',
            }}
          />
        </div>

        {/* Question Prompt */}
        <div
          style={{
            padding: '20px 22px',
            borderRadius: 16,
            backgroundColor: 'rgba(6, 10, 18, 0.72)',
            border: '1px solid rgba(229, 184, 92, 0.2)',
            marginBottom: 18,
          }}
        >
          <p className="font-editorial" style={{ fontSize: 'clamp(1.18rem, 2.2vw, 1.42rem)', lineHeight: 1.55, color: 'var(--text-main)', whiteSpace: 'pre-line' }}>
            {currentQ.question}
          </p>
        </div>

        {/* Jokers Row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 18 }}>
          <button
            onClick={useFiftyFifty}
            disabled={fiftyUsesLeft <= 0 || selectedOpt !== null || eliminatedOpts.length > 0}
            style={{
              padding: '7px 13px',
              borderRadius: 10,
              fontSize: 12.5,
              fontWeight: 700,
              cursor: fiftyUsesLeft > 0 && selectedOpt === null ? 'pointer' : 'not-allowed',
              backgroundColor: 'rgba(45, 212, 191, 0.12)',
              border: '1px solid rgba(45, 212, 191, 0.35)',
              color: 'var(--turquoise)',
              opacity: fiftyUsesLeft <= 0 || selectedOpt !== null || eliminatedOpts.length > 0 ? 0.45 : 1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <HelpCircle size={15} /> %50 Joker ({fiftyUsesLeft})
          </button>

          <button
            onClick={useHint}
            disabled={hintUsesLeft <= 0 || hintShown || selectedOpt !== null}
            style={{
              padding: '7px 13px',
              borderRadius: 10,
              fontSize: 12.5,
              fontWeight: 700,
              cursor: hintUsesLeft > 0 && selectedOpt === null ? 'pointer' : 'not-allowed',
              backgroundColor: 'rgba(229, 184, 92, 0.12)',
              border: '1px solid rgba(229, 184, 92, 0.35)',
              color: 'var(--gold-bright)',
              opacity: hintUsesLeft <= 0 || hintShown || selectedOpt !== null ? 0.45 : 1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Lightbulb size={15} /> Kitap İpucu ({hintUsesLeft})
          </button>

          {hintShown && (
            <div style={{ fontSize: 12.5, color: 'var(--gold-bright)', alignSelf: 'center', padding: '4px 10px', borderRadius: 8, background: 'rgba(229,184,92,0.12)' }}>
              İpucu: Bu madde eserin <strong>{currentQ.page}. sayfasında</strong> yer almaktadır.
            </div>
          )}
        </div>

        {/* 4 Options Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
          {currentQ.options.map((optText, idx) => {
            const isEliminated = eliminatedOpts.includes(idx);
            const isPicked = selectedOpt === idx;
            const isCorrect = idx === currentQ.correctIndex;
            const revealed = selectedOpt !== null;

            let bg = 'rgba(255,255,255,0.04)';
            let border = 'rgba(255,255,255,0.12)';
            let color = 'var(--text-main)';

            if (revealed) {
              if (isCorrect) {
                bg = 'rgba(34, 197, 94, 0.2)';
                border = '#4ade80';
                color = '#dcfce7';
              } else if (isPicked && !isCorrect) {
                bg = 'rgba(239, 68, 68, 0.2)';
                border = '#f87171';
                color = '#fee2e2';
              } else {
                bg = 'rgba(255,255,255,0.02)';
                border = 'rgba(255,255,255,0.06)';
              }
            }

            return (
              <button
                key={idx}
                disabled={revealed || isEliminated}
                onClick={() => handleAnswer(idx)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  textAlign: 'left',
                  padding: '14px 16px',
                  borderRadius: 14,
                  backgroundColor: bg,
                  border: `1.5px solid ${border}`,
                  color,
                  cursor: revealed || isEliminated ? 'default' : 'pointer',
                  opacity: isEliminated ? 0.22 : 1,
                  transition: 'all 0.16s ease',
                }}
              >
                <span
                  style={{
                    minWidth: 30,
                    height: 30,
                    borderRadius: 9,
                    backgroundColor: revealed && isCorrect ? '#22c55e' : revealed && isPicked ? '#ef4444' : 'rgba(229, 184, 92, 0.18)',
                    color: revealed && (isCorrect || isPicked) ? '#fff' : 'var(--gold-bright)',
                    fontWeight: 800,
                    fontSize: 13,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {OPTION_LETTERS[idx]}
                </span>
                <span style={{ flex: 1, fontSize: 14.5, lineHeight: 1.45, fontWeight: 500 }}>{optText}</span>
                {revealed && isCorrect && <CheckCircle2 size={20} color="#4ade80" />}
                {revealed && isPicked && !isCorrect && <XCircle size={20} color="#f87171" />}
              </button>
            );
          })}
        </div>

        {/* Post-Answer Explanation & Next Button */}
        {selectedOpt !== null && (
          <div
            style={{
              marginTop: 20,
              padding: '16px 18px',
              borderRadius: 16,
              backgroundColor:
                selectedOpt === currentQ.correctIndex ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              border: `1px solid ${
                selectedOpt === currentQ.correctIndex ? 'rgba(74, 222, 128, 0.35)' : 'rgba(248, 113, 113, 0.35)'
              }`,
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 6, color: selectedOpt === currentQ.correctIndex ? '#86efac' : '#fca5a5' }}>
              {selectedOpt === currentQ.correctIndex
                ? '✓ Tebrikler, Doğru Cevap!'
                : selectedOpt === -1
                  ? '⏱ Süre Doldu!'
                  : `✗ Yanlış Cevap — Doğru Seçenek: ${OPTION_LETTERS[currentQ.correctIndex]}`}
            </div>
            <p style={{ fontSize: 13.5, lineHeight: 1.6, color: 'rgba(243,240,230,0.9)', marginBottom: 14 }}>
              <strong>Kaynak Açıklaması:</strong> {currentQ.explanation}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
              <button
                onClick={() => onOpenInReader(Math.max(0, (currentQ.page || 1) - 1))}
                style={{
                  padding: '8px 14px',
                  borderRadius: 10,
                  border: '1px solid rgba(45, 212, 191, 0.4)',
                  backgroundColor: 'rgba(45, 212, 191, 0.12)',
                  color: 'var(--turquoise)',
                  fontWeight: 700,
                  fontSize: 12.5,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <BookOpen size={15} /> Kitapta Oku (Sayfa {currentQ.page})
              </button>

              <button
                onClick={nextQuestion}
                style={{
                  padding: '10px 22px',
                  borderRadius: 11,
                  border: 'none',
                  background: 'linear-gradient(135deg, #e5b85c, #c99432)',
                  color: '#0a0f17',
                  fontWeight: 800,
                  fontSize: 13.5,
                  cursor: 'pointer',
                }}
              >
                {qIndex + 1 >= deck.length ? 'Sonuçları Gör →' : 'Sonraki Soru →'}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function StatPill({ label, value, color }) {
  return (
    <div
      style={{
        padding: '10px 16px',
        borderRadius: 14,
        backgroundColor: 'rgba(6, 10, 18, 0.72)',
        border: '1px solid rgba(255,255,255,0.1)',
        textAlign: 'center',
        minWidth: 110,
      }}
    >
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}
