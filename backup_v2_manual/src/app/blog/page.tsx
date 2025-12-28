"use client";

import { useState, useEffect } from 'react';
import { Sparkles, Copy, Check, Settings, Eye, EyeOff, Save, Trash, User, Users, Plus, Download, FileText, Zap, RefreshCw, AlertCircle, Loader2, Link as LinkIcon, X } from 'lucide-react';
import JSZip from 'jszip';

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
    keywords: string[]; // Changed to array
    status: 'idle' | 'loading' | 'success' | 'error';
    result?: string;
    errorMsg?: string;
}

// Fixed Categories
const DEFAULT_CATEGORIES = [
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

// Tag Input Component
const TagInput = ({ keywords, setKeywords, max = 5 }: { keywords: string[], setKeywords: (k: string[]) => void, max?: number }) => {
    const [input, setInput] = useState('');

    const addTag = (e: React.KeyboardEvent | React.FocusEvent) => {
        if ((e.type === 'keydown' && (e as React.KeyboardEvent).key !== 'Enter') && (e.type === 'keydown' && (e as React.KeyboardEvent).key !== ',')) return;

        // Prevent default if it's a keydown event
        if (e.type === 'keydown') e.preventDefault();

        const trimmed = input.trim().replace(/,/g, '');
        if (trimmed && !keywords.includes(trimmed) && keywords.length < max) {
            setKeywords([...keywords, trimmed]);
            setInput('');
        }
    };

    const removeTag = (tag: string) => {
        setKeywords(keywords.filter(k => k !== tag));
    };

    return (
        <div className="w-full p-2 bg-white border border-gray-200 rounded-xl focus-within:border-blue-500 transition-colors flex flex-wrap gap-2 min-h-[50px]">
            {keywords.map(tag => (
                <span key={tag} className="bg-blue-50 text-blue-600 px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 border border-blue-100">
                    {tag}
                    <button onClick={() => removeTag(tag)} className="hover:text-blue-800"><X className="w-3 h-3" /></button>
                </span>
            ))}
            {keywords.length < max && (
                <input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={addTag}
                    onBlur={addTag}
                    className="flex-1 min-w-[100px] outline-none text-sm bg-transparent"
                    placeholder={keywords.length === 0 ? "키워드 입력 (Enter로 추가, 최대 5개)" : ""}
                />
            )}
            <div className="w-full text-[10px] text-right text-gray-400">
                {keywords.length} / {max}
            </div>
        </div>
    );
};

export default function BlogPage() {
    // --- Global State ---
    const [apiKey, setApiKey] = useState('');
    const [activeTab, setActiveTab] = useState<'single' | 'batch'>('single');
    const [profiles, setProfiles] = useState<BlogProfile[]>([]);
    const [showApiKey, setShowApiKey] = useState(false);

    // --- Custom Group State ---
    const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
    const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
    const [tempCategories, setTempCategories] = useState<string[]>(DEFAULT_CATEGORIES);

    // --- Single Gen State ---
    const [singleTitle, setSingleTitle] = useState('');
    const [singleKeywords, setSingleKeywords] = useState<string[]>([]);
    const [singleRefUrl, setSingleRefUrl] = useState(''); // New: Reference URL
    const [singleProfileId, setSingleProfileId] = useState('');
    const [singleContent, setSingleContent] = useState('');
    const [singleStats, setSingleStats] = useState<{ charCount: number, keywordCounts: Record<string, number> } | null>(null); // New: Stats
    const [singleLoading, setSingleLoading] = useState(false);
    const [singleError, setSingleError] = useState('');

    // --- Batch Gen State ---
    const [batchItems, setBatchItems] = useState<BatchItem[]>([{ id: '1', title: '', keywords: [], status: 'idle' }]);
    const [batchProfileId, setBatchProfileId] = useState('');
    const [batchProcessing, setBatchProcessing] = useState(false);

    // Auto-fill state
    const [autoTitle, setAutoTitle] = useState('');
    const [autoKeyword, setAutoKeyword] = useState(''); // Simple input for batch auto-fill separate by comma
    const [batchRefUrl, setBatchRefUrl] = useState(''); // New: Batch Reference URL

    // --- Profile Manager State ---
    const [newProfileName, setNewProfileName] = useState('');
    const [newProfileCategory, setNewProfileCategory] = useState(DEFAULT_CATEGORIES[0]);
    const [newProfileStyle, setNewProfileStyle] = useState('');

    // --- Init ---
    useEffect(() => {
        const savedKey = localStorage.getItem('gemini_api_key');
        if (savedKey) setApiKey(savedKey);

        const savedProfiles = localStorage.getItem('blog_profiles');
        if (savedProfiles) {
            setProfiles(JSON.parse(savedProfiles));
        }

        const savedGroups = localStorage.getItem('blog_custom_groups');
        if (savedGroups) {
            const parsed = JSON.parse(savedGroups);
            setCategories(parsed);
            setNewProfileCategory(parsed[0]);
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

    const generateBlog = async (title: string, keywords: string[], profileId: string, refUrl?: string) => {
        const profile = profiles.find(p => p.id === profileId);
        const style = profile ? profile.style : '';
        const category = profile ? profile.category : '기타';

        const res = await fetch('/api/blog', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiKey, title, keywords, style, category, refUrl }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '오류 발생');
        return data;
    };

    const handleSingleGenerate = async () => {
        if (!apiKey) return setSingleError('API Key가 필요합니다.');
        if (!singleTitle || singleKeywords.length === 0 || !singleProfileId) return setSingleError('필수 항목을 모두 입력해주세요.');

        setSingleLoading(true);
        setSingleError('');
        setSingleContent('');
        setSingleStats(null);

        try {
            const data = await generateBlog(singleTitle, singleKeywords, singleProfileId, singleRefUrl);
            setSingleContent(data.content);
            setSingleStats({ charCount: data.charCount, keywordCounts: data.keywordCounts });
        } catch (e: any) {
            setSingleError(e.message);
        } finally {
            setSingleLoading(false);
        }
    };

    // --- Batch Handlers ---
    const addBatchItem = () => {
        if (batchItems.length >= 10) return alert("최대 10개까지 동시에 작업 가능합니다.");
        setBatchItems([...batchItems, { id: Date.now().toString(), title: '', keywords: [], status: 'idle' }]);
    };

    const handleAutoFill = () => {
        if (!autoTitle || !autoKeyword) return alert("공통 주제와 키워드를 입력해주세요.");

        const keywords = autoKeyword.split(',').map(k => k.trim()).filter(Boolean).slice(0, 5); // Simple parsing

        const newItems: BatchItem[] = Array.from({ length: 10 }, (_, i) => ({
            id: Date.now().toString() + i,
            title: `${autoTitle} - ${i + 1}편`,
            keywords: keywords,
            status: 'idle'
        }));

        setBatchItems(newItems);
    };

    const updateBatchItemTitle = (id: string, value: string) => {
        setBatchItems(batchItems.map(item => item.id === id ? { ...item, title: value } : item));
    };

    // For Batch, we use a simpler comma-separated input for now to save space, or we could repurpose TagInput
    const updateBatchItemKeywords = (id: string, value: string) => {
        const keywords = value.split(',').map(k => k.trim()).slice(0, 5); // Limit 5
        setBatchItems(batchItems.map(item => item.id === id ? { ...item, keywords } : item));
    };


    const removeBatchItem = (id: string) => {
        setBatchItems(batchItems.filter(item => item.id !== id));
    };

    const handleBatchGenerate = async () => {
        if (!apiKey) return alert("API Key가 필요합니다.");
        if (!batchProfileId) return alert("프로필을 선택해주세요.");

        setBatchProcessing(true);

        for (let i = 0; i < batchItems.length; i++) {
            const item = batchItems[i];

            if (!item.title || item.keywords.length === 0) continue;
            if (item.status === 'success') continue;

            setBatchItems(prev => prev.map(it => it.id === item.id ? { ...it, status: 'loading', errorMsg: undefined } : it));

            try {
                const data = await generateBlog(item.title, item.keywords, batchProfileId, batchRefUrl);
                setBatchItems(prev => prev.map(it => it.id === item.id ? { ...it, status: 'success', result: data.content } : it));
            } catch (e: any) {
                setBatchItems(prev => prev.map(it => it.id === item.id ? { ...it, status: 'error', errorMsg: e.message } : it));
            }

            if (i < batchItems.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        setBatchProcessing(false);
    };

    const handleDownloadAll = async () => {
        const successfulItems = batchItems.filter(item => item.status === 'success' && item.result);

        if (successfulItems.length === 0) {
            alert("다운로드할 완료된 작업이 없습니다.");
            return;
        }

        if (!confirm(`${successfulItems.length}개의 파일을 ZIP으로 압축하여 다운로드합니다.`)) return;

        const zip = new JSZip();

        successfulItems.forEach((item, index) => {
            const safeTitle = item.title.replace(/[\/\\?%*:|"<>]/g, '_').trim();
            const fileName = `${index + 1}_${safeTitle || 'untitled'}.txt`;
            zip.file(fileName, item.result || "");
        });

        try {
            const content = await zip.generateAsync({ type: "blob" });
            const url = window.URL.createObjectURL(content);
            const a = document.createElement("a");
            a.href = url;
            a.download = `블로그_일괄생성_${new Date().toISOString().slice(0, 10)}.zip`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (err) {
            console.error(err);
            alert("압축 파일 생성 중 오류가 발생했습니다.");
        }
    };

    const handleOpenGroupModal = () => {
        setTempCategories([...categories]);
        setIsGroupModalOpen(true);
    };

    const handleGroupChange = (index: number, val: string) => {
        const newCats = [...tempCategories];
        newCats[index] = val;
        setTempCategories(newCats);
    };

    const handleSaveGroups = () => {
        setCategories(tempCategories);
        localStorage.setItem('blog_custom_groups', JSON.stringify(tempCategories));
        setNewProfileCategory(tempCategories[0]);
        setIsGroupModalOpen(false);
    };

    // --- Modal ---
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

            {/* Group Settings Modal */}
            {isGroupModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-scale-up">
                        <div className="p-5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                            <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                                <Settings className="w-5 h-5 text-gray-600" /> 그룹(카테고리) 설정
                            </h3>
                            <button onClick={() => setIsGroupModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                                닫기
                            </button>
                        </div>
                        <div className="p-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                            <p className="text-xs text-gray-500 mb-4 bg-blue-50 p-3 rounded-lg leading-relaxed">
                                * 10개의 고정 그룹 이름을 변경할 수 있습니다.
                            </p>
                            <div className="space-y-3">
                                {tempCategories.map((cat, idx) => (
                                    <div key={idx} className="flex items-center gap-3">
                                        <span className="text-xs font-bold text-gray-400 w-6">{idx + 1}.</span>
                                        <input
                                            value={cat}
                                            onChange={(e) => handleGroupChange(idx, e.target.value)}
                                            className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:bg-white focus:border-blue-500 outline-none transition-colors"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="p-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-2">
                            <button onClick={() => setIsGroupModalOpen(false)} className="px-4 py-2 text-sm font-bold text-gray-500 hover:bg-gray-200 rounded-lg transition-colors">취소</button>
                            <button onClick={handleSaveGroups} className="px-4 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-md">
                                <Save className="w-4 h-4 inline-block mr-1" /> 저장하기
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Result Viewer Modal */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white w-full max-w-4xl h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scale-up">
                        <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                            <h3 className="font-bold text-lg text-gray-800 line-clamp-1 flex-1 mr-4">{modalTitle}</h3>
                            <div className="flex gap-2">
                                <button onClick={() => navigator.clipboard.writeText(modalContent)} className="px-3 py-1.5 bg-blue-100 text-blue-700 font-bold rounded-lg text-sm flex items-center gap-1"><Copy className="w-4 h-4" /> 복사</button>
                                <button onClick={() => setModalOpen(false)} className="px-3 py-1.5 bg-gray-200 text-gray-600 font-bold rounded-lg text-sm">닫기</button>
                            </div>
                        </div>
                        <div className="flex-1 p-6 overflow-y-auto whitespace-pre-wrap leading-relaxed text-gray-700 bg-white font-serif">
                            {modalContent}
                        </div>
                    </div>
                </div>
            )}

            <div className="w-full max-w-[1600px] bg-white rounded-3xl shadow-xl overflow-hidden flex flex-col h-[90vh]">

                <header className="p-6 border-b border-gray-100 bg-white flex-none">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
                            <Sparkles className="text-white w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-gray-900">AI 블로그 마스터 (Pro)</h1>
                            <p className="text-gray-500 text-xs">다중 키워드 & 스타일 카피 엔진</p>
                        </div>
                        <div className="ml-auto flex gap-2">
                            <div className="flex flex-col items-end text-xs text-gray-400">
                                <span>v2.0 Update</span>
                            </div>
                        </div>
                    </div>
                </header>

                <div className="flex flex-1 flex-col lg:flex-row overflow-hidden">

                    {/* MAIN */}
                    <main className="flex-1 flex flex-col border-r border-gray-100 overflow-hidden">
                        <div className="flex border-b border-gray-100 bg-gray-50/30 flex-none sticky top-0 z-10">
                            <button onClick={() => setActiveTab('single')} className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-colors ${activeTab === 'single' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                                <FileText className="w-4 h-4" /> 단일 생성
                            </button>
                            <button onClick={() => setActiveTab('batch')} className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 border-b-2 transition-colors ${activeTab === 'batch' ? 'border-blue-600 text-blue-600 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                                <Zap className="w-4 h-4" /> 일괄 작업
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 lg:p-8 bg-white">

                            {/* SINGLE */}
                            {activeTab === 'single' && (
                                <div className="space-y-6 animate-fade-in h-full flex flex-col">
                                    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 h-full">
                                        <div className="xl:col-span-4 space-y-4 flex-none">

                                            {/* Profile Select */}
                                            <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100">
                                                <label className="block text-xs font-bold text-gray-500 mb-2">작성 프로필 (필수)</label>
                                                <select
                                                    value={singleProfileId}
                                                    onChange={(e) => setSingleProfileId(e.target.value)}
                                                    className="w-full p-3 bg-white border border-gray-200 rounded-xl focus:border-blue-500 outline-none text-sm"
                                                >
                                                    <option value="">프로필을 선택하세요</option>
                                                    {profiles.map(p => <option key={p.id} value={p.id}>[{p.category}] {p.name}</option>)}
                                                </select>
                                                <div className="mt-2 text-[10px] text-gray-400 px-1">
                                                    * 선택한 프로필의 <b>카테고리</b>에 맞춰 글 구조가 최적화됩니다.
                                                </div>
                                            </div>

                                            {/* Blog Info */}
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 mb-1">제목</label>
                                                <input
                                                    value={singleTitle}
                                                    onChange={(e) => setSingleTitle(e.target.value)}
                                                    className="w-full p-3 bg-white border border-gray-200 rounded-xl focus:border-blue-500 outline-none text-sm font-medium"
                                                    placeholder="포스팅 제목 입력"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 mb-1">키워드 (최대 5개)</label>
                                                <TagInput keywords={singleKeywords} setKeywords={setSingleKeywords} max={5} />
                                                <div className="text-[10px] text-gray-400 mt-1 pl-1">
                                                    * 각 키워드는 본문에서 <b>10회 이상</b> 반복 사용됩니다.
                                                </div>
                                            </div>

                                            {/* Reference URL */}
                                            <div className="pt-2 border-t border-gray-100 mt-2">
                                                <label className="block text-xs font-bold text-purple-600 mb-1 flex items-center gap-1">
                                                    <LinkIcon className="w-3 h-3" /> 참고/모방할 블로그 주소 (선택)
                                                </label>
                                                <input
                                                    value={singleRefUrl}
                                                    onChange={(e) => setSingleRefUrl(e.target.value)}
                                                    className="w-full p-3 bg-purple-50 border border-purple-100 rounded-xl focus:border-purple-500 outline-none text-sm"
                                                    placeholder="https://..."
                                                />
                                                <div className="text-[10px] text-gray-400 mt-1 pl-1">
                                                    * 입력 시 해당 글의 <b>문체와 스타일</b>을 분석하여 반영합니다.
                                                </div>
                                            </div>

                                            <button
                                                onClick={handleSingleGenerate}
                                                disabled={singleLoading}
                                                className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl shadow-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 mt-4 text-sm flex justify-center items-center gap-2"
                                            >
                                                {singleLoading ? <Loader2 className="animate-spin w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                                                {singleLoading ? 'AI 분석 및 생성 중...' : '블로그 글 생성하기'}
                                            </button>
                                            {singleError && <p className="text-red-500 text-xs mt-2 text-center break-keep">{singleError}</p>}
                                        </div>

                                        {/* Preview */}
                                        <div className="xl:col-span-8 flex flex-col h-[500px] xl:h-auto">
                                            <div className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl flex flex-col relative overflow-hidden">
                                                <div className="p-3 border-b border-gray-200 bg-white/50 flex items-center justify-between backdrop-blur-sm">
                                                    <span className="text-xs font-bold text-gray-500 px-2 flex items-center gap-2">
                                                        결과 미리보기
                                                        {singleStats && (
                                                            <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-[10px]">
                                                                {singleStats.charCount}자 (공백제외)
                                                            </span>
                                                        )}
                                                    </span>
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
                                                            <span className="text-xs text-gray-400">#1500자 #키워드반복 #맞춤스타일</span>
                                                        </div>
                                                    )}
                                                </div>
                                                {singleStats && (
                                                    <div className="p-2 bg-gray-50 border-t border-gray-200 text-[10px] text-gray-500 flex flex-wrap gap-2">
                                                        {Object.entries(singleStats.keywordCounts).map(([k, c]) => (
                                                            <span key={k} className={`${c >= 10 ? 'text-blue-600 font-bold' : 'text-orange-500'}`}>"{k}": {c}회</span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* BATCH */}
                            {activeTab === 'batch' && (
                                <div className="space-y-6 animate-fade-in pb-10 max-w-3xl mx-auto">
                                    <div className="bg-indigo-50/50 p-6 rounded-2xl border border-indigo-100 mb-4">
                                        <div className="flex items-center justify-between mb-4">
                                            <h2 className="text-lg font-bold text-indigo-900 flex items-center gap-2">
                                                <Zap className="w-5 h-5 text-indigo-600" /> 일괄 작업 설정
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

                                        <div className="flex gap-2 mb-2">
                                            <input
                                                placeholder="공통 주제 (예: 제주도 맛집)"
                                                value={autoTitle}
                                                onChange={(e) => setAutoTitle(e.target.value)}
                                                className="flex-1 px-3 py-2 text-sm border border-indigo-200 rounded-lg focus:outline-none focus:border-indigo-400"
                                            />
                                            <input
                                                placeholder="공통 키워드 (쉼표로 구분, 최대 5개)"
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
                                        {/* Batch Ref URL Input */}
                                        <div className="flex items-center gap-2 mt-2">
                                            <LinkIcon className="w-4 h-4 text-purple-600" />
                                            <input
                                                placeholder="공통 참고/모방 블로그 URL (선택사항 - 입력 시 모든 일괄 작업에 스타일 적용)"
                                                value={batchRefUrl}
                                                onChange={(e) => setBatchRefUrl(e.target.value)}
                                                className="flex-1 px-3 py-2 text-sm border border-purple-200 bg-purple-50/50 rounded-lg focus:outline-none focus:border-purple-400 placeholder-purple-300 text-purple-800"
                                            />
                                        </div>
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
                                                        onChange={(e) => updateBatchItemTitle(item.id, e.target.value)}
                                                        className="px-3 py-2 bg-gray-50 rounded-lg text-sm outline-none w-full"
                                                    />
                                                    <input
                                                        placeholder="키워드 (쉼표로 구분)"
                                                        value={item.keywords.join(', ')}
                                                        onChange={(e) => updateBatchItemKeywords(item.id, e.target.value)}
                                                        className="px-3 py-2 bg-gray-50 rounded-lg text-sm outline-none w-full"
                                                    />
                                                </div>
                                                <div className="w-20 flex justify-end flex-none text-xs">
                                                    {item.status === 'loading' ? <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /> :
                                                        item.status === 'success' ? <Check className="text-green-500 w-5 h-5" /> :
                                                            item.status === 'error' ? <span className="text-red-500" title={item.errorMsg}>오류</span> :
                                                                <button onClick={() => removeBatchItem(item.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash className="w-4 h-4" /></button>
                                                    }
                                                </div>
                                            </div>
                                        ))}

                                        {batchItems.length < 10 && (
                                            <button onClick={addBatchItem} className="w-full py-3 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 hover:bg-gray-50 font-medium text-sm">
                                                <Plus className="w-4 h-4 inline-block mr-2" /> 항목 추가하기
                                            </button>
                                        )}
                                    </div>

                                    <div className="flex gap-4 pt-4 border-t border-gray-100 bg-white sticky bottom-0 z-10 shadow-sm py-4">
                                        <button
                                            onClick={handleBatchGenerate}
                                            disabled={batchProcessing}
                                            className={`flex-1 py-4 rounded-xl text-white font-bold text-lg shadow-lg flex items-center justify-center gap-2 transition-all
                                                ${batchProcessing ? 'bg-gray-300 cursor-not-allowed shadow-none' : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'}`}
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
                                </div>
                            )}

                        </div>
                    </main>

                    {/* SIDEBAR */}
                    <aside className="lg:w-[400px] flex-none bg-gray-50 border-l border-gray-200 flex flex-col h-full overflow-hidden">
                        <div className="p-6 pb-2 flex-none">
                            <ApiKeySettings apiKey={apiKey} saveApiKey={saveApiKey} showApiKey={showApiKey} setShowApiKey={setShowApiKey} />
                        </div>

                        <div className="flex-1 flex flex-col overflow-hidden px-6 pb-6">
                            <div className="flex items-center justify-between mb-4 flex-none">
                                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                    <Users className="w-5 h-5 text-gray-700" /> 프로필 관리
                                </h2>
                                <div className="flex items-center gap-2">
                                    <button onClick={handleOpenGroupModal} className="text-xs font-bold text-gray-500 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded-lg flex items-center gap-1">
                                        <Settings className="w-3 h-3" /> 그룹설정
                                    </button>
                                    <span className="text-xs font-medium text-gray-400">{profiles.length}/100</span>
                                </div>
                            </div>

                            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-3 mb-6 flex-none">
                                <div className="flex gap-2">
                                    <input value={newProfileName} onChange={(e) => setNewProfileName(e.target.value)} className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none" placeholder="이름 (예: 맛집탐험)" />
                                    <select value={newProfileCategory} onChange={(e) => setNewProfileCategory(e.target.value)} className="w-24 px-2 py-2 rounded-lg border border-gray-200 text-xs bg-gray-50 outline-none">
                                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                <textarea value={newProfileStyle} onChange={(e) => setNewProfileStyle(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm h-16 resize-none bg-gray-50 outline-none" placeholder="성향/문체 (예: 이모지 많이 사용, 반말, 전문적...)" />
                                <button onClick={handleCreateProfile} className="w-full py-2 bg-gray-800 text-white font-bold rounded-lg hover:bg-black text-sm flex items-center justify-center gap-1"><Plus className="w-4 h-4" /> 추가하기</button>
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-1">
                                {profiles.map(profile => (
                                    <div key={profile.id} className="p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-400 group relative shadow-sm">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">{profile.category}</span>
                                            <button onClick={() => handleDeleteProfile(profile.id)} className="text-gray-300 hover:text-red-500 p-1"><Trash className="w-3 h-3" /></button>
                                        </div>
                                        <h3 className="font-bold text-gray-800 mb-1">{profile.name}</h3>
                                        <p className="text-xs text-gray-500 line-clamp-2 bg-gray-50 p-2 rounded">{profile.style || "설정된 성향 없음"}</p>
                                    </div>
                                ))}
                                {profiles.length === 0 && <div className="text-center py-10 text-gray-400 text-sm bg-gray-100/50 rounded-xl border-dashed border-gray-300">프로필을 추가해주세요</div>}
                            </div>
                        </div>
                    </aside>
                </div>
            </div>
        </div>
    );
}
