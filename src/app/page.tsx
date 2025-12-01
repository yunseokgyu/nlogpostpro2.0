'use client';

import { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, Download, X } from 'lucide-react';

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'translating' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      setStatus('idle');
      setMessage('');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setStatus('idle');
      setMessage('');
    }
  };

  const handleTranslate = async () => {
    if (!file) return;

    setStatus('translating');
    setMessage('Translating document...');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('targetLang', 'ko');

    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Translation failed');
      }

      // Handle file download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `translated_${file.name}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setStatus('success');
      setMessage('Translation complete! Download started.');
    } catch (error: any) {
      console.error(error);
      setStatus('error');
      setMessage(error.message || 'An error occurred during translation.');
    }
  };

  const clearFile = () => {
    setFile(null);
    setStatus('idle');
    setMessage('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <main className="container">
      <h1>DeepL Document Translator</h1>
      <p className="subtitle">Translate PDF, DOCX, PPTX to Korean instantly</p>

      <div className="card">
        <div
          className={`upload-area ${dragActive ? 'drag-active' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleChange}
            accept=".pdf,.docx,.pptx,.txt,.html"
            style={{ display: 'none' }}
          />

          <div className="flex flex-col items-center">
            <Upload className="upload-icon" />
            <p className="text-xl font-medium">Drag & Drop file here</p>
            <p className="text-sm text-gray-400 mt-2">or click to browse</p>
          </div>
        </div>

        {file && (
          <div className="mt-8 text-left">
            <div className="bg-slate-800/50 p-4 rounded-lg flex items-center justify-between border border-slate-700 mb-6">
              <div className="flex items-center space-x-4">
                <FileText className="text-blue-400" />
                <div>
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              </div>
              <button onClick={(e) => { e.stopPropagation(); clearFile(); }} className="text-gray-500 hover:text-red-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col items-center space-y-4">
              {status === 'idle' && (
                <button className="btn w-full" onClick={handleTranslate}>
                  Translate to Korean
                </button>
              )}

              {status === 'translating' && (
                <div className="flex items-center space-x-3 text-blue-400">
                  <Loader2 className="animate-spin" />
                  <span>{message}</span>
                </div>
              )}

              {status === 'success' && (
                <div className="flex items-center space-x-3 text-green-400">
                  <CheckCircle />
                  <span>{message}</span>
                </div>
              )}

              {status === 'error' && (
                <div className="flex items-center space-x-3 text-red-400">
                  <AlertCircle />
                  <span>{message}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
