function escapeCsvValue(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function downloadCsvTemplate(filename: string, headers: string[], rows: Array<string[]> = []): void {
  const csvLines = [headers.map(escapeCsvValue).join(',')];
  rows.forEach((row) => {
    csvLines.push(row.map((cell) => escapeCsvValue(cell ?? '')).join(','));
  });

  const blob = new Blob([`\ufeff${csvLines.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    URL.revokeObjectURL(url);
  }
}
