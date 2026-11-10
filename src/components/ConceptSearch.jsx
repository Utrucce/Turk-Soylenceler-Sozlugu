import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Compass, ExternalLink, Hash, Search, Sparkles, X } from 'lucide-react';
import { matchesSearchQuery, normalizeTurkish } from '../utils/turkish';

const LETTERS = [
  'Tümü', 'A', 'B', 'C', 'Ç', 'D', 'E', 'F', 'G', 'H', 'I', 'İ',
  'K', 'L', 'M', 'N', 'O', 'Ö', 'P', 'R', 'S', 'Ş', 'T', 'U', 'Ü', 'V', 'Y', 'Z',
];

const CATEGORIES = [
  'Tümü',
  'Tanrılar & İlahlar',
  'Ruhlar & İyeler',
  'Mitolojik Varlıklar',
  'Kahramanlar & Atalar',
  'Kutsal Doğa & Mekânlar',
  'İnanç, Tören & Kavramlar',
];

const CATEGORY_COLORS = {
  'Tanrılar & İlahlar': { bg: 'rgba(229, 184, 92, 0.14)', border: 'rgba(229, 184, 92, 0.4)', text: '#ffd982' },
  'Ruhlar & İyeler': { bg: 'rgba(45, 212, 191, 0.14)', border: 'rgba(45, 212, 191, 0.4)', text: '#5eead4' },
  'Mitolojik Varlıklar': { bg: 'rgba(244, 114, 182, 0.14)', border: 'rgba(244, 114, 182, 0.4)', text: '#f9a8d4' },
  'Kahramanlar & Atalar': { bg: 'rgba(251, 146, 60, 0.14)', border: 'rgba(251, 146, 60, 0.4)', text: '#fdba74' },
  'Kutsal Doğa & Mekânlar': { bg: 'rgba(74, 222, 128, 0.14)', border: 'rgba(74, 222, 128, 0.4)', text: '#86efac' },
  'İnanç, Tören & Kavramlar': { bg: 'rgba(129, 140, 248, 0.16)', border: 'rgba(129, 140, 248, 0.42)', text: '#a5b4fc' },
};

export default function ConceptSearch({ concepts, initialQuery = '', initialConcept = null, onOpenInReader }) {
  const [query, setQuery] = useState(initialQuery);
  const [selectedLetter, setSelectedLetter] = useState('Tümü');
  const [selectedCategory, setSelectedCategory] = useState('Tümü');
  const [visibleCount, setVisibleCount] = useState(36);
  const [activeConcept, setActiveConcept] = useState(initialConcept);

  useEffect(() => {
    if (initialQuery) setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    if (initialConcept) setActiveConcept(initialConcept);
  }, [initialConcept]);

  useEffect(() => {
    setVisibleCount(36);
  }, [query, selectedLetter, selectedCategory]);

  const conceptByNormTitle = useMemo(() => {
    const map = new Map();
    for (const c of concepts) {
      map.set(normalizeTurkish(c.title), c);
    }
    return map;
  }, [concepts]);

  const filtered = useMemo(() => {
    const q = query.trim();
    const nq = normalizeTurkish(q);

    const list = concepts.filter((c) => {
      if (selectedLetter !== 'Tümü' && c.letter !== selectedLetter) return false;
      if (selectedCategory !== 'Tümü' && c.category !== selectedCategory) return false;
      if (!q) return true;
      const haystack = `${c.title} ${c.azeri || ''} ${(c.aliases || []).join(' ')} ${c.shortDef} ${c.description} ${c.etymology || ''}`;
      return matchesSearchQuery(haystack, q);
    });

    if (!q) return list;

    // Score relevance: exact title > startsWith title > title includes > aliases > body
    return [...list].sort((a, b) => {
      const score = (c) => {
        const nt = normalizeTurkish(c.title);
        if (nt === nq) return 100;
        if (nt.startsWith(nq)) return 80;
        if (nt.includes(nq)) return 60;
        if ((c.aliases || []).some((al) => matchesSearchQuery(al, q))) return 45;
        if (matchesSearchQuery(c.shortDef, q)) return 30;
        return 10;
      };
      return score(b) - score(a);
    });
  }, [concepts, query, selectedLetter, selectedCategory]);

  const visibleItems = filtered.slice(0, visibleCount);

  return (
    <section style={{ maxWidth: 1200, width: '100%', margin: '0 auto', padding: '24px 20px 64px' }}>
      {/* Header & Search Bar */}
      <div className="glass-panel-gold" style={{ borderRadius: 20, padding: '26px 24px', marginBottom: 22 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--turquoise)', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              <Compass size={15} /> Kavram Ansiklopedisi
            </div>
            <h2 className="font-display" style={{ fontSize: 'clamp(1.4rem, 2.8vw, 2rem)', color: 'var(--gold-bright)', marginTop: 4 }}>
              Türk Söylenceler Sözlüğü’nde Kavram Ara
            </h2>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Toplam <strong style={{ color: 'var(--gold-bright)' }}>{concepts.length}</strong> mitolojik kavram •{' '}
            <strong style={{ color: 'var(--turquoise)' }}>{filtered.length}</strong> sonuç
          </div>
        </div>

        {/* Search Input */}
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <Search
            size={20}
            style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--gold)' }}
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Kavram, tanrı, iye, kahraman, etimoloji veya Azerice karşılık ara (örn. Ülgen, Umay, Bozkurt, Erlik, İye)..."
            style={{
              width: '100%',
              padding: '14px 44px 14px 46px',
              borderRadius: 14,
              border: '1px solid rgba(229, 184, 92, 0.35)',
              backgroundColor: 'rgba(6, 10, 18, 0.85)',
              color: 'var(--text-main)',
              fontSize: 15,
              outline: 'none',
            }}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              title="Aramayı Temizle"
              style={{
                position: 'absolute',
                right: 14,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'rgba(255,255,255,0.08)',
                border: 'none',
                borderRadius: 99,
                width: 26,
                height: 26,
                color: 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Category Filter Chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          {CATEGORIES.map((cat) => {
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                style={{
                  padding: '6px 13px',
                  borderRadius: 99,
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.18s ease',
                  backgroundColor: active ? 'var(--gold)' : 'rgba(255,255,255,0.05)',
                  color: active ? '#0b0f17' : 'var(--text-muted)',
                  border: active ? '1px solid var(--gold-bright)' : '1px solid rgba(255,255,255,0.1)',
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Alphabet Strip */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
          {LETTERS.map((ltr) => {
            const active = selectedLetter === ltr;
            return (
              <button
                key={ltr}
                onClick={() => setSelectedLetter(ltr)}
                style={{
                  padding: ltr === 'Tümü' ? '5px 11px' : '5px 9px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  backgroundColor: active ? 'var(--turquoise-dim)' : 'rgba(255,255,255,0.03)',
                  color: active ? 'var(--turquoise)' : 'var(--text-muted)',
                  border: active ? '1px solid rgba(45,212,191,0.55)' : '1px solid rgba(255,255,255,0.08)',
                }}
              >
                {ltr}
              </button>
            );
          })}
        </div>
      </div>

      {/* Results Grid */}
      {visibleItems.length === 0 ? (
        <div className="glass-panel" style={{ borderRadius: 18, padding: 48, textAlign: 'center' }}>
          <Sparkles size={36} color="var(--gold)" style={{ marginBottom: 12 }} />
          <h3 style={{ fontSize: 18, marginBottom: 6 }}>Eşleşen kavram bulunamadı</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            Farklı bir anahtar kelime deneyin veya harf/kategori filtresini sıfırlayın.
          </p>
        </div>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))',
              gap: 16,
            }}
          >
            {visibleItems.map((c) => {
              const style = CATEGORY_COLORS[c.category] || CATEGORY_COLORS['İnanç, Tören & Kavramlar'];
              return (
                <article
                  key={c.id}
                  onClick={() => setActiveConcept(c)}
                  className="glass-panel"
                  style={{
                    borderRadius: 16,
                    padding: 20,
                    cursor: 'pointer',
                    transition: 'transform 0.18s ease, border-color 0.18s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-3px)';
                    e.currentTarget.style.borderColor = 'rgba(229, 184, 92, 0.45)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '3px 9px',
                          borderRadius: 99,
                          backgroundColor: style.bg,
                          border: `1px solid ${style.border}`,
                          color: style.text,
                        }}
                      >
                        {c.category}
                      </span>
                      <span style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 600 }}>
                        s. {c.page}
                      </span>
                    </div>

                    <h3 className="font-display" style={{ fontSize: 20, color: 'var(--gold-bright)', marginBottom: 4 }}>
                      {c.title}
                    </h3>

                    {c.azeri && (
                      <div style={{ fontSize: 11.5, color: 'var(--turquoise)', marginBottom: 8 }}>
                        Azəricə: {c.azeri}
                      </div>
                    )}

                    <p style={{ fontSize: 13.5, lineHeight: 1.6, color: 'rgba(243,240,230,0.88)' }}>
                      {c.shortDef}
                    </p>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                    <span style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 600 }}>
                      Ayrıntıları Gör →
                    </span>
                    {c.etymology && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Etimoloji mevcut</span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          {visibleCount < filtered.length && (
            <div style={{ textAlign: 'center', marginTop: 28 }}>
              <button
                onClick={() => setVisibleCount((v) => v + 36)}
                style={{
                  padding: '12px 28px',
                  borderRadius: 12,
                  border: '1px solid var(--gold)',
                  backgroundColor: 'rgba(229, 184, 92, 0.14)',
                  color: 'var(--gold-bright)',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                Daha Fazla Göster ({filtered.length - visibleCount} kavram kaldı)
              </button>
            </div>
          )}
        </>
      )}

      {/* ==================== CONCEPT DETAIL MODAL ==================== */}
      {activeConcept && (
        <div
          onClick={() => setActiveConcept(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(3, 6, 12, 0.78)',
            backdropFilter: 'blur(8px)',
            zIndex: 70,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 18,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="glass-panel-gold"
            style={{
              width: '100%',
              maxWidth: 740,
              maxHeight: '88vh',
              overflowY: 'auto',
              borderRadius: 22,
              padding: '28px 26px',
              position: 'relative',
            }}
          >
            <button
              onClick={() => setActiveConcept(null)}
              style={{
                position: 'absolute',
                top: 18,
                right: 18,
                width: 34,
                height: 34,
                borderRadius: '50%',
                border: '1px solid rgba(255,255,255,0.15)',
                backgroundColor: 'rgba(255,255,255,0.06)',
                color: 'var(--text-main)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={18} />
            </button>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  padding: '4px 10px',
                  borderRadius: 99,
                  backgroundColor: (CATEGORY_COLORS[activeConcept.category] || CATEGORY_COLORS['İnanç, Tören & Kavramlar']).bg,
                  color: (CATEGORY_COLORS[activeConcept.category] || CATEGORY_COLORS['İnanç, Tören & Kavramlar']).text,
                  border: `1px solid ${(CATEGORY_COLORS[activeConcept.category] || CATEGORY_COLORS['İnanç, Tören & Kavramlar']).border}`,
                }}
              >
                {activeConcept.category}
              </span>
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  padding: '4px 10px',
                  borderRadius: 99,
                  backgroundColor: 'rgba(255,255,255,0.07)',
                  color: 'var(--text-muted)',
                }}
              >
                <Hash size={12} style={{ display: 'inline', verticalAlign: '-2px' }} /> Sayfa {activeConcept.page}
              </span>
              {activeConcept.azeri && (
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    padding: '4px 10px',
                    borderRadius: 99,
                    backgroundColor: 'rgba(45, 212, 191, 0.14)',
                    color: 'var(--turquoise)',
                  }}
                >
                  Azəricə: {activeConcept.azeri}
                </span>
              )}
            </div>

            <h2 className="font-display" style={{ fontSize: 'clamp(1.6rem, 3vw, 2.2rem)', color: 'var(--gold-bright)', marginBottom: 8 }}>
              {activeConcept.title}
            </h2>

            {activeConcept.aliases?.length > 0 && (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>
                <strong style={{ color: 'var(--text-main)' }}>Diğer Adları / Söylenişleri:</strong>{' '}
                {activeConcept.aliases.join(', ')}
              </div>
            )}

            <div className="orkhon-divider" style={{ margin: '14px 0 18px' }} />

            <div style={{ fontSize: 15, lineHeight: 1.75, color: 'rgba(243,240,230,0.94)', whiteSpace: 'pre-line' }}>
              {activeConcept.description}
            </div>

            {activeConcept.features && (
              <div style={{ marginTop: 18 }}>
                <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--gold)', marginBottom: 6 }}>
                  Özellikleri & Kültürel Bağlam
                </h4>
                <p style={{ fontSize: 14.5, lineHeight: 1.75, color: 'rgba(243,240,230,0.88)' }}>
                  {activeConcept.features}
                </p>
              </div>
            )}

            {activeConcept.etymology && (
              <div
                style={{
                  marginTop: 18,
                  padding: '14px 16px',
                  borderRadius: 12,
                  backgroundColor: 'rgba(45, 212, 191, 0.08)',
                  border: '1px solid rgba(45, 212, 191, 0.28)',
                }}
              >
                <h4 style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--turquoise)', marginBottom: 5 }}>
                  Etimoloji / Sözcük Kökeni
                </h4>
                <p style={{ fontSize: 14, lineHeight: 1.68, color: 'rgba(243,240,230,0.9)' }}>
                  {activeConcept.etymology}
                </p>
              </div>
            )}

            {activeConcept.seeAlso?.length > 0 && (
              <div style={{ marginTop: 18 }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>
                  Ayrıca Bakınız
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {activeConcept.seeAlso.map((rel, i) => {
                    const target = conceptByNormTitle.get(normalizeTurkish(rel));
                    return (
                      <button
                        key={i}
                        onClick={() => {
                          if (target) {
                            setActiveConcept(target);
                          } else {
                            setActiveConcept(null);
                            setQuery(rel);
                          }
                        }}
                        style={{
                          padding: '5px 11px',
                          borderRadius: 99,
                          fontSize: 12.5,
                          fontWeight: 600,
                          cursor: 'pointer',
                          backgroundColor: 'rgba(255,255,255,0.07)',
                          border: '1px solid rgba(255,255,255,0.14)',
                          color: target ? 'var(--gold-bright)' : 'var(--text-muted)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        {rel} {target && <ExternalLink size={11} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                Kaynak: <strong>Deniz Karakurt</strong> — Türk Söylenceler Sözlüğü
              </span>
              <button
                onClick={() => {
                  const pageIdx = Math.max(0, (activeConcept.page || 1) - 1);
                  setActiveConcept(null);
                  onOpenInReader(pageIdx);
                }}
                style={{
                  padding: '10px 18px',
                  borderRadius: 12,
                  border: 'none',
                  background: 'linear-gradient(135deg, #e5b85c, #c99432)',
                  color: '#0a0f17',
                  fontWeight: 800,
                  fontSize: 13.5,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <BookOpen size={17} /> Kitapta Oku (Sayfa {activeConcept.page})
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
