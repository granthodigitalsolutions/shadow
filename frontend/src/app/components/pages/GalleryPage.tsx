import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import SeoHead from '../seo/SeoHead';
import { localBusinessSchema } from '../../../utils/seo-schemas';
import { Search, X } from 'lucide-react';
import * as allImages from '../../../assets/images';

export default function GalleryPage() {
  const [filter, setFilter] = useState('All');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Convert the module exports into an array of image paths, excluding belt/stage/progression avatars
  const imagesList = useMemo(() => {
    // 1. Get all valid images
    const validImages = Object.entries(allImages).filter(([key]) => {
      const lowerKey = key.toLowerCase();
      return !lowerKey.includes('belt') && !lowerKey.includes('stage') && !lowerKey.includes('progression');
    });

    // 2. Separate into Karate and Silambam/Maduvu
    const karateImages = validImages.filter(([key]) => key.toLowerCase().includes('karate'));
    const silambamImages = validImages.filter(([key]) => key.toLowerCase().includes('silambam') || key.toLowerCase().includes('maduvu'));

    // 3. Helper to shuffle arrays
    const shuffleArray = (arr: any[]) => [...arr].sort(() => 0.5 - Math.random());

    // 4. Take 10 of each randomly
    const randomKarate = shuffleArray(karateImages).slice(0, 10);
    const randomSilambam = shuffleArray(silambamImages).slice(0, 10);

    // 5. Combine and shuffle the 20 images for the masonry grid
    const combined = shuffleArray([...randomKarate, ...randomSilambam]);

    return combined.map(([key, path]) => {
      let category = 'Karate';
      if (key.toLowerCase().includes('silambam')) category = 'Silambam';
      if (key.toLowerCase().includes('maduvu')) category = 'Silambam';
      
      let type = 'Training';
      if (key.toLowerCase().includes('pose') || key.toLowerCase().includes('stance')) type = 'Poses';
      if (key.toLowerCase().includes('group')) type = 'Group';
      if (key.toLowerCase().includes('combat') || key.toLowerCase().includes('block')) type = 'Combat';
      
      return { id: key, src: path as string, category, type };
    });
  }, []);

  const categories = ['All', 'Karate', 'Silambam'];

  const filteredImages = useMemo(() => {
    if (filter === 'All') return imagesList;
    return imagesList.filter(img => img.category === filter || img.type === filter);
  }, [filter, imagesList]);

  return (
    <div className="pt-28 pb-24 min-h-screen bg-white">
      <SeoHead 
        title="Martial Arts Gallery | Team Shadow Kai Tiruppur"
        description="View photos of our Karate and Silambam training, belt tests, and championships in Tiruppur. See our students in action at Team Shadow Kai."
        keywords="Martial Arts Gallery, Karate Photos, Silambam Pictures, Shadow Kai Academy Images, Tiruppur Dojo"
        schema={localBusinessSchema}
      />
      <div className="max-w-[1400px] mx-auto px-6">
        
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-4" style={{ background: 'rgba(255,140,0,0.1)', border: '1px solid rgba(255,140,0,0.3)' }}>
            <span style={{ color: 'var(--orange)', fontSize: '11px', fontFamily: "'Bebas Neue',sans-serif", letterSpacing: '2px' }}>OUR LEGACY</span>
          </div>
          <h1 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(24px,4.5vw,48px)', lineHeight: 1, letterSpacing: '1px', color: 'var(--ink)' }}>
            Academy <span style={{ color: 'var(--orange)' }}>Gallery</span>
          </h1>
        </motion.div>

        {/* Filter Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-wrap items-center justify-center gap-3 mb-12"
        >
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className="px-5 py-2 rounded-full text-sm font-bold uppercase tracking-wide transition-all duration-300"
              style={
                filter === cat
                  ? { background: 'var(--orange)', color: '#fff', boxShadow: '0 4px 14px rgba(255,140,0,0.35)' }
                  : { background: 'rgba(0,0,0,0.04)', color: 'var(--ink)', border: '1px solid rgba(0,0,0,0.08)' }
              }
            >
              {cat}
            </button>
          ))}
        </motion.div>

        {/* Masonry Grid */}
        <motion.div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-4">
          <AnimatePresence>
            {filteredImages.map((img, i) => (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3 }}
                key={img.id}
                className="break-inside-avoid mb-4 relative group rounded-2xl overflow-hidden cursor-zoom-in shadow-md"
                onClick={() => setSelectedImage(img.src)}
              >
                <img src={img.src} alt={img.id} className="w-full h-auto transition-transform duration-700 group-hover:scale-105" loading="lazy" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-300" />
                <div className="absolute bottom-4 left-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <div className="bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-gray-900 shadow-lg">
                    {img.category}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>

        {/* Lightbox */}
        <AnimatePresence>
          {selectedImage && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-12 bg-black/95 backdrop-blur-sm cursor-zoom-out"
              onClick={() => setSelectedImage(null)}
            >
              <button className="absolute top-6 right-6 text-white/50 hover:text-white transition-colors">
                <X size={32} />
              </button>
              <motion.img
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                src={selectedImage}
                alt="Enlarged"
                className="max-w-full max-h-full rounded-lg shadow-2xl"
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
              />
            </motion.div>
          )}
        </AnimatePresence>
        
      </div>
    </div>
  );
}

