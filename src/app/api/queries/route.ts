import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase-server';
import * as fs from 'fs';
import * as path from 'path';

// Student queries — saved as CSV in /data/queries.csv
// Also saved to Supabase for admin viewing

const CSV_PATH = path.join(process.cwd(), 'data', 'queries.csv');
const CSV_HEADER = 'Timestamp,Student Email,Module,Query\n';

function ensureCSVExists() {
  const dir = path.dirname(CSV_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(CSV_PATH)) fs.writeFileSync(CSV_PATH, CSV_HEADER, 'utf8');
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { studentEmail, moduleName, query } = body;

    if (!studentEmail || !moduleName || !query) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const timestamp = new Date().toISOString();

    // 1. Save to CSV file
    ensureCSVExists();
    const row = `${escapeCSV(timestamp)},${escapeCSV(studentEmail)},${escapeCSV(moduleName)},${escapeCSV(query)}\n`;
    fs.appendFileSync(CSV_PATH, row, 'utf8');

    // 2. Also save to Supabase for admin dashboard viewing
    const supabase = await createAdminSupabaseClient();
    await supabase.from('student_queries').insert({
      student_email: studentEmail,
      module_name: moduleName,
      query_text: query,
      created_at: timestamp,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Query save error:', err);
    return NextResponse.json({ error: 'Failed to save query' }, { status: 500 });
  }
}

export async function GET() {
  try {
    // Return all queries from Supabase for admin
    const supabase = await createAdminSupabaseClient();
    const { data, error } = await supabase
      .from('student_queries')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ queries: data || [] });
  } catch (err) {
    console.error('GET queries error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
