import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { karateProgression, silambamProgression } from '../../../assets/images';
import { Medal } from 'lucide-react';

const ProgressionSection: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'karate' | 'silambam'>('karate');

  return (
    <section className="py-24 relative overflow-hidden bg-white dark:bg-[#0a0a0a]">
      <div className="container mx-auto px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-5 bg-orange-500/10 border border-orange-500/30">
            <Medal size={14} className="text-orange-500" />
            <span className="text-orange-500 text-[8.25px] font-bebas tracking-[2.5px]">
              OUR BELT SYSTEM
            </span>
          </div>
          <h2 className="font-bebas text-[clamp(21px,3.75vw,48px)] leading-none tracking-[1.5px] text-gray-900 dark:text-white">
            STUDENT PROGRESSION
          </h2>
          <p className="mx-auto mt-5 text-gray-600 dark:text-white/55 max-w-[560px] leading-relaxed text-[11.25px]">
            Follow a clear and structured path to mastery. See the different stages and belts you will achieve as you advance in your training.
          </p>
        </motion.div>

        <div className="max-w-5xl mx-auto">
          <div className="flex justify-center mb-10">
            <div className="flex bg-gray-100 dark:bg-white/5 rounded-full p-1 border border-gray-200 dark:border-white/10">
              <button
                onClick={() => setActiveTab('karate')}
                className={`px-8 py-3 rounded-full text-sm font-medium transition-all duration-300 ${
                  activeTab === 'karate' 
                    ? 'bg-orange-500 text-white shadow-sm' 
                    : 'text-gray-600 dark:text-white/60 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Karate Belts
              </button>
              <button
                onClick={() => setActiveTab('silambam')}
                className={`px-8 py-3 rounded-full text-sm font-medium transition-all duration-300 ${
                  activeTab === 'silambam' 
                    ? 'bg-orange-500 text-white shadow-sm' 
                    : 'text-gray-600 dark:text-white/60 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                Silambam Stages
              </button>
            </div>
          </div>

          <div className="relative rounded-2xl overflow-hidden shadow-2xl bg-white border border-gray-200 dark:border-white/10">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="w-full aspect-[4/3] md:aspect-[16/9] lg:aspect-[21/9] relative bg-white"
              >
                <img 
                  src={activeTab === 'karate' ? karateProgression : silambamProgression} 
                  alt={`${activeTab === 'karate' ? 'Karate' : 'Silambam'} Progression`}
                  className="w-full h-full object-contain p-4 md:p-8"
                />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProgressionSection;
