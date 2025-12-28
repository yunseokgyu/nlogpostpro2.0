'use client';

import { useState, useEffect, useRef, useMemo } from 'react';

const RUB_TO_KRW = 14.5; // Approximate exchange rate

// Simple reusable Searchable Select Component
function SearchableSelect({
    label,
    options,
    value,
    onChange,
    placeholder
}: {
    label: string,
    options: { id: string, name: string, stock?: number, minPrice?: number }[],
    value: string,
    onChange: (val: string) => void,
    placeholder?: string
}) {
    const [search, setSearch] = useState('');
    const [isOpen, setIsOpen] = useState(false);

    // Sort: Available > Lowest Price > Name
    // Filter: Match search text
    const filtered = useMemo(() => {
        let list = [...options];
        list.sort((a, b) => {
            const stockA = a.stock || 0;
            const stockB = b.stock || 0;
            const hasStockA = stockA > 0;
            const hasStockB = stockB > 0;

            // 1. Prioritize items with stock
            if (hasStockA !== hasStockB) return hasStockA ? -1 : 1;

            // 2. If both available (or both unavailable), sort by Min Price (Cheap -> Expensive)
            const priceA = a.minPrice ?? Infinity;
            const priceB = b.minPrice ?? Infinity;
            if (priceA !== priceB) return priceA - priceB;

            // 3. Alphabetical
            return a.name.localeCompare(b.name);
        });

        if (!search) return list;
        return list.filter(o =>
            o.name.toLowerCase().includes(search.toLowerCase()) ||
            o.id.toLowerCase().includes(search.toLowerCase())
        );
    }, [options, search]);

    // Find selected name
    const selectedOpt = options.find(o => o.id === value);
    const displayLabel = selectedOpt
        ? `${selectedOpt.name}${selectedOpt.stock !== undefined ? ` (${selectedOpt.stock}개 | ${selectedOpt.minPrice}₽ ≈${Math.round((selectedOpt.minPrice || 0) * RUB_TO_KRW)}원)` : ''}`
        : value;

    return (
        <div className="relative">
            <label className="block text-gray-400 mb-1">{label}</label>
            <div
                className="w-full bg-gray-700 text-white p-2 rounded border border-gray-600 cursor-pointer flex justify-between items-center"
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className="truncate">{displayLabel || placeholder || 'Select...'}</span>
                <span className="text-xs text-gray-400">▼</span>
            </div>

            {isOpen && (
                <div className="absolute z-10 w-full bg-gray-600 border border-gray-500 rounded mt-1 shadow-xl max-h-60 overflow-hidden flex flex-col">
                    <input
                        type="text"
                        autoFocus
                        className="w-full bg-gray-800 text-white p-2 border-b border-gray-500 outline-none"
                        placeholder="Search..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                    <div className="overflow-y-auto flex-1">
                        {filtered.length > 0 ? filtered.map(opt => (
                            <div
                                key={opt.id}
                                className={`p-2 hover:bg-blue-600 cursor-pointer flex justify-between items-center ${opt.id === value ? 'bg-blue-800' : ''}`}
                                onClick={() => {
                                    onChange(opt.id);
                                    setIsOpen(false);
                                    setSearch('');
                                }}
                            >
                                <span>{opt.name}</span>
                                {opt.stock !== undefined && (
                                    <span className={`text-xs ${opt.stock > 0 ? 'text-green-300' : 'text-gray-400'}`}>
                                        {opt.stock > 0 ? `${opt.stock}개` : '품절'}
                                        {opt.minPrice && ` (${opt.minPrice}₽ ≈${Math.round(opt.minPrice * RUB_TO_KRW)}원)`}
                                    </span>
                                )}
                            </div>
                        )) : (
                            <div className="p-2 text-gray-400">No results</div>
                        )}
                    </div>
                </div>
            )}

            {/* Backdrop to close */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-0"
                    onClick={() => setIsOpen(false)}
                />
            )}
        </div>
    );
}

export default function FiveSimPage() {
    // Configuration
    const [countries, setCountries] = useState<{ id: string, name: string, stock?: number, minPrice?: number }[]>([]);
    const [products, setProducts] = useState<{ id: string, name: string }[]>([]);

    const [selectedCountry, setSelectedCountry] = useState('usa');
    const [selectedProduct, setSelectedProduct] = useState('google');
    const [maxPrice, setMaxPrice] = useState(50);

    // Status
    const [isRunning, setIsRunning] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [balance, setBalance] = useState<number | null>(null);
    const [activeOrder, setActiveOrder] = useState<any>(null);
    const [isLoadingStock, setIsLoadingStock] = useState(false);

    // Refs for intervals
    const runLoopRef = useRef<NodeJS.Timeout | null>(null);
    const countriesRef = useRef<{ id: string, name: string }[]>([]); // Store base list

    // Initial Load
    useEffect(() => {
        fetchCountries();
        fetchProducts();
        fetchProfile();
    }, []);

    // Fetch stock when product changes
    useEffect(() => {
        if (selectedProduct && countriesRef.current.length > 0) {
            updateCountryStock(selectedProduct);
        }
    }, [selectedProduct]);

    // Auto-set Max Price when country changes
    useEffect(() => {
        const country = countries.find(c => c.id === selectedCountry);
        if (country && country.minPrice) {
            setMaxPrice(country.minPrice);
        }
    }, [selectedCountry, countries]);

    const addLog = (msg: string) => {
        const time = new Date().toLocaleTimeString();
        setLogs(prev => [`[${time}] ${msg}`, ...prev.slice(0, 49)]);
    };

    const fetchCountries = async () => {
        try {
            const res = await fetch('/api/5sim?action=countries');
            const data = await res.json();
            if (Array.isArray(data)) {
                countriesRef.current = data;
                setCountries(data); // Initial render without stock
                // If product is already selected, fetch stock immediately
                if (selectedProduct) updateCountryStock(selectedProduct);
            }
        } catch (e) { console.error(e); }
    };

    const updateCountryStock = async (product: string) => {
        setIsLoadingStock(true);
        try {
            const res = await fetch(`/api/5sim?action=price&product=${product}`);
            const json = await res.json();

            // API returns { "google": { "usa": { ... } } }
            // So we need to access json[product] first to get the country map
            const productData = json[product];

            if (productData) {
                const newCountries = countriesRef.current.map(c => {
                    const offers = productData[c.id]; // e.g. productData['usa']
                    let totalStock = 0;
                    let minCost = Infinity;

                    if (offers) {
                        // Iterate operators
                        Object.values(offers).forEach((op: any) => {
                            if (op.count > 0) {
                                totalStock += op.count;
                                if (op.cost < minCost) minCost = op.cost;
                            }
                        });
                    }

                    return {
                        ...c,
                        stock: totalStock,
                        minPrice: minCost === Infinity ? undefined : minCost
                    };
                });
                setCountries(newCountries);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoadingStock(false);
        }
    };

    const fetchProducts = async () => {
        try {
            const res = await fetch('/api/5sim?action=products');
            const data = await res.json();
            if (Array.isArray(data)) {
                // Convert simple string array to object array
                setProducts(data.map((p: string) => ({ id: p, name: p })));
            }
        } catch (e) { console.error(e); }
    };

    const fetchProfile = async () => {
        const res = await fetch('/api/5sim?action=profile');
        const data = await res.json();
        if (data.balance !== undefined) setBalance(data.balance);
    };

    const stopBot = () => {
        setIsRunning(false);
        if (runLoopRef.current) clearInterval(runLoopRef.current);
        runLoopRef.current = null;
        addLog('봇이 중지되었습니다.');
    };

    const startBot = () => {
        if (isRunning) return;
        setIsRunning(true);
        addLog(`봇 시작: ${selectedCountry} / ${selectedProduct} / Max ${maxPrice}₽`);

        let isBuying = false;

        // Loop Logic
        runLoopRef.current = setInterval(async () => {
            // If we have an active order, check for SMS
            if (activeOrder) {
                const res = await fetch(`/api/5sim?action=check_order&id=${activeOrder.id}`);
                const data = await res.json();

                if (data.sms && data.sms.length > 0) {
                    addLog(`★ SMS 도착! 코드: ${data.sms[0].code}`);
                    setActiveOrder({ ...data, code: data.sms[0].code, text: data.sms[0].text });
                    // Stop polling order, keep running to let user finish? Or stop bot?
                    // Let's stop the bot so user can see the code.
                    stopBot();
                } else if (data.status === 'CANCELED' || data.status === 'TIMEOUT') {
                    addLog(`주문 취소/만료됨. 상태: ${data.status}`);
                    setActiveOrder(null);
                }
                return;
            }

            // If no active order, try to buy
            if (isBuying) return; // Prevent overlapping requests
            isBuying = true;

            try {
                // Check Price
                addLog(`가격 검색 중... ${selectedCountry}/${selectedProduct}`);
                const priceRes = await fetch(`/api/5sim?action=price&country=${selectedCountry}&product=${selectedProduct}`);
                const priceData = await priceRes.json();

                // Parse Price Data (same logic as bot script)
                // Structure: { country: { product: { operator: ... } } }
                if (priceData && priceData[selectedCountry] && priceData[selectedCountry][selectedProduct]) {
                    const offers = priceData[selectedCountry][selectedProduct];
                    let bestOffer: any = null;

                    for (const op in offers) {
                        const offer = offers[op];
                        if (offer.count > 0 && (!bestOffer || offer.cost < bestOffer.cost)) {
                            bestOffer = { operator: op, ...offer };
                        }
                    }

                    if (bestOffer) {
                        if (bestOffer.cost <= maxPrice) {
                            addLog(`구매 시도! 통신사: ${bestOffer.operator}, 가격: ${bestOffer.cost}₽`);
                            const buyRes = await fetch('/api/5sim', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    action: 'buy_number',
                                    country: selectedCountry,
                                    product: selectedProduct,
                                    operator: bestOffer.operator
                                })
                            });
                            const buyData = await buyRes.json();

                            if (buyData.id) {
                                addLog(`구매 성공! 번호: ${buyData.phone}`);
                                setActiveOrder(buyData);
                            } else {
                                addLog(`구매 실패: ${buyData.message || 'Unknown error'}`);
                            }
                        } else {
                            addLog(`가격이 너무 비쌉니다. (최저: ${bestOffer.cost}₽)`);
                        }
                    } else {
                        addLog('구매 가능한 재고가 없습니다.');
                    }
                } else {
                    addLog('가격 정보를 가져올 수 없습니다.');
                }
            } catch (e) {
                console.error(e);
            } finally {
                isBuying = false;
            }

        }, 5000); // 5 second interval
    };

    const finishOrder = async () => {
        if (!activeOrder) return;
        await fetch('/api/5sim', {
            method: 'POST',
            body: JSON.stringify({ action: 'finish_order', id: activeOrder.id })
        });
        setActiveOrder(null);
        addLog('주문 완료 처리됨.');
    };

    const cancelOrder = async () => {
        if (!activeOrder) return;
        await fetch('/api/5sim', {
            method: 'POST',
            body: JSON.stringify({ action: 'cancel_order', id: activeOrder.id })
        });
        setActiveOrder(null);
        addLog('주문 취소 요청됨.');
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white p-8 font-sans">
            <h1 className="text-3xl font-bold mb-8 text-blue-400">5sim Auto-Buy Bot</h1>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Controls */}
                <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-semibold">설정 (Settings)</h2>
                        <div className="text-green-400 font-mono">
                            잔액: {balance !== null ? balance : '...'}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <SearchableSelect
                            label="상품 (Service/Product)"
                            options={products}
                            value={selectedProduct}
                            onChange={setSelectedProduct}
                            placeholder="서비스 검색..."
                        />

                        <div className="relative">
                            <SearchableSelect
                                label={`국가 (Country) ${isLoadingStock ? '⏳ 재고 확인 중...' : ''}`}
                                options={countries}
                                value={selectedCountry}
                                onChange={setSelectedCountry}
                                placeholder="국가 검색..."
                            />
                        </div>

                        <div>
                            <label className="block text-gray-400 mb-1">
                                구매 상한선 (Max Price Limit)
                                <span className="text-xs text-gray-500 ml-2 block sm:inline">
                                    * {maxPrice}₽ (약 {Math.round(maxPrice * RUB_TO_KRW)}원) 초과 시 구매 안 함
                                </span>
                            </label>
                            <input
                                type="number"
                                className="w-full bg-gray-700 text-white p-2 rounded border border-gray-600"
                                value={maxPrice}
                                onChange={(e) => setMaxPrice(Number(e.target.value))}
                            />
                        </div>

                        <div className="pt-4 flex gap-4">
                            {!isRunning ? (
                                <button
                                    onClick={startBot}
                                    className="flex-1 bg-green-600 hover:bg-green-500 text-white py-3 rounded font-bold transition-colors"
                                >
                                    봇 시작 (Start)
                                </button>
                            ) : (
                                <button
                                    onClick={stopBot}
                                    className="flex-1 bg-red-600 hover:bg-red-500 text-white py-3 rounded font-bold transition-colors"
                                >
                                    봇 중지 (Stop)
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Active Order & Logs */}
                <div className="space-y-8">
                    {/* Active Order Panel */}
                    <div className={`p-6 rounded-lg shadow-lg border ${activeOrder ? 'bg-blue-900 border-blue-500' : 'bg-gray-800 border-gray-700'}`}>
                        <h2 className="text-xl font-semibold mb-4">현재 주문 (Active Order)</h2>

                        {activeOrder ? (
                            <div className="text-center">
                                <div className="text-4xl font-mono font-bold mb-2 text-yellow-300 tracking-wider">
                                    {activeOrder.phone}
                                </div>
                                <div className="text-sm text-gray-300 mb-6">ID: {activeOrder.id}</div>

                                {activeOrder.code ? (
                                    <div className="bg-green-900/50 p-4 rounded mb-4 border border-green-500">
                                        <div className="text-sm text-green-300">인증 코드 (Code)</div>
                                        <div className="text-5xl font-bold text-white my-2">{activeOrder.code}</div>
                                        <div className="text-xs text-gray-400">{activeOrder.text}</div>
                                    </div>
                                ) : (
                                    <div className="animate-pulse bg-gray-700/50 p-4 rounded mb-4">
                                        SMS 수신 대기 중...
                                    </div>
                                )}

                                <div className="flex gap-2 justify-center">
                                    <button onClick={finishOrder} className="bg-blue-600 px-4 py-2 rounded text-sm hover:bg-blue-500">완료 (Finish)</button>
                                    <button onClick={cancelOrder} className="bg-red-600 px-4 py-2 rounded text-sm hover:bg-red-500">취소 (Cancel)</button>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center text-gray-500 py-8">
                                진행 중인 주문이 없습니다.
                            </div>
                        )}
                    </div>

                    {/* Logs */}
                    <div className="bg-black p-4 rounded-lg border border-gray-800 h-64 overflow-y-auto font-mono text-xs">
                        {logs.map((log, i) => (
                            <div key={i} className="mb-1 text-gray-300 border-b border-gray-800 pb-1 last:border-0">{log}</div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
