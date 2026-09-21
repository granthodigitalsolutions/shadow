// LocalBusiness Schema for Team Shadow Kai
export const localBusinessSchema = {
  "@context": "https://schema.org",
  "@type": "SportsActivityLocation",
  "name": "Team Shadow Kai",
  "url": "https://teamshadowkai.com",
  "logo": "https://teamshadowkai.com/logo.png",
  "image": "https://teamshadowkai.com/logo.png",
  "description": "Premier Karate and Traditional Silambam Academy in Tiruppur, Tamil Nadu. Founded in 1986, training over 30,000 students in Martial Arts and Self Defence.",
  "@id": "https://teamshadowkai.com/#organization",
  "telephone": "+91 00000 00000",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Team Shadow Kai - India, 4th St Stanes Rd, KNP Puram, Odakkadu",
    "addressLocality": "Tiruppur",
    "addressRegion": "Tamil Nadu",
    "postalCode": "641602",
    "addressCountry": "IN"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 11.1085,
    "longitude": 77.3411
  },
  "openingHoursSpecification": [
    {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": [
        "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
      ],
      "opens": "06:00",
      "closes": "21:00"
    }
  ],
  "sameAs": [
    "https://www.instagram.com/team_shadow_kai",
    "https://www.facebook.com/share/1NpzP8PLSL/",
    "https://youtube.com/@teamshadowkai"
  ]
};

// FAQ Schema Generator
export const generateFaqSchema = (faqs: { question: string, answer: string }[]) => {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  };
};

// Breadcrumb Schema Generator
export const generateBreadcrumbSchema = (crumbs: { name: string, item: string }[]) => {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": crumb.name,
      "item": crumb.item
    }))
  };
};
