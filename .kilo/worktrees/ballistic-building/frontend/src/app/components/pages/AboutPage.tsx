import { motion } from 'motion/react';
import SeoHead from '../seo/SeoHead';
import { localBusinessSchema } from '../../../utils/seo-schemas';
import { Target, Users, Shield, CheckCircle2 } from 'lucide-react';

import imgSensei from '../../../assets/images/gallery/karate/karate-tournament-20.webp';
import imgGroup from '../../../assets/images/gallery/karate/karate-tournament-20.webp';
import AnimatedCounter from '../ui/AnimatedCounter';

export default function AboutPage() {
  return (
    <div className="pt-28 pb-24 min-h-screen bg-white">
      <SeoHead 
        title="About Us | Martial Arts Academy Tamil Nadu | Team Shadow Kai"
        description="Learn about Team Shadow Kai, the premier Martial Arts Academy in Tamil Nadu. With 40+ years of experience and over 30,000 students trained since 1986."
        keywords="Martial Arts Academy Tamil Nadu, Karate School Tiruppur, Best Silambam Academy, Shadow Kai History"
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
            <span style={{ color: 'var(--orange)', fontSize: '11px', fontFamily: "'Bebas Neue',sans-serif", letterSpacing: '2px' }}>OUR STORY</span>
          </div>
          <h1 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(24px,4.5vw,48px)', lineHeight: 1, letterSpacing: '1px', color: 'var(--ink)' }}>
            About <span style={{ color: 'var(--orange)' }}>Shadow Kai</span>
          </h1>
          <p className="mt-4 text-gray-600 max-w-2xl mx-auto text-sm leading-relaxed">
            Founded with a vision to preserve traditional martial arts while adapting to modern educational needs, Team Shadow Kai stands as a pillar of discipline and excellence in Tiruppur, Tamil Nadu.
          </p>
        </motion.div>

        {/* Story Section */}
        <div className="grid md:grid-cols-2 gap-12 items-center mb-24">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            
            className="rounded-3xl overflow-hidden shadow-2xl relative h-[500px]"
          >
            <img src={imgGroup} alt="Academy Group" className="w-full h-full object-cover" loading="lazy" />
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            
            className="space-y-6"
          >
            <h2 className="text-sm font-bebas tracking-wide text-gray-900">Forging Champions Since 2010</h2>
            <p className="text-gray-600 leading-relaxed">
              Shadow Kai started as a small dojo and has grown into one of the most respected martial arts academies in the region. We specialize in Shitoryu Karate and the traditional Tamil art of Silambam.
            </p>
            <p className="text-gray-600 leading-relaxed">
              Our philosophy goes beyond punches and kicks. We focus on building character, instilling confidence, and teaching our students the value of perseverance. Every student is guided on a personal journey from White Belt to Black Belt, and from beginner to leader.
            </p>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6 pt-6 border-t border-gray-100 mt-6">
              {[
                { value: '40+', label: 'Years' },
                { value: '4,000+', label: 'Active Students' },
                { value: '5,000+', label: 'Black Belts Produced' },
                { value: '80+', label: 'Champions' },
                { value: '30,000+', label: 'Total Students Trained' },
                { value: '1986', label: 'Founded Since' },
              ].map((stat, i) => (
                <div key={stat.label}>
                  <div className="text-3xl lg:text-4xl font-bebas text-orange-500 mb-1">
                    {stat.value === '1986' ? stat.value : <AnimatedCounter value={stat.value} />}
                  </div>
                  <div className="text-sm font-semibold text-gray-900 uppercase tracking-wide">{stat.label}</div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Mission & Vision */}
        <div className="grid md:grid-cols-3 gap-6 mb-24">
          {[
            { icon: Target, title: 'Our Mission', desc: 'To empower individuals of all ages through the discipline of martial arts, fostering physical fitness, mental resilience, and moral character.' },
            { icon: Shield, title: 'Our Vision', desc: 'To be the premier martial arts institution in India, recognized for producing technically superior athletes and exceptional leaders.' },
            { icon: Users, title: 'Our Community', desc: 'We pride ourselves on creating a safe, inclusive, and highly motivating environment where every student feels like family.' }
          ].map((item, i) => (
            <motion.div 
              key={item.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              
              transition={{ delay: i * 0.1 }}
              className="bg-gray-50 p-8 rounded-3xl border border-gray-100"
            >
              <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center mb-6">
                <item.icon size={24} className="text-orange-500" />
              </div>
              <h3 className="text-sm font-bebas tracking-wide text-gray-900 mb-3">{item.title}</h3>
              <p className="text-gray-600 text-sm leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Founder Section */}
        <section className="py-24 bg-gray-50 rounded-[3rem] overflow-hidden relative mt-16 mb-24 border border-gray-100 shadow-xl">
          <div className="grid lg:grid-cols-2 gap-0 items-stretch">
            {/* Left: Image */}
            <motion.div 
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              className="relative min-h-[500px]"
            >
              <img src={imgSensei} alt="Gowtham Ragunathan" className="absolute inset-0 w-full h-full object-cover grayscale opacity-90" loading="lazy" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
              <div className="absolute bottom-10 left-10 right-10">
                <div className="text-orange-500 font-bebas text-sm tracking-wide mb-1">FOUNDER & HEAD COACH</div>
                <div className="text-white font-bebas text-sm tracking-widest leading-none">GOWTHAM RAGUNATHAN</div>
                <div className="text-white/70 mt-2 text-sm uppercase tracking-[3px]">Karate, Silambam & Taekwondo</div>
              </div>
            </motion.div>

            {/* Right: Content */}
            <motion.div 
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-12 md:p-16 flex flex-col justify-center"
            >
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8 bg-orange-500/10 border border-orange-500/20 self-start">
                <span className="text-orange-600 text-xs font-bebas tracking-[2.5px]">LEADERSHIP</span>
              </div>
              
              <h2 className="font-bebas text-[clamp(24px,3vw,42px)] leading-[1.05] tracking-wide text-gray-900 mb-8">
                A LEGACY OF <span className="text-orange-500">EXCELLENCE</span>
              </h2>
              
              <div className="space-y-6 text-gray-600 text-sm leading-relaxed mb-10">
                <p>
                  Instructor with a World [WKF] Coach License and International Black Belt Diploma in two different disciplines with a vast amount of knowledge and experience in martial arts.
                </p>
                <p>
                  Fully trained by a documented master and has membership in the principal governing bodies of Karate, Silambam, and Taekwondo. Possesses great instruction abilities for people of all ages and skill levels.
                </p>
                
                <div className="grid grid-cols-2 gap-4 mt-6">
                  <div className="flex items-center gap-2"><CheckCircle2 size={18} className="text-orange-500"/> <span className="text-sm font-bold text-gray-900">Silambam Specialist</span></div>
                  <div className="flex items-center gap-2"><CheckCircle2 size={18} className="text-orange-500"/> <span className="text-sm font-bold text-gray-900">Fat Loss Specialist</span></div>
                  <div className="flex items-center gap-2"><CheckCircle2 size={18} className="text-orange-500"/> <span className="text-sm font-bold text-gray-900">Functional Training</span></div>
                  <div className="flex items-center gap-2"><CheckCircle2 size={18} className="text-orange-500"/> <span className="text-sm font-bold text-gray-900">Strength & Condition</span></div>
                  <div className="flex items-center gap-2 col-span-2"><CheckCircle2 size={18} className="text-orange-500"/> <span className="text-sm font-bold text-gray-900">Krav Maga Self-Defense</span></div>
                </div>
              </div>
              
              <hr className="my-8 border-gray-200" />
              
              <h3 className="font-bebas text-sm tracking-wide text-gray-900 mb-6">AWARDS & CERTIFICATION</h3>
              
              <div className="space-y-6">
                
                <div className="relative pl-6 border-l-2 border-orange-200">
                  <div className="absolute -left-2 top-0 w-4 h-4 rounded-full bg-orange-500 border-4 border-gray-50"></div>
                  <div className="font-bold text-gray-900 mb-1">2025 - LICENSED ASIAN & WORLD KARATE JUDGE</div>
                  <div className="text-gray-500 text-sm">Issued By ASIAN & World KARATE</div>
                </div>

                <div className="relative pl-6 border-l-2 border-orange-200">
                  <div className="absolute -left-2 top-0 w-4 h-4 rounded-full bg-orange-500 border-4 border-gray-50"></div>
                  <div className="font-bold text-gray-900 mb-1">2025 - JN.SECRETARY WORLD UNION SILAMBAM</div>
                  <div className="text-gray-500 text-sm">Appointed as JN.SECRETARY for WUSF TN</div>
                </div>
                
                <div className="relative pl-6 border-l-2 border-orange-200">
                  <div className="absolute -left-2 top-0 w-4 h-4 rounded-full bg-orange-500 border-4 border-gray-50"></div>
                  <div className="font-bold text-gray-900 mb-1">2024 - WORLD KARATE COACH LICENSE</div>
                  <div className="text-gray-500 text-sm">Issued By World Karate Federation</div>
                </div>

                <div className="relative pl-6 border-l-2 border-orange-200">
                  <div className="absolute -left-2 top-0 w-4 h-4 rounded-full bg-orange-500 border-4 border-gray-50"></div>
                  <div className="font-bold text-gray-900 mb-1">2022 - 2023 - CONSECUTIVE MEDALIST PRODUCER AWARD</div>
                  <div className="text-gray-500 text-sm">Awarded by TDSKA Association</div>
                </div>

                <div className="relative pl-6">
                  <div className="absolute -left-2 top-0 w-4 h-4 rounded-full bg-orange-500 border-4 border-gray-50"></div>
                  <div className="font-bold text-gray-900 mb-1">2021 - 2022 - BEST COACH AWARD FOR TEAM KATA</div>
                  <div className="text-gray-500 text-sm">Awarded by TDSKA Association</div>
                </div>
                
              </div>
            </motion.div>
          </div>
        </section>

      </div>
    </div>
  );
}

