import SeoHead from '../seo/SeoHead';

export default function BlogPostPage() {
  return (
    <div className="pt-24 min-h-screen bg-white">
      <SeoHead 
        title="BlogPostPage - Team Shadow Kai"
        description="Information about BlogPostPage at Team Shadow Kai in Tiruppur."
      />
      <div className="max-w-7xl mx-auto px-6 py-12">
        <h1 className="text-sm font-bebas text-gray-900">BlogPostPage</h1>
        <p className="mt-4 text-gray-600">Content coming soon...</p>
      </div>
    </div>
  );
}
