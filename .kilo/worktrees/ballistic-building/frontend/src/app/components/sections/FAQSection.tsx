import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import { generateFaqSchema } from '../../../utils/seo-schemas';

const FAQS = [
  { question: "What is the best Karate academy in Tiruppur?", answer: "Team Shadow Kai is highly rated as the best Karate academy in Tiruppur, with over 40 years of experience, producing over 80 national and international champions." },
  { question: "At what age can children start Karate?", answer: "Children can start Karate as early as 5 years old. Our Kids Karate program focuses on developing motor skills, discipline, and focus." },
  { question: "What is Traditional Silambam?", answer: "Silambam is an ancient weapon-based martial art from Tamil Nadu. It teaches agility, stick combat, and self-defense using a bamboo staff." },
  { question: "How long does it take to earn a Black Belt?", answer: "On average, it takes 4 to 5 years of consistent training and successfully passing all belt tests to earn a Black Belt in Shitoryu Karate." },
  { question: "Do you provide tournament coaching?", answer: "Yes! We provide specialized tournament coaching for students who wish to compete in district, state, national, and international championships." },
  { question: "Do you conduct belt tests?", answer: "Yes, we conduct regular, structured belt tests evaluated by certified national referees to ensure students meet the required standards before progressing." },
  { question: "Do you offer self-defense classes for women?", answer: "Absolutely. We offer specialized self-defense programs designed to empower women with practical skills, situational awareness, and confidence." },
  { question: "Is martial arts training safe?", answer: "Yes. Safety is our top priority. Our certified instructors ensure a controlled environment, proper warm-ups, and step-by-step technical progressions." },
  { question: "What should I wear to my first class?", answer: "For your first class, comfortable athletic wear (t-shirt and track pants) is perfect. Once enrolled, you will be required to wear the official academy uniform (Gi)." },
  { question: "Are your instructors certified?", answer: "Yes, our masters and instructors hold national and international certifications and have decades of teaching experience." },
  { question: "Can adults join the academy?", answer: "Yes, it's never too late to start! We have dedicated batches for adults focusing on fitness, stress relief, and practical self-defense." },
  { question: "How often should I train?", answer: "We recommend training at least 2-3 times a week to see consistent progress and build muscle memory." },
  { question: "Where is the academy located?", answer: "We are located in Tiruppur, Tamil Nadu. Please check our Contact page for exact directions and branch details." },
  { question: "Do you teach weapons other than the Silambam staff?", answer: "Yes, as students advance in Silambam, they learn double stick (Irattai Cumbu), deer horn (Maduvu), and other traditional weapons." },
  { question: "How do I register for classes?", answer: "You can easily register online through our website's registration portal or contact us directly via WhatsApp or phone call." }
];

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [showAll, setShowAll] = useState(false);
  const faqSchema = generateFaqSchema(FAQS);

  const displayedFaqs = showAll ? FAQS : FAQS.slice(0, 5);

  return (
    <section className="py-24 bg-white">
      {/* Inject FAQ Schema into the head specifically for this section */}
      <script type="application/ld+json">
        {JSON.stringify(faqSchema)}
      </script>

      <div className="max-w-[800px] mx-auto px-6">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-4" style={{ background: 'rgba(255,140,0,0.1)', border: '1px solid rgba(255,140,0,0.3)' }}>
            <span style={{ color: '#C2410C', fontSize: '11px', fontFamily: "'Bebas Neue',sans-serif", letterSpacing: '2px' }}>FAQ</span>
          </div>
          <h2 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(24px,3.75vw,36px)', lineHeight: 1, letterSpacing: '1px', color: 'var(--ink)' }}>
            Frequently Asked <span style={{ color: '#C2410C' }}>Questions</span>
          </h2>
        </div>

        <div className="space-y-4">
          {displayedFaqs.map((faq, index) => {
            const isOpen = openIndex === index;
            return (
              <div 
                key={index} 
                className={`border rounded-2xl overflow-hidden transition-all duration-300 ${isOpen ? 'bg-orange-50/50 border-orange-200' : 'bg-white border-gray-100 hover:border-gray-200 shadow-sm'}`}
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="w-full flex flex-wrap items-center justify-between gap-3 p-6 text-left focus:outline-none"
                >
                  <span className="font-bold text-gray-900 pr-4">{faq.question}</span>
                  <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.3 }}
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isOpen ? 'bg-orange-100 text-orange-600' : 'bg-gray-50 text-gray-400'}`}
                  >
                    <ChevronDown size={18} />
                  </motion.div>
                </button>
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="px-6 pb-6 text-gray-600 leading-relaxed border-t border-gray-100/50 pt-4">
                        {faq.answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
        
        {!showAll && FAQS.length > 5 && (
          <div className="text-center mt-12">
            <button 
              onClick={() => setShowAll(true)}
              className="inline-flex items-center gap-2 px-8 py-3 rounded-xl font-bold bg-gray-900 text-white hover:-translate-y-1 transition-all shadow-lg hover:shadow-gray-900/30 font-bebas tracking-wide"
            >
              VIEW ALL FAQs
            </button>
          </div>
        )}

      </div>
    </section>
  );
}
