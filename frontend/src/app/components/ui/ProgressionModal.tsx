import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { karateProgression, silambamProgression } from '../../../assets/images';

interface ProgressionModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'karate' | 'silambam';
}

export default function ProgressionModal({ isOpen, onClose, defaultTab = 'karate' }: ProgressionModalProps) {
  const [activeTab, setActiveTab] = useState<'karate' | 'silambam'>(defaultTab);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-5xl max-h-[90vh] overflow-hidden bg-white rounded-2xl shadow-2xl flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-gray-100">
            <h3 className="text-sm font-bold text-gray-900 font-bebas tracking-wide truncate pr-4">
              BELT & STAGE PROGRESSION
            </h3>
            <button
              onClick={onClose}
              className="p-2 flex-shrink-0 text-gray-400 transition-colors rounded-full hover:bg-gray-100 hover:text-gray-600"
            >
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-50/50">
            <div className="flex justify-center mb-6">
              <div className="flex p-1 space-x-1 bg-gray-200/50 rounded-full w-full max-w-sm">
                <button
                  onClick={() => setActiveTab('karate')}
                  className={`flex-1 px-4 sm:px-6 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition-all duration-300 ${
                    activeTab === 'karate'
                      ? 'bg-orange-500 text-white shadow-md'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                  }`}
                >
                  Karate Belts
                </button>
                <button
                  onClick={() => setActiveTab('silambam')}
                  className={`flex-1 px-4 sm:px-6 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition-all duration-300 ${
                    activeTab === 'silambam'
                      ? 'bg-orange-500 text-white shadow-md'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                  }`}
                >
                  Silambam Stages
                </button>
              </div>
            </div>

            <div className="relative rounded-xl overflow-hidden shadow-lg bg-white border border-gray-100">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.02 }}
                  transition={{ duration: 0.3 }}
                  className="w-full relative bg-white"
                >
                  <img
                    src={activeTab === 'karate' ? karateProgression : silambamProgression}
                    alt={`${activeTab === 'karate' ? 'Karate' : 'Silambam'} Progression`}
                    className="w-full h-auto object-contain p-2 md:p-4"
                  />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
