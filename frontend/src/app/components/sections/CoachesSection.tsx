import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Award, Shield, Medal } from 'lucide-react';
import {
  shihanBrKumar,
  renshiAravintha,
  renshiBaskaran,
  renshiSarathi,
  senseiMani,
  senseiMohan,
  senseiDevaraj,
  senseiRaja,
  senseiNithish,
  senseiTamilarasu,
  senseiSivaranjani,
  senseiKavin,
  senseiVinoth,
  senseiTharun,
  shidoinNagulan,
  senseiIndhuShri,
  shidoinUma,
  senseiKavinraj,
  senseiRubanKumar
} from '../../../assets/images/coaches';

const COACHES = [
  {
    id: 'br-kumar',
    name: 'Shihan BR Kumar',
    rank: '6th Dan Black Belt',
    roles: ['Thalamai Aashan - Silambam', 'Karate - National Coach'],
    position: 'Jn.Secretary- All India Shadow Kai',
    image: shihanBrKumar
  },
  {
    id: 'aravintha',
    name: 'Renshi E.Aravintha Kumar',
    rank: '5th Dan Black Belt',
    roles: ['Karate - National REFEREE A'],
    position: 'Director & Secretary - North India Shadow Kai',
    image: renshiAravintha
  },
  {
    id: 'baskaran',
    name: 'Renshi Baskaran.S',
    rank: '5th Dan Black Belt',
    roles: ['Aashan - Silambam', 'Karate - National REFEREE A'],
    position: 'Secretary- Namakkal District Shadow Kai',
    image: renshiBaskaran
  },
  {
    id: 'sarathi',
    name: 'Renshi Sarathi T',
    rank: '5th Dan Black Belt',
    roles: ['Aashan - Silambam', 'Karate - National REFEREE A'],
    position: 'Secretary- All India Shadow Kai',
    image: renshiSarathi
  },
  {
    id: 'raja',
    name: 'Sensei Raja. S',
    rank: '5th Dan Black Belt',
    roles: ['Aashan - Silambam', 'Karate - National REFEREE A'],
    position: 'Secretary- Erode District Shadow Kai',
    image: senseiRaja
  },
  {
    id: 'mani',
    name: 'Sensei ManiArumugam',
    rank: '4th Dan Black Belt',
    roles: ['Aashan - Silambam', 'Karate - National REFEREE A'],
    position: 'Secretary- Tiruppur District Shadow Kai',
    image: senseiMani
  },
  {
    id: 'mohan',
    name: 'Sensei Mohan Raj',
    rank: '4th Dan Black Belt',
    roles: ['Aashan - Silambam', 'Karate - National REFEREE A'],
    position: 'Secretary- Karur District Shadow Kai',
    image: senseiMohan
  },
  {
    id: 'nithish',
    name: 'Sensei Dr.Nithish Kumar.S',
    rank: '4th Dan Black Belt (Dental Surgeon)',
    roles: ['Aashan - Silambam', 'Karate - National Champion'],
    position: 'Secretary- Salem District Shadow Kai',
    image: senseiNithish
  },
  {
    id: 'tamilarasu',
    name: 'Sensei Tamilarasu LR',
    rank: '4th Dan Black Belt',
    roles: ['Aashan - Silambam', 'Karate - National REFEREE A'],
    position: 'President - Salem District Shadow Kai',
    image: senseiTamilarasu
  },
  {
    id: 'sivaranjani',
    name: 'Sensei Sivaranjani',
    rank: '4th Dan Black Belt',
    roles: ['Aashan - Silambam', 'Karate - South Asian Champion'],
    position: 'AO - All India Shadow Kai',
    image: senseiSivaranjani
  },
  {
    id: 'kavin',
    name: 'Sensei Kavin K',
    rank: '4th Dan Black Belt',
    roles: ['Aashan - Silambam', 'Karate - National REFEREE A'],
    position: 'President- Erode District Shadow Kai',
    image: senseiKavin
  },
  {
    id: 'devaraj',
    name: 'Sensei Devaraj.M',
    rank: '3rd Dan Black Belt',
    roles: ['Aashan - Silambam', 'Karate - National REFEREE A'],
    position: 'Secretary- Coimbatore District Shadow Kai',
    image: senseiDevaraj
  },
  {
    id: 'vinoth',
    name: 'Sensei Vinoth Kumar.P',
    rank: '3rd Dan Black Belt',
    roles: ['Aashan - Silambam', 'Karate - National REFEREE A'],
    position: 'President - Tiruppur District Shadow Kai',
    image: senseiVinoth
  },
  {
    id: 'tharun',
    name: 'Sensei Tharun',
    rank: '3rd Dan Black Belt',
    roles: ['Karate - National Judge', 'Assnt.Examiner'],
    position: 'Sensei',
    image: senseiTharun
  },
  {
    id: 'nagulan',
    name: 'Shidoin Nagulan',
    rank: '2nd Dan Black Belt',
    roles: ['Karate - National Judge', 'Assnt.Examiner'],
    position: 'Shidoin',
    image: shidoinNagulan
  },
  {
    id: 'indhushri',
    name: 'Sensei Indhu Shri',
    rank: '3rd Dan Black Belt',
    roles: ['Karate - South Asian Champion - 2022', 'Assnt.Examiner'],
    position: 'Sensei',
    image: senseiIndhuShri
  },
  {
    id: 'uma',
    name: 'Shidoin Uma',
    rank: '2nd Dan Black Belt',
    roles: ['Karate - National Judge', 'Assnt.Examiner'],
    position: 'Shidoin',
    image: shidoinUma
  },
  {
    id: 'kavinraj',
    name: 'Sensei Kavinraj SR., MBBS',
    rank: '3rd Dan Black Belt',
    roles: ['Karate - National Champion', 'Assnt.Examiner'],
    position: 'Sensei',
    image: senseiKavinraj
  },
  {
    id: 'rubankumar',
    name: 'Sensei Ruban Kumar.V',
    rank: '4th Dan Black Belt',
    roles: ['Karate - National Judge', 'Assnt.Examiner'],
    position: 'Secretary- Coimbatore District Shadow Kai',
    image: senseiRubanKumar
  }
];

export default function CoachesSection() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Responsive items per page
  const [itemsPerPage, setItemsPerPage] = useState(3);

  useEffect(() => {
    const updateItemsPerPage = () => {
      if (window.innerWidth < 640) setItemsPerPage(1);
      else if (window.innerWidth < 1024) setItemsPerPage(2);
      else setItemsPerPage(3);
    };
    updateItemsPerPage();
    window.addEventListener('resize', updateItemsPerPage);
    return () => window.removeEventListener('resize', updateItemsPerPage);
  }, []);

  const totalPages = Math.ceil(COACHES.length / itemsPerPage);

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setDirection(1);
      setCurrentIndex((prev) => (prev + 1) % totalPages);
    }, 6000); // Auto-scroll every 6 seconds
  };

  useEffect(() => {
    startTimer();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [totalPages]);

  const handleNext = () => {
    setDirection(1);
    setCurrentIndex((prev) => (prev + 1) % totalPages);
    startTimer(); // Reset timer
  };

  const handlePrev = () => {
    setDirection(-1);
    setCurrentIndex((prev) => (prev - 1 + totalPages) % totalPages);
    startTimer(); // Reset timer
  };

  const visibleCoaches = COACHES.slice(
    currentIndex * itemsPerPage,
    (currentIndex + 1) * itemsPerPage
  );

  return (
    <section className="py-24 bg-[#0A0A0A] relative overflow-hidden text-white border-t border-white/5">
      {/* Background decorations */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-orange-500/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-green-500/5 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/2" />
      
      <div className="max-w-[1400px] mx-auto px-6 relative z-10">
        
        {/* Header Area */}
        <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-5 bg-orange-500/15 border border-orange-500/30">
              <span className="text-orange-500 text-xs font-bebas tracking-[2.5px]">LEADERSHIP & EXPERTISE</span>
            </div>
            <h2 className="font-bebas text-[clamp(28px,6vw,48px)] leading-[1] tracking-wide mb-4">
              MEET OUR <span className="text-orange-500">MASTER COACHES</span>
            </h2>
            <p className="text-white/60 max-w-xl text-sm leading-relaxed">
              Trained by internationally certified masters. Our dedicated leadership ensures you receive the highest standard of traditional martial arts education.
            </p>
          </motion.div>

          {/* Navigation Controls */}
          <motion.div 
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="flex gap-3"
          >
            <button 
              onClick={handlePrev}
              className="p-3 rounded-full border border-white/10 hover:bg-white/10 transition-colors group"
              aria-label="Previous coaches"
            >
              <ChevronLeft className="text-white/60 group-hover:text-white transition-colors" />
            </button>
            <button 
              onClick={handleNext}
              className="p-3 rounded-full bg-orange-500 hover:bg-orange-600 transition-colors shadow-[0_0_20px_rgba(255,140,0,0.3)] text-black"
              aria-label="Next coaches"
            >
              <ChevronRight />
            </button>
          </motion.div>
        </div>

        {/* Carousel Container */}
        <div className="relative min-h-[500px]">
          <AnimatePresence mode="popLayout" initial={false} custom={direction}>
            <motion.div
              key={currentIndex}
              custom={direction}
              initial={(dir) => ({ opacity: 0, x: dir > 0 ? 100 : -100 })}
              animate={{ opacity: 1, x: 0 }}
              exit={(dir) => ({ opacity: 0, x: dir > 0 ? -100 : 100 })}
              transition={{ duration: 0.5, ease: "easeInOut" }}
              className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 absolute inset-0 w-full"
            >
              {visibleCoaches.map((coach, idx) => (
                <div 
                  key={coach.id} 
                  className="bg-[#111] rounded-3xl overflow-hidden border border-white/10 flex flex-col group hover:border-orange-500/40 transition-colors h-full"
                >
                  {/* Image Container */}
                  <div className="relative aspect-[4/5] overflow-hidden bg-white">
                    <img 
                      src={coach.image} 
                      alt={coach.name} 
                      className="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#111] via-transparent to-transparent opacity-90" />
                    
                    {/* Rank Badge */}
                    <div className="absolute bottom-4 left-4 bg-orange-500 text-black px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-lg">
                      <Medal size={14} />
                      {coach.rank}
                    </div>
                  </div>

                  {/* Details Container */}
                  <div className="p-6 flex flex-col flex-grow">
                    <h3 className="font-bebas text-2xl tracking-wide mb-1 group-hover:text-orange-400 transition-colors">{coach.name}</h3>
                    <p className="text-orange-500/80 text-xs font-semibold uppercase tracking-wider mb-5">
                      {coach.position}
                    </p>

                    <div className="space-y-3">
                      {coach.roles.map((role, i) => (
                        <div key={i} className="flex items-start gap-2.5 text-sm text-white/70">
                          {role.toLowerCase().includes('karate') ? (
                            <Award size={16} className="text-orange-500 mt-0.5 shrink-0" />
                          ) : (
                            <Shield size={16} className="text-green-500 mt-0.5 shrink-0" />
                          )}
                          <span className="leading-snug">{role}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>
        
        {/* Pagination Dots */}
        <div className="flex justify-center gap-2 mt-8 relative z-10">
          {Array.from({ length: totalPages }).map((_, idx) => (
            <button
              key={idx}
              onClick={() => {
                setDirection(idx > currentIndex ? 1 : -1);
                setCurrentIndex(idx);
                startTimer();
              }}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                idx === currentIndex ? 'w-8 bg-orange-500' : 'w-2 bg-white/20 hover:bg-white/40'
              }`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>

      </div>
    </section>
  );
}
