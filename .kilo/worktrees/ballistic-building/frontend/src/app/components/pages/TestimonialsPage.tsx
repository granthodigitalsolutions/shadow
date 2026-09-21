import { motion } from 'motion/react';
import SeoHead from '../seo/SeoHead';
import { localBusinessSchema } from '../../../utils/seo-schemas';
import { Star, Quote } from 'lucide-react';
import { karateFamilyPose02, silambamAcrobatics01, karateGroupTraining04 } from '../../../assets/images';

const TESTIMONIALS = [
  {
    id: 1,
    name: 'INDHU SRI S.G',
    role: '9 months ago',
    initials: 'IS',
    color: 'bg-green-600',
    quote: "Especially for girls and women, it is the safest and most secure place to learn Karate and other martial arts. Friendly trainers with a well-equipped dojo help you to enhance your talents.",
    rating: 5,
    tag: 'Google Review'
  },
  {
    id: 2,
    name: 'Harrish Ramesh',
    role: '8 years ago',
    initials: 'HR',
    color: 'bg-blue-600',
    quote: "The only association that teaches the traditional Karate. It gives its techniques in the form of Syallbus. They are very easily understandable by both children and adults. It teaches Karate not for profit the association is full of service motive. I have wondered in an aspect of paying respect to senior belts students in a very respected manner.",
    rating: 5,
    tag: 'Google Review'
  },
  {
    id: 3,
    name: 'Sanjay Krishna',
    role: '5 years ago',
    initials: 'SK',
    color: 'bg-purple-600',
    quote: "This association is ran by Well talented and professional masters.. they don't want to describe, their efforts and love towards Karate will describe abt their team and their association. Very inspirational to be a follower of this association or club.",
    rating: 5,
    tag: 'Google Review'
  },
  {
    id: 4,
    name: 'Sangam H',
    role: '8 years ago',
    initials: 'SH',
    color: 'bg-orange-600',
    quote: "In a world where Martial arts has become only a show sport, Shadow Kai teaches students the essence of traditional karate, the art of the ancient warriors. It is the only place I've seen where traditional Martial arts are taught in such a proper and systematic method. The spirit of true martial arts is saved. OSU!",
    rating: 5,
    tag: 'Google Review'
  },
  {
    id: 5,
    name: 'Sujitha Mathivanan',
    role: '5 years ago',
    initials: 'SM',
    color: 'bg-teal-600',
    quote: "One of the best Karate associations in the world with very professional, sincere , respectable and well-talented trainers. My son being a part of this team, is getting the best caoching ever.\n\nThe most appreciable part is , individual importance is being given to the students, both their strengths and weakness are identified and students are trained up accordingly.\n\nApart from all these sports stuffs, the students are being taught moral values too, which are very much essential in making our kids, a better future generation.\n\nFeeling over-whelmed for being a part of this Great team.\n\nBest wishes,\nSujitha Mathivanan.",
    rating: 5,
    tag: 'Google Review'
  }
];

export default function TestimonialsPage() {
  return (
    <div className="pt-28 pb-24 min-h-screen bg-gray-50">
      <SeoHead 
        title="Student Reviews & Testimonials | Team Shadow Kai Tiruppur"
        description="Read what parents and students say about Team Shadow Kai's Karate and Silambam programs in Tiruppur. Over 5000 Black Belts produced since 1986."
        keywords="Shadow Kai Reviews, Karate Academy Ratings Tiruppur, Martial Arts Testimonials, Silambam Feedback"
        schema={localBusinessSchema}
      />
      <div className="max-w-[1400px] mx-auto px-6">
        
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-24"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-4" style={{ background: 'rgba(255,140,0,0.1)', border: '1px solid rgba(255,140,0,0.3)' }}>
            <span style={{ color: 'var(--orange)', fontSize: '11px', fontFamily: "'Bebas Neue',sans-serif", letterSpacing: '2px' }}>STUDENT STORIES</span>
          </div>
          <h1 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(24px,4.5vw,48px)', lineHeight: 1, letterSpacing: '1px', color: 'var(--ink)' }}>
            What They <span style={{ color: 'var(--orange)' }}>Say</span>
          </h1>
          <p className="mt-4 text-gray-600 max-w-2xl mx-auto text-sm leading-relaxed">
            Don't just take our word for it. Hear from our students and parents about their experience at Shadow Kai.
          </p>
        </motion.div>

        {/* Masonry-style Grid */}
        <div className="grid md:grid-cols-2 gap-8">
          {TESTIMONIALS.map((t, i) => (
            <motion.div 
              key={t.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              
              transition={{ delay: i * 0.1 }}
              className="bg-white p-8 md:p-10 rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 relative group"
            >
              <Quote size={80} className="absolute top-6 right-6 text-gray-50 opacity-50 group-hover:text-orange-50 transition-colors" />
              
              <div className="flex gap-1 mb-6 relative z-10">
                {[...Array(t.rating)].map((_, i) => (
                  <Star key={i} size={18} className="fill-orange-500 text-orange-500" />
                ))}
              </div>
              
              <p className="text-gray-700 text-sm leading-relaxed mb-8 relative z-10 italic">
                "{t.quote}"
              </p>
              
              <div className="flex items-center gap-4 relative z-10">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-inner ${t.color}`}>
                  {t.initials}
                </div>
                <div>
                  <h4 className="font-bold text-gray-900">{t.name}</h4>
                  <div className="text-sm text-gray-500">{t.role}</div>
                </div>
                <div className="ml-auto">
                  <div className="text-xs font-bold px-3 py-1 bg-gray-100 text-gray-600 rounded-full">
                    {t.tag}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

      </div>
    </div>
  );
}

