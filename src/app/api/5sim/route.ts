import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// API Key should be securely loaded from env, or fallback for this demo
const API_KEY = process.env.FIVESIM_API_KEY || 'eyJhbGciOiJSUzUxMiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3OTcyMzQ1MDcsImlhdCI6MTc2NTY5ODUwNywicmF5IjoiZTE1ZWQ3OTZlNDEyZDMwMjJjZDhlZTFlNzU4YjIwZjYiLCJzdWIiOjM2NjUxNTB9.Sqo0W1kFBzqfk0u6VkztFKEOScKQsjUYJ6dmEy6z2ghQrpw1-JKaLa0zxyZ9uGWG6IScrMHF6cdSNQAwPSppG_OaIe32jPuZW3oP2Hqeh8xdj73rxm1Y2HgqQpspl592XAUgV3VzU1ILXQOKLUqQC5jNDwptAy2K_19-YWwJWQ368qcXptZgx028tIePm-rFWybJZWiF5e1_SjGgLbMlVrtWKGXJ6DHmItp3jQRqfFSx-2GqXYSFJCCabUyNrjXxt6CmdAMOVkyi0oXzFLZfcPRkTS4nsZ94TZMz62XDu8Gky7F1-_2skRbojQKYiUcx5lkDF4YbWTjBZN0BA0s3fQ';
const BASE_URL = 'https://5sim.net/v1';

async function fetch5Sim(endpoint: string, method: string = 'GET') {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
        method,
        headers: {
            'Authorization': `Bearer ${API_KEY}`,
            'Accept': 'application/json'
        }
    });

    // Handle plain text responses (often errors or simple strings)
    const text = await res.text();
    try {
        return { status: res.status, data: JSON.parse(text) };
    } catch {
        return { status: res.status, data: text };
    }
}

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'countries') {
        try {
            // Read from the local JSON file we generated earlier
            const jsonPath = path.join(process.cwd(), 'countries_list.json');
            const data = fs.readFileSync(jsonPath, 'utf8');
            return NextResponse.json(JSON.parse(data));
        } catch (e) {
            return NextResponse.json({ error: 'Failed to load countries' }, { status: 500 });
        }
    }

    if (action === 'products') {
        try {
            const jsonPath = path.join(process.cwd(), 'products_list.json');
            const data = fs.readFileSync(jsonPath, 'utf8');
            return NextResponse.json(JSON.parse(data));
        } catch (e) {
            return NextResponse.json({ error: 'Failed to load products' }, { status: 500 });
        }
    }

    if (action === 'profile') {
        const result = await fetch5Sim('/user/profile');
        return NextResponse.json(result.data, { status: result.status });
    }

    if (action === 'check_order') {
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
        const result = await fetch5Sim(`/user/check/${id}`);
        return NextResponse.json(result.data, { status: result.status });
    }

    if (action === 'price') {
        const country = searchParams.get('country');
        const product = searchParams.get('product');
        if (!product) return NextResponse.json({ error: 'Missing product' }, { status: 400 });

        // If country is provided, get specific, otherwise get global for product
        const query = country
            ? `/guest/prices?country=${country}&product=${product}`
            : `/guest/prices?product=${product}`;

        const result = await fetch5Sim(query);
        return NextResponse.json(result.data, { status: result.status });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

export async function POST(request: Request) {
    const body = await request.json();
    const { action } = body;

    if (action === 'buy_number') {
        const { country, product, operator } = body;
        const result = await fetch5Sim(`/user/buy/activation/${country}/${operator || 'any'}/${product}`);
        return NextResponse.json(result.data, { status: result.status });
    }

    if (action === 'finish_order') {
        const { id } = body;
        const result = await fetch5Sim(`/user/finish/${id}`);
        return NextResponse.json(result.data, { status: result.status });
    }

    if (action === 'cancel_order') {
        const { id } = body;
        const result = await fetch5Sim(`/user/cancel/${id}`);
        return NextResponse.json(result.data, { status: result.status });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
