"use client";

import { useState, useEffect } from 'react';

import { Sparkles, Copy, Check, Settings, Eye, EyeOff, Save, Trash, User, Users, Plus, Download, FileText, Zap, RefreshCw, AlertCircle, Loader2, Link as LinkIcon, X, Upload, LogOut } from 'lucide-react';
import JSZip from 'jszip';
import { supabase } from '../lib/supabase';
import Auth from '../components/Auth';

// --- Types ---

interface BlogProfile {
    id: string;
    name: string;
    category: string;
    style: string;
    createdAt: string;
}

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
    keywords: string[];
    status: 'idle' | 'loading' | 'success' | 'error';
    result?: string;
    errorMsg?: string;
    profileId?: string; // Specific profile for this task
    profileName?: string; // Display name
}


const DEFAULT_CATEGORIES = [
    "IT/테크", "일상/브이로그", "맛집/여행", "금융/재테크", "뷰티/패션",
    "건강/운동", "육아/교육", "게임/취미", "리뷰/후기", "기타"
];

const POST_TYPES = [
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
    const [singleRefUrl, setSingleRefUrl] = useState('');
    const [singleProfileId, setSingleProfileId] = useState('');
    const [singlePostType, setSinglePostType] = useState(POST_TYPES[0]); // New: Explicit Post Type Selection
    const [singleContent, setSingleContent] = useState('');
    const [singleStats, setSingleStats] = useState<{ charCount: number, keywordCounts: Record<string, number> } | null>(null);
    const [singleLoading, setSingleLoading] = useState(false);
    const [singleError, setSingleError] = useState('');
    const [selectedGroup, setSelectedGroup] = useState<string>('전체'); // New: Group Filter State
    const [sidebarSelectedGroup, setSidebarSelectedGroup] = useState<string>('전체'); // New: Sidebar Group Filter State

    // --- Batch Gen State ---
    const [batchItems, setBatchItems] = useState<BatchItem[]>([{ id: '1', title: '', keywords: [], status: 'idle' }]);
    const [batchProfileIds, setBatchProfileIds] = useState<string[]>([]);
    const [batchPostType, setBatchPostType] = useState(POST_TYPES[0]); // New: Batch Post Type

    const [batchProcessing, setBatchProcessing] = useState(false);

    // Auto-fill state
    const [autoTitle, setAutoTitle] = useState('');
    const [autoKeyword, setAutoKeyword] = useState(''); // Simple input for batch auto-fill separate by comma
    const [batchRefUrl, setBatchRefUrl] = useState(''); // New: Batch Reference URL

    // --- Profile Manager State ---
    const [newProfileName, setNewProfileName] = useState('');
    const [newProfileCategory, setNewProfileCategory] = useState(DEFAULT_CATEGORIES[0]);
    const [newProfileStyle, setNewProfileStyle] = useState('');

    // --- Auth State ---
    const [user, setUser] = useState<any>(null);
    const [authLoading, setAuthLoading] = useState(true);

    // --- Init & Auth Listener ---
    useEffect(() => {
        // Check active session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            setAuthLoading(false);
            if (session?.user) fetchData(session.user.id);
        });

        // Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
            if (session?.user) {
                fetchData(session.user.id);
            } else {
                // Clear data on logout
                setProfiles([]);
                setApiKey('');
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const fetchData = async (userId: string) => {
        // 1. Fetch Settings (API Key & Categories)
        const { data: settings } = await supabase
            .from('user_settings')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (settings) {
            if (settings.gemini_api_key) setApiKey(settings.gemini_api_key);
            if (settings.custom_groups && Array.isArray(settings.custom_groups)) {
                setCategories(settings.custom_groups as string[]);
                setNewProfileCategory((settings.custom_groups as string[])[0]);
            }
        }

        // 2. Fetch Profiles
        const { data: profileArgs } = await supabase
            .from('blog_profiles')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: true });

        if (profileArgs) {
            // Map DB fields to State fields if necessary, currently they match
            setProfiles(profileArgs.map((p: any) => ({
                ...p,
                createdAt: p.created_at // map snake_case to camelCase if needed, but we used createdAt in interface
            })));
        }
    };

    // Legacy LocalStorage Init removed to enforce Cloud Sync (or we can keep as fallback?)
    // For this V1 migration, we assume full switch. But wait, if user provided key late?
    // Let's keep data in memory.



    // Sync new profile category with sidebar selection
    useEffect(() => {
        if (sidebarSelectedGroup !== '전체') {
            setNewProfileCategory(sidebarSelectedGroup);
        }
    }, [sidebarSelectedGroup]);

    // --- Handlers ---

    const saveApiKey = async (key: string) => {
        setApiKey(key);
        if (user) {
            await supabase.from('user_settings').upsert({
                user_id: user.id,
                gemini_api_key: key
            });
        }
    };

    const handleCreateProfile = async () => {
        if (!newProfileName.trim()) return alert("프로필 이름을 입력하세요.");
        if (profiles.length >= 100) return alert("프로필은 최대 100개까지만 생성 가능합니다.");

        const newItem = {
            id: crypto.randomUUID(), // specific ID generation 
            user_id: user.id,
            name: newProfileName,
            category: newProfileCategory,
            style: newProfileStyle,
            created_at: new Date().toISOString()
        };

        // Optimistic UI Update
        const newProfileUI: BlogProfile = {
            id: newItem.id,
            name: newItem.name,
            category: newItem.category,
            style: newItem.style,
            createdAt: newItem.created_at
        };

        setProfiles([...profiles, newProfileUI]);
        setNewProfileName('');
        setNewProfileStyle('');

        // DB Insert
        const { error } = await supabase.from('blog_profiles').insert(newItem);
        if (error) {
            console.error(error);
            alert("저장 중 오류가 발생했습니다.");
            // Rollback? For now simple alert.
        }
    };

    const handleDeleteProfile = async (id: string) => {
        if (!confirm("정말 삭제하시겠습니까?")) return;

        // Optimistic UI
        const updated = profiles.filter(p => p.id !== id);
        setProfiles(updated);

        if (singleProfileId === id) setSingleProfileId('');
        setBatchProfileIds(prev => prev.filter(pid => pid !== id));

        // DB Delete
        await supabase.from('blog_profiles').delete().eq('id', id);
    };

    const handleClearProfiles = async () => {
        if (!confirm("⚠️ 주의: 모든 프로필이 삭제됩니다.\n\n새로운 그룹 설정과 충돌 방지를 위해 초기화하시겠습니까? (복구 불가)")) return;
        setProfiles([]);

        setSingleProfileId('');
        setBatchProfileIds([]);

        await supabase.from('blog_profiles').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all matches RLS
        alert("모든 프로필이 서버에서 삭제되었습니다.");
    };
    setBatchProfileIds([]);
    alert("모든 프로필이 초기화되었습니다. 새로운 그룹에 맞춰 프로필을 다시 생성해주세요.");
};

const generateBlog = async (title: string, keywords: string[], profileId: string, category: string, refUrl?: string) => {
    const profile = profiles.find(p => p.id === profileId);
    const style = profile ? profile.style : '';
    // Category is now passed explicitly as an argument, not from profile

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
        const data = await generateBlog(singleTitle, singleKeywords, singleProfileId, singlePostType, singleRefUrl);
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

// Toggle profile selection
const toggleBatchProfile = (id: string) => {
    setBatchProfileIds(prev => {
        if (prev.includes(id)) {
            return prev.filter(pid => pid !== id);
        } else {
            if (prev.length >= 10) {
                alert("최대 10개까지만 선택 가능합니다.");
                return prev;
            }
            return [...prev, id];
        }
    });
};

const handleBatchGenerate = async () => {
    if (!apiKey) return alert("API Key가 필요합니다.");
    if (batchProfileIds.length === 0) return alert("프로필을 최소 1개 이상 선택해주세요.");

    // Filter valid template items
    const validTemplates = batchItems.filter(item => item.title && item.keywords.length > 0);

    if (validTemplates.length === 0) return alert("작업할 주제를 입력해주세요.");

    if (!confirm(`선택된 ${batchProfileIds.length}개의 프로필로 총 ${validTemplates.length * batchProfileIds.length}개의 글을 생성하시겠습니까?`)) return;

    setBatchProcessing(true);

    // Expand tasks: Templates x Profiles
    const expandedItems: BatchItem[] = [];

    // We use the current timestamp to generate unique IDs, but ensuring uniqueness across loop
    let idCounter = Date.now();

    batchProfileIds.forEach(pid => {
        const profile = profiles.find(p => p.id === pid);
        const pName = profile ? profile.name : 'Unknown';

        validTemplates.forEach(template => {
            expandedItems.push({
                id: (idCounter++).toString(),
                title: template.title, // Keep original title
                keywords: [...template.keywords],
                status: 'idle',
                profileId: pid,
                profileName: pName
            });
        });
    });

    // Update state with expanded list
    setBatchItems(expandedItems);

    // Process loop
    for (let i = 0; i < expandedItems.length; i++) {
        const item = expandedItems[i];

        // Skip already processed (though here all are new)
        if (item.status === 'success') continue;

        // Update status to loading
        setBatchItems(prev => prev.map(it => it.id === item.id ? { ...it, status: 'loading', errorMsg: undefined } : it));

        try {
            // Use the specific profile for this item, but common batchPostType
            const data = await generateBlog(item.title, item.keywords, item.profileId!, batchPostType, batchRefUrl);
            setBatchItems(prev => prev.map(it => it.id === item.id ? { ...it, status: 'success', result: data.content } : it));
        } catch (e: any) {
            setBatchItems(prev => prev.map(it => it.id === item.id ? { ...it, status: 'error', errorMsg: e.message } : it));
        }

        // Delay between requests
        if (i < expandedItems.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    setBatchProcessing(false);
};

const handleDownloadAll = async (format: 'txt' | 'md') => {
    const successfulItems = batchItems.filter(item => item.status === 'success' && item.result);

    if (successfulItems.length === 0) {
        alert("다운로드할 완료된 작업이 없습니다.");
        return;
    }

    const zip = new JSZip();

    successfulItems.forEach((item, index) => {
        const safeTitle = item.title.replace(/[\/\\?%*:|"<>]/g, '_').trim();
        const safeProfile = item.profileName?.replace(/[\/\\?%*:|"<>]/g, '_').trim() || 'NoProfile';

        // File naming: 1_[Profile]_Title
        const fileName = `${index + 1}_[${safeProfile}]_${safeTitle || 'untitled'}.${format}`;

        let content = item.result || "";
        // For TXT, maybe strip markdown? For now, we just save raw content as requested, mostly likely markdown text.

        zip.file(fileName, content);
    });

    try {
        const content = await zip.generateAsync({ type: "blob" });
        const url = window.URL.createObjectURL(content);
        const a = document.createElement("a");
        a.href = url;
        a.download = `블로그_일괄생성_${new Date().toISOString().slice(0, 10)}_${format.toUpperCase()}.zip`;
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

const handleSaveGroups = async () => {
    setCategories(tempCategories);
    setNewProfileCategory(tempCategories[0]);
    setIsGroupModalOpen(false);

    if (user) {
        // Update custom groups in DB
        // We need to fetch existing settings first to keep api key or upsert carefully
        // Actually upsert handles it if we provide all fields? 
        // Better to upsert just this field? Supabase upsert requires primary key.
        // Let's assume we want to preserve api key.
        const { error } = await supabase.from('user_settings').upsert({
            user_id: user.id,
            custom_groups: tempCategories
        }, { onConflict: 'user_id' }); // This might overwrite api_key to null if not ignored? 
        // Correct way for partial update: update()
        // But if row doesn't exist? 
        // Let's use upsert with ignoreDuplicates? No. 
        // We should use update if exists, insert if not. 
        // Or easier: select first.

        // Simplified: Just update custom_groups. If it fails (no row), insert.
        const { error: updateErr } = await supabase.from('user_settings').update({ custom_groups: tempCategories }).eq('user_id', user.id);
        if (updateErr || true) { // Force upsert logic safely? 
            // Actually upsert merges? No, it replaces unless specified.
            // Let's keep it simple: read then write for safety or trust update.
            // Given the complexity, let's just trigger a 'user_settings' upsert with current apiKey state.
            await supabase.from('user_settings').upsert({
                user_id: user.id,
                gemini_api_key: apiKey, // preserve local state
                custom_groups: tempCategories
            });
        }
    }
};

// --- Backup & Restore ---
const handleExportData = () => {
    const data = {
        profiles,
        categories,
        apiKey,
        version: '2.0',
        exportedAt: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BlogMaster_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

const handleImportData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            const json = JSON.parse(event.target?.result as string);

            if (confirm("현재 데이터를 덮어쓰고 백업 파일의 내용을 복원(클라우드 저장)하시겠습니까?")) {

                // 1. Restore UI State first
                if (json.profiles) setProfiles(json.profiles);
                if (json.categories) setCategories(json.categories);
                if (json.apiKey) setApiKey(json.apiKey);

                // 2. Save to Supabase (Migration)
                if (user) {
                    try {
                        // Save Settings
                        await supabase.from('user_settings').upsert({
                            user_id: user.id,
                            gemini_api_key: json.apiKey || apiKey,
                            custom_groups: json.categories || categories
                        });

                        // Save Profiles (Bulk Insert)
                        // Note: we might want to clear old profiles or just add new ones. 
                        // For "Restore", let's clear and re-insert to match the file exactly? 
                        // Or safer: just upsert using ID.
                        if (json.profiles && Array.isArray(json.profiles)) {
                            const profileRows = json.profiles.map((p: any) => ({
                                id: p.id || crypto.randomUUID(),
                                user_id: user.id,
                                name: p.name,
                                category: p.category,
                                style: p.style,
                                created_at: p.createdAt || new Date().toISOString()
                            }));

                            // Delete existing to avoid duplicates if ID matches, or just insert
                            // Let's use upsert if ID exists.
                            const { error } = await supabase.from('blog_profiles').upsert(profileRows);
                            if (error) throw error;
                        }

                        alert("데이터가 클라우드에 성공적으로 저장되었습니다!");
                    } catch (dbErr) {
                        console.error(dbErr);
                        alert("데이터 UI는 복구되었으나, 클라우드 저장 중 일부 오류가 발생했습니다.");
                    }
                } else {
                    alert("로그인 상태가 아닙니다. 데이터는 화면에만 표시되며 저장되지 않습니다.");
                }
            }
        } catch (err) {
            alert("파일을 읽는 중 오류가 발생했습니다. 올바른 백업 파일인지 확인해주세요.");
            console.error(err);
        }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = '';
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

// --- Legacy Backup Handler (for Migration) ---
const handleLegacyBackup = () => {
    const savedProfiles = localStorage.getItem('blog_profiles');
    const savedCategories = localStorage.getItem('blog_custom_groups');
    const savedKey = localStorage.getItem('gemini_api_key');

    if (!savedProfiles && !savedCategories) {
        alert("브라우저에 저장된 기존 데이터가 없습니다.");
        return;
    }

    const backupData = {
        profiles: savedProfiles ? JSON.parse(savedProfiles) : [],
        categories: savedCategories ? JSON.parse(savedCategories) : [],
        apiKey: savedKey || ''
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `blog_backup_legacy_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
};

if (authLoading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin w-8 h-8 text-blue-500" /></div>;

if (!user) {
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            <div className="mb-8 text-center animate-fade-in">
                <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-200 mx-auto mb-4">
                    <Sparkles className="text-white w-8 h-8" />
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">AI 블로그 마스터 (Pro)</h1>
                <p className="text-gray-500">어디서든 연결되는 나만의 창작 스튜디오</p>
            </div>
            <Auth onLogin={() => { }} />

            <div className="mt-8 pt-6 border-t border-gray-100 flex flex-col items-center">
                <button
                    onClick={handleLegacyBackup}
                    className="text-xs text-gray-400 hover:text-gray-600 underline flex items-center justify-center gap-1 mx-auto transition-colors"
                >
                    <Download className="w-3 h-3" /> 기존(로컬) 데이터 백업받기
                </button>
                <p className="text-[10px] text-gray-300 mt-2">로그인 화면이 떠서 기존 데이터를 못 찾으시는 경우 클릭하세요.</p>
            </div>
        </div>
    );
}

return (
    <div className="min-h-screen bg-gray-50 flex justify-center p-4 lg:p-8 font-sans text-gray-800 relative text-lg">

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
                            <div className="flex flex-col items-end text-xs text-gray-400 gap-1">
                                <span>v2.1 (Backup)</span>
                                <div className="flex gap-2">
                                    <button onClick={handleExportData} className="flex items-center gap-1 hover:text-blue-600 font-bold transition-colors" title="설정 백업(저장)">
                                        <Download className="w-3 h-3" /> 백업
                                    </button>
                                    <label className="flex items-center gap-1 hover:text-green-600 font-bold transition-colors cursor-pointer" title="설정 복원(불러오기)">
                                        <Upload className="w-3 h-3" /> 복원
                                        <input type="file" accept=".json" onChange={handleImportData} className="hidden" />
                                    </label>
                                </div>
                            </div>
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
                                        <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100 space-y-4">
                                            <div>
                                                <label className="block text-sm font-bold text-gray-600 mb-2">0. 그룹 선택 (필터)</label>
                                                <select
                                                    value={selectedGroup}
                                                    onChange={(e) => setSelectedGroup(e.target.value)}
                                                    className="w-full p-3 mb-4 bg-white border border-blue-200 rounded-xl focus:border-blue-500 outline-none text-sm text-gray-700 font-medium"
                                                >
                                                    <option value="전체">전체 보기</option>
                                                    {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                                </select>

                                                <label className="block text-xs font-bold text-gray-500 mb-2">1. 작성 프로필 (페르소나)</label>
                                                <select
                                                    value={singleProfileId}
                                                    onChange={(e) => setSingleProfileId(e.target.value)}
                                                    className="w-full p-3 bg-white border border-gray-200 rounded-xl focus:border-blue-500 outline-none text-sm"
                                                >
                                                    <option value="">프로필을 선택하세요</option>
                                                    {profiles
                                                        .filter(p => selectedGroup === '전체' || p.category === selectedGroup)
                                                        .map(p => <option key={p.id} value={p.id}>{p.name} ({p.category})</option>)}
                                                </select>
                                            </div>

                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 mb-2">2. 포스팅 유형 (글 구조)</label>
                                                <select
                                                    value={singlePostType}
                                                    onChange={(e) => setSinglePostType(e.target.value)}
                                                    className="w-full p-3 bg-white border border-gray-200 rounded-xl focus:border-blue-500 outline-none text-sm"
                                                >
                                                    {POST_TYPES.map(cat => <option key={cat} value={cat}>{cat}</option>)}

                                                </select>
                                                <div className="mt-2 text-[10px] text-gray-400 px-1">
                                                    * 선택한 <b>포스팅 유형</b>에 맞춰 글의 구조와 흐름이 결정됩니다.
                                                </div>
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
                                    <div className="mb-4">
                                        <h2 className="text-lg font-bold text-indigo-900 flex items-center gap-2 mb-3">
                                            <Zap className="w-5 h-5 text-indigo-600" /> 일괄 작업 설정
                                        </h2>

                                        {/* Profile Buttons Grid */}
                                        <div className="bg-white/60 rounded-xl p-3 border border-indigo-100 shadow-sm">
                                            <div className="flex justify-between items-center mb-2 px-1">
                                                <span className="text-xs font-bold text-gray-500 flex items-center gap-1">
                                                    <Users className="w-3 h-3" /> 작업할 프로필 선택 <span className="text-indigo-400 font-normal">(최대 10개)</span>
                                                </span>
                                                <span className={`text-xs font-bold ${batchProfileIds.length > 0 ? 'text-indigo-600' : 'text-gray-400'}`}>
                                                    {batchProfileIds.length}개 선택됨
                                                </span>
                                            </div>

                                            {/* Batch Group Filter */}
                                            <div className="mb-4">
                                                <label className="block text-sm font-bold text-gray-600 mb-2">그룹 필터</label>
                                                <select
                                                    value={selectedGroup}
                                                    onChange={(e) => setSelectedGroup(e.target.value)}
                                                    className="w-full p-3 bg-white border border-indigo-200 rounded-xl focus:border-indigo-500 outline-none text-sm text-gray-700 font-medium"
                                                >
                                                    <option value="전체">전체 그룹 보기</option>
                                                    {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                                </select>
                                            </div>

                                            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto custom-scrollbar p-1">
                                                {profiles
                                                    .filter(p => selectedGroup === '전체' || p.category === selectedGroup)
                                                    .map(p => (
                                                        <button
                                                            key={p.id}
                                                            onClick={() => toggleBatchProfile(p.id)}
                                                            className={`
                                                                px-3 py-2 rounded-xl border text-left text-xs transition-all flex items-center gap-2 flex-none
                                                                ${batchProfileIds.includes(p.id)
                                                                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-bold ring-1 ring-indigo-500 shadow-md transform scale-105'
                                                                    : 'border-gray-200 bg-white text-gray-600 hover:border-indigo-300 hover:bg-indigo-50/50 hover:shadow-sm'}
                                                            `}
                                                        >
                                                            <span className={`w-2 h-2 rounded-full flex-none ${batchProfileIds.includes(p.id) ? 'bg-indigo-600' : 'bg-gray-300'}`} />
                                                            <span className="truncate max-w-[100px]">{p.name}</span>
                                                            <span className="text-[10px] opacity-70 flex-none hidden sm:inline-block">({p.category})</span>
                                                        </button>
                                                    ))}
                                                {profiles.length === 0 && (
                                                    <div className="w-full text-center py-6 text-gray-400 text-xs border border-dashed border-gray-300 rounded-lg">
                                                        생성된 프로필이 없습니다. 먼저 프로필을 추가해주세요.
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>



                                    {/* Common Batch Settings: Post Type & Reference URL */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-2">공통 포스팅 유형</label>
                                            <div className="relative">
                                                <select
                                                    value={batchPostType}
                                                    onChange={(e) => setBatchPostType(e.target.value)}
                                                    className="w-full p-3 bg-white border border-indigo-200 rounded-xl focus:border-indigo-500 outline-none text-sm appearance-none"
                                                >
                                                    {POST_TYPES.map(cat => <option key={cat} value={cat}>{cat}</option>)}

                                                </select>
                                                <Settings className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-purple-600 mb-2 flex items-center gap-1">
                                                <LinkIcon className="w-3 h-3" /> 참고/모방 URL (선택)
                                            </label>
                                            <input
                                                placeholder="https://..."
                                                value={batchRefUrl}
                                                onChange={(e) => setBatchRefUrl(e.target.value)}
                                                className="w-full px-3 py-3 text-sm border border-purple-200 bg-purple-50/50 rounded-xl focus:outline-none focus:border-purple-400 placeholder-purple-300 text-purple-800"
                                            />
                                        </div>
                                    </div>

                                    <div className="flex gap-2 mb-2 pt-4 border-t border-indigo-100">
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
                                </div>
                                {/* Removed old batchRefUrl input from here as it moved up */}


                                <div className="space-y-3 pr-2">
                                    {batchItems.map((item, idx) => (
                                        <div key={item.id} className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-xl shadow-sm hover:shadow-md transition-shadow group">
                                            <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center font-bold text-gray-500 text-xs flex-none">
                                                {idx + 1}
                                            </div>

                                            {/* Expanded Item Info */}
                                            {item.profileName && (
                                                <div className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-xs font-bold whitespace-nowrap">
                                                    {item.profileName}
                                                </div>
                                            )}

                                            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <input
                                                    placeholder="글 제목"
                                                    value={item.title}
                                                    onChange={(e) => updateBatchItemTitle(item.id, e.target.value)}
                                                    className="px-3 py-2 bg-gray-50 rounded-lg text-sm outline-none w-full"
                                                    readOnly={batchProcessing || item.status !== 'idle'} // Lock during process
                                                />
                                                <input
                                                    placeholder="키워드 (쉼표로 구분)"
                                                    value={item.keywords.join(', ')}
                                                    onChange={(e) => updateBatchItemKeywords(item.id, e.target.value)}
                                                    className="px-3 py-2 bg-gray-50 rounded-lg text-sm outline-none w-full"
                                                    readOnly={batchProcessing || item.status !== 'idle'}
                                                />
                                            </div>
                                            <div className="w-20 flex justify-end flex-none text-xs">
                                                {item.status === 'loading' ? <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /> :
                                                    item.status === 'success' ?
                                                        <div className="flex gap-2">
                                                            <button onClick={() => handleViewResult(item.title, item.result || '')} className="text-blue-500 hover:text-blue-700 font-bold underline">보기</button>
                                                            <Check className="text-green-500 w-5 h-5" />
                                                        </div> :
                                                        item.status === 'error' ? <span className="text-red-500" title={item.errorMsg}>오류</span> :
                                                            <button onClick={() => removeBatchItem(item.id)} className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash className="w-4 h-4" /></button>
                                                }
                                            </div>
                                        </div>
                                    ))}

                                    {batchItems.length < 100 && !batchProcessing && (
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
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleDownloadAll('md')}
                                                className={`px-4 py-4 bg-gray-800 hover:bg-black text-white font-bold rounded-xl shadow-lg flex items-center gap-2 transition-all`}
                                            >
                                                <Download className="w-5 h-5" />
                                                MD
                                            </button>
                                            <button
                                                onClick={() => handleDownloadAll('txt')}
                                                className={`px-4 py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl shadow-lg flex items-center gap-2 transition-all`}
                                            >
                                                <Download className="w-5 h-5" />
                                                TXT
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                    </div>
                </main>

                {/* SIDEBAR */}
                <aside className="lg:w-[400px] flex-none bg-gray-50 border-l border-gray-200 flex flex-col h-full overflow-hidden">
                    <div className="p-6 pb-2 flex-none">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold text-xs uppercase">
                                    {user.email?.slice(0, 2)}
                                </div>
                                <div className="text-xs truncate max-w-[150px]">
                                    <p className="font-bold text-gray-700">{user.email?.split('@')[0]}</p>
                                    <p className="text-gray-400">Connected</p>
                                </div>
                            </div>
                            <button
                                onClick={() => supabase.auth.signOut()}
                                className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition-colors"
                                title="로그아웃"
                            >
                                <LogOut className="w-4 h-4" />
                            </button>
                        </div>
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
                                {profiles.length > 0 && (
                                    <button onClick={handleClearProfiles} className="text-xs font-bold text-red-500 bg-red-50 hover:bg-red-100 px-2 py-1 rounded-lg flex items-center gap-1">
                                        <Trash className="w-3 h-3" /> 초기화
                                    </button>
                                )}
                                <span className="text-xs font-medium text-gray-400">{profiles.length}/100</span>
                            </div>
                        </div>

                        {/* Sidebar Group Filter */}
                        <div className="mb-4">
                            <select
                                value={sidebarSelectedGroup}
                                onChange={(e) => setSidebarSelectedGroup(e.target.value)}
                                className="w-full p-3 bg-white border border-gray-200 rounded-xl focus:border-blue-500 outline-none text-sm text-gray-700 font-medium"
                            >
                                <option value="전체">전체 그룹 보기</option>
                                {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                            </select>
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
                            {profiles
                                .filter(p => sidebarSelectedGroup === '전체' || p.category === sidebarSelectedGroup)
                                .map(profile => (
                                    <div key={profile.id} className="p-4 bg-white border border-gray-200 rounded-xl hover:border-blue-400 group relative shadow-sm">
                                        <div className="flex justify-between items-start mb-1">
                                            <button
                                                onClick={() => setSidebarSelectedGroup(profile.category)}
                                                className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100 hover:bg-blue-100 transition-colors"
                                            >
                                                {profile.category}
                                            </button>
                                            <button
                                                onClick={() => handleDeleteProfile(profile.id)}
                                                className="text-gray-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors"
                                                title="Delete Profile"
                                            >
                                                <Trash className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <h3 className="font-bold text-gray-800 mb-1">{profile.name}</h3>
                                        <p className="text-xs text-gray-500 line-clamp-2 bg-gray-50 p-2 rounded">{profile.style || "설정된 성향 없음"}</p>
                                    </div>
                                ))}
                            {profiles.length === 0 && <div className="text-center py-10 text-gray-400 text-sm bg-gray-100/50 rounded-xl border-dashed border-gray-300">프로필을 추가해주세요</div>}
                        </div>
                    </div>
                </aside>
            </div >
        </div >
    </div >
);
}
