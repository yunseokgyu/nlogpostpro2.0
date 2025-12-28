"use client";

import { useState, useEffect } from 'react';
import { Sparkles, Copy, Check, Settings, Eye, EyeOff, Save, Trash, User, Users, Plus, Download, FileText, Zap, RefreshCw, AlertCircle, Loader2 } from 'lucide-react';

// --- Types ---

interface BlogProfile {
    id: string;
    name: string;
    category: string;
    style: string;
    createdAt: string;
}

interface BatchItem {
    id: string;
    title: string;
    keyword: string;
    status: 'idle' | 'loading' | 'success' | 'error';
    result?: string;
    errorMsg?: string;
}

// Fixed Categories
const CATEGORIES = [
    "IT/테크", "일상/브이로그", "맛집/여행", "금융/재테크", "뷰티/패션",
    "건강/운동", "육아/교육", "게임/취미", "리뷰/후기", "기타"
];

// --- Components ---

const ApiKeySettings = ({ apiKey, saveApiKey, showApiKey, setShowApiKey }: {
    apiKey: string, saveApiKey: (k: string) => void, showApiKey: boolean, setShowApiKey: (s: boolean) => void
}) => (
    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 shadow-inner mb-6">
        <div className="flex items-center gap-2 mb-2">
            <Settings className="w-4 h-4 text-gray-600" />
            <label className="text-xs font-semibold text-gray-700">Gemini API Key</label>
            {apiKey && <span className="ml-auto text-xs text-green-600 font-medium">✅ 연결됨</span>}
        </div>
        <div className="relative">
            <input
                type={showApiKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => saveApiKey(e.target.value)}
                placeholder="AIza..."
                className="w-full px-3 py-2 pr-10 text-sm border border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none font-mono"
            />
            <button
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
            >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
        </div>
    </div>
);

export default function BlogPage() {
    // --- Global State ---
    const [apiKey, setApiKey] = useState('');
    const [activeTab, setActiveTab] = useState<'single' | 'batch'>('single');
    const [profiles, setProfiles] = useState<BlogProfile[]>([]);
    const [showApiKey, setShowApiKey] = useState(false);

    // --- Single Gen State ---
    const [singleTitle, setSingleTitle] = useState('');
    const [singleKeyword, setSingleKeyword] = useState('');
    const [singleProfileId, setSingleProfileId] = useState('');
    const [singleContent, setSingleContent] = useState('');
    const [singleLoading, setSingleLoading] = useState(false);
    const [singleError, setSingleError] = useState('');

    // --- Batch Gen State ---
    const [batchItems, setBatchItems] = useState<BatchItem[]>([{ id: '1', title: '', keyword: '', status: 'idle' }]);
    const [batchProfileId, setBatchProfileId] = useState('');
    const [batchProcessing, setBatchProcessing] = useState(false);
    const [isZipping, setIsZipping] = useState(false); // Add simple loading state for zip

    // Auto-fill state
    const [autoTitle, setAutoTitle] = useState('');
    const [autoKeyword, setAutoKeyword] = useState('');

    // --- Profile Manager State ---
    const [newProfileName, setNewProfileName] = useState('');
    const [newProfileCategory, setNewProfileCategory] = useState(CATEGORIES[0]);
    const [newProfileStyle, setNewProfileStyle] = useState('');

    // --- Init ---
    useEffect(() => {
        const savedKey = localStorage.getItem('gemini_api_key');
        if (savedKey) setApiKey(savedKey);

        const savedProfiles = localStorage.getItem('blog_profiles');
        if (savedProfiles) {
            setProfiles(JSON.parse(savedProfiles));
        }
    }, []);

    // --- Handlers ---

    const saveApiKey = (key: string) => {
        setApiKey(key);
        localStorage.setItem('gemini_api_key', key);
    };

    const handleCreateProfile = () => {
        if (!newProfileName.trim()) return alert("프로필 이름을 입력하세요.");
        if (profiles.length >= 100) return alert("프로필은 최대 100개까지만 생성 가능합니다.");

        const newProfile: BlogProfile = {
            id: Date.now().toString(),
            name: newProfileName,
            category: newProfileCategory,
            style: newProfileStyle,
            createdAt: new Date().toISOString()
        };

        const updated = [...profiles, newProfile];
        setProfiles(updated);
        localStorage.setItem('blog_profiles', JSON.stringify(updated));
        setNewProfileName('');
        setNewProfileStyle('');
    };

    const handleDeleteProfile = (id: string) => {
        if (!confirm("정말 삭제하시겠습니까?")) return;
        const updated = profiles.filter(p => p.id !== id);
        setProfiles(updated);
        localStorage.setItem('blog_profiles', JSON.stringify(updated));
        if (singleProfileId === id) setSingleProfileId('');
        if (batchProfileId === id) setBatchProfileId('');
    };

    const generateBlog = async (title: string, keyword: string, profileId: string): Promise<string> => {
        const profile = profiles.find(p => p.id === profileId);
        const style = profile ? profile.style : '';

        const res = await fetch('/api/blog', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiKey, title, keyword, style }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '오류 발생');
        return data.content;
    };

    const handleSingleGenerate = async () => {
        if (!apiKey) return setSingleError('API Key가 필요합니다.');
        if (!singleTitle || !singleKeyword || !singleProfileId) return setSingleError('모든 필드를 입력해주세요.');

        setSingleLoading(true);
        setSingleError('');
        try {
            const content = await generateBlog(singleTitle, singleKeyword, singleProfileId);
            setSingleContent(content);
        } catch (e: any) {
            setSingleError(e.message);
        } finally {
            setSingleLoading(false);
        }
    };

    // --- Batch Handlers ---
    const addBatchItem = () => {
        if (batchItems.length >= 10) return alert("최대 10개까지 동시에 작업 가능합니다.");
        setBatchItems([...batchItems, { id: Date.now().toString(), title: '', keyword: '', status: 'idle' }]);
    };

    const handleAutoFill = () => {
        if (!autoTitle || !autoKeyword) return alert("공통 주제와 키워드를 입력해주세요.");

        const newItems: BatchItem[] = Array.from({ length: 10 }, (_, i) => ({
            id: Date.now().toString() + i,
            title: `${autoTitle} - ${i + 1}편`,
            keyword: autoKeyword,
            status: 'idle'
        }));

        setBatchItems(newItems);
    };

    const updateBatchItem = (id: string, field: 'title' | 'keyword', value: string) => {
        setBatchItems(batchItems.map(item => item.id === id ? { ...item, [field]: value } : item));
    };

    const removeBatchItem = (id: string) => {
        setBatchItems(batchItems.filter(item => item.id !== id));
    };

    const handleBatchGenerate = async () => {
        if (!apiKey) return alert("API Key가 필요합니다.");
        if (!batchProfileId) return alert("프로필을 선택해주세요.");

        setBatchProcessing(true);

        // Staggered Parallel Processing (Balance Speed & Stability)
        // Start each request with a 500ms delay relative to the previous one
        // This prevents hitting the rate limit instantly while still being much faster than sequential.
        const promises = batchItems.map(async (item, index) => {
            if (!item.title || !item.keyword) return item;

            // Stagger delay
            await new Promise(resolve => setTimeout(resolve, index * 500));

            // Update status to loading
            setBatchItems(prev => prev.map(it => it.id === item.id ? { ...it, status: 'loading' } : it));

            try {
                const content = await generateBlog(item.title, item.keyword, batchProfileId);
                // Update status to success
                setBatchItems(prev => prev.map(it => it.id === item.id ? { ...it, status: 'success', result: content } : it));
            } catch (e: any) {
                // Update status to error
                setBatchItems(prev => prev.map(it => it.id === item.id ? { ...it, status: 'error', errorMsg: e.message } : it));
            }
        });

        await Promise.all(promises);

        setBatchProcessing(false);
    };

    const handleDownloadAll = async () => {
        const successfulItems = batchItems.filter(item => item.status === 'success' && item.result);

        if (successfulItems.length === 0) {
            alert("다운로드할 완료된 작업이 없습니다.");
            return;
        }

        if (!confirm(`${successfulItems.length}개의 파일을 다운로드합니다.\n만약 다운로드가 안되면 아래 '수동 다운로드 링크'를 이용해주세요.`)) return;

        // Download each file
        for (let i = 0; i < successfulItems.length; i++) {
            const item = successfulItems[i];
            const safeTitle = item.title.replace(/[\/\\?%*:|"<>]/g, '_').trim();
            const fileName = `${i + 1}_${safeTitle || 'untitled'}.txt`;
            const content = item.result || "";

            // USE DATA URI (Most robust for text) - bypasses Blob storage
            // Use application/octet-stream to FORCE download instead of opening in tab
            const dataUri = 'data:application/octet-stream;charset=utf-8,' + encodeURIComponent(content);

            const a = document.createElement("a");
            a.style.display = "none";
            a.href = dataUri;
            a.download = fileName;

            document.body.appendChild(a);
            a.click();

            // Cleanup just DOM
            setTimeout(() => {
                document.body.removeChild(a);
            }, 1000);

            // 500ms delay
            if (i < successfulItems.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
    };

    // --- Result Viewer Modal State ---
    const [modalOpen, setModalOpen] = useState(false);
    const [modalTitle, setModalTitle] = useState('');
    const [modalContent, setModalContent] = useState('');

    const handleViewResult = (title: string, content: string) => {
        setModalTitle(title);
        setModalContent(content);
        setModalOpen(true);
    };

    // --- Renders ---

    return (
        <div className="min-h-screen bg-gray-50 flex justify-center p-4 lg:p-8 font-sans text-gray-800 relative">
            {/* Modal Overlay */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white w-full max-w-4xl h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scale-up">
                        <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                            <h3 className="font-bold text-lg text-gray-800 line-clamp-1 flex-1 mr-4">{modalTitle}</h3>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => navigator.clipboard.writeText(modalContent)}
                                    className="px-3 py-1.5 bg-blue-100 text-blue-700 font-bold rounded-lg hover:bg-blue-200 transition-colors flex items-center gap-1 text-sm"
                                >
                                    <Copy className="w-4 h-4" /> 전체 복사
                                </button>
                                <button
                                    onClick={() => setModalOpen(false)}
                                    className="px-3 py-1.5 bg-gray-200 text-gray-600 font-bold rounded-lg hover:bg-gray-300 transition-colors text-sm"
                                >
                                    닫기
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 p-6 overflow-y-auto whitespace-pre-wrap leading-relaxed text-gray-700 bg-white font-serif">
                            {modalContent}
                        </div>
                    </div>
                </div>
            )}

            <div className="w-full max-w-[1600px] bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col h-[90vh]">

                {/* Header */}
                <header className="p-6 border-b border-gray-100 bg-white flex-none">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
                            <Sparkles className="text-white w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">AI 블로그 마스터</h1>
                            <p className="text-gray-500 text-xs">다중 프로필 관리 및 일괄 생성 시스템</p>
                        </div>
                    </div>
                </header>

                <div className="flex flex-1 flex-col lg:flex-row overflow-hidden">

                    {/* --- LEFT PANEL: Generation Area (70%) --- */}
                    <main className="flex-1 flex flex-col border-r border-gray-100 overflow-hidden">
                        {/* Tabs */}
                        <div className="flex border-b border-gray-100 bg-gray-50/30 flex-none sticky top-0 z-10">
                            <button
                                onClick={() => setActiveTab('single')}
                                className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-colors ${activeTab === 'single' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                            >
                                <FileText className="w-4 h-4" /> 단일 생성
                            </button>
                            <button
                                onClick={() => setActiveTab('batch')}
                                className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-colors ${activeTab === 'batch' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                            >
                                <Zap className="w-4 h-4" /> 일괄 작업 (Batch)
                            </button>
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 overflow-y-auto p-6 lg:p-8 bg-white">

                            {/* --- SINGLE GEN --- */}
                            {activeTab === 'single' && (
                                <div className="space-y-6 animate-fade-in h-full flex flex-col">
                                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 h-full">
                                        {/* Inputs */}
                                        <div className="xl:col-span-4 space-y-4 flex-none">
                                            <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100">
                                                <label className="block text-xs font-bold text-gray-500 mb-2">작성 프로필 선택</label>
                                                <select
                                                    value={singleProfileId}
                                                    onChange={(e) => setSingleProfileId(e.target.value)}
                                                    className="w-full p-3 bg-white border border-gray-200 rounded-xl focus:border-blue-500 outline-none text-sm"
                                                >
                                                    <option value="">프로필 없이 작성 (기본)</option>
                                                    {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                                </select>
                                            </div>

                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 mb-1">제목</label>
                                                <input
                                                    value={singleTitle}
                                                    onChange={(e) => setSingleTitle(e.target.value)}
                                                    className="w-full p-3 bg-white border border-gray-200 rounded-xl focus:border-blue-500 outline-none text-sm font-medium"
                                                    placeholder="포스팅 제목"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 mb-1">키워드</label>
                                                <input
                                                    value={singleKeyword}
                                                    onChange={(e) => setSingleKeyword(e.target.value)}
                                                    className="w-full p-3 bg-white border border-gray-200 rounded-xl focus:border-blue-500 outline-none text-sm"
                                                    placeholder="핵심 키워드"
                                                />
                                            </div>
                                            <button
                                                onClick={handleSingleGenerate}
                                                disabled={singleLoading}
                                                className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 mt-4 text-sm"
                                            >
                                                {singleLoading ? '생성 중...' : '글 생성하기'}
                                            </button>
                                            {singleError && <p className="text-red-500 text-xs mt-2 text-center">{singleError}</p>}
                                        </div>

                                        {/* Output Preview */}
                                        <div className="xl:col-span-8 flex flex-col h-[500px] xl:h-auto">
                                            <div className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl flex flex-col relative overflow-hidden">
                                                <div className="p-3 border-b border-gray-200 bg-white/50 flex items-center justify-between backdrop-blur-sm">
                                                    <span className="text-xs font-bold text-gray-500 px-2">결과 미리보기</span>
                                                    {singleContent && (
                                                        <button onClick={() => navigator.clipboard.writeText(singleContent)} className="flex items-center gap-1 text-blue-600 text-xs font-bold hover:bg-blue-50 px-2 py-1 rounded-lg transition-colors">
                                                            <Copy className="w-3 h-3" /> 복사
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="flex-1 p-6 overflow-y-auto custom-scrollbar bg-white">
                                                    {singleContent ? (
                                                        <div className="whitespace-pre-wrap leading-relaxed text-gray-800 text-base">
                                                            {singleContent}
                                                        </div>
                                                    ) : (
                                                        <div className="h-full flex flex-col items-center justify-center text-gray-300 gap-3">
                                                            <FileText className="w-12 h-12 opacity-50" />
                                                            <span className="text-sm">생성된 글이 여기에 표시됩니다</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* --- BATCH GEN --- */}
                            {activeTab === 'batch' && (
                                <div className="space-y-6 animate-fade-in pb-10 max-w-3xl mx-auto">
                                    <div className="bg-indigo-50/50 p-6 rounded-2xl border border-indigo-100 mb-4">
                                        <div className="flex items-center justify-between mb-4">
                                            <h2 className="text-lg font-bold text-indigo-900 flex items-center gap-2">
                                                <Zap className="w-5 h-5 text-indigo-600" /> 일괄 작업 설정 (1주제 → 10개 확장)
                                            </h2>
                                            <select
                                                value={batchProfileId}
                                                onChange={(e) => setBatchProfileId(e.target.value)}
                                                className="px-4 py-2 border border-indigo-200 rounded-lg text-sm min-w-[200px] focus:ring-2 ring-indigo-200 outline-none"
                                            >
                                                <option value="">프로필 선택... (필수)</option>
                                                {profiles.map(p => <option key={p.id} value={p.id}>{p.name} ({p.category})</option>)}
                                            </select>
                                        </div>

                                        {/* Auto Fill Section */}
                                        <div className="flex gap-2 mb-2">
                                            <input
                                                placeholder="공통 주제 (예: 제주도 맛집)"
                                                value={autoTitle}
                                                onChange={(e) => setAutoTitle(e.target.value)}
                                                className="flex-1 px-3 py-2 text-sm border border-indigo-200 rounded-lg focus:outline-none focus:border-indigo-400"
                                            />
                                            <input
                                                placeholder="공통 키워드"
                                                value={autoKeyword}
                                                onChange={(e) => setAutoKeyword(e.target.value)}
                                                className="w-1/3 px-3 py-2 text-sm border border-indigo-200 rounded-lg focus:outline-none focus:border-indigo-400"
                                            />
                                            <button
                                                onClick={handleAutoFill}
                                                className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 whitespace-nowrap"
                                            >
                                                목록 10개 채우기
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-indigo-500">
                                            * 공통 주제를 입력하고 버튼을 누르면 아래 목록이 자동으로 생성됩니다.
                                        </p>
                                    </div>

                                    <div className="space-y-3 pr-2">
                                        {batchItems.map((item, idx) => (
                                            <div key={item.id} className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow group">
                                                <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-500 text-xs flex-none">
                                                    {idx + 1}
                                                </div>
                                                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    <input
                                                        placeholder="글 제목"
                                                        value={item.title}
                                                        onChange={(e) => updateBatchItem(item.id, 'title', e.target.value)}
                                                        className="px-3 py-2 bg-gray-50 rounded-lg text-sm outline-none focus:ring-2 ring-blue-100 transition-all border border-transparent focus:border-blue-200"
                                                    />
                                                    <input
                                                        placeholder="핵심 키워드"
                                                        value={item.keyword}
                                                        onChange={(e) => updateBatchItem(item.id, 'keyword', e.target.value)}
                                                        className="px-3 py-2 bg-gray-50 rounded-lg text-sm outline-none focus:ring-2 ring-blue-100 transition-all border border-transparent focus:border-blue-200"
                                                    />
                                                </div>
                                                <div className="w-20 flex justify-end flex-none">
                                                    {item.status === 'loading' && <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />}
                                                    {item.status === 'success' && <Check className="text-green-500 w-5 h-5" />}
                                                    {item.status === 'error' && <span className="text-xs text-red-500 font-bold">Error</span>}
                                                    {item.status === 'idle' && (
                                                        <button onClick={() => removeBatchItem(item.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash className="w-4 h-4" /></button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}

                                        {batchItems.length < 10 && (
                                            <button
                                                onClick={addBatchItem}
                                                className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 hover:bg-gray-50 hover:border-gray-300 font-medium transition-all flex items-center justify-center gap-2 text-sm"
                                            >
                                                <Plus className="w-4 h-4" /> 항목 추가하기
                                            </button>
                                        )}
                                    </div>

                                    <div className="flex gap-4 pt-4 border-t border-gray-100 bg-white sticky bottom-0 z-10 shadow-sm py-4">
                                        <button
                                            onClick={handleBatchGenerate}
                                            disabled={batchProcessing || !batchProfileId}
                                            className={`flex-1 py-4 rounded-xl text-white font-bold text-lg shadow-lg flex items-center justify-center gap-2 transition-all
                                                ${batchProcessing || !batchProfileId ? 'bg-gray-300 cursor-not-allowed shadow-none' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'}`}
                                        >
                                            {batchProcessing ? '작업 진행 중...' : '일괄 생성 시작'}
                                        </button>

                                        {batchItems.some(i => i.status === 'success') && (
                                            <button
                                                onClick={handleDownloadAll}
                                                className={`px-6 py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-lg flex items-center gap-2 transition-all`}
                                            >
                                                <Download className="w-5 h-5" />
                                                전체 다운로드
                                            </button>
                                        )}
                                    </div>

                                    {/* Manual Download Links (Fallback) */}
                                    {batchItems.some(i => i.status === 'success') && (
                                        <div className="bg-gray-100 p-4 rounded-xl mt-4">
                                            <p className="text-xs font-bold text-gray-500 mb-2">⚠️ 다운로드 오류 시 아래 '보기' 버튼을 눌러 복사하세요.</p>
                                            <div className="flex flex-wrap gap-2">
                                                {batchItems.map((item, idx) => {
                                                    if (item.status !== 'success' || !item.result) return null;
                                                    const safeTitle = item.title.replace(/[\/\\?%*:|"<>]/g, '_').trim();
                                                    const fileName = `${idx + 1}_${safeTitle || 'untitled'}.txt`;

                                                    // Use Data URI for manual links too - consistent with auto download
                                                    // Force download with octet-stream
                                                    const dataUri = 'data:application/octet-stream;charset=utf-8,' + encodeURIComponent(item.result);

                                                    return (
                                                        <div key={item.id} className="flex items-center gap-1 bg-white border border-gray-300 rounded-lg p-1">
                                                            <button
                                                                onClick={() => handleViewResult(item.title, item.result || "")}
                                                                className="text-xs px-2 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-bold flex items-center gap-1 rounded border border-indigo-100"
                                                                title="내용 바로보기"
                                                            >
                                                                <Eye className="w-3 h-3" />
                                                                {idx + 1}번 보기
                                                            </button>
                                                            <div className="w-px h-3 bg-gray-300 mx-1"></div>
                                                            <a
                                                                href={dataUri}
                                                                download={fileName}
                                                                className="text-xs px-2 py-1 hover:bg-blue-50 text-gray-500 flex items-center gap-1 rounded"
                                                                target="_blank"
                                                                title="파일 다운로드"
                                                            >
                                                                <Download className="w-3 h-3" />
                                                            </a>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                        </div>
                    </main>

                    {/* --- RIGHT PANEL: Sidebar / Profiles (30%) --- */}
                    <aside className="lg:w-[400px] flex-none bg-gray-50 border-l border-gray-200 flex flex-col h-full overflow-hidden">

                        {/* API Settings Area */}
                        <div className="p-6 pb-2 flex-none">
                            <ApiKeySettings apiKey={apiKey} saveApiKey={saveApiKey} showApiKey={showApiKey} setShowApiKey={setShowApiKey} />
                        </div>

                        {/* Profile Manager */}
                        <div className="flex-1 flex flex-col overflow-hidden px-6 pb-6">
                            <div className="flex items-center justify-between mb-4 flex-none">
                                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                    <Users className="w-5 h-5 text-gray-700" /> 프로필 관리
                                </h2>
                                <span className="text-xs font-medium text-gray-400 bg-white px-2 py-1 rounded-full border border-gray-200">
                                    {profiles.length} / 100
                                </span>
                            </div>

                            {/* Create Form */}
                            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-3 mb-6 flex-none">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">새 프로필 만들기</label>
                                    <div className="flex gap-2">
                                        <input
                                            value={newProfileName}
                                            onChange={(e) => setNewProfileName(e.target.value)}
                                            className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-gray-400 outline-none"
                                            placeholder="이름 (예: 맛집고수)"
                                        />
                                        <select
                                            value={newProfileCategory}
                                            onChange={(e) => setNewProfileCategory(e.target.value)}
                                            className="w-24 px-2 py-2 rounded-lg border border-gray-200 text-xs bg-gray-50 outline-none"
                                        >
                                            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <textarea
                                    value={newProfileStyle}
                                    onChange={(e) => setNewProfileStyle(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-gray-400 outline-none h-16 resize-none bg-gray-50 focus:bg-white transition-colors"
                                    placeholder="성향/문체 (예: 친절해요, 전문적...)"
                                />
                                <button
                                    onClick={handleCreateProfile}
                                    className="w-full py-2 bg-gray-800 text-white font-bold rounded-lg hover:bg-black transition-colors text-sm flex items-center justify-center gap-1"
                                >
                                    <Plus className="w-4 h-4" /> 추가하기
                                </button>
                            </div>

                            {/* Profile List */}
                            <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-1">
                                {profiles.map(profile => (
                                    <div key={profile.id} className="p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-400 transition-all group relative shadow-sm">
                                        <div className="flex justify-between items-start mb-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
                                                    {profile.category}
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => handleDeleteProfile(profile.id)}
                                                className="text-gray-300 hover:text-red-500 transition-colors p-1"
                                                title="프로필 삭제"
                                            >
                                                <Trash className="w-3 h-3" />
                                            </button>
                                        </div>
                                        <h3 className="font-bold text-gray-800 mb-1">{profile.name}</h3>
                                        <p className="text-xs text-gray-500 line-clamp-2 bg-gray-50 p-2 rounded leading-relaxed">
                                            {profile.style || "설정된 성향 없음"}
                                        </p>
                                    </div>
                                ))}
                                {profiles.length === 0 && (
                                    <div className="text-center py-10 text-gray-400 text-sm bg-gray-100/50 rounded-xl border border-dashed border-gray-300">
                                        등록된 프로필이 없습니다
                                    </div>
                                )}
                            </div>
                        </div>
                    </aside>
                </div>
            </div>
        </div>
    );
}
