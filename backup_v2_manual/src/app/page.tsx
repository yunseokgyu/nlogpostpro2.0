
"use client";

import { useState } from 'react';

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [url, setUrl] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState<{ html: string; css: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!prompt && !image) return;
    setLoading(true);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, url, image }),
      });
      const data = await res.json();
      if (data.html && data.css) {
        setGenerated(data);
      } else {
        alert("Failed to generate website. Please try again.");
      }
    } catch (e) {
      console.error(e);
      alert("An error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const previewSrc = generated
    ? `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            ${generated.css}
            body { margin: 0; padding: 0; }
          </style>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Playfair+Display:wght@700&display=swap" rel="stylesheet">
        </head>
        <body>
          ${generated.html}
        </body>
      </html>
    `
    : '';

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans flex flex-col items-center p-4">
      <header className="w-full max-w-6xl flex justify-between items-center py-6 mb-8 border-b border-gray-800">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          Lumina Generator
        </h1>
        <div className="text-sm text-gray-400">Powered by Gemini 1.5 Flash</div>
      </header>

      <main className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-8 h-[80vh]">

        {/* Input Configuration Panel */}
        <div className="lg:col-span-1 flex flex-col gap-4">
          <div className="bg-gray-900 p-6 rounded-xl border border-gray-800 shadow-xl flex-1 flex flex-col gap-4 overflow-y-auto">

            {/* Context Inputs */}
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">Reference URL (Optional)</label>
              <input
                type="text"
                className="w-full bg-gray-950 border border-gray-700 rounded-lg p-3 text-sm text-gray-300 focus:outline-none focus:border-blue-500 transition-all placeholder-gray-600"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">Reference Image (Optional)</label>
              <div className="relative border-2 border-dashed border-gray-700 rounded-lg p-4 hover:border-gray-500 transition-colors cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center justify-center text-gray-500">
                  {image ? (
                    <img src={image} alt="Preview" className="h-20 object-contain rounded" />
                  ) : (
                    <>
                      <span className="text-2xl mb-1">+</span>
                      <span className="text-xs">Upload Screenshot/Sketch</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex-1 flex flex-col">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 block">Description</label>
              <textarea
                className="w-full flex-1 bg-gray-950 border border-gray-700 rounded-lg p-4 text-gray-300 focus:outline-none focus:border-blue-500 resize-none transition-all placeholder-gray-600"
                placeholder="Describe your vision (e.g. 'A dark minimalist portfolio for a photographer')..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={loading}
              />
            </div>

            <button
              onClick={handleGenerate}
              disabled={loading || (!prompt && !image)}
              className={`py-3 px-6 rounded-lg font-semibold text-white transition-all transform active:scale-95 flex justify-center items-center gap-2
                ${loading
                  ? 'bg-gray-700 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 shadow-lg hover:shadow-blue-500/25'
                }`}
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Generating Magic...</span>
                </>
              ) : (
                'Generate Website'
              )}
            </button>
          </div>
        </div>

        {/* Output Section */}
        <div className="lg:col-span-2 bg-gray-900 rounded-xl border border-gray-800 shadow-xl overflow-hidden flex flex-col">
          <div className="flex border-b border-gray-800">
            <button
              onClick={() => setActiveTab('preview')}
              className={`flex-1 py-3 text-sm font-medium transition-colors
                ${activeTab === 'preview' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'}`}
            >
              Live Preview
            </button>
            <button
              onClick={() => setActiveTab('code')}
              className={`flex-1 py-3 text-sm font-medium transition-colors
                ${activeTab === 'code' ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'}`}
            >
              View Code
            </button>
          </div>

          <div className="flex-1 relative bg-white">
            {generated ? (
              activeTab === 'preview' ? (
                <iframe
                  srcDoc={previewSrc}
                  className="w-full h-full border-none"
                  title="Preview"
                />
              ) : (
                <div className="absolute inset-0 bg-gray-950 p-4 overflow-auto font-mono text-xs text-green-400">
                  <pre>{`<!-- HTML -->\n${generated.html}\n\n/* CSS */\n${generated.css}`}</pre>
                </div>
              )
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 bg-gray-900">
                <div className="w-16 h-16 border-2 border-dashed border-gray-700 rounded-lg mb-4 opacity-50"></div>
                <p>Your creation will appear here</p>
              </div>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}
