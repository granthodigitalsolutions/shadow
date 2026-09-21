import { useState } from 'react';
import { MapPin, Phone, Mail, Clock, MessageCircle, Send } from 'lucide-react';
import { motion } from 'motion/react';
import { useToast } from '../../hooks/useToast';
import SeoHead from '../seo/SeoHead';
import { localBusinessSchema } from '../../../utils/seo-schemas';

export default function ContactPage() {
  const { addToast } = useToast();
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const subject = encodeURIComponent("New Contact Form Submission");
    const body = encodeURIComponent(`Name: ${formData.name}\nPhone: ${formData.phone}\nEmail: ${formData.email}\n\nMessage:\n${formData.message}`);
    
    // Open default email client
    window.location.href = `mailto:info@teamshadowkai.com?subject=${subject}&body=${body}`;

    setTimeout(() => {
      addToast('Your email client should now be open with the message.', 'success');
      setFormData({ name: '', email: '', phone: '', message: '' });
      setIsSubmitting(false);
    }, 500);
  };

  return (
    <div className="pt-28 pb-24 min-h-screen bg-gray-50">
      <SeoHead 
        title="Contact Us | Karate Coaching Near Me | Team Shadow Kai"
        description="Contact Team Shadow Kai in Tiruppur for Karate and Silambam admissions. Find our location, phone number, WhatsApp details, and academy opening hours."
        keywords="Karate Coaching Near Me, Martial Arts Academy Contact, Tiruppur Karate Classes Phone Number, Team Shadow Kai Address"
        schema={localBusinessSchema}
      />
      <div className="max-w-[1200px] mx-auto px-6">
        
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-4" style={{ background: 'rgba(255,140,0,0.1)', border: '1px solid rgba(255,140,0,0.3)' }}>
            <span style={{ color: 'var(--orange)', fontSize: '11px', fontFamily: "'Bebas Neue',sans-serif", letterSpacing: '2px' }}>GET IN TOUCH</span>
          </div>
          <h1 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: 'clamp(24px,4.5vw,48px)', lineHeight: 1, letterSpacing: '1px', color: 'var(--ink)' }}>
            Contact <span style={{ color: 'var(--orange)' }}>Shadow Kai</span>
          </h1>
          <p className="mt-4 text-gray-600 max-w-lg mx-auto">
            Have questions about our programs, belt tests, or schedules? We're here to help you start your martial arts journey.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-12 items-start">
          
          {/* Contact Form */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white p-8 md:p-10 rounded-3xl shadow-xl shadow-gray-200/50"
            style={{ border: '1px solid var(--border-color)' }}
          >
            <h3 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '28px', letterSpacing: '1px', color: 'var(--ink)', marginBottom: '24px' }}>
              Send a Message
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-gray-700">Name</label>
                  <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full p-3 rounded-xl border focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all bg-gray-50" placeholder="John Doe" />
                </div>
                <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-gray-700">Phone</label>
                    <input required type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full p-3 rounded-xl border focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all bg-gray-50" placeholder="+91 95005 30441" />
                </div>
              </div>
              
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">Email Address</label>
                <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full p-3 rounded-xl border focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all bg-gray-50" placeholder="john@example.com" />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700">Message</label>
                <textarea required rows={4} value={formData.message} onChange={e => setFormData({...formData, message: e.target.value})} className="w-full p-3 rounded-xl border focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-all bg-gray-50 resize-none" placeholder="How can we help you?" />
              </div>

              <button 
                disabled={isSubmitting}
                type="submit" 
                className="w-full flex items-center justify-center gap-2 py-4 rounded-xl text-white font-bold transition-all hover:brightness-110 disabled:opacity-70 active:scale-95 shadow-lg shadow-orange-500/30"
                style={{ background: 'var(--orange)', fontFamily: "'Bebas Neue',sans-serif", fontSize: '18px', letterSpacing: '1.5px' }}
              >
                {isSubmitting ? 'SENDING...' : <>SEND MESSAGE <Send size={18} /></>}
              </button>
            </form>
          </motion.div>

          {/* Contact Info & Map */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-8"
          >
            {/* Info Cards */}
            <div className="grid sm:grid-cols-2 gap-4">
                {/* Contact Cards */}
                {[
                { icon: Phone, title: 'Phone', content: '+91 95005 30441', cta: 'Call Now', link: 'tel:+919500530441', color: '#3B82F6' },
                { icon: MessageCircle, title: 'WhatsApp', content: '+91 95005 30441', cta: 'Chat Now', link: 'https://wa.me/919500530441', color: '#22C55E' },
                { icon: Mail, title: 'Email', content: 'info@teamshadowkai.com', cta: 'Email Us', link: 'mailto:info@teamshadowkai.com', color: '#7C3AED' },
                { icon: Clock, title: 'Hours', content: 'Mon-Sat: 6AM - 8PM\nSun: Closed', cta: '', link: '', color: 'var(--orange)' },
              ].map((item, i) => {
                const Icon = item.icon;
                return (
                  <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border" style={{ borderColor: 'var(--border-color)' }}>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center mb-4" style={{ background: `${item.color}15` }}>
                      <Icon size={18} style={{ color: item.color }} />
                    </div>
                    <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '20px', letterSpacing: '1px', color: 'var(--ink)' }}>{item.title}</div>
                    <div className="text-gray-500 text-sm mt-1 whitespace-pre-line">{item.content}</div>
                    {item.link && (
                      <a href={item.link} className="inline-block mt-3 text-sm font-bold" style={{ color: item.color }}>
                        {item.cta} →
                      </a>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Map Link / Address */}
            <a href="https://maps.app.goo.gl/ZkEEqiWCLtz7BNo68" target="_blank" rel="noopener noreferrer" className="block bg-gray-50 rounded-3xl overflow-hidden relative p-8 border border-gray-200 transition-all hover:border-orange-500 hover:shadow-lg group">
              <div className="flex flex-col items-center justify-center text-center text-gray-700">
                <div className="w-16 h-16 rounded-full bg-orange-500/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <MapPin size={32} className="text-orange-500" />
                </div>
                <span className="font-bebas text-sm tracking-wide text-gray-900 mb-2">Team Shadow Kai - India</span>
                <span className="text-sm leading-relaxed max-w-sm">4th St Stanes Rd, KNP Puram, Odakkadu,<br/>Tiruppur, Tamil Nadu 641602</span>
                <span className="mt-4 text-orange-500 font-bold text-sm flex items-center gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                  Open in Google Maps →
                </span>
              </div>
            </a>
            
          </motion.div>
        </div>
      </div>
    </div>
  );
}

