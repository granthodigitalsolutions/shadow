import { Link } from 'react-router-dom';
import { MapPin, Phone, Mail, Award, ArrowRight, Facebook, Instagram, Youtube } from 'lucide-react';
import logo from '../../../assets/logos/team-shadow-kai.png';

export default function Footer() {
  return (
    <footer className="pt-24 pb-12" style={{ background: '#0D0D0D', color: 'rgba(255,255,255,0.85)' }}>
      <div className="max-w-[1200px] mx-auto px-6 grid md:grid-cols-3 gap-12 border-b pb-16" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
        
        {/* Brand Col */}
        <div className="md:col-span-1 space-y-6">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Shadow Kai" className="w-12 h-12 object-cover" />
            <div>
              <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '24px', letterSpacing: '2px', color: '#fff', lineHeight: 1 }}>
                SHADOW KAI
              </div>
              <div style={{ fontSize: '11px', color: 'var(--orange)', letterSpacing: '1px' }}>
                TEAM SHADOW KAI
              </div>
            </div>
          </div>
          <p className="text-sm leading-relaxed" style={{ maxWidth: '280px' }}>
            Forging champions through discipline, focus, and traditional martial arts values. Join the premier Karate & Silambam academy.
          </p>
          <div className="flex gap-4">
            <a href="https://www.facebook.com/share/1NpzP8PLSL/" target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="w-10 h-10 rounded-full flex items-center justify-center transition-colors hover:bg-orange-500 hover:text-white" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <Facebook size={18} />
            </a>
            <a href="https://www.instagram.com/team_shadow_kai?igsh=eHlyMzJmOTY3aHB5" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="w-10 h-10 rounded-full flex items-center justify-center transition-colors hover:bg-orange-500 hover:text-white" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <Instagram size={18} />
            </a>
            <a href="https://youtube.com/@teamshadowkai?si=7xL2cMPu0WKQisHA" target="_blank" rel="noopener noreferrer" aria-label="YouTube" className="w-10 h-10 rounded-full flex items-center justify-center transition-colors hover:bg-orange-500 hover:text-white" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <Youtube size={18} />
            </a>
          </div>
        </div>

        {/* Quick Links */}
        <div className="space-y-6">
          <h3 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '20px', letterSpacing: '1.5px', color: '#fff' }}>QUICK LINKS</h3>
          <div className="flex flex-col gap-3 text-sm">
            {['About', 'Programs', 'Journey', 'Gallery', 'Testimonials'].map(link => (
              <Link key={link} to={`/${link.toLowerCase()}`} className="hover:text-white transition-colors flex items-center gap-2 group">
                <ArrowRight size={12} className="opacity-0 -ml-4 group-hover:opacity-100 group-hover:ml-0 transition-all text-orange-500" />
                {link}
              </Link>
            ))}
          </div>
        </div>

        {/* Contact Info */}
        <div className="space-y-6">
          <h3 style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '20px', letterSpacing: '1.5px', color: '#fff' }}>CONTACT US</h3>
          <div className="flex flex-col gap-4 text-sm">
            <a href="https://maps.app.goo.gl/ZkEEqiWCLtz7BNo68" target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 hover:text-white transition-colors">
              <MapPin size={18} className="text-orange-500 flex-shrink-0 mt-0.5" />
              <span>Team Shadow Kai - India,<br/>4th St Stanes Rd, KNP Puram, Odakkadu,<br/>Tiruppur, Tamil Nadu 641602</span>
            </a>
            <div className="flex items-center gap-3">
              <Phone size={18} className="text-orange-500 flex-shrink-0" />
              <span>+91 95005 30441</span>
            </div>
            <div className="flex items-center gap-3">
              <Mail size={18} className="text-orange-500 flex-shrink-0" />
              <span>info@teamshadowkai.com</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-6 pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs" style={{ color: 'rgba(255,255,255,0.85)' }}>
        <p>© {new Date().getFullYear()} Team Shadow Kai. All rights reserved.</p>
        <div className="flex items-center gap-2">
          <Award size={14} />
          <span>Recognized by State Karate Association</span>
        </div>
      </div>
    </footer>
  );
}
