import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import SeoHead from '../seo/SeoHead';
import { localBusinessSchema } from '../../../utils/seo-schemas';
import { ArrowRight, CheckCircle } from 'lucide-react';

import imgKarate from '../../../assets/images/gallery/karate/karate-action-01.webp';
import imgSilambam from '../../../assets/images/gallery/silambam/silambam-acrobatics-01.webp';

export default function ProgramsPage() {
  const navigate = useNavigate();

  return (
    <div className="pt-28 pb-24 min-h-screen bg-gray-50">
      <SeoHead 
        title="Karate Belt Test & Silambam Stage Test in Tiruppur | Programs"
        description="Explore our martial arts programs including Kids Karate, Adult Karate, and Traditional Silambam classes in Tiruppur, Tamil Nadu. Enroll at Team Shadow Kai today."
        keywords="Karate Belt Test, Silambam Stage Test, Kids Karate, Adult Karate, Martial Arts Training"
        schema={localBusinessSchema}
      />
      <div className="max-w-[1200px] mx-auto px-6">
        
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-20"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-4" style={{ background: 'rgba(255,140,0,0.1)', border: '1px solid rgba(255,140,0,0.3)' }}>
            <span style={{ color: 'var(--orange)', fontSize: '11px', fontFamily: "'Bebas Neue',sans-serif", letterSpacing: '2px' }}>TRAINING PATHS</span>
          </div>
          <h1 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(24px,4.5vw,48px)', lineHeight: 1, letterSpacing: '1px', color: 'var(--ink)' }}>
            Our <span style={{ color: 'var(--orange)' }}>Programs</span>
          </h1>
          <p className="mt-4 text-gray-600 max-w-2xl mx-auto text-sm leading-relaxed">
            Choose your martial arts journey. We offer structured, professional training in both Japanese Karate and Tamil Silambam for all age groups across Tiruppur and surrounding regions.
          </p>
        </motion.div>

        <div className="space-y-24">
          
          {/* Karate Program */}
          <ProgramDetail 
            title="Karate Belt Test in Tiruppur"
            subtitle="The Path of the Empty Hand"
            img={imgKarate}
            aspect="aspect-[3/4]"
            color="var(--orange)"
            align="left"
            desc="Shitoryu is one of the four major schools of Karate in Japan. It emphasizes fast, powerful strikes and fluid blocks. Our curriculum covers kihon (basics), kata (forms), and kumite (sparring), providing a holistic approach to self-defense and physical fitness."
            benefits={['Self-Defense Mastery', 'Increased Focus & Discipline', 'Cardiovascular Fitness', 'Tournament Preparation']}
            ageGroup="Kids (5+) and Adults"
            onRegister={() => navigate('/karate/register')}
          />

          {/* Silambam Program */}
          <ProgramDetail 
            title="Silambam Stage Test in Tiruppur"
            subtitle="Ancient Stick Martial Art"
            img={imgSilambam}
            aspect="aspect-[9/16]"
            color="#22C55E"
            align="right"
            desc="Silambam is a weapon-based Indian martial art from Tamil Nadu. It improves footwork, agility, and hand-eye coordination. We train students through a 5-stage progressive system, teaching single stick, double stick, and acrobatic maneuvers."
            benefits={['Extreme Agility & Reflexes', 'Cultural Heritage Connection', 'Full Body Conditioning', 'Stage Performance Skills']}
            ageGroup="Kids (7+) and Adults"
            onRegister={() => navigate('/selambam/register')}
          />

        </div>
      </div>
    </div>
  );
}

function ProgramDetail({ title, subtitle, img, aspect, color, align, desc, benefits, ageGroup, onRegister }: any) {
  const isLeft = align === 'left';
  return (
    <div className={`grid md:grid-cols-2 gap-12 items-center ${isLeft ? '' : 'md:flex-row-reverse'}`}>
      <motion.div
        initial={{ opacity: 0, x: isLeft ? -30 : 30 }}
        animate={{ opacity: 1, x: 0 }}

        className={`rounded-3xl overflow-hidden ${aspect || 'aspect-[3/4]'} w-full shadow-2xl ${isLeft ? '' : 'md:order-last'}`}
      >
        <img src={img} alt={title} className="w-full h-full object-cover" loading="lazy" />
      </motion.div>
      
      <motion.div 
        initial={{ opacity: 0, x: isLeft ? 30 : -30 }}
        animate={{ opacity: 1, x: 0 }}
        
        className="space-y-6"
      >
        <div>
          <h2 className="text-sm font-bebas tracking-wide text-gray-900 mb-1">{title}</h2>
          <p className="text-sm font-semibold" style={{ color }}>{subtitle}</p>
        </div>
        
        <p className="text-gray-600 leading-relaxed text-sm">{desc}</p>
        
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <h4 className="font-bebas text-sm mb-4 text-gray-900 tracking-wide">What You'll Gain</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {benefits.map((b: string) => (
              <div key={b} className="flex items-center gap-2">
                <CheckCircle size={16} style={{ color }} />
                <span className="text-sm font-semibold text-gray-700">{b}</span>
              </div>
            ))}
          </div>
        </div>
        
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
          <div>
            <div className="text-sm text-gray-500 uppercase tracking-widest font-semibold mb-1">Suitable For</div>
            <div className="text-gray-900 font-bold">{ageGroup}</div>
          </div>
          <button 
            onClick={onRegister}
            className="flex items-center gap-2 px-6 py-3 rounded-xl text-white font-bold transition-all hover:-translate-y-1 hover:shadow-lg active:scale-95 tracking-wide font-bebas text-sm"
            style={{ background: color }}
          >
            REGISTER NOW <ArrowRight size={18} />
          </button>
        </div>
      </motion.div>
    </div>
  );
}

