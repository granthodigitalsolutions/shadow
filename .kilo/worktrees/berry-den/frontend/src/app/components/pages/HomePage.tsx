import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import SeoHead from '../seo/SeoHead';
import { localBusinessSchema } from '../../../utils/seo-schemas';
import { m, useInView, LazyMotion, domAnimation } from 'motion/react';
import { ArrowRight, Award, Trophy, Shield, Users, Target, Zap, Medal, Clock, Flame, ChevronDown, CheckCircle, Star, Quote, ShieldCheck } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import AnimatedCounter from '../ui/AnimatedCounter';
import FAQSection from '../sections/FAQSection';
import ProgressionSection from '../sections/ProgressionSection';
import CoachesSection from '../sections/CoachesSection';


import {
  karateTournament05, karateTournament06, karateTournament07,
  silambamStickCombat02, silambamAcrobatics03, silambamGroupCranePose01,
  karateFamilyPose02, silambamStickCombat04, karateTournament08,
  karateTournament20, karateAction01
} from '../../../assets/images';

const imgHero = silambamAcrobatics03;
const imgKarate = karateAction01;
const imgSilambam = silambamStickCombat02;
const imgTraining = karateTournament06;
const imgWarrior = silambamGroupCranePose01;
const imgDojo = karateTournament07;
const imgBelt = silambamStickCombat04;
const imgAbout = karateTournament08;

// ── Components ──────────────────────────────────────────────────────────────
function SectionHeader({ eyebrow, title, subtitle, dark = false }: { eyebrow: string; title: React.ReactNode; subtitle: string; dark?: boolean }) {
  return (
    <m.div 
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6 }}
      className="text-center"
    >
      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-5"
        style={{ background: dark ? 'rgba(255,140,0,0.15)' : 'rgba(255,140,0,0.1)', border: '1px solid rgba(255,140,0,0.3)' }}>
        <span style={{ color: 'var(--orange)', fontSize: '11px', fontFamily: "'Bebas Neue',sans-serif", letterSpacing: '2.5px' }}>
          {eyebrow}
        </span>
      </div>
      <h2 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(24px,6vw,48px)', lineHeight: 1, letterSpacing: '1.5px', color: dark ? '#fff' : 'var(--ink)' }}>
        {title}
      </h2>
      <p className="mx-auto mt-5" style={{ color: dark ? 'rgba(255,255,255,0.55)' : '#666', maxWidth: '560px', lineHeight: 1.7, fontSize: '15px' }}>
        {subtitle}
      </p>
    </m.div>
  );
}

// ── HomePage ────────────────────────────────────────────────────────────────
export default function HomePage() {
  const navigate = useNavigate();

  return (
    <LazyMotion features={domAnimation}>
      <div className="bg-white overflow-hidden">
        <SeoHead 
          title="Best Karate & Silambam Academy in Tiruppur | Team Shadow Kai"
        description="Join Team Shadow Kai, the leading Karate and Traditional Silambam academy in Tiruppur, Tamil Nadu. Professional coaching for kids and adults. Enroll today."
        keywords="Karate Classes in Tiruppur, Silambam Classes in Tiruppur, Best Karate Academy, Martial Arts Tamil Nadu, Kids Karate"
        schema={localBusinessSchema}
      />
      
      {/* 1. HERO SECTION */}
      <section className="relative min-h-[90vh] flex items-center pt-20" style={{ background: '#0D0D0D' }}>
        <div className="absolute inset-0">
          {/* Using a local image now instead of unsplash! Fallback to black if not found during dev build */}
          <img src={imgHero} alt="Team Shadow Kai Karate and Silambam Training in Tiruppur" className="w-full h-full object-cover object-[center_20%] opacity-70" loading="eager" fetchpriority="high" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0D0D0D] via-[#0D0D0D]/80 to-[#0D0D0D]/20" />
        </div>

        <div className="relative max-w-[1200px] mx-auto px-6 py-24 w-full">
          <div 
            className="max-w-[700px] animate-fade-in-left"
            style={{ opacity: 0, animationFillMode: 'forwards' }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8 bg-orange-500/15 border border-orange-500/30">
              <Flame size={14} className="text-orange-500" />
              <span className="text-orange-700 dark:text-orange-400 text-xs font-bebas tracking-[2px]">TEAM SHADOW KAI</span>
            </div>

            <h1 className="text-[clamp(24px,8.25vw,67.5px)] leading-[0.92] tracking-wide text-white font-bebas">
              TEAM SHADOW KAI <br/>
              <span className="text-transparent" style={{ WebkitTextStroke: '2px var(--orange)' }}>MARTIAL ARTS</span><br/>
              IN TIRUPPUR
            </h1>

            <p className="mt-6 mb-10 text-sm md:text-sm leading-relaxed text-white/70 max-w-[500px]">
              Tiruppur's premier Karate & Traditional Silambam academy. Train with certified masters in Tamil Nadu and discover your true potential in a traditional yet modern environment. Over 30,000 students trained since 1986.
            </p>

            <div className="flex flex-wrap gap-4 mb-12">
              <button onClick={() => navigate('/karate/register')}
                className="group inline-flex items-center gap-3 px-8 py-4 rounded-2xl font-bold transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(255,140,0,0.4)] active:scale-95 bg-orange-500 text-black font-bebas text-sm tracking-wide">
                <Award size={20} />
                KARATE PROGRAM
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
              <button onClick={() => navigate('/selambam/register')}
                className="group inline-flex items-center gap-3 px-8 py-4 rounded-2xl font-bold transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(34,197,94,0.3)] active:scale-95 bg-green-500/10 text-green-500 border-2 border-green-500/40 font-bebas text-sm tracking-wide">
                <Trophy size={20} />
                SILAMBAM PATH
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>

        <div 
          className="absolute bottom-8 left-1/2 flex flex-col items-center gap-2 animate-bounce-slow"
        >
          <span className="text-[7.5px] text-white/40 tracking-[2px] uppercase">Scroll</span>
          <ChevronDown size={18} className="text-white/40" />
        </div>
      </section>

      {/* 2. WHY SHADOW KAI */}
      <section className="py-24 lg:py-32 bg-white overflow-hidden relative">
        <div className="max-w-[1400px] mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
            
            {/* Left Column: Typography & CTA */}
            <div className="pr-4">
              <m.div 
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6 }}
              >
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6 bg-orange-500/10 border border-orange-500/20">
                  <span className="text-orange-700 dark:text-orange-400 text-xs font-bebas tracking-[2.5px]">WHY SHADOW KAI</span>
                </div>
                
                <h2 className="font-bebas text-[clamp(27px,6.75vw,42px)] leading-[1.05] tracking-wide text-gray-900 mb-6">
                  TEAM SHADOW KAI: BUILT FOR <span className="text-orange-500">CHAMPIONS.</span><br/>
                  TRAIN WITH CONFIDENCE.
                </h2>
                
                <p className="text-gray-600 text-sm md:text-sm leading-relaxed mb-10 max-w-[480px]">
                  Master traditional martial arts with nationally certified instructors in a proven, discipline-focused environment.
                </p>

                <button onClick={() => navigate('/programs')}
                  className="group inline-flex items-center gap-3 px-8 py-4 rounded-xl font-bold transition-all duration-300 hover:-translate-y-1 shadow-lg hover:shadow-[0_12px_30px_rgba(255,140,0,0.3)] active:scale-95 bg-gray-900 text-white font-bebas text-sm tracking-wide">
                  EXPLORE PROGRAMS
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform text-orange-500" />
                </button>
              </m.div>
            </div>

            {/* Right Column: Hero Image with Floating Badges */}
            <div className="relative mt-12 lg:mt-0">
              {/* Main Image */}
              <m.div 
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="relative rounded-3xl overflow-hidden shadow-2xl aspect-[4/5] md:aspect-[4/3] lg:aspect-square group"
              >
                <img src={imgAbout} alt="Shadow Kai Training" className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105" loading="lazy" />
                <div className="absolute inset-0 bg-gradient-to-tr from-black/60 via-black/10 to-transparent pointer-events-none" />
              </m.div>



            </div>

          </div>
        </div>
      </section>

      {/* 3. PROGRAMS OVERVIEW */}
      <section className="py-24 bg-white border-t border-gray-100">
        <div className="max-w-[1200px] mx-auto px-6">
          <SectionHeader
            eyebrow="OUR PROGRAMS"
            title={<>Two Ancient Arts, <br/><span className="text-orange-500">One Academy</span></>}
            subtitle="Choose your path: the discipline of Karate or the agility of Silambam."
          />
          <div className="grid md:grid-cols-2 gap-8 mt-16">
            <ProgramCard 
              img={imgKarate} title="KARATE" subtitle="Shitoryu Style" badge="REGISTRATION OPEN" 
              color="var(--orange)" 
              desc="Master the ancient Japanese art of Shitoryu Karate. Structured belt system from White to Black."
              onClick={() => navigate('/programs')}
            />
            <ProgramCard 
              img={imgSilambam} title="SILAMBAM" subtitle="Tamil Heritage Art" badge="STAGES 1-5" 
              color="#22C55E" 
              desc="Discover Silambam — Tamil Nadu's ancient stick martial art. Develop agility and cultural pride."
              onClick={() => navigate('/programs')}
            />
          </div>
        </div>
      </section>

      {/* 4. GALLERY PREVIEW */}
      <section className="py-24 bg-zinc-950 text-white">
        <div className="max-w-[1200px] mx-auto px-6">
          <SectionHeader
            dark
            eyebrow="GALLERY PREVIEW"
            title={<>Inside <span className="text-orange-500">The Dojo</span></>}
            subtitle="Take a look at our training sessions, belt tests, and championships."
          />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-12">
            {[imgTraining, imgWarrior, imgDojo, imgBelt].map((img, i) => (
              <m.div 
                key={i}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                
                transition={{ delay: i * 0.1 }}
                className="aspect-square rounded-2xl overflow-hidden relative group cursor-pointer"
                onClick={() => navigate('/gallery')}
              >
                <img src={img} alt="Gallery" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" loading="lazy" />
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors" />
              </m.div>
            ))}
          </div>
          <div className="text-center mt-12">
            <button onClick={() => navigate('/gallery')} className="px-8 py-3 rounded-xl border border-white/20 hover:bg-white/10 font-bebas tracking-wide text-sm transition-colors">
              VIEW FULL GALLERY
            </button>
          </div>
        </div>
      </section>

      {/* 5. ACHIEVEMENTS PREVIEW */}
      <section className="py-24 bg-white">
        <div className="max-w-[1200px] mx-auto px-6">
          <SectionHeader
            eyebrow="ACADEMY EXCELLENCE"
            title={<>Our <span className="text-orange-500">Achievements</span></>}
            subtitle="Producing champions at the state, national, and international levels."
          />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6 mt-16 text-center">
            {[
              { value: '40+', label: 'Years' },
              { value: '4,000+', label: 'Active Students' },
              { value: '5,000+', label: 'Black Belts Produced' },
              { value: '80+', label: 'Champions' },
              { value: '30,000+', label: 'Total Students Trained' },
              { value: '1986', label: 'Founded Since' },
            ].map((stat, i) => (
              <m.div 
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="bg-gray-50 p-4 sm:p-6 md:p-8 rounded-3xl border border-gray-100"
              >
                <div className="text-2xl min-[400px]:text-3xl sm:text-4xl lg:text-5xl font-bebas text-orange-500 mb-2">
                  <AnimatedCounter value={stat.value} />
                </div>
                <div className="text-xs sm:text-sm lg:text-base font-semibold text-gray-500 uppercase tracking-wide">{stat.label}</div>
              </m.div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. FOUNDER & HEAD COACH SECTION */}
      <section className="py-24 bg-white overflow-hidden relative border-t border-gray-100">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Image Side */}
            <m.div 
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              className="relative min-h-[500px] lg:min-h-[600px] rounded-3xl overflow-hidden shadow-2xl"
            >
              <img src={karateTournament20} alt="Gowtham Ragunathan - Founder" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
              <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/20 to-transparent" />
              
              <div className="absolute bottom-8 left-8 right-8">
                <div className="inline-block px-4 py-1.5 bg-orange-500 rounded-full text-white text-xs font-bold tracking-wider mb-4">
                  FOUNDER & HEAD COACH
                </div>
                <h3 className="font-bebas text-white text-[clamp(24px,3.375vw,42px)] leading-none tracking-wide mb-2">GOWTHAM RAGUNATHAN</h3>
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="px-3 py-1 bg-white/10 backdrop-blur-md rounded-md text-white/90 text-sm font-medium border border-white/20">WKF Certified Coach</span>
                  <span className="px-3 py-1 bg-white/10 backdrop-blur-md rounded-md text-white/90 text-sm font-medium border border-white/20">International Black Belt</span>
                </div>
              </div>
            </m.div>

            {/* Content Side */}
            <m.div 
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-4 bg-orange-500/10 border border-orange-500/20">
                <span className="text-orange-700 dark:text-orange-400 text-xs font-bebas tracking-[2.5px]">LEADERSHIP</span>
              </div>
              
              <h2 className="font-bebas text-[clamp(27px,6.75vw,42px)] leading-[1.05] tracking-wide text-gray-900 mb-6">
                MEET THE <span className="text-orange-500">FOUNDER</span>
              </h2>
              
              <div className="space-y-6 text-gray-600 text-sm leading-relaxed mb-8">
                <p>
                  <strong className="text-gray-900">Karate, Silambam, Taekwondo & Self-Defense Coach</strong><br/>
                  Instructor with a World [WKF] Coach License and International Black Belt Diploma in multiple disciplines. Fully trained by documented masters with a vast amount of knowledge and experience in martial arts.
                </p>
              </div>

              {/* Highlighted Credentials Grid */}
              <div className="grid sm:grid-cols-2 gap-4 mb-10">
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex items-start gap-3 transition-colors hover:border-orange-500/30">
                  <div className="bg-orange-500/10 p-2 rounded-lg text-orange-500 mt-1">
                    <Medal size={20} />
                  </div>
                  <div>
                    <div className="font-bold text-gray-900 text-sm">USA-TKFI & KIO</div>
                    <div className="text-gray-500 text-sm">Certified Coach</div>
                  </div>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex items-start gap-3 transition-colors hover:border-orange-500/30">
                  <div className="bg-orange-500/10 p-2 rounded-lg text-orange-500 mt-1">
                    <Trophy size={20} />
                  </div>
                  <div>
                    <div className="font-bold text-gray-900 text-sm">Best Coach Award</div>
                    <div className="text-gray-500 text-sm">Consecutive Medalist Producer</div>
                  </div>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex items-start gap-3 transition-colors hover:border-orange-500/30">
                  <div className="bg-orange-500/10 p-2 rounded-lg text-orange-500 mt-1">
                    <Award size={20} />
                  </div>
                  <div>
                    <div className="font-bold text-gray-900 text-sm">Specialized Skills</div>
                    <div className="text-gray-500 text-sm">Fat Loss & Functional Training</div>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex items-start gap-3 transition-colors hover:border-orange-500/30">
                  <div className="bg-orange-500/10 p-2 rounded-lg text-orange-500 mt-1">
                    <ShieldCheck size={20} />
                  </div>
                  <div>
                    <div className="font-bold text-gray-900 text-sm">Krav Maga</div>
                    <div className="text-gray-500 text-sm">Self-Defense Expert</div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <button onClick={() => navigate('/about')}
                  className="group inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl font-bold transition-all duration-300 hover:-translate-y-1 shadow-lg hover:shadow-[0_12px_30px_rgba(255,140,0,0.3)] active:scale-95 bg-orange-500 text-black font-bebas text-sm tracking-wide">
                  FULL PROFILE & AWARDS
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </button>
                <button onClick={() => navigate('/achievements')}
                  className="group inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl font-bold transition-all duration-300 hover:-translate-y-1 shadow-lg hover:shadow-[0_12px_30px_rgba(0,0,0,0.1)] active:scale-95 bg-gray-900 text-white font-bebas text-sm tracking-wide">
                  COACHING ACHIEVEMENTS
                </button>
              </div>
              
            </m.div>
          </div>
        </div>
      </section>

      {/* 6.5. COACHES SECTION */}
      <CoachesSection />

      {/* 7. TESTIMONIALS PREVIEW */}
      <section className="py-24 bg-gray-50">
        <div className="max-w-[1200px] mx-auto px-6">
          <SectionHeader
            eyebrow="TESTIMONIALS"
            title={<>What Parents <span className="text-orange-500">Say</span></>}
            subtitle="The impact of our martial arts training on real families."
          />
          <div className="grid md:grid-cols-2 gap-8 mt-16">
            <m.div 
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              
              className="bg-white p-8 rounded-3xl shadow-lg border border-gray-100"
            >
              <p className="text-gray-600 text-sm italic mb-6">"Shadow Kai has completely transformed my son. Not only has his physical fitness improved, but his focus in school and respect for others is incredible. The Sensei is patient but firm."</p>
              <div className="flex items-center gap-4">
                <img src={karateFamilyPose02} alt="Parent" className="w-12 h-12 rounded-full object-cover" loading="lazy" />
                <div>
                  <div className="font-bold text-gray-900">Sarah Johnson</div>
                  <div className="text-sm text-gray-500">Parent of Yellow Belt</div>
                </div>
              </div>
            </m.div>
            <m.div 
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              
              className="bg-white p-8 rounded-3xl shadow-lg border border-gray-100"
            >
              <p className="text-gray-600 text-sm italic mb-6">"Learning Silambam here connects me to my roots. The training is intense but highly rewarding. The acrobatics and stick combat techniques taught are authentic and practical."</p>
              <div className="flex items-center gap-4">
                <img src={silambamGroupCranePose01} alt="Student" className="w-12 h-12 rounded-full object-cover" loading="lazy" />
                <div>
                  <div className="font-bold text-gray-900">Karthik Raja</div>
                  <div className="text-sm text-gray-500">Silambam Student</div>
                </div>
              </div>
            </m.div>
          </div>
          <div className="text-center mt-12">
            <button onClick={() => navigate('/testimonials')} className="font-bebas text-orange-700 dark:text-orange-400 tracking-wide text-sm hover:underline">
              READ MORE TESTIMONIALS
            </button>
          </div>
        </div>
      </section>

      {/* BELT PROGRESSION SECTION */}
      <ProgressionSection />

      {/* FAQ SECTION */}
      <FAQSection />

      {/* 8. CTA SECTION */}
      <section className="py-32 bg-[#0D0D0D] relative overflow-hidden text-center text-white">
        <div className="absolute inset-0 bg-gradient-to-t from-orange-500/20 to-transparent" />
        <m.div 
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          
          className="relative z-10 max-w-3xl mx-auto px-6"
        >
          <h2 className="text-[clamp(24px,6.75vw,45px)] leading-[1] font-bebas tracking-wide mb-6">READY TO BEGIN YOUR <span className="text-orange-500">JOURNEY?</span></h2>
          <p className="text-white/70 text-sm mb-10">Join our academy today and take the first step towards physical excellence and mental resilience.</p>
          <div className="flex flex-wrap justify-center gap-4">
            <button onClick={() => navigate('/karate/register')} className="px-8 py-4 bg-orange-500 text-black font-bebas text-sm tracking-wide rounded-xl shadow-[0_10px_30px_rgba(255,140,0,0.4)] hover:-translate-y-1 transition-transform">
              REGISTER FOR KARATE
            </button>
            <button onClick={() => navigate('/selambam/register')} className="px-8 py-4 bg-white/10 text-white font-bebas text-sm tracking-wide rounded-xl hover:bg-white/20 transition-colors border border-white/20">
              REGISTER FOR SILAMBAM
            </button>
          </div>
        </m.div>
      </section>

      </div>
    </LazyMotion>
  );
}

function ProgramCard({ img, title, subtitle, badge, color, desc, onClick }: any) {
  return (
    <m.div 
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      
      className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-xl shadow-gray-200/50 group cursor-pointer"
      onClick={onClick}
    >
      <div className="h-64 relative overflow-hidden">
        <img src={img} alt={title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" loading="lazy" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
        <div className="absolute bottom-6 left-6 right-6">
          <div className="inline-block px-3 py-1 mb-2 text-xs font-bebas tracking-wide rounded-full" style={{ background: color, color: '#fff' }}>
            {badge}
          </div>
          <h3 className="font-bebas text-sm text-white tracking-wide">{title}</h3>
          <p className="text-white/70 text-sm">{subtitle}</p>
        </div>
      </div>
      <div className="p-6">
        <p className="text-gray-600 mb-6">{desc}</p>
        <button className="flex items-center gap-2 font-bebas text-sm tracking-wide" style={{ color }}>
          LEARN MORE <ArrowRight size={18} />
        </button>
      </div>
    </m.div>
  );
}

