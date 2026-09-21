import { motion } from 'motion/react';
import SeoHead from '../seo/SeoHead';
import { localBusinessSchema } from '../../../utils/seo-schemas';
import { Trophy, Award, Star, Medal, Users, MapPin } from 'lucide-react';
import { silambamGroupCranePose01, karateGroupTraining02 } from '../../../assets/images';

export default function AchievementsPage() {
  return (
    <div className="pt-28 pb-24 min-h-screen bg-white">
      <SeoHead 
        title="Academy Achievements | 80+ Champions | Team Shadow Kai"
        description="Team Shadow Kai has produced over 80 champions, 5000+ Black Belts, and trained 30,000+ students in Karate and Silambam in Tiruppur, Tamil Nadu."
        keywords="Karate Champions Tiruppur, Silambam Awards, Shadow Kai Achievements, Martial Arts Tournaments"
        schema={localBusinessSchema}
      />
      <div className="max-w-[1200px] mx-auto px-6">
        
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-24"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-4" style={{ background: 'rgba(255,140,0,0.1)', border: '1px solid rgba(255,140,0,0.3)' }}>
            <span style={{ color: 'var(--orange)', fontSize: '11px', fontFamily: "'Bebas Neue',sans-serif", letterSpacing: '2px' }}>HALL OF FAME</span>
          </div>
          <h1 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(24px,4.5vw,48px)', lineHeight: 1, letterSpacing: '1px', color: 'var(--ink)' }}>
            Academy <span style={{ color: 'var(--orange)' }}>Achievements</span>
          </h1>
        </motion.div>

        {/* Stats Counters */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-24">
          {[
            { value: '40+', label: 'Years Experience', icon: Star },
            { value: '30,000+', label: 'Students Trained', icon: Users },
            { value: '5,000+', label: 'Black Belts', icon: Award },
            { value: '80+', label: 'Championships', icon: Trophy },
          ].map((stat, i) => (
            <motion.div 
              key={stat.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              
              transition={{ delay: i * 0.1 }}
              className="bg-gray-50 p-8 rounded-3xl text-center border border-gray-100"
            >
              <stat.icon size={28} className="mx-auto mb-4 text-orange-500" />
              <div className="text-3xl lg:text-4xl font-bebas text-gray-900 mb-2">{stat.value}</div>
              <div className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{stat.label}</div>
            </motion.div>
          ))}
        </div>

        {/* Highlight Section */}
        <div className="grid lg:grid-cols-2 gap-12 items-center mb-24">
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            
            className="space-y-6"
          >
            <h2 className="text-sm font-bebas tracking-wide text-gray-900">National Champions</h2>
            <p className="text-gray-600 leading-relaxed text-sm">
              Our students consistently represent Shadow Kai at state and national level tournaments, bringing home medals in both Kata (forms) and Kumite (sparring). The rigorous competition training program ensures that our athletes are physically and mentally prepared for the highest levels of competition.
            </p>
            <ul className="space-y-4 pt-4">
              {[
                'South Asian Karate Championship (New Delhi) 2023 - 2 Gold (Senior)',
                'WKF Karate 1 Youth League (Fujairah, UAE) 2023 - Participant',
                'All India Inter Zone (New Delhi) 2022 - 4 Gold',
                'All India Karate Championships (Pune) 2021/2022 - 3 Gold, 1 Bronze'
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-3">
                  <Medal size={20} className="text-orange-500 flex-shrink-0 mt-0.5" />
                  <span className="font-semibold text-gray-800">{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            
            className="h-[500px] rounded-3xl overflow-hidden shadow-2xl relative"
          >
            <img src={silambamGroupCranePose01} alt="Champions" className="w-full h-full object-cover" loading="lazy" />
          </motion.div>
        </div>

        {/* Head Coach Achievements Section */}
        <div className="mb-24">
          <div className="text-center mb-16">
            <h2 className="text-sm font-bebas tracking-wide text-gray-900 mb-4">HEAD COACH <span className="text-orange-500">ACHIEVEMENTS</span></h2>
            <p className="text-gray-600 max-w-2xl mx-auto text-sm">
              A proven track record of producing consecutive medalists across State, National, and International championships under the leadership of Gowtham Ragunathan.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            
            {/* State Championship */}
            <div className="bg-gray-50 rounded-3xl p-8 border border-gray-100">
              <div className="bg-orange-500 text-white font-bebas text-sm px-6 py-2 rounded-xl inline-block mb-8 shadow-md">
                STATE CHAMPIONSHIP
              </div>
              <div className="space-y-6">
                <div>
                  <h4 className="font-bold text-gray-900 text-sm uppercase tracking-wide mb-3">TAMILNADU STATE KARATE CHAMPIONSHIPS - CHENNAI</h4>
                  <ul className="space-y-3">
                    <li className="flex gap-3"><div className="w-2 h-2 rounded-full bg-orange-500 mt-1.5 shrink-0"></div><span className="text-gray-600 text-sm"><strong className="text-gray-900">2021</strong> - 2 Gold, 3 Bronze (Senior)</span></li>
                    <li className="flex gap-3"><div className="w-2 h-2 rounded-full bg-orange-500 mt-1.5 shrink-0"></div><span className="text-gray-600 text-sm"><strong className="text-gray-900">2022</strong> - 3 Gold, 4 Bronze (Senior)</span></li>
                    <li className="flex gap-3"><div className="w-2 h-2 rounded-full bg-orange-500 mt-1.5 shrink-0"></div><span className="text-gray-600 text-sm"><strong className="text-gray-900">2023</strong> - 1 Gold, 3 Silver, 2 Bronze (Sub Junior)</span></li>
                    <li className="flex gap-3"><div className="w-2 h-2 rounded-full bg-orange-500 mt-1.5 shrink-0"></div><span className="text-gray-600 text-sm"><strong className="text-gray-900">2024</strong> - 1 Gold, 3 Silver, 3 Bronze (Sub Junior)</span></li>
                  </ul>
                </div>
              </div>
            </div>

            {/* National Championship */}
            <div className="bg-gray-50 rounded-3xl p-8 border border-gray-100">
              <div className="bg-gray-900 text-white font-bebas text-sm px-6 py-2 rounded-xl inline-block mb-8 shadow-md">
                NATIONAL CHAMPIONSHIP
              </div>
              <div className="space-y-8">
                <div>
                  <h4 className="font-bold text-gray-900 text-sm uppercase tracking-wide mb-2">ALL INDIA KARATE CHAMPIONSHIPS - PUNE</h4>
                  <div className="text-gray-600 text-sm flex gap-3"><div className="w-2 h-2 rounded-full bg-gray-900 mt-1.5 shrink-0"></div><span><strong className="text-gray-900">2021/2022</strong> - 3 Gold, 1 Bronze (Senior)</span></div>
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 text-sm uppercase tracking-wide mb-2">ALL INDIA INTER ZONE - NEW DELHI</h4>
                  <div className="text-gray-600 text-sm flex gap-3"><div className="w-2 h-2 rounded-full bg-gray-900 mt-1.5 shrink-0"></div><span><strong className="text-gray-900">2022</strong> - 4 Gold (Senior Female Team Kata & U21 Female Individual)</span></div>
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 text-sm uppercase tracking-wide mb-2">KIO NATIONAL KARATE - NEW DEHRADUN</h4>
                  <div className="text-gray-600 text-sm flex gap-3"><div className="w-2 h-2 rounded-full bg-gray-900 mt-1.5 shrink-0"></div><span><strong className="text-gray-900">2023</strong> - 1 Silver (U21 Female Individual Kata)</span></div>
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 text-sm uppercase tracking-wide mb-2">SOUTH INDIA KARATE CHAMPIONSHIPS - CHENNAI</h4>
                  <div className="text-gray-600 text-sm flex gap-3"><div className="w-2 h-2 rounded-full bg-gray-900 mt-1.5 shrink-0"></div><span><strong className="text-gray-900">2024</strong> - 3 Gold, 4 Silver, 2 Bronze</span></div>
                </div>
              </div>
            </div>

            {/* South Asian Championship */}
            <div className="bg-gray-50 rounded-3xl p-8 border border-gray-100">
              <div className="bg-orange-500 text-white font-bebas text-sm px-6 py-2 rounded-xl inline-block mb-8 shadow-md">
                ASIAN CHAMPIONSHIP
              </div>
              <div className="space-y-6">
                <div>
                  <h4 className="font-bold text-gray-900 text-sm uppercase tracking-wide mb-3">SOUTH ASIAN KARATE CHAMPIONSHIP - SRILANKA</h4>
                  <ul className="space-y-3">
                    <li className="flex gap-3"><div className="w-2 h-2 rounded-full bg-orange-500 mt-1.5 shrink-0"></div><span className="text-gray-600 text-sm"><strong className="text-gray-900">2022</strong> - 3 Silver Medal (Senior Category Female Team Kata)</span></li>
                  </ul>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}

