import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../../database/prisma.service';
import { ResourceNotFoundException } from '../../common/exceptions';
import PDFDocument from 'pdfkit';
import * as ExcelJS from 'exceljs';

interface TemplateComponent {
  id: string;
  type: 'table' | 'checklist' | 'text' | 'header' | 'divider';
  position: number;
  config: any;
}

type PDFDoc = InstanceType<typeof PDFDocument>;

@Injectable()
export class TemplateExportService {
  constructor(private prisma: PrismaService) { }

  // ==================== PDF EXPORT ====================

  async exportToPdf(templateId: string, res: Response) {
    const template = await this.getTemplateWithData(templateId);

    // Create PDF document - use landscape for tables with many columns
    // Use A3 for extremely wide tables
    const components: TemplateComponent[] = (template.settings as any)?.components || [];
    const maxTableColumns = components.reduce((max, c) => {
      if (c.type === 'table') {
        return Math.max(max, c.config?.headers?.length || c.config?.columns || 0);
      }
      return max;
    }, 0);

    const isWide = maxTableColumns > 5;
    const isUltraWide = maxTableColumns > 10;

    const doc = new PDFDocument({
      size: isUltraWide ? 'A3' : 'A4',
      layout: isWide ? 'landscape' : 'portrait',
      margins: { top: 50, bottom: 50, left: 40, right: 40 },
      bufferPages: true,
    });

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${this.sanitizeFilename(template.name)}.pdf"`,
    );

    // Pipe PDF to response
    doc.pipe(res);

    // Add template title
    doc
      .fontSize(22)
      .font('Helvetica-Bold')
      .fillColor('#1e293b')
      .text(template.name, { align: 'center' });

    doc.moveDown(0.3);

    // Add description if exists
    if (template.description) {
      doc
        .fontSize(11)
        .font('Helvetica')
        .fillColor('#64748b')
        .text(template.description, { align: 'center' });
    }

    doc.moveDown(0.8);

    // Add horizontal line
    this.drawHorizontalLine(doc);
    doc.moveDown(0.8);

    // Render components from settings
    const sortedComponents = components.sort((a, b) => a.position - b.position);
    for (let i = 0; i < sortedComponents.length; i++) {
      const component = sortedComponents[i];
      this.renderComponent(doc, component);

      // Only move down if there's a next component and we're not already at a new page
      if (i < sortedComponents.length - 1) {
        const remainingSpace = doc.page.height - doc.page.margins.bottom - doc.y;
        if (remainingSpace > 20) {
          doc.moveDown(0.5);
        } else if (remainingSpace > 0) {
          // If very little space, just jump to next page instead of moving down
          doc.addPage();
        }
      }
    }

    // If no components but has checklist items, render them as table
    if (components.length === 0 && template.checklistItems.length > 0) {
      this.renderChecklistItemsAsTable(doc, template.checklistItems);
    }

    doc.end();
  }

  // ==================== EXCEL EXPORT ====================

  async exportToExcel(templateId: string, res: Response) {
    const template = await this.getTemplateWithData(templateId);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Checklist System';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet(this.sanitizeFilename(template.name).slice(0, 31));

    // Get components
    const components: TemplateComponent[] = (template.settings as any)?.components || [];

    let currentRow = 1;

    // Add title
    worksheet.mergeCells(`A${currentRow}:G${currentRow}`);
    const titleCell = worksheet.getCell(`A${currentRow}`);
    titleCell.value = template.name;
    titleCell.font = { bold: true, size: 18, color: { argb: 'FF1e293b' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getRow(currentRow).height = 30;
    currentRow += 2;

    // Add description if exists
    if (template.description) {
      worksheet.mergeCells(`A${currentRow}:G${currentRow}`);
      const descCell = worksheet.getCell(`A${currentRow}`);
      descCell.value = template.description;
      descCell.font = { size: 11, color: { argb: 'FF64748b' } };
      descCell.alignment = { horizontal: 'center' };
      currentRow += 2;
    }

    // Render components
    for (const component of components.sort((a, b) => a.position - b.position)) {
      currentRow = this.renderComponentToExcel(worksheet, component, currentRow);
      currentRow += 1; // Gap between components
    }

    // If no components but has checklist items, render them
    if (components.length === 0 && template.checklistItems.length > 0) {
      this.renderChecklistItemsToExcel(worksheet, template.checklistItems, currentRow);
    }

    // Auto-fit columns (with max width)
    worksheet.columns.forEach((column) => {
      let maxLength = 10;
      column.eachCell?.({ includeEmpty: false }, (cell) => {
        const cellLength = cell.value ? String(cell.value).length : 0;
        if (cellLength > maxLength) {
          maxLength = Math.min(cellLength, 50);
        }
      });
      column.width = maxLength + 2;
    });

    // Set response headers
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${this.sanitizeFilename(template.name)}.xlsx"`,
    );

    await workbook.xlsx.write(res);
  }

  // ==================== HELPER METHODS ====================

  private async getTemplateWithData(templateId: string) {
    const template = await this.prisma.template.findUnique({
      where: { id: templateId, deletedAt: null },
      include: {
        templateType: true,
        checklistItems: {
          where: { deletedAt: null },
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!template) {
      throw new ResourceNotFoundException('Template', templateId);
    }

    return template;
  }

  // ==================== PDF RENDERING ====================

  private renderComponent(doc: PDFDoc, component: TemplateComponent) {
    switch (component.type) {
      case 'header':
        this.renderHeader(doc, component.config);
        break;
      case 'text':
        this.renderText(doc, component.config);
        break;
      case 'checklist':
        this.renderChecklist(doc, component.config);
        break;
      case 'table':
        this.renderTable(doc, component.config);
        break;
      case 'divider':
        this.drawHorizontalLine(doc, component.config?.style?.color);
        break;
    }
  }

  private renderHeader(doc: PDFDoc, config: any) {
    const fontSize = config.level === 1 ? 18 : config.level === 2 ? 15 : 13;
    const color = config.style?.color || '#0f172a';

    doc
      .fontSize(fontSize)
      .font('Helvetica-Bold')
      .fillColor(color)
      .text(config.text || 'Header', {
        align: (config.style?.align as any) || 'left',
      });
  }

  private renderText(doc: PDFDoc, config: any) {
    const fontSize = config.style?.fontSize || 11;
    const fontWeight = config.style?.fontWeight === 'bold' ? 'Helvetica-Bold' : 'Helvetica';
    const color = config.style?.color || '#334155';

    doc
      .fontSize(fontSize)
      .font(fontWeight)
      .fillColor(color)
      .text(config.content || '', {
        align: (config.style?.align as any) || 'left',
      });
  }

  private renderChecklist(doc: PDFDoc, config: any) {
    if (config.title) {
      doc.fontSize(13).font('Helvetica-Bold').fillColor('#1e293b').text(config.title);
      doc.moveDown(0.3);
    }

    const items = config.items || [];
    for (const item of items) {
      const checkbox = item.checked ? '[x]' : '[ ]';
      const textColor = item.checked ? '#22c55e' : '#334155';

      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor(textColor)
        .text(`${checkbox} ${item.text}`, { indent: 15 });
    }

    if (config.showProgress && items.length > 0) {
      const completed = items.filter((i: any) => i.checked).length;
      const percentage = Math.round((completed / items.length) * 100);
      doc.moveDown(0.3);
      doc
        .fontSize(9)
        .font('Helvetica')
        .fillColor('#64748b')
        .text(`Progress: ${completed}/${items.length} (${percentage}%)`);
    }
  }

  private renderTable(doc: PDFDoc, config: any) {
    const headers = config.headers || [];
    const data = config.data || [];
    const columnCount = headers.length || config.columns || 3;

    if (columnCount === 0) return;

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const startX = doc.page.margins.left;

    // Calculate column widths based on content
    const columnWidths = this.calculateColumnWidths(headers, data, columnCount, pageWidth);

    const cellPadding = 5;
    // Adapt font size based on column count
    let fontSize = 9;
    if (columnCount > 12) fontSize = 6;
    else if (columnCount > 8) fontSize = 7;
    else if (columnCount > 5) fontSize = 8;

    const headerFontSize = fontSize;
    const headerBgColor = config.style?.headerBgColor || '#f1f5f9';
    const borderColor = config.style?.borderColor || '#cbd5e1';

    let currentY = doc.y;

    // Draw header row
    if (headers.length > 0) {
      // Calculate header row height
      const headerHeight = this.calculateRowHeight(
        headers,
        columnWidths,
        cellPadding,
        headerFontSize,
        doc,
        true, // isHeader
      );

      // Check if we need a new page
      if (currentY + headerHeight > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        currentY = doc.page.margins.top;
      }

      // Header background
      doc.rect(startX, currentY, pageWidth, headerHeight).fill(headerBgColor);

      // Header text
      doc.fontSize(headerFontSize).font('Helvetica-Bold').fillColor('#1e293b');
      let xPos = startX;
      for (let i = 0; i < columnCount; i++) {
        const cellWidth = columnWidths[i];
        const text = headers[i] || `Col ${i + 1}`;
        const savedY = doc.y;
        doc.y = currentY + cellPadding;
        doc.text(text, xPos + cellPadding, currentY + cellPadding, {
          width: cellWidth - cellPadding * 2,
          align: 'left',
          lineBreak: true,
          lineGap: 0,
        });
        doc.y = savedY; // Prevent cursor advancement
        xPos += cellWidth;
      }

      // Draw header border
      doc.lineWidth(0.5).strokeColor(borderColor);
      doc.rect(startX, currentY, pageWidth, headerHeight).stroke();

      // Draw vertical lines for header
      xPos = startX;
      for (let i = 0; i < columnCount - 1; i++) {
        xPos += columnWidths[i];
        doc.moveTo(xPos, currentY).lineTo(xPos, currentY + headerHeight).stroke();
      }

      currentY += headerHeight;
      doc.y = currentY; // Sync cursor
    }

    // Draw data rows
    doc.fontSize(fontSize).font('Helvetica').fillColor('#334155');

    for (let rowIndex = 0; rowIndex < data.length; rowIndex++) {
      const row = Array.isArray(data[rowIndex]) ? data[rowIndex] : [];
      const rowTexts = row.map((cell: any) => String(cell || ''));

      // Calculate row height
      const rowHeight = this.calculateRowHeight(rowTexts, columnWidths, cellPadding, fontSize, doc);

      // Check if we need a new page
      if (currentY + rowHeight > doc.page.height - doc.page.margins.bottom) {
        // Only add a page if we have more rows to draw or if this row is too tall
        doc.addPage();
        currentY = doc.page.margins.top;

        // Re-draw header on new page
        if (headers.length > 0) {
          const headerHeight = this.calculateRowHeight(
            headers,
            columnWidths,
            cellPadding,
            headerFontSize,
            doc,
            true,
          );
          doc.rect(startX, currentY, pageWidth, headerHeight).fill(headerBgColor);
          doc.fontSize(headerFontSize).font('Helvetica-Bold').fillColor('#1e293b');
          let hxPos = startX;
          for (let i = 0; i < columnCount; i++) {
            const savedHeaderY = doc.y;
            doc.y = currentY + cellPadding;
            doc.text(headers[i] || '', hxPos + cellPadding, currentY + cellPadding, {
              width: columnWidths[i] - cellPadding * 2,
              align: 'left',
              lineGap: 0,
            });
            doc.y = savedHeaderY;
            hxPos += columnWidths[i];
          }
          doc.lineWidth(0.5).strokeColor(borderColor);
          doc.rect(startX, currentY, pageWidth, headerHeight).stroke();
          hxPos = startX;
          for (let i = 0; i < columnCount - 1; i++) {
            hxPos += columnWidths[i];
            doc.moveTo(hxPos, currentY).lineTo(hxPos, currentY + headerHeight).stroke();
          }
          currentY += headerHeight;
          doc.y = currentY;
          doc.fontSize(fontSize).font('Helvetica').fillColor('#334155');
        }
      }

      // Alternate row background
      if (rowIndex % 2 === 1) {
        doc.rect(startX, currentY, pageWidth, rowHeight).fill('#f8fafc');
      }

      // Draw cell text
      let xPos = startX;
      const rowStartY = currentY;
      for (let i = 0; i < columnCount; i++) {
        const cellWidth = columnWidths[i];
        const text = rowTexts[i] || '';
        doc.y = rowStartY + cellPadding;
        doc.fillColor('#334155').text(text, xPos + cellPadding, rowStartY + cellPadding, {
          width: cellWidth - cellPadding * 2,
          align: 'left',
          lineBreak: true,
          lineGap: 0,
        });
        xPos += cellWidth;
      }
      doc.y = rowStartY; // Reset cursor to row start

      // Draw row border
      doc.lineWidth(0.5).strokeColor(borderColor);
      doc.rect(startX, currentY, pageWidth, rowHeight).stroke();

      // Draw vertical lines
      xPos = startX;
      for (let i = 0; i < columnCount - 1; i++) {
        xPos += columnWidths[i];
        doc.moveTo(xPos, currentY).lineTo(xPos, currentY + rowHeight).stroke();
      }

      currentY += rowHeight;
    }

    // Sync doc.y with our local tracker
    doc.y = currentY;
  }

  private calculateColumnWidths(
    headers: string[],
    data: any[][],
    columnCount: number,
    totalWidth: number,
  ): number[] {
    const minWidth = 40;

    // 1. Initially assign widths based on relative header/content length
    const rawWidths: number[] = [];
    for (let i = 0; i < columnCount; i++) {
      let maxLen = headers[i]?.length || 5;
      // Sample some data rows for length
      const sampleRows = data.slice(0, 20);
      for (const row of sampleRows) {
        const cellVal = Array.isArray(row) ? String(row[i] || '') : '';
        maxLen = Math.max(maxLen, Math.min(cellVal.length, 100)); // Cap sample length
      }
      rawWidths.push(Math.max(maxLen, minWidth / 5));
    }

    // 2. Normalize and scale
    const totalRaw = rawWidths.reduce((a, b) => a + b, 0);
    const finalWidths = rawWidths.map(w => {
      const scaled = (w / totalRaw) * totalWidth;
      return Math.max(scaled, minWidth);
    });

    // 3. Re-normalize after minWidth enforcement
    const totalFinal = finalWidths.reduce((a, b) => a + b, 0);
    if (Math.abs(totalFinal - totalWidth) > 1) {
      const correctionScale = totalWidth / totalFinal;
      return finalWidths.map(w => w * correctionScale);
    }

    return finalWidths;
  }

  private calculateRowHeight(
    texts: string[],
    columnWidths: number[],
    cellPadding: number,
    fontSize: number,
    doc: PDFDoc,
    isHeader = false,
  ): number {
    doc.fontSize(fontSize).font(isHeader ? 'Helvetica-Bold' : 'Helvetica');
    let maxHeight = 0;

    for (let i = 0; i < texts.length; i++) {
      const text = texts[i] || '';
      const cellWidth = columnWidths[i] - cellPadding * 2;
      const height = doc.heightOfString(text, { width: cellWidth });
      maxHeight = Math.max(maxHeight, height);
    }

    return maxHeight + cellPadding * 2;
  }

  private renderChecklistItemsAsTable(doc: PDFDoc, items: any[]) {
    if (items.length === 0) return;

    // Get all unique keys from content
    const allKeys = new Set<string>();
    items.forEach((item) => {
      const content = item.content as Record<string, any>;
      if (content && typeof content === 'object') {
        Object.keys(content).forEach((key) => allKeys.add(key));
      }
    });

    const headers = Array.from(allKeys);
    if (headers.length === 0) {
      headers.push('Item', 'Status');
    }

    const data = items.map((item) => {
      const content = item.content as Record<string, any>;
      if (content && typeof content === 'object' && Object.keys(content).length > 0) {
        return headers.map((h) => content[h] || '');
      }
      const anyContent = content as any;
      return [anyContent?.text || anyContent?.name || 'Item', item.status || 'pending'];
    });

    this.renderTable(doc, { headers, data, columns: headers.length });
  }

  private drawHorizontalLine(doc: PDFDoc, color = '#e2e8f0') {
    const startX = doc.page.margins.left;
    const endX = doc.page.width - doc.page.margins.right;

    doc.strokeColor(color).lineWidth(1).moveTo(startX, doc.y).lineTo(endX, doc.y).stroke();
  }

  // ==================== EXCEL RENDERING ====================

  private renderComponentToExcel(
    worksheet: ExcelJS.Worksheet,
    component: TemplateComponent,
    startRow: number,
  ): number {
    switch (component.type) {
      case 'header':
        return this.renderHeaderToExcel(worksheet, component.config, startRow);
      case 'text':
        return this.renderTextToExcel(worksheet, component.config, startRow);
      case 'checklist':
        return this.renderChecklistToExcel(worksheet, component.config, startRow);
      case 'table':
        return this.renderTableToExcel(worksheet, component.config, startRow);
      case 'divider':
        return startRow + 1;
      default:
        return startRow;
    }
  }

  private renderHeaderToExcel(
    worksheet: ExcelJS.Worksheet,
    config: any,
    startRow: number,
  ): number {
    const fontSize = config.level === 1 ? 16 : config.level === 2 ? 14 : 12;

    worksheet.mergeCells(`A${startRow}:G${startRow}`);
    const cell = worksheet.getCell(`A${startRow}`);
    cell.value = config.text || 'Header';
    cell.font = { bold: true, size: fontSize, color: { argb: 'FF1e293b' } };
    cell.alignment = { horizontal: (config.style?.align as any) || 'left', vertical: 'middle' };
    worksheet.getRow(startRow).height = fontSize * 1.5;

    return startRow + 1;
  }

  private renderTextToExcel(worksheet: ExcelJS.Worksheet, config: any, startRow: number): number {
    worksheet.mergeCells(`A${startRow}:G${startRow}`);
    const cell = worksheet.getCell(`A${startRow}`);
    cell.value = config.content || '';
    cell.font = {
      bold: config.style?.fontWeight === 'bold',
      size: config.style?.fontSize || 11,
      color: { argb: 'FF334155' },
    };
    cell.alignment = { horizontal: (config.style?.align as any) || 'left', wrapText: true };

    return startRow + 1;
  }

  private renderChecklistToExcel(
    worksheet: ExcelJS.Worksheet,
    config: any,
    startRow: number,
  ): number {
    let row = startRow;

    if (config.title) {
      worksheet.mergeCells(`A${row}:G${row}`);
      const titleCell = worksheet.getCell(`A${row}`);
      titleCell.value = config.title;
      titleCell.font = { bold: true, size: 13, color: { argb: 'FF1e293b' } };
      row++;
    }

    const items = config.items || [];
    for (const item of items) {
      const checkbox = item.checked ? '✓' : '○';
      const statusCell = worksheet.getCell(`A${row}`);
      statusCell.value = checkbox;
      statusCell.font = { color: { argb: item.checked ? 'FF22c55e' : 'FF334155' } };
      statusCell.alignment = { horizontal: 'center' };

      worksheet.mergeCells(`B${row}:G${row}`);
      const textCell = worksheet.getCell(`B${row}`);
      textCell.value = item.text;
      textCell.font = { color: { argb: item.checked ? 'FF22c55e' : 'FF334155' } };
      row++;
    }

    if (config.showProgress && items.length > 0) {
      const completed = items.filter((i: any) => i.checked).length;
      const percentage = Math.round((completed / items.length) * 100);
      worksheet.mergeCells(`A${row}:G${row}`);
      const progressCell = worksheet.getCell(`A${row}`);
      progressCell.value = `Progress: ${completed}/${items.length} (${percentage}%)`;
      progressCell.font = { size: 10, color: { argb: 'FF64748b' }, italic: true };
      row++;
    }

    return row;
  }

  private renderTableToExcel(
    worksheet: ExcelJS.Worksheet,
    config: any,
    startRow: number,
  ): number {
    const headers = config.headers || [];
    const data = config.data || [];
    let row = startRow;

    // Add headers
    if (headers.length > 0) {
      for (let i = 0; i < headers.length; i++) {
        const cell = worksheet.getCell(row, i + 1);
        cell.value = headers[i];
        cell.font = { bold: true, color: { argb: 'FF1e293b' } };
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFf1f5f9' },
        };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFcbd5e1' } },
          left: { style: 'thin', color: { argb: 'FFcbd5e1' } },
          bottom: { style: 'thin', color: { argb: 'FFcbd5e1' } },
          right: { style: 'thin', color: { argb: 'FFcbd5e1' } },
        };
        cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
      }
      worksheet.getRow(row).height = 25;
      row++;
    }

    // Add data rows
    for (let r = 0; r < data.length; r++) {
      const rowData = Array.isArray(data[r]) ? data[r] : [];
      const colCount = headers.length || rowData.length;

      for (let c = 0; c < colCount; c++) {
        const cell = worksheet.getCell(row, c + 1);
        cell.value = rowData[c] || '';
        cell.font = { color: { argb: 'FF334155' } };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFe2e8f0' } },
          left: { style: 'thin', color: { argb: 'FFe2e8f0' } },
          bottom: { style: 'thin', color: { argb: 'FFe2e8f0' } },
          right: { style: 'thin', color: { argb: 'FFe2e8f0' } },
        };
        cell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };

        // Alternate row color
        if (r % 2 === 1) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFf8fafc' },
          };
        }
      }
      row++;
    }

    return row;
  }

  private renderChecklistItemsToExcel(
    worksheet: ExcelJS.Worksheet,
    items: any[],
    startRow: number,
  ): number {
    if (items.length === 0) return startRow;

    // Get all unique keys from content
    const allKeys = new Set<string>();
    items.forEach((item) => {
      const content = item.content as Record<string, any>;
      if (content && typeof content === 'object') {
        Object.keys(content).forEach((key) => allKeys.add(key));
      }
    });

    const headers = Array.from(allKeys);
    if (headers.length === 0) {
      headers.push('Item', 'Status');
    }

    const data = items.map((item) => {
      const content = item.content as Record<string, any>;
      if (content && typeof content === 'object' && Object.keys(content).length > 0) {
        return headers.map((h) => content[h] || '');
      }
      const anyContent = content as any;
      return [anyContent?.text || anyContent?.name || 'Item', item.status || 'pending'];
    });

    return this.renderTableToExcel(worksheet, { headers, data }, startRow);
  }

  private sanitizeFilename(name: string): string {
    return name.replace(/[^a-z0-9\-_\s]/gi, '_').trim();
  }
}
