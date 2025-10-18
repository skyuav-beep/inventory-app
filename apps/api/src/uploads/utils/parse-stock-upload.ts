import { promises as fs } from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import type { Options } from 'csv-parse/sync';
import * as XLSX from 'xlsx';

export interface ParsedStockRow {
  code: string;
  quantity: number;
  date: Date;
  shipDate?: Date;
  orderDate?: Date;
  note?: string;
  productName?: string;
  unit?: string;
  ordererId?: string;
  ordererName?: string;
  recipientName?: string;
  recipientPhone?: string;
  recipientAddress?: string;
  recipientPostalCode?: string;
  customsNumber?: string;
  invoiceNumber?: string;
}

const PRODUCT_CODE_KEYS = ['code', 'product_code', '제품코드'];
const PRODUCT_NAME_KEYS = ['product_name', 'productName', '제품명'];
const UNIT_KEYS = ['unit', '단위'];
const QUANTITY_KEYS = ['quantity', '수량'];
const SHIP_DATE_KEYS = ['ship_date', 'shipDate', 'date', '출고일시'];
const ORDER_DATE_KEYS = ['order_date', 'orderDate', '주문일시'];
const NOTE_KEYS = ['note', '비고'];
const ORDERER_ID_KEYS = ['orderer_id', 'ordererId', '아이디'];
const ORDERER_NAME_KEYS = ['orderer_name', 'ordererName', '성명'];
const RECIPIENT_NAME_KEYS = ['recipient_name', 'recipientName', '수령자'];
const RECIPIENT_PHONE_KEYS = ['recipient_phone', 'recipientPhone', '전화번호', '연락처'];
const RECIPIENT_ADDRESS_KEYS = ['recipient_address', 'recipientAddress', '주소'];
const RECIPIENT_POSTAL_KEYS = ['recipient_postal_code', 'recipientPostalCode', '우편', '우편번호'];
const CUSTOMS_NUMBER_KEYS = ['customs_number', 'customsNumber', '통관번호'];
const INVOICE_NUMBER_KEYS = [
  'invoice_number',
  'invoiceNumber',
  '송장번호',
  'tracking_number',
  'trackingNumber',
];

type RawRecord = Record<string, unknown>;

export async function parseStockUpload(filePath: string): Promise<ParsedStockRow[]> {
  const ext = path.extname(filePath).toLowerCase();

  let records: RawRecord[] | null = null;

  if (ext === '.csv') {
    records = await parseCsv(filePath);
  } else if (ext === '.xlsx' || ext === '.xls') {
    records = parseExcel(filePath);
  }

  if (!records) {
    throw new Error('현재는 CSV 또는 Excel(xlsx) 업로드만 지원합니다.');
  }

  return records.map((row, index) => {
    const rowNo = index + 1;
    const code = extractRequiredString(row, PRODUCT_CODE_KEYS, rowNo, '제품 코드');
    const quantity = extractQuantity(row, rowNo);
    const shipDate = extractDate(row, SHIP_DATE_KEYS, rowNo, '출고일시');
    const orderDate = extractDate(row, ORDER_DATE_KEYS, rowNo, '주문일시');
    const note = extractOptionalString(row, NOTE_KEYS);
    const productName = extractOptionalString(row, PRODUCT_NAME_KEYS);
    const unit = extractOptionalString(row, UNIT_KEYS);
    const ordererId = extractOptionalString(row, ORDERER_ID_KEYS);
    const ordererName = extractOptionalString(row, ORDERER_NAME_KEYS);
    const recipientName = extractOptionalString(row, RECIPIENT_NAME_KEYS);
    const recipientPhone = extractOptionalString(row, RECIPIENT_PHONE_KEYS);
    const recipientAddress = extractOptionalString(row, RECIPIENT_ADDRESS_KEYS);
    const recipientPostalCode = extractOptionalString(row, RECIPIENT_POSTAL_KEYS);
    const customsNumber = extractOptionalString(row, CUSTOMS_NUMBER_KEYS);
    const invoiceNumber = extractOptionalString(row, INVOICE_NUMBER_KEYS);

    const effectiveDate = shipDate ?? new Date();

    return {
      code,
      quantity,
      date: effectiveDate,
      shipDate: shipDate ?? undefined,
      orderDate: orderDate ?? undefined,
      note: note ?? undefined,
      productName: productName ?? undefined,
      unit: unit ?? undefined,
      ordererId: ordererId ?? undefined,
      ordererName: ordererName ?? undefined,
      recipientName: recipientName ?? undefined,
      recipientPhone: recipientPhone ?? undefined,
      recipientAddress: recipientAddress ?? undefined,
      recipientPostalCode: recipientPostalCode ?? undefined,
      customsNumber: customsNumber ?? undefined,
      invoiceNumber: invoiceNumber ?? undefined,
    };
  });
}

async function parseCsv(filePath: string): Promise<RawRecord[]> {
  const content = await fs.readFile(filePath, 'utf8');
  const csvParse = parse as unknown as <T>(input: string, options?: Options) => T[];

  return csvParse<Record<string, string>>(content, {
    bom: true,
    columns: true,
    skipEmptyLines: true,
    trim: true,
  });
}

function parseExcel(filePath: string): RawRecord[] {
  const workbook = XLSX.readFile(filePath, {
    cellDates: true,
    dateNF: 'yyyy-mm-dd"T"hh:mm:ss',
  });
  const sheetName = workbook.SheetNames.at(0);

  if (!sheetName) {
    return [];
  }

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    return [];
  }

  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
    raw: false,
  });
}

function extractRequiredString(
  row: RawRecord,
  keys: string[],
  rowNo: number,
  label: string,
): string {
  const value = extractOptionalString(row, keys);
  if (!value) {
    throw new Error(`${rowNo}행: ${label}가 비어 있습니다.`);
  }
  return value;
}

function extractOptionalString(row: RawRecord, keys: string[]): string | undefined {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      const candidate = row[key];
      const normalized = normalizeString(candidate);
      if (normalized) {
        return normalized;
      }
    }
  }
  return undefined;
}

function extractQuantity(row: RawRecord, rowNo: number): number {
  const rawValue = extractCell(row, QUANTITY_KEYS);
  const numeric =
    typeof rawValue === 'number'
      ? rawValue
      : typeof rawValue === 'string'
        ? Number(rawValue.trim())
        : rawValue instanceof Date
          ? Number.NaN
          : Number(rawValue);

  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error(`${rowNo}행: 수량은 1 이상의 숫자여야 합니다.`);
  }

  return Math.trunc(numeric);
}

function extractDate(
  row: RawRecord,
  keys: string[],
  rowNo: number,
  label: string,
): Date | undefined {
  const rawValue = extractCell(row, keys);
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return undefined;
  }

  const parsed = parseDateValue(rawValue);
  if (!parsed) {
    throw new Error(`${rowNo}행: ${label} 형식이 잘못되었습니다.`);
  }

  return parsed;
}

function extractCell(row: RawRecord, keys: string[]): unknown {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      const value = row[key];
      if (value === undefined || value === null) {
        continue;
      }
      if (typeof value === 'string' && value.trim().length === 0) {
        continue;
      }
      return value;
    }
  }
  return undefined;
}

function normalizeString(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (typeof value === 'number') {
    if (Number.isNaN(value)) {
      return undefined;
    }
    return String(value);
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return undefined;
    }
    return value.toISOString();
  }

  const text = String(value).trim();
  return text.length > 0 ? text : undefined;
}

function parseDateValue(value: unknown): Date | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return undefined;
    }
    return value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    let serial = value;
    if (serial >= 60) {
      serial -= 1;
    }
    const excelEpoch = Date.UTC(1899, 11, 30);
    const milliseconds = Math.round(serial * 86400000);
    return new Date(excelEpoch + milliseconds);
  }

  const text = String(value).trim();
  if (!text) {
    return undefined;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return parsed;
}
