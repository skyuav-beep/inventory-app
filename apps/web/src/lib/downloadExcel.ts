import { utils, writeFile } from 'xlsx';

type ExcelCell = string | number | boolean | Date | null | undefined;

export function downloadExcel(filename: string, headers: string[], rows: ExcelCell[][] = []) {
  const worksheet = utils.aoa_to_sheet([
    headers,
    ...rows.map((row) => row.map((cell) => cell ?? '')),
  ]);
  const workbook = utils.book_new();
  utils.book_append_sheet(workbook, worksheet, 'products');
  writeFile(workbook, filename);
}
