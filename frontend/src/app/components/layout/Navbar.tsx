import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Menu, X, ChevronDown } from "lucide-react";
import logo from "../../../assets/shadow-kai-logo.png";

const NAV_LINKS = [
  { name: "Home", path: "/" },
  { name: "About", path: "/about" },
  { name: "Programs", path: "/programs" },
  { name: "Journey", path: "/journey" },
  { name: "Gallery", path: "/gallery" },
  { name: "Achievements", path: "/achievements" },
  { name: "Testimonials", path: "/testimonials" },
  { name: "Contact", path: "/contact" },
];
export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [registerDropdownOpen, setRegisterDropdownOpen] = useState(false);
  const loginTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const registerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openLoginDropdown = useCallback(() => {
    if (loginTimeoutRef.current) clearTimeout(loginTimeoutRef.current);
    setDropdownOpen(true);
  }, []);
  const closeLoginDropdown = useCallback(() => {
    loginTimeoutRef.current = setTimeout(() => setDropdownOpen(false), 150);
  }, []);
  const openRegisterDropdown = useCallback(() => {
    if (registerTimeoutRef.current) clearTimeout(registerTimeoutRef.current);
    setRegisterDropdownOpen(true);
  }, []);
  const closeRegisterDropdown = useCallback(() => {
    registerTimeoutRef.current = setTimeout(() => setRegisterDropdownOpen(false), 150);
  }, []);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    setNavOpen(false);
    setDropdownOpen(false);
    setRegisterDropdownOpen(false);
  }, [location.pathname]);
  const isHome = location.pathname === "/";
  const isTransparent = isHome && !scrolled;
  return (
    <>
      {" "}
      <nav
        className="fixed top-0 left-0 right-0 z-[100] transition-all duration-300"
        style={{
          background: isTransparent ? "transparent" : "rgba(13,13,13,0.98)",
          backdropFilter: isTransparent ? "none" : "blur(16px)",
          borderBottom: isTransparent
            ? "1px solid transparent"
            : "1px solid rgba(255,255,255,0.08)",
          padding: isTransparent ? "1.25rem 0" : "0.75rem 0",
        }}
        aria-label="Main Navigation"
      >
        {" "}
        <div className="max-w-[1400px] mx-auto px-6 flex flex-wrap items-center justify-between gap-3">
          {" "}
          {/* LEFT: Logo */}{" "}
          <div className="flex-1 flex justify-start items-center">
            {" "}
            <Link
              to="/"
              className="flex items-center gap-4 transition-all duration-300 hover:opacity-90 active:scale-95 focus:outline-none focus:ring-2 focus:ring-orange-500 rounded-lg p-1"
              aria-label="Home"
            >
              <div className="relative group">
                <div className="absolute inset-0 bg-orange-500/20 rounded-full blur-md group-hover:bg-orange-500/40 transition-all duration-300"></div>
                <img
                  src={logo}
                  alt="Shadow Kai Logo"
                  className="w-11 h-11 object-cover drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)] relative z-10"
                />
              </div> 
              <div className="block">
                {" "}
                <div
                  style={{
                    fontFamily: "'Bebas Neue',sans-serif",
                    fontSize: "20px",
                    letterSpacing: "2px",
                    color: "#fff",
                    lineHeight: 1,
                  }}
                >
                  TEAM
                </div>
                <div
                  style={{
                    fontSize: "10px",
                    color: "rgba(255,255,255,.5)",
                    letterSpacing: "1px",
                  }}
                >
                  SHADOW KAI
                </div>
              </div>{" "}
            </Link>{" "}
          </div>{" "}
          {/* CENTER: Desktop Nav Links */}{" "}
          <div className="hidden lg:flex flex-none items-stretch justify-center gap-6 xl:gap-8 h-full">
            {" "}
            {NAV_LINKS.map((link) => {
              const isActive = location.pathname === link.path;
              return (
                <Link
                  key={link.name}
                  to={link.path}
                  className="text-[9.75px] xl:text-sm font-medium transition-all duration-300 relative group focus:outline-none flex items-center"
                  style={{
                    color: isActive ? "#FF8C00" : "rgba(255, 255, 255, 0.7)",
                    letterSpacing: "0.5px",
                  }}
                >
                  {" "}
                  <span className="group-hover:text-white group-hover:-translate-y-[1px] transition-all duration-300 inline-block">
                    {link.name}
                  </span>{" "}
                  {/* Active Indicator */}{" "}
                  {isActive && (
                    <div
                      className="absolute -bottom-[2px] left-0 right-0 h-[2px] rounded-full"
                      style={{ background: "#FF8C00" }}
                    />
                  )}{" "}
                  {/* Hover Underline (only when not active) */}{" "}
                  {!isActive && (
                    <div className="absolute -bottom-[2px] left-0 right-0 h-[2px] bg-white/40 scale-x-0 origin-left transition-transform duration-300 ease-out group-hover:scale-x-100 rounded-full" />
                  )}{" "}
                </Link>
              );
            })}{" "}
          </div>{" "}
          {/* RIGHT: Desktop CTA & Login Dropdown */}{" "}
          <div className="hidden lg:flex flex-1 items-center justify-end gap-3 xl:gap-5">
            {" "}
            <div
              className="relative"
              onMouseEnter={openLoginDropdown}
              onMouseLeave={closeLoginDropdown}
            >
              <button
                className="flex items-center gap-1.5 text-sm font-semibold px-2 py-2 transition-all text-gray-300 hover:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 rounded-md"
                aria-expanded={dropdownOpen}
                aria-haspopup="true"
              >
                Login
                <ChevronDown
                  size={16}
                  className={`transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`}
                />
              </button>
              {dropdownOpen && (
                <div className="absolute right-0 top-full pt-2 w-48">
                  <div
                    className="rounded-xl shadow-2xl py-2 overflow-hidden border"
                    style={{
                      background: "rgba(20,20,20,0.95)",
                      backdropFilter: "blur(16px)",
                      borderColor: "rgba(255,255,255,0.1)",
                    }}
                  >
                    <Link
                      to="/coach/login"
                      className="block px-5 py-3 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors focus:bg-white/10 focus:outline-none"
                    >
                      Coach Portal
                    </Link>
                    <Link
                      to="/examiner"
                      className="block px-5 py-3 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors focus:bg-white/10 focus:outline-none"
                    >
                      Examiner Portal
                    </Link>
                    <Link
                      to="/admin/login"
                      className="block px-5 py-3 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors focus:bg-white/10 focus:outline-none"
                    >
                      Admin Portal
                    </Link>
                  </div>
                </div>
              )}
            </div>{" "}
            <div
              className="relative"
              onMouseEnter={openRegisterDropdown}
              onMouseLeave={closeRegisterDropdown}
            >
              <button
                className="flex items-center gap-1.5 px-4 xl:px-5 py-2 xl:py-2.5 rounded-xl text-xs xl:text-sm font-bold transition-all hover:brightness-110 active:scale-95 shadow-[0_4px_14px_0_rgba(255,140,0,0.39)] hover:shadow-[0_6px_20px_rgba(255,140,0,0.23)] focus:outline-none focus:ring-2 focus:ring-white whitespace-nowrap"
                style={{
                  background: "var(--orange)",
                  color: "#000",
                  fontFamily: "'Bebas Neue',sans-serif",
                  letterSpacing: "1.5px",
                }}
                aria-expanded={registerDropdownOpen}
                aria-haspopup="true"
              >
                REGISTER NOW
                <ChevronDown
                  size={16}
                  className={`transition-transform duration-200 ${registerDropdownOpen ? "rotate-180" : ""}`}
                />
              </button>
              {registerDropdownOpen && (
                <div className="absolute right-0 top-full pt-2 w-48">
                  <div
                    className="rounded-xl shadow-2xl py-2 overflow-hidden border"
                    style={{
                      background: "rgba(20,20,20,0.95)",
                      backdropFilter: "blur(16px)",
                      borderColor: "rgba(255,255,255,0.1)",
                    }}
                  >
                    <Link
                      to="/karate/register"
                      className="block px-5 py-3 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors focus:bg-white/10 focus:outline-none"
                    >
                      Karate
                    </Link>
                    <Link
                      to="/selambam/register"
                      className="block px-5 py-3 text-sm text-gray-300 hover:text-white hover:bg-white/5 transition-colors focus:bg-white/10 focus:outline-none"
                    >
                      Silambam
                    </Link>
                  </div>
                </div>
              )}
            </div>{" "}
          </div>{" "}
          {/* Mobile hamburger */}{" "}
          <div className="lg:hidden flex-1 flex justify-end">
            {" "}
            <button
              className="text-white relative z-50 p-2 focus:outline-none focus:ring-2 focus:ring-orange-500 rounded-md"
              onClick={() => setNavOpen((p) => !p)}
              aria-label={navOpen ? "Close Menu" : "Open Menu"}
              aria-expanded={navOpen}
            >
              {" "}
              {navOpen ? <X size={24} /> : <Menu size={24} />}{" "}
            </button>{" "}
          </div>{" "}
        </div>{" "}
      </nav>{" "}
      {/* Mobile menu - Rendered outside <nav> to prevent backdrop-filter containing block truncation */}{" "}
      
        {" "}
        {navOpen && (
          <>
            {" "}
            <div
              onClick={() => setNavOpen(false)}
              className="lg:hidden fixed inset-0 z-[150] bg-black/60 backdrop-blur-sm"
            />{" "}
            <div
              className="lg:hidden fixed top-0 right-0 bottom-0 w-[80vw] max-w-[320px] z-[200] shadow-2xl border-l border-white/10 flex flex-col"
              style={{ background: "rgba(13,13,13,0.98)" }}
            >
              {" "}
              <div className="flex flex-wrap justify-between items-center gap-3 px-6 py-6 border-b border-white/10">
                {" "}
                <span className="font-bebas text-white tracking-widest text-sm">
                  MENU
                </span>{" "}
                <button
                  onClick={() => setNavOpen(false)}
                  className="text-white p-2 focus:outline-none focus:ring-2 focus:ring-orange-500 rounded-md"
                  aria-label="Close Menu"
                >
                  {" "}
                  <X size={24} />{" "}
                </button>{" "}
              </div>{" "}
              <div className="px-6 py-6 overflow-y-auto flex-1">
                {" "}
                <div className="flex flex-col gap-1">
                  {" "}
                  {NAV_LINKS.map((link) => {
                    const isActive = location.pathname === link.path;
                    return (
                      <Link
                        key={link.name}
                        to={link.path}
                        onClick={() => setNavOpen(false)}
                        className="relative block w-full text-left py-4 px-6 text-sm font-medium transition-all duration-300 focus:outline-none group"
                        style={{
                          color: isActive
                            ? "#FF8C00"
                            : "rgba(255, 255, 255, 0.7)",
                          letterSpacing: "0.5px",
                        }}
                      >
                        {" "}
                        <span className="group-hover:text-white transition-colors inline-block group-hover:translate-x-1">
                          {link.name}
                        </span>{" "}
                        {/* Active Indicator line on the left side */}{" "}
                        {isActive && (
                          <div
                            className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-1/2 rounded-r-full"
                            style={{ background: "#FF8C00" }}
                          />
                        )}{" "}
                      </Link>
                    );
                  })}{" "}
                </div>{" "}
                <div className="mt-8 pt-8 border-t border-white/10 flex flex-col gap-3">
                  {" "}
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-widest px-4 mb-2">
                    Portals
                  </div>{" "}
                  <Link
                    to="/coach/login"
                    onClick={() => setNavOpen(false)}
                    className="block py-3 px-4 rounded-lg text-sm font-semibold transition-colors bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    {" "}
                    Coach Portal{" "}
                  </Link>{" "}
                  <Link
                    to="/examiner"
                    onClick={() => setNavOpen(false)}
                    className="block py-3 px-4 rounded-lg text-sm font-semibold transition-colors bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    {" "}
                    Examiner Portal{" "}
                  </Link>{" "}
                  <Link
                    to="/admin/login"
                    onClick={() => setNavOpen(false)}
                    className="block py-3 px-4 rounded-lg text-sm font-semibold transition-colors bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    {" "}
                    Admin Portal{" "}
                  </Link>{" "}
                  <div className="mt-6 flex flex-col gap-3">
                    <button
                      onClick={() => {
                        setNavOpen(false);
                        navigate("/karate/register");
                      }}
                      className="py-4 w-full rounded-xl text-black text-sm font-bold shadow-[0_4px_14px_0_rgba(255,140,0,0.39)] focus:outline-none focus:ring-2 focus:ring-white"
                      style={{
                        background: "var(--orange)",
                        fontFamily: "'Bebas Neue',sans-serif",
                        fontSize: "18px",
                        letterSpacing: "1.5px",
                      }}
                    >
                      {" "}
                      KARATE REGISTRATION{" "}
                    </button>{" "}
                    <button
                      onClick={() => {
                        setNavOpen(false);
                        navigate("/selambam/register");
                      }}
                      className="py-4 w-full rounded-xl text-black text-sm font-bold shadow-[0_4px_14px_0_rgba(255,140,0,0.39)] focus:outline-none focus:ring-2 focus:ring-white"
                      style={{
                        background: "var(--orange)",
                        fontFamily: "'Bebas Neue',sans-serif",
                        fontSize: "18px",
                        letterSpacing: "1.5px",
                      }}
                    >
                      {" "}
                      SILAMBAM REGISTRATION{" "}
                    </button>{" "}
                  </div>{" "}
                </div>{" "}
              </div>{" "}
            </div>{" "}
          </>
        )}{" "}
      {" "}
    </>
  );
}
