import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
 ArrowRight, ChevronDown, Award, Shield, Users, Trophy,
 Star, MapPin, Phone, Mail, Menu, X, CheckCircle,
 Zap, Globe, Clock, Target, Medal, Flame,
} from 'lucide-react';
import logo from '../../../assets/shadow-kai-logo.png';
import { 
  karateTournament01, karateTournament02, karateTournament03, karateTournament04,
  silambamAcrobatics01, silambamAcrobatics02, silambamAcrobatics03, silambamStickCombat01
} from '../../../assets/images';

// ── Images ───────────────────────────────────────────────────────────────────
const IMG_HERO = silambamAcrobatics03;
const IMG_KARATE = karateTournament01;
const IMG_SILAMBAM = silambamStickCombat01;
const IMG_TRAINING = karateTournament02;
const IMG_WARRIOR = silambamAcrobatics01;
const IMG_BELT = karateTournament03;
const IMG_FESTIVAL = silambamAcrobatics02;
const IMG_DOJO = karateTournament04;

// ── useScrollReveal hook ──────────────────────────────────────────────────────
function useScrollReveal() {
 const ref = useRef<HTMLDivElement>(null);
 const [visible, setVisible] = useState(false);
 useEffect(() => {
 const el = ref.current;
 if (!el) return;
 const obs = new IntersectionObserver(
 ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
 { threshold: 0.12 }
 );
 obs.observe(el);
 return () => obs.disconnect();
 }, []);
 return { ref, visible };
}

// ── Belt data ─────────────────────────────────────────────────────────────────
const BELTS = [
 { color: '#FFFFFF', name: 'White', border: '#ccc' },
 { color: '#FFD700', name: 'Yellow', border: '#e6c200' },
 { color: '#FF8C00', name: 'Orange', border: '#cc7000' },
 { color: '#22C55E', name: 'Green', border: '#16a34a' },
 { color: '#3B82F6', name: 'Blue', border: '#2563eb' },
 { color: '#7C3AED', name: 'Purple', border: '#6d28d9' },
 { color: '#92400E', name: 'Brown', border: '#78350f' },
 { color: '#0D0D0D', name: 'Black', border: '#000' },
];

const SILAMBAM_STAGES = [
 { stage: 'Stage 1', color: '#22C55E', desc: 'Foundations & Footwork' },
 { stage: 'Stage 2', color: '#3B82F6', desc: 'Basic Strikes & Guards' },
 { stage: 'Stage 3', color: '#F59E0B', desc: 'Combinations & Patterns' },
 { stage: 'Stage 4', color: '#EF4444', desc: 'Advanced Techniques' },
 { stage: 'Stage 5', color: '#7C3AED', desc: 'Mastery & Performance' },
];

// ── Testimonials ──────────────────────────────────────────────────────────────
const TESTIMONIALS = [
 {
 name: 'Arjun Krishnan',
 role: 'Green Belt — 2 years',
 text: 'Shadow Kai changed my life. The discipline I learned here helped me not just in martial arts but in academics too.',
 avatar: 'AK',
 color: '#22C55E',
 },
 {
 name: 'Priya Sundaram',
 role: 'Silambam Stage 3',
 text: 'Learning Silambam here felt like connecting with my roots. The instructors make every session engaging and meaningful.',
 avatar: 'PS',
 color: '#FF8C00',
 },
 {
 name: 'Ravi Kumar',
 role: 'Black Belt — 5 years',
 text: 'From white belt to black belt at Shadow Kai — every step was guided with care and expertise. Best decision of my life.',
 avatar: 'RK',
 color: '#0D0D0D',
 },
 {
 name: 'Meena Devi',
 role: "Parent of 2 students",
 text: 'Both my children train here. The structured belt test system keeps them motivated and I can track their progress online.',
 avatar: 'MD',
 color: '#7C3AED',
 },
];

// ─────────────────────────────────────────────────────────────────────────────
export default function LandingPage() {
 const navigate = useNavigate();
 const [navOpen, setNavOpen] = useState(false);
 const [scrolled, setScrolled] = useState(false);
 const [activeTestimonial, setActiveTestimonial] = useState(0);

 useEffect(() => {
 const onScroll = () => setScrolled(window.scrollY > 60);
 window.addEventListener('scroll', onScroll);
 return () => window.removeEventListener('scroll', onScroll);
 }, []);

 useEffect(() => {
 const timer = setInterval(() => {
 setActiveTestimonial(p => (p + 1) % TESTIMONIALS.length);
 }, 4500);
 return () => clearInterval(timer);
 }, []);

 const scrollTo = (id: string) => {
 document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
 setNavOpen(false);
 };

 return (
 <div style={{ fontFamily: "'Nunito', sans-serif", color: 'var(--ink)', overflowX: 'hidden' }}>

 {/* ── NAVBAR ─────────────────────────────────────────────────────────── */}
 <nav
 className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
 style={{
 background: scrolled ? 'rgba(13,13,13,0.97)' : 'transparent',
 backdropFilter: scrolled ? 'blur(14px)' : 'none',
 borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : 'none',
 }}
 >
 <div className="max-w-[1200px] mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-3">
 {/* Logo */}
 <div className="flex items-center gap-3">
 <img src={logo} alt="Shadow Kai" className="w-11 h-11 object-cover" />
 <div>
 <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '20px', letterSpacing: '2px', color: '#fff', lineHeight: 1 }}>
 SHADOW KAI
 </div>
 <div style={{ fontSize: '10px', color: 'rgba(255,255,255,.5)', letterSpacing: '1px' }}>
 SHADOW KAI
 </div>
 </div>
 </div>

 {/* Desktop Nav */}
 <div className="hidden md:flex items-center gap-8">
 {['Programs', 'Journey', 'Gallery', 'Testimonials'].map(n => (
 <button key={n} onClick={() => scrollTo(n.toLowerCase())}
 className="text-sm font-semibold transition-colors"
 style={{ color: 'rgba(255,255,255,.7)' }}
 onMouseOver={e => (e.currentTarget.style.color = '#FF8C00')}
 onMouseOut={e => (e.currentTarget.style.color = 'rgba(255,255,255,.7)')}
 >
 {n}
 </button>
 ))}
 </div>

 {/* CTA */}
 <div className="hidden md:flex items-center gap-3">
 <a href="/admin/login" className="text-sm font-semibold px-4 py-2 rounded-lg transition-all"
 style={{ color: 'rgba(255,255,255,.6)' }}
 onMouseOver={e => (e.currentTarget.style.color = '#fff')}
 onMouseOut={e => (e.currentTarget.style.color = 'rgba(255,255,255,.6)')}>
 Admin
 </a>
 <button onClick={() => navigate('/karate/register')}
 className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:brightness-110 active:scale-95"
 style={{ background: 'var(--orange)', color: '#fff', fontFamily: "'Bebas Neue',sans-serif", fontSize: '15px', letterSpacing: '1.5px' }}>
 REGISTER NOW
 </button>
 </div>

 {/* Mobile hamburger */}
 <button className="md:hidden text-white" onClick={() => setNavOpen(p => !p)}>
 {navOpen ? <X size={24} /> : <Menu size={24} />}
 </button>
 </div>

 {/* Mobile menu */}
 {navOpen && (
 <div className="md:hidden px-6 pb-6 pt-2 space-y-3" style={{ background: 'rgba(13,13,13,0.98)' }}>
 {['Programs', 'Journey', 'Gallery', 'Testimonials'].map(n => (
 <button key={n} onClick={() => scrollTo(n.toLowerCase())}
 className="block w-full text-left py-2 text-sm font-semibold"
 style={{ color: 'rgba(255,255,255,.8)' }}>
 {n}
 </button>
 ))}
 <div className="pt-3 flex flex-col gap-2">
 <a href="/admin/login" className="text-center py-2.5 rounded-lg text-sm font-semibold border"
 style={{ color: 'rgba(255,255,255,.7)', borderColor: 'rgba(255,255,255,.15)' }}>
 Admin Login
 </a>
 <button onClick={() => navigate('/karate/register')}
 className="py-3 rounded-xl text-white text-sm font-bold"
 style={{ background: 'var(--orange)', fontFamily: "'Bebas Neue',sans-serif", fontSize: '16px', letterSpacing: '1.5px' }}>
 REGISTER NOW
 </button>
 </div>
 </div>
 )}
 </nav>

 {/* ── HERO ───────────────────────────────────────────────────────────── */}
 <section className="relative min-h-screen flex items-center" style={{ background: '#0D0D0D' }}>
 {/* BG image */}
 <div className="absolute inset-0">
 <img src={IMG_HERO} alt="hero" className="w-full h-full object-cover opacity-30" />
 <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(13,13,13,0.9) 0%, rgba(13,13,13,0.6) 50%, rgba(255,140,0,0.15) 100%)' }} />
 </div>

 {/* Decorative lines */}
 <div className="absolute right-0 top-0 bottom-0 w-px opacity-10" style={{ background: 'var(--orange)' }} />
 <div className="absolute right-20 top-1/4 bottom-1/4 w-px opacity-5" style={{ background: 'var(--orange)' }} />

 <div className="relative max-w-[1200px] mx-auto px-6 py-32 md:py-40 w-full">
 <div className="max-w-[700px]">
 {/* Badge */}
 <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8"
 style={{ background: 'rgba(255,140,0,0.15)', border: '1px solid rgba(255,140,0,0.3)' }}>
 <Flame size={14} color="var(--orange)" />
 <span style={{ color: 'var(--orange)', fontSize: '12px', fontFamily: "'Bebas Neue',sans-serif", letterSpacing: '2px' }}>
 TEAM SHADOW KAI
 </span>
 </div>

 {/* Headline */}
 <h1 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(30px,6vw,75px)', lineHeight: 0.92, letterSpacing: '2px', color: '#fff' }}>
 FORGE YOUR
 <br />
 <span style={{ color: 'var(--orange)', WebkitTextStroke: '1px var(--orange)' }}>WARRIOR</span>
 <br />
 SPIRIT
 </h1>

 {/* Subtext */}
 <p className="mt-6 mb-10 text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.65)', maxWidth: '500px' }}>
 India's premier Karate &amp; Silambam academy — where ancient tradition meets modern discipline. 
 Train with certified Shitoryu masters and discover your true potential.
 </p>

 {/* CTA Row */}
 <div className="flex flex-wrap gap-4 mb-12">
 <button onClick={() => navigate('/karate/register')}
 className="group inline-flex items-center gap-3 px-8 py-4 rounded-2xl font-bold transition-all duration-300 hover:translate-y-[-2px] hover:shadow-[0_16px_40px_rgba(255,140,0,0.4)] active:scale-95"
 style={{ background: 'var(--orange)', color: '#fff', fontFamily: "'Bebas Neue',sans-serif", fontSize: '20px', letterSpacing: '2px' }}>
 <Award size={20} />
 KARATE BELT TEST
 <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
 </button>
 <button onClick={() => navigate('/selambam/register')}
 className="group inline-flex items-center gap-3 px-8 py-4 rounded-2xl font-bold transition-all duration-300 hover:translate-y-[-2px] hover:shadow-[0_16px_40px_rgba(0,200,83,0.3)] active:scale-95"
 style={{ background: 'rgba(0,200,83,0.12)', color: '#22C55E', border: '2px solid rgba(0,200,83,0.4)', fontFamily: "'Bebas Neue',sans-serif", fontSize: '20px', letterSpacing: '2px' }}>
 <Trophy size={20} />
 SILAMBAM STAGE
 <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
 </button>
 </div>

 {/* Micro stats */}
 <div className="flex flex-wrap gap-8">
 {[['500+', 'Students Trained'], ['8+', 'Belt Levels'], ['5', 'Silambam Stages'], ['15+', 'Years Legacy']].map(([n, l]) => (
 <div key={l}>
 <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '28px', color: 'var(--orange)', letterSpacing: '1px' }}>{n}</div>
 <div style={{ fontSize: '11px', color: 'rgba(255,255,255,.45)', letterSpacing: '1px', textTransform: 'uppercase' }}>{l}</div>
 </div>
 ))}
 </div>
 </div>
 </div>

 {/* Scroll indicator */}
 <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
 style={{ animation: 'scrollBounce 2s ease-in-out infinite' }}>
 <span style={{ fontSize: '10px', color: 'rgba(255,255,255,.4)', letterSpacing: '2px', textTransform: 'uppercase' }}>Scroll</span>
 <ChevronDown size={18} color="rgba(255,255,255,.4)" />
 </div>

 <style>{`
 @keyframes scrollBounce {
 0%,100% { transform: translateX(-50%) translateY(0); }
 50% { transform: translateX(-50%) translateY(8px); }
 }
 `}</style>
 </section>

 {/* ── STATS BAR ──────────────────────────────────────────────────────── */}
 <StatsBar />

 {/* ── PROGRAMS ───────────────────────────────────────────────────────── */}
 <section id="programs" className="py-24" style={{ background: 'var(--off)' }}>
 <div className="max-w-[1200px] mx-auto px-6">
 <SectionHeader
 eyebrow="OUR PROGRAMS"
 title={<>Two Ancient Arts,<br /><span style={{ color: 'var(--orange)' }}>One Academy</span></>}
 subtitle="Whether you seek the precision of Japanese Karate or the ancient Tamil art of Silambam, we have the perfect path for your warrior journey."
 dark={false}
 />

 <div className="grid md:grid-cols-2 gap-8 mt-16">
 <ProgramCard
 image={IMG_KARATE}
 title="KARATE"
 subtitle="கராத்தே — Shitoryu Style"
 accent="var(--orange)"
 accentBg="rgba(255,140,0,0.08)"
 badge="BELT TEST REGISTRATION OPEN"
 badgeColor="var(--orange)"
 description="Master the ancient Japanese art of Shitoryu Karate. Our structured belt system takes you from White to Black Belt through rigorous training, discipline, and character development."
 features={['8 Belt Levels', 'Certified Sensei', 'School Batch Programs', 'Individual Training']}
 featureColor="var(--orange)"
 cta="Register for Belt Test"
 onCta={() => navigate('/karate/register')}
 price="₹1,200"
 priceNote="Starting from White → Yellow"
 />

 <ProgramCard
 image={IMG_SILAMBAM}
 title="SILAMBAM"
 subtitle="சிலம்பம் — Tamil Heritage Art"
 accent="#22C55E"
 accentBg="rgba(34,197,94,0.08)"
 badge="STAGE 1–5 AVAILABLE"
 badgeColor="#22C55E"
 description="Discover Silambam — Tamil Nadu's ancient stick martial art, a 3,000-year tradition. Develop agility, rhythm, and cultural pride through our 5-stage progressive curriculum."
 features={['5 Progressive Stages', 'Cultural Heritage', 'Certified Instructors', 'Performance Events']}
 featureColor="#22C55E"
 cta="Register for Silambam"
 onCta={() => navigate('/selambam/register')}
 price="₹800"
 priceNote="Starting from Stage 1"
 />
 </div>
 </div>
 </section>

 {/* ── WHY SHADOW KAI ─────────────────────────────────────────────────── */}
 <WhySection />

 {/* ── BELT JOURNEY ───────────────────────────────────────────────────── */}
 <section id="journey" className="py-24" style={{ background: 'var(--off)' }}>
 <div className="max-w-[1200px] mx-auto px-6">
 <SectionHeader
 eyebrow="THE JOURNEY"
 title={<>Your Path to<br /><span style={{ color: 'var(--orange)' }}>Black Belt</span></>}
 subtitle="Every master was once a beginner. Our structured belt system guides your transformation step by step."
 dark={false}
 />

 <div className="mt-16 grid md:grid-cols-2 gap-16 items-center">
 {/* Belt visual */}
 <div className="space-y-3">
 {BELTS.map((belt, i) => (
 <BeltRow key={belt.name} belt={belt} index={i} total={BELTS.length} />
 ))}
 </div>

 {/* Silambam stages */}
 <div>
 <div className="mb-6 flex items-center gap-3">
 <div className="w-1 h-10 rounded-full" style={{ background: '#22C55E' }} />
 <div>
 <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '28px', letterSpacing: '2px', color: 'var(--ink)' }}>
 SILAMBAM STAGES
 </div>
 <div style={{ fontSize: '12px', color: 'var(--muted-color)', letterSpacing: '1px' }}>
 சிலம்பம் நிலைகள்
 </div>
 </div>
 </div>
 <div className="space-y-4">
 {SILAMBAM_STAGES.map((s, i) => (
 <SilambamStageRow key={s.stage} stage={s} index={i} />
 ))}
 </div>

 <div className="mt-10 p-6 rounded-2xl" style={{ background: 'var(--ink)', border: '1px solid rgba(255,255,255,0.06)' }}>
 <img src={IMG_BELT} alt="Belt ceremony" className="w-full h-44 object-cover rounded-xl mb-4 opacity-80" />
 <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '22px', letterSpacing: '1.5px', color: '#fff' }}>
 BELT CEREMONY
 </div>
 <p style={{ fontSize: '13px', color: 'rgba(255,255,255,.5)', marginTop: '6px', lineHeight: 1.6 }}>
 Earn your belt at official grading events, assessed by certified referees. 
 Your achievements are digitally recorded and hall tickets generated instantly.
 </p>
 </div>
 </div>
 </div>
 </div>
 </section>

 {/* ── GALLERY ────────────────────────────────────────────────────────── */}
 <GallerySection />

 {/* ── TESTIMONIALS ───────────────────────────────────────────────────── */}
 <section id="testimonials" className="py-24" style={{ background: 'var(--off)' }}>
 <div className="max-w-[1200px] mx-auto px-6">
 <SectionHeader
 eyebrow="TESTIMONIALS"
 title={<>Voices of Our<br /><span style={{ color: 'var(--orange)' }}>Warriors</span></>}
 subtitle="Hear from our students and parents about their Shadow Kai journey."
 dark={false}
 />

 <div className="mt-12 grid md:grid-cols-2 gap-6">
 {TESTIMONIALS.map((t, i) => (
 <div key={t.name}
 className="p-6 rounded-2xl transition-all duration-500"
 style={{
 background: i === activeTestimonial ? 'var(--ink)' : '#fff',
 border: `2px solid ${i === activeTestimonial ? t.color : 'var(--border-color)'}`,
 transform: i === activeTestimonial ? 'scale(1.02)' : 'scale(1)',
 }}>
 <div className="flex gap-1 mb-4">
 {[1,2,3,4,5].map(s => <Star key={s} size={14} fill="var(--orange)" color="var(--orange)" />)}
 </div>
 <p className="text-sm leading-relaxed mb-5"
 style={{ color: i === activeTestimonial ? 'rgba(255,255,255,0.75)' : '#555' }}>
 "{t.text}"
 </p>
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
 style={{ background: t.color, fontFamily: "'Bebas Neue',sans-serif", fontSize: '14px', color: t.color === '#0D0D0D' ? '#FFD700' : '#fff' }}>
 {t.avatar}
 </div>
 <div>
 <div className="text-sm font-bold" style={{ color: i === activeTestimonial ? '#fff' : 'var(--ink)' }}>
 {t.name}
 </div>
 <div style={{ fontSize: '11px', color: t.color }}>
 {t.role}
 </div>
 </div>
 </div>
 </div>
 ))}
 </div>

 {/* Dot indicators */}
 <div className="flex justify-center gap-2 mt-8">
 {TESTIMONIALS.map((_, i) => (
 <button key={i} onClick={() => setActiveTestimonial(i)}
 className="rounded-full transition-all duration-300"
 style={{
 width: i === activeTestimonial ? '28px' : '8px',
 height: '8px',
 background: i === activeTestimonial ? 'var(--orange)' : 'var(--border-color)',
 }} />
 ))}
 </div>
 </div>
 </section>

 {/* ── CTA SECTION ────────────────────────────────────────────────────── */}
 <CtaSection navigate={navigate} />

 {/* ── FOOTER ─────────────────────────────────────────────────────────── */}
 <Footer navigate={navigate} />
 </div>
 );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({
 eyebrow, title, subtitle, dark,
}: { eyebrow: string; title: React.ReactNode; subtitle: string; dark: boolean }) {
 const { ref, visible } = useScrollReveal();
 return (
 <div ref={ref} className="text-center transition-all duration-700"
 style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(32px)' }}>
 <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-5"
 style={{ background: dark ? 'rgba(255,140,0,0.15)' : 'rgba(255,140,0,0.1)', border: '1px solid rgba(255,140,0,0.3)' }}>
 <span style={{ color: 'var(--orange)', fontSize: '11px', fontFamily: "'Bebas Neue',sans-serif", letterSpacing: '2.5px' }}>
 {eyebrow}
 </span>
 </div>
 <h2 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(21px,3.75vw,48px)', lineHeight: 1, letterSpacing: '1.5px', color: dark ? '#fff' : 'var(--ink)' }}>
 {title}
 </h2>
 <p className="mx-auto mt-5" style={{ color: dark ? 'rgba(255,255,255,0.55)' : '#666', maxWidth: '560px', lineHeight: 1.7, fontSize: '15px' }}>
 {subtitle}
 </p>
 </div>
 );
}

function StatsBar() {
 const { ref, visible } = useScrollReveal();
 const stats = [
 { icon: Users, value: '500+', label: 'Students Trained', color: 'var(--orange)' },
 { icon: Award, value: '8', label: 'Belt Levels', color: 'var(--yellow)' },
 { icon: Shield, value: '15+', label: 'Years of Legacy', color: '#22C55E' },
 { icon: Trophy, value: '50+', label: 'Championships', color: '#3B82F6' },
 { icon: Globe, value: '20+', label: 'Partner Schools', color: '#7C3AED' },
 ];
 return (
 <div ref={ref} style={{ background: 'var(--ink)', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
 <div className="max-w-[1200px] mx-auto px-6 py-8">
 <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
 {stats.map((s, i) => {
 const Icon = s.icon;
 return (
 <div key={s.label}
 className="flex items-center gap-3 transition-all duration-700"
 style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(20px)', transitionDelay: `${i * 80}ms` }}>
 <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
 style={{ background: `${s.color}18` }}>
 <Icon size={18} style={{ color: s.color }} />
 </div>
 <div>
 <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '26px', color: s.color, letterSpacing: '1px', lineHeight: 1 }}>
 {s.value}
 </div>
 <div style={{ fontSize: '10px', color: 'rgba(255,255,255,.4)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
 {s.label}
 </div>
 </div>
 </div>
 );
 })}
 </div>
 </div>
 </div>
 );
}

function ProgramCard({
 image, title, subtitle, accent, accentBg, badge, badgeColor,
 description, features, featureColor, cta, onCta, price, priceNote,
}: {
 image: string; title: string; subtitle: string; accent: string; accentBg: string;
 badge: string; badgeColor: string; description: string; features: string[];
 featureColor: string; cta: string; onCta: () => void; price: string; priceNote: string;
}) {
 const { ref, visible } = useScrollReveal();
 return (
 <div ref={ref} className="group rounded-3xl overflow-hidden transition-all duration-700"
 style={{
 opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(40px)',
 background: '#fff', border: `2px solid var(--border-color)`,
 boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
 }}>
 {/* Image */}
 <div className="relative h-56 overflow-hidden">
 <img src={image} alt={title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
 <div className="absolute inset-0" style={{ background: `linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 60%)` }} />
 <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
 <div>
 <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '36px', letterSpacing: '2px', color: '#fff', lineHeight: 1 }}>
 {title}
 </div>
 <div style={{ fontSize: '12px', color: 'rgba(255,255,255,.65)', marginTop: '2px' }}>
 {subtitle}
 </div>
 </div>
 <div className="px-3 py-1.5 rounded-full" style={{ background: `${badgeColor}22`, border: `1px solid ${badgeColor}55` }}>
 <span style={{ fontSize: '10px', color: badgeColor, fontFamily: "'Bebas Neue',sans-serif", letterSpacing: '1px' }}>
 {badge}
 </span>
 </div>
 </div>
 </div>

 {/* Body */}
 <div className="p-6">
 <p className="text-sm leading-relaxed mb-5" style={{ color: '#555' }}>{description}</p>

 <div className="grid grid-cols-2 gap-2 mb-6">
 {features.map(f => (
 <div key={f} className="flex items-center gap-2">
 <CheckCircle size={14} style={{ color: featureColor, flexShrink: 0 }} />
 <span style={{ fontSize: '12px', color: '#444', fontWeight: 600 }}>{f}</span>
 </div>
 ))}
 </div>

 <div className="flex flex-wrap items-center justify-between gap-3 pt-5" style={{ borderTop: '1px solid var(--border-color)' }}>
 <div>
 <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '30px', color: accent, letterSpacing: '1px' }}>
 {price}
 </div>
 <div style={{ fontSize: '10px', color: '#999' }}>{priceNote}</div>
 </div>
 <button onClick={onCta}
 className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-bold transition-all hover:brightness-110 hover:translate-y-[-2px] active:scale-95"
 style={{ background: accent, fontFamily: "'Bebas Neue',sans-serif", fontSize: '16px', letterSpacing: '1.5px' }}>
 {cta} <ArrowRight size={16} />
 </button>
 </div>
 </div>
 </div>
 );
}

function WhySection() {
 const { ref, visible } = useScrollReveal();
 const items = [
 { icon: Shield, color: 'var(--orange)', label: 'Certified Masters', desc: 'All instructors are nationally certified with decades of training experience.' },
 { icon: Target, color: '#3B82F6', label: 'Structured Curriculum', desc: 'Scientifically designed belt & stage progression that tracks real skill growth.' },
 { icon: Zap, color: 'var(--yellow)', label: 'Digital Hall Tickets', desc: 'Instant online registration with QR-coded hall tickets and digital results.' },
 { icon: Users, color: '#22C55E', label: 'School Batch Programs', desc: 'Special bulk programs for schools, with dedicated referee and batch management.' },
 { icon: Medal, color: '#7C3AED', label: 'Championship Pathway', desc: 'Our students compete at state and national level tournaments regularly.' },
 { icon: Clock, color: '#EF4444', label: 'Flexible Scheduling', desc: 'Morning, evening, and weekend batches to fit every student\'s lifestyle.' },
 ];
 return (
 <section className="py-24" style={{ background: 'var(--ink)' }}>
 <div className="max-w-[1200px] mx-auto px-6">
 <SectionHeader
 eyebrow="WHY SHADOW KAI"
 title={<>Built for<br /><span style={{ color: 'var(--orange)' }}>Champions</span></>}
 subtitle="We combine traditional martial arts wisdom with modern management systems for an unparalleled learning experience."
 dark={true}
 />

 <div ref={ref} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-16">
 {items.map((item, i) => {
 const Icon = item.icon;
 return (
 <div key={item.label}
 className="p-6 rounded-2xl group cursor-default transition-all duration-700"
 style={{
 opacity: visible ? 1 : 0,
 transform: visible ? 'none' : 'translateY(32px)',
 transitionDelay: `${i * 80}ms`,
 background: 'rgba(255,255,255,0.04)',
 border: '1px solid rgba(255,255,255,0.07)',
 }}>
 <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
 style={{ background: `${item.color}1a` }}>
 <Icon size={22} style={{ color: item.color }} />
 </div>
 <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '20px', letterSpacing: '1px', color: '#fff', marginBottom: '8px' }}>
 {item.label}
 </div>
 <p style={{ fontSize: '13px', color: 'rgba(255,255,255,.45)', lineHeight: 1.6 }}>
 {item.desc}
 </p>
 </div>
 );
 })}
 </div>

 {/* Featured image strip */}
 <div className="mt-16 grid md:grid-cols-3 gap-4">
 {[IMG_TRAINING, IMG_WARRIOR, IMG_FESTIVAL].map((img, i) => (
 <div key={i} className="relative rounded-2xl overflow-hidden h-52 group">
 <img src={img} alt="" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-60" />
 <div className="absolute inset-0 group-hover:bg-transparent transition-all duration-300"
 style={{ background: 'rgba(13,13,13,0.3)' }} />
 </div>
 ))}
 </div>
 </div>
 </section>
 );
}

function BeltRow({ belt, index, total }: { belt: typeof BELTS[0]; index: number; total: number }) {
 const { ref, visible } = useScrollReveal();
 const isBlack = belt.name === 'Black';
 return (
 <div ref={ref}
 className="flex items-center gap-4 p-3 rounded-xl transition-all duration-500"
 style={{
 opacity: visible ? 1 : 0,
 transform: visible ? 'none' : 'translateX(-24px)',
 transitionDelay: `${index * 60}ms`,
 background: isBlack ? 'var(--ink)' : '#fff',
 border: `1.5px solid ${belt.border}33`,
 }}>
 {/* Belt swatch */}
 <div className="w-16 h-5 rounded-md flex-shrink-0"
 style={{ background: belt.color, border: `2px solid ${belt.border}`, boxShadow: isBlack ? '0 0 12px rgba(255,215,0,0.3)' : 'none' }} />
 <div className="flex-1">
 <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '16px', letterSpacing: '1px', color: isBlack ? '#fff' : 'var(--ink)' }}>
 {belt.name} Belt
 </div>
 </div>
 {/* Progress bar */}
 <div className="flex gap-1">
 {Array.from({ length: total }).map((_, j) => (
 <div key={j} className="w-1.5 h-1.5 rounded-full"
 style={{ background: j <= index ? belt.color : 'rgba(0,0,0,.1)' }} />
 ))}
 </div>
 </div>
 );
}

function SilambamStageRow({ stage, index }: { stage: typeof SILAMBAM_STAGES[0]; index: number }) {
 const { ref, visible } = useScrollReveal();
 return (
 <div ref={ref}
 className="flex items-center gap-4 p-4 rounded-xl"
 style={{
 opacity: visible ? 1 : 0,
 transform: visible ? 'none' : 'translateX(24px)',
 transitionDelay: `${index * 70}ms`,
 transition: 'all 0.5s ease',
 background: '#fff',
 border: `1.5px solid ${stage.color}33`,
 }}>
 <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
 style={{ background: `${stage.color}15` }}>
 <span style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '16px', color: stage.color }}>
 {index + 1}
 </span>
 </div>
 <div>
 <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '16px', letterSpacing: '1px', color: 'var(--ink)' }}>
 {stage.stage}
 </div>
 <div style={{ fontSize: '12px', color: '#777' }}>{stage.desc}</div>
 </div>
 <div className="ml-auto w-2 h-2 rounded-full flex-shrink-0" style={{ background: stage.color }} />
 </div>
 );
}

function GallerySection() {
 const { ref, visible } = useScrollReveal();
 const photos = [
 { src: IMG_HERO, span: 'col-span-2', h: 'h-72' },
 { src: IMG_DOJO, span: 'col-span-1', h: 'h-72' },
 { src: IMG_TRAINING, span: 'col-span-1', h: 'h-56' },
 { src: IMG_WARRIOR, span: 'col-span-1', h: 'h-56' },
 { src: IMG_FESTIVAL, span: 'col-span-1', h: 'h-56' },
 ];
 return (
 <section id="gallery" className="py-24" style={{ background: 'var(--ink)' }}>
 <div className="max-w-[1200px] mx-auto px-6">
 <SectionHeader
 eyebrow="GALLERY"
 title={<>Training.<br /><span style={{ color: 'var(--orange)' }}>Competing. Growing.</span></>}
 subtitle="A glimpse into the world of Shadow Kai — where every class, every belt, every tournament is a chapter in your story."
 dark={true}
 />

 <div ref={ref} className="grid grid-cols-3 gap-4 mt-16">
 {photos.map((p, i) => (
 <div key={i}
 className={`${p.span} ${p.h} rounded-2xl overflow-hidden group relative transition-all duration-700`}
 style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'scale(0.94)', transitionDelay: `${i * 100}ms` }}>
 <img src={p.src} alt="" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
 <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
 style={{ background: 'rgba(255,140,0,0.2)' }} />
 </div>
 ))}
 </div>
 </div>
 </section>
 );
}

function CtaSection({ navigate }: { navigate: (path: string) => void }) {
 const { ref, visible } = useScrollReveal();
 return (
 <section className="py-24 relative overflow-hidden" style={{ background: 'var(--orange)' }}>
 {/* BG pattern */}
 <div className="absolute inset-0 opacity-10">
 <img src={IMG_KARATE} alt="" className="w-full h-full object-cover" />
 </div>
 <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(255,140,0,0.95) 0%, rgba(255,60,0,0.9) 100%)' }} />

 <div ref={ref} className="relative max-w-[1200px] mx-auto px-6 text-center transition-all duration-700"
 style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(32px)' }}>
 <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6"
 style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.2)' }}>
 <Flame size={14} color="#fff" />
 <span style={{ color: '#fff', fontSize: '11px', fontFamily: "'Bebas Neue',sans-serif", letterSpacing: '2.5px' }}>
 REGISTRATIONS NOW OPEN
 </span>
 </div>

 <h2 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(24px,5.25vw,67.5px)', lineHeight: 0.92, letterSpacing: '2px', color: '#fff' }}>
 BEGIN YOUR
 <br />
 WARRIOR
 <br />
 JOURNEY TODAY
 </h2>

 <p className="mt-6 mb-10 mx-auto" style={{ color: 'rgba(255,255,255,0.85)', fontSize: '16px', maxWidth: '480px', lineHeight: 1.7 }}>
 Join hundreds of students across Tamil Nadu who have transformed their lives through the discipline of martial arts.
 </p>

 <div className="flex flex-wrap justify-center gap-4">
 <button onClick={() => navigate('/karate/register')}
 className="inline-flex items-center gap-3 px-10 py-5 rounded-2xl font-bold transition-all hover:translate-y-[-3px] hover:shadow-[0_20px_40px_rgba(0,0,0,0.3)] active:scale-95"
 style={{ background: '#fff', color: 'var(--orange)', fontFamily: "'Bebas Neue',sans-serif", fontSize: '22px', letterSpacing: '2px' }}>
 <Award size={22} />
 KARATE BELT TEST
 </button>
 <button onClick={() => navigate('/selambam/register')}
 className="inline-flex items-center gap-3 px-10 py-5 rounded-2xl font-bold transition-all hover:translate-y-[-3px] hover:shadow-[0_20px_40px_rgba(0,0,0,0.3)] active:scale-95"
 style={{ background: 'rgba(0,0,0,0.2)', color: '#fff', border: '2px solid rgba(255,255,255,0.4)', fontFamily: "'Bebas Neue',sans-serif", fontSize: '22px', letterSpacing: '2px' }}>
 <Trophy size={22} />
 SILAMBAM STAGE
 </button>
 </div>
 </div>
 </section>
 );
}

function Footer({ navigate }: { navigate: (path: string) => void }) {
 return (
 <footer style={{ background: '#080808', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
 <div className="max-w-[1200px] mx-auto px-6 py-16">
 <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-10">
 {/* Brand */}
 <div className="lg:col-span-2">
 <div className="flex items-center gap-3 mb-5">
 <img src={logo} alt="Shadow Kai" className="w-12 h-12 object-cover" />
 <div>
 <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '22px', letterSpacing: '2.5px', color: '#fff', lineHeight: 1 }}>
 SHADOW KAI KARATE
 </div>
 <div style={{ fontSize: '11px', color: 'rgba(255,255,255,.35)', letterSpacing: '1px' }}>
 SHADOW KAI
 </div>
 </div>
 </div>
 <p style={{ color: 'rgba(255,255,255,.4)', fontSize: '13px', lineHeight: 1.7, maxWidth: '320px' }}>
 Forging champions through traditional Shitoryu Karate and the ancient Tamil art of Silambam. 
 Discipline, respect, and excellence — since 2009.
 </p>
 <div className="flex gap-3 mt-6">
 {['FB', 'IG', 'YT'].map(s => (
 <div key={s} className="w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer transition-all hover:scale-110"
 style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,.4)', fontFamily: "'Bebas Neue',sans-serif", fontSize: '12px', letterSpacing: '1px' }}>
 {s}
 </div>
 ))}
 </div>
 </div>

 {/* Programs */}
 <div>
 <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '16px', letterSpacing: '2px', color: 'var(--orange)', marginBottom: '16px' }}>
 PROGRAMS
 </div>
 <div className="space-y-3">
 {['Karate Belt Test', 'Silambam Stages', 'School Batch Programs', 'Individual Training', 'Championship Events'].map(l => (
 <div key={l} style={{ fontSize: '13px', color: 'rgba(255,255,255,.4)', cursor: 'pointer' }}
 onMouseOver={e => (e.currentTarget.style.color = 'rgba(255,255,255,.8)')}
 onMouseOut={e => (e.currentTarget.style.color = 'rgba(255,255,255,.4)')}>
 {l}
 </div>
 ))}
 </div>
 </div>

 {/* Contact */}
 <div>
 <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '16px', letterSpacing: '2px', color: 'var(--orange)', marginBottom: '16px' }}>
 CONTACT
 </div>
 <div className="space-y-4">
 {[
 { icon: MapPin, text: 'Tamil Nadu, India' },
 { icon: Phone, text: '+91 95005 30441' },
 { icon: Mail, text: 'info@teamshadowkai.com' },
 ].map(({ icon: Icon, text }) => (
 <div key={text} className="flex items-center gap-3">
 <Icon size={14} style={{ color: 'var(--orange)', flexShrink: 0 }} />
 <span style={{ fontSize: '13px', color: 'rgba(255,255,255,.45)' }}>{text}</span>
 </div>
 ))}
 </div>

 <div className="mt-8 space-y-2">
 <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '13px', letterSpacing: '2px', color: 'rgba(255,255,255,.25)', marginBottom: '8px' }}>
 PORTAL ACCESS
 </div>
 <a href="/admin/login" className="block text-xs transition-all hover:text-white"
 style={{ color: 'rgba(255,255,255,.35)' }}>
 Admin Login →
 </a>
 <a href="/referee/login" className="block text-xs transition-all hover:text-white"
 style={{ color: 'rgba(255,255,255,.35)' }}>
 Referee Login →
 </a>
 </div>
 </div>
 </div>

 {/* Bottom bar */}
 <div className="mt-14 pt-6 flex flex-col md:flex-row items-center justify-between gap-4"
 style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
 <div style={{ fontSize: '12px', color: 'rgba(255,255,255,.25)' }}>
 © {new Date().getFullYear()} Shadow Kai Karate Academy. All rights reserved.
 </div>
 <div style={{ fontSize: '12px', color: 'rgba(255,255,255,.25)' }}>
 Shadow Kai · Karate · Silambam · Tamil Nadu
 </div>
 </div>
 </div>
 </footer>
 );
}
