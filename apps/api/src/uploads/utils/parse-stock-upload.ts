import { promises as fs } from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import type { Options } from 'csv-parse/sync';

interface StockRow {
  code: string;
  quantity: number;
  date: Date;
  note?: string;
}

export async function parseStockUpload(filePath: string): Promise<StockRow[]> {
  const ext = path.extname(filePath).toLowerCase();

  if (ext !== '.csv') {
    throw new Error('현재는 CSV 업로드만 지원합니다.');
  }

  const content = await fs.readFile(filePath, 'utf8');

  const csvParse = parse as unknown as <T>(input: string, options?: Options) => T[];

  const records = csvParse<Record<string, string>>(content, {
    bom: true,
    columns: true,
    skipEmptyLines: true,
    trim: true,
  });

  return records.map((row, index) => {
    const code = row.code?.trim();
    const quantityValue = Number(row.quantity);
    const dateValue = row.date ? new Date(row.date) : new Date();

    if (!code) {
      throw new Error(`${index + 1}행: 제품 코드가 비어 있습니다.`);
    }

    if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
      throw new Error(`${index + 1}행: 수량은 1 이상의 숫자여야 합니다.`);
    }

    return {
      code,
      quantity: quantityValue,
      date: dateValue,
      note: row.note?.trim() || undefined,
    };
  });
}
