import { useEffect } from 'react';

interface SEOProps {
  title: string;
  description: string;
  type?: string;
  name?: string;
  url?: string;
}

export default function SEO({ title, description, type = 'website', name = 'Shadow Kai', url = 'https://shadowkai.com' }: SEOProps) {
  useEffect(() => {
    document.title = title;

    const setMeta = (name: string, content: string, attr = 'name') => {
      let element = document.querySelector(`meta[${attr}="${name}"]`);
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attr, name);
        document.head.appendChild(element);
      }
      element.setAttribute('content', content);
    };

    setMeta('description', description);
    
    // Open Graph
    setMeta('og:title', title, 'property');
    setMeta('og:description', description, 'property');
    setMeta('og:type', type, 'property');
    setMeta('og:site_name', name, 'property');
    setMeta('og:url', url, 'property');
    
    // Twitter
    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:title', title);
    setMeta('twitter:description', description);
    
  }, [title, description, type, name, url]);

  return null;
}
