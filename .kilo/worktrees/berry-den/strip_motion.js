const fs = require('fs');
let code = fs.readFileSync('frontend/src/app/components/layout/Navbar.tsx', 'utf8');

// Remove import
code = code.replace(/import \{ m, AnimatePresence, LazyMotion, domAnimation \} from "motion\/react";\n?/, '');

// Remove LazyMotion tags
code = code.replace(/<LazyMotion features=\{domAnimation\}>/g, '<>');
code = code.replace(/<\/LazyMotion>/g, '</>');

// Remove AnimatePresence tags
code = code.replace(/<AnimatePresence>/g, '');
code = code.replace(/<\/AnimatePresence>/g, '');

// Replace m.div with div
code = code.replace(/<m\.div/g, '<div');
code = code.replace(/<\/m\.div>/g, '</div>');

// Remove layoutId, initial, animate, exit, transition props
code = code.replace(/\s+layoutId="[^"]+"/g, '');
code = code.replace(/\s+initial=\{\{[^\}]+\}\}/g, '');
code = code.replace(/\s+animate=\{\{[^\}]+\}\}/g, '');
code = code.replace(/\s+exit=\{\{[^\}]+\}\}/g, '');
code = code.replace(/\s+transition=\{\{[^\}]+\}\}/g, '');

fs.writeFileSync('frontend/src/app/components/layout/Navbar.tsx', code);
console.log('Removed framer-motion from Navbar.tsx');
