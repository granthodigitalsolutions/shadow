import { motion } from 'motion/react';
import SeoHead from '../seo/SeoHead';
import { localBusinessSchema } from '../../../utils/seo-schemas';
import { Target, Star, Award, Shield, Trophy, Zap, ChevronDown } from 'lucide-react';
import { karateFamilyPose01, karateGroupTraining01, silambamAcrobatics04 } from '../../../assets/images';

import AnimatedCounter from '../ui/AnimatedCounter';

const JOURNEY_STEPS = [
  { title: 'Join Academy', desc: 'Begin your martial arts journey with Team Shadow Kai and build a strong foundation in discipline, confidence, and character.', icon: Target, color: '#3B82F6' },
  { title: 'Elevate Your Physical & Mental Strength', desc: 'Develop focus, fitness, flexibility, confidence, and self-discipline through structured martial arts training.', icon: Shield, color: '#10B981' },
  { title: 'Beginner Stage 1', desc: 'Learn the fundamentals of stance, rotation, blocking, and striking techniques.', icon: Award, color: '#9CA3AF' },
  { title: 'Beginner Stage 2', desc: 'Master essential movements, coordination, balance, and body control.', icon: Award, color: '#FACC15' },
  { title: 'Intermediate Stage 1', desc: 'Learn the core principles of practical self-defence and controlled techniques.', icon: Award, color: '#F97316' },
  { title: 'Intermediate Stage 2', desc: 'Understand sports movements, tournament rules, and competitive techniques.', icon: Award, color: '#3B82F6' },
  { title: 'Intermediate Stage 3', desc: 'Develop greater power, speed, endurance, precision, and advanced combinations.', icon: Award, color: '#6366F1' },
  { title: 'Advanced Stage', desc: 'This stage represents mastery beyond the intermediate levels and prepares students for higher technical excellence.', icon: Award, color: '#111827' },
  { title: 'Tournament Competitor', desc: 'Participate confidently in district, state, national, and international championships while representing Team Shadow Kai.', icon: Trophy, color: '#EAB308' },
  { title: 'Leadership & Mastery', desc: 'Become a mentor, role model, and future instructor by embodying discipline, leadership, and martial arts excellence.', icon: Zap, color: '#EF4444' }
];

export default function JourneyPage() {
  return (
    <div className="pt-28 pb-24 min-h-screen bg-gray-50">
      <SeoHead 
        title="Student Journey | Karate Belt Test & Silambam Training | Team Shadow Kai"
        description="Follow the martial arts journey from beginner to Black Belt at Team Shadow Kai. Discover our structured Karate belt test and Silambam stages in Tiruppur."
        keywords="Karate Belt Test, Silambam Training Stages, Martial Arts Journey, Black Belt Training Tiruppur"
        schema={localBusinessSchema}
      />
      <div className="max-w-[1000px] mx-auto px-6">
        
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-24"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-4" style={{ background: 'rgba(255,140,0,0.1)', border: '1px solid rgba(255,140,0,0.3)' }}>
            <span style={{ color: 'var(--orange)', fontSize: '11px', fontFamily: "'Bebas Neue',sans-serif", letterSpacing: '2px' }}>STUDENT PROGRESSION</span>
          </div>
          <h1 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(24px,4.5vw,48px)', lineHeight: 1, letterSpacing: '1px', color: 'var(--ink)' }}>
            The <span style={{ color: 'var(--orange)' }}>Journey</span>
          </h1>
          <p className="mt-4 text-gray-600 max-w-2xl mx-auto text-sm leading-relaxed">
            From the first time you step onto the mat to the moment you tie your black belt, the path of a martial artist is a journey of continuous growth.
          </p>
        </motion.div>

        {/* Timeline */}
        <div className="relative">
          {/* Vertical Line */}
          <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-1 bg-gradient-to-b from-orange-500/20 via-orange-500/50 to-orange-500/10 -translate-x-1/2" />
          
          {JOURNEY_STEPS.map((step, i) => {
            const isEven = i % 2 === 0;
            const Icon = step.icon;
            
            return (
              <motion.div 
                key={step.title}
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                
                transition={{ duration: 0.5, delay: 0.1 }}
                className={`relative flex items-center mb-12 md:mb-24 ${isEven ? 'md:flex-row-reverse' : ''}`}
              >
                {/* Center Node */}
                <div className="absolute left-4 md:left-1/2 w-12 h-12 rounded-full border-4 border-gray-50 flex items-center justify-center -translate-x-1/2 shadow-xl z-10" style={{ background: step.color }}>
                  <Icon size={20} className="text-white" />
                </div>
                
                {/* Content Card */}
                <div className={`ml-16 md:ml-0 md:w-1/2 ${isEven ? 'md:pl-16' : 'md:pr-16 text-left md:text-right'}`}>
                  <div className="bg-white p-6 md:p-8 rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 hover:-translate-y-1 transition-transform">
                    <div className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Stage {i + 1}</div>
                    <h3 className="text-sm font-bebas tracking-wide text-gray-900 mb-2">{step.title}</h3>
                    <p className="text-gray-600 leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Closing Image & CTA */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          
          className="mt-32 relative rounded-3xl overflow-hidden shadow-2xl h-[400px] flex items-center justify-center text-center"
        >
          <img src={karateGroupTraining01} alt="Achievement" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative z-10 p-8">
            <h2 className="text-sm font-bebas text-white tracking-wide mb-4">BEGIN YOUR JOURNEY TODAY</h2>
            <button className="px-8 py-4 bg-orange-500 text-white font-bebas text-sm tracking-wide rounded-xl shadow-[0_10px_30px_rgba(255,140,0,0.4)] hover:-translate-y-1 transition-all active:scale-95">
              REGISTER NOW
            </button>
          </div>
        </motion.div>

        {/* Global Statistics */}
        <div className="mt-24 pt-24 border-t border-gray-200">
          <div className="text-center mb-16">
            <h2 className="text-sm font-bebas tracking-wide text-gray-900">
              JOIN OUR <span className="text-orange-500">GROWING</span> LEGACY
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-8 text-center">
            {[
              { value: '40+', label: 'Years' },
              { value: '4,000+', label: 'Active Students' },
              { value: '5,000+', label: 'Black Belts Produced' },
              { value: '80+', label: 'Champions' },
              { value: '30,000+', label: 'Total Students Trained' },
              { value: '1986', label: 'Founded Since' },
            ].map((stat, i) => (
              <motion.div 
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-white p-8 rounded-3xl border border-gray-100 shadow-xl shadow-gray-200/40"
              >
                <div className="text-sm font-bebas text-orange-500 mb-2">
                  {stat.value === '1986' ? stat.value : <AnimatedCounter value={stat.value} />}
                </div>
                <div className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
        
      </div>
    </div>
  );
}

