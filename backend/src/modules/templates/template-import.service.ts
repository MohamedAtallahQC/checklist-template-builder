import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { DeletedResourceFoundException, ResourceAlreadyExistsException, BusinessException } from '../../common/exceptions';
import * as ExcelJS from 'exceljs';
import { v4 as uuidv4 } from 'uuid';

// Cell value can be a string or a checkbox object
export type TableCellValue = string | {
  type: 'checkbox';
  checked: boolean;
};

export interface ParsedTableData {
  title: string;
  headers: string[];
  rows: TableCellValue[][];
}

export interface ParsedChecklistSection {
  title: string;
  items: { text: string; checked: boolean }[];
}

export interface ParsedMarkdownData {
  title: string;
  type: 'table' | 'checklist' | 'mixed';
  tableData?: ParsedTableData;
  checklistSections?: ParsedChecklistSection[];
}

export interface ImportResult {
  success: boolean;
  templateId?: string;
  message: string;
  componentsCreated?: number;
  itemsCreated?: number;
}

@Injectable()
export class TemplateImportService {
  constructor(private prisma: PrismaService) { }

  /**
   * Get or create the System Templates project
   */
  private async getOrCreateSystemProject(createdBy: string): Promise<string> {
    // Use upsert to handle race conditions where multiple requests
    // might try to create the project simultaneously
    const systemProject = await this.prisma.project.upsert({
      where: { slug: 'system-templates' },
      update: {}, // No update needed if it exists
      create: {
        name: 'System Templates',
        slug: 'system-templates',
        description: 'Container for default system templates',
        createdBy,
        isArchived: false,
      },
    });

    return systemProject.id;
  }

  /**
   * Import template from Excel file
   */
  async importFromExcel(
    file: Express.Multer.File,
    options: {
      projectId?: string;
      folderId?: string;
      templateName?: string;
      templateTypeId?: string;
      createdBy: string;
      restoreDeleted?: boolean;
    },
  ): Promise<ImportResult> {
    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(Buffer.from(file.buffer) as any);

      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        throw new BadRequestException('Excel file has no worksheets');
      }

      const tableData = this.parseExcelWorksheet(worksheet);
      return await this.createTemplateFromTableData(tableData, options, 'excel');
    } catch (error) {
      if (error instanceof BusinessException || error instanceof BadRequestException) throw error;
      throw new BadRequestException(`Failed to parse Excel file: ${error.message} `);
    }
  }

  /**
   * Import template from CSV file
   */
  async importFromCsv(
    file: Express.Multer.File,
    options: {
      projectId?: string;
      folderId?: string;
      templateName?: string;
      templateTypeId?: string;
      createdBy: string;
      restoreDeleted?: boolean;
      delimiter?: string;
    },
  ): Promise<ImportResult> {
    try {
      const content = file.buffer.toString('utf-8');
      const tableData = this.parseCsvContent(content, options.delimiter || ',');

      // Use filename as default template name if not provided
      const templateName = options.templateName ||
        file.originalname.replace(/\.[^/.]+$/, '') ||
        'Imported CSV';

      return await this.createTemplateFromTableData(
        { ...tableData, title: templateName },
        { ...options, templateName },
        'csv',
      );
    } catch (error) {
      if (error instanceof BusinessException || error instanceof BadRequestException) throw error;
      throw new BadRequestException(`Failed to parse CSV file: ${error.message} `);
    }
  }

  /**
   * Parse CSV content into table data
   */
  private parseCsvContent(content: string, delimiter: string = ','): ParsedTableData {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < content.length; i++) {
      const char = content[i];
      const nextChar = content[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          currentField += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote mode
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !inQuotes) {
        currentRow.push(currentField.trim());
        if (currentRow.length > 0 || currentField.trim() !== '') {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
        if (char === '\r') i++; // Skip \n
      } else if (char === '\r' && !inQuotes) {
        // Handle standalone \r if any
        currentRow.push(currentField.trim());
        if (currentRow.length > 0 || currentField.trim() !== '') {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }

    // Add last field/row if any
    if (currentField.trim() !== '' || currentRow.length > 0) {
      currentRow.push(currentField.trim());
      rows.push(currentRow);
    }

    if (rows.length === 0) {
      throw new BadRequestException('CSV file is empty');
    }

    // Filter out completely empty rows (which can happen at the end of file)
    const filteredRows = rows.filter(row => row.some(cell => cell.trim() !== ''));

    if (filteredRows.length === 0) {
      throw new BadRequestException('CSV file has no data');
    }

    const headers = filteredRows[0];
    const dataRows = filteredRows.slice(1).map(row => {
      const paddedRow = [...row];
      // Pad or truncate row to match headers length
      while (paddedRow.length < headers.length) {
        paddedRow.push('');
      }
      const finalRow = paddedRow.slice(0, headers.length);
      return finalRow.map((cell, index) => this.parseCellValue(cell, headers[index]));
    });

    return {
      title: 'Imported CSV',
      headers,
      rows: dataRows,
    };
  }


  /**
   * Import template from Markdown content
   * Supports both tables and checklists
   */
  async importFromMarkdown(
    content: string,
    options: {
      projectId?: string;
      folderId?: string;
      templateName?: string;
      templateTypeId?: string;
      createdBy: string;
      restoreDeleted?: boolean;
    },
  ): Promise<ImportResult> {
    try {
      const parsedData = this.parseMarkdownContent(content);

      if (parsedData.type === 'table' && parsedData.tableData) {
        return await this.createTemplateFromTableData(parsedData.tableData, options, 'markdown');
      } else if (
        (parsedData.type === 'checklist' || parsedData.type === 'mixed') &&
        parsedData.checklistSections
      ) {
        return await this.createTemplateFromChecklist(parsedData, options);
      }

      throw new BadRequestException('No valid content found in Markdown');
    } catch (error) {
      if (error instanceof BusinessException || error instanceof BadRequestException) throw error;
      throw new BadRequestException(`Failed to parse Markdown: ${error.message} `);
    }
  }

  /**
   * Parse Markdown content - detects tables or checklists
   */
  private parseMarkdownContent(content: string): ParsedMarkdownData {
    const lines = content.split('\n');

    // Check if content has tables (pipe characters with separator row)
    const hasPipe = lines.some((line) => line.includes('|'));
    const hasSeparator = lines.some((l) => /^\|?\s*[-:]+\s*\|/.test(l.trim()));
    const hasTable = hasPipe && hasSeparator;

    // Check if content has checklists
    const hasChecklist = lines.some((line) => /^\s*-\s*\[[\sx]\]/i.test(line));

    if (hasTable && !hasChecklist) {
      return {
        title: this.extractTitle(content),
        type: 'table',
        tableData: this.parseMarkdownTable(content),
      };
    } else if (hasChecklist) {
      return {
        title: this.extractTitle(content),
        type: hasTable ? 'mixed' : 'checklist',
        checklistSections: this.parseMarkdownChecklist(content),
      };
    }

    throw new BadRequestException(
      'No table or checklist found in Markdown content. ' +
      'Use | for tables or - [ ] for checklists.',
    );
  }

  /**
   * Extract main title from markdown
   */
  private extractTitle(content: string): string {
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('#')) {
        let title = trimmed.replace(/^#+\s*/, '').trim();
        // Remove emoji if present at the start
        title = title.replace(/^[\u{1F300}-\u{1F9FF}]+\s*/u, '').trim();
        return title;
      }
    }
    return 'Imported Data';
  }

  /**
   * Parse Markdown checklist format
   * Supports:
   * # Section Title
   * - [ ] Unchecked item
   * - [x] Checked item
   */
  private parseMarkdownChecklist(content: string): ParsedChecklistSection[] {
    const lines = content.split('\n');
    const sections: ParsedChecklistSection[] = [];
    let currentSection: ParsedChecklistSection | null = null;

    for (const line of lines) {
      const trimmed = line.trim();

      // New section header
      if (trimmed.startsWith('#')) {
        // Save previous section if it has items
        if (currentSection && currentSection.items.length > 0) {
          sections.push(currentSection);
        }

        let title = trimmed.replace(/^#+\s*/, '').trim();
        // Remove emoji if present at the start
        title = title.replace(/^[\u{1F300}-\u{1F9FF}]+\s*/u, '').trim();

        currentSection = {
          title,
          items: [],
        };
        continue;
      }

      // Checklist item: - [ ] or - [x]
      const checklistMatch = trimmed.match(/^-\s*\[([\sx])\]\s*(.+)/i);
      if (checklistMatch) {
        const checked = checklistMatch[1].toLowerCase() === 'x';
        const text = checklistMatch[2].trim();

        if (!currentSection) {
          currentSection = {
            title: 'Checklist',
            items: [],
          };
        }

        currentSection.items.push({ text, checked });
      }
    }

    // Don't forget the last section
    if (currentSection && currentSection.items.length > 0) {
      sections.push(currentSection);
    }

    if (sections.length === 0) {
      throw new BadRequestException('No checklist items found in Markdown content');
    }

    return sections;
  }

  /**
   * Parse Excel worksheet to extract table data
   */
  private parseExcelWorksheet(worksheet: ExcelJS.Worksheet): ParsedTableData {
    const headers: string[] = [];
    const rows: TableCellValue[][] = [];
    let title = worksheet.name || 'Imported Data';

    worksheet.eachRow((row, rowNumber) => {
      const values = row.values as any[];
      // Remove first empty element (ExcelJS uses 1-based indexing)
      const cleanValues = values.slice(1).map((v) => this.cellToString(v));

      if (rowNumber === 1) {
        // First row is headers
        headers.push(...cleanValues);
      } else {
        // Data rows - parse each cell for checkboxes
        const parsedRow = cleanValues.map((cell, index) => this.parseCellValue(cell, headers[index]));
        rows.push(parsedRow);
      }
    });

    if (headers.length === 0) {
      throw new BadRequestException('Excel file has no header row');
    }

    return { title, headers, rows };
  }

  /**
   * Parse a cell value - detect checkbox patterns [x] or [ ]
   */
  private parseCellValue(cell: string, headerName?: string): TableCellValue {
    const trimmed = cell.trim();

    // If the column header contains "checkbox", treat values as boolean
    if (headerName && /checkbox/i.test(headerName)) {
      const lowerValue = trimmed.toLowerCase();
      if (lowerValue === 'yes' || lowerValue === 'true' || lowerValue === '1' || lowerValue === 'checked') {
        return { type: 'checkbox', checked: true };
      }
      if (lowerValue === 'no' || lowerValue === 'false' || lowerValue === '0' || lowerValue === 'unchecked' || lowerValue === '') {
        return { type: 'checkbox', checked: false };
      }
    }

    // Check for checkbox patterns: [x], [X], [ ]
    const checkboxMatch = trimmed.match(/^\[([xX\s])\]$/);
    if (checkboxMatch) {
      return {
        type: 'checkbox',
        checked: checkboxMatch[1].toLowerCase() === 'x',
      };
    }

    // Check for common boolean representations (case-insensitive)
    const lowerValue = trimmed.toLowerCase();
    if (lowerValue === 'yes' || lowerValue === 'true') {
      return { type: 'checkbox', checked: true };
    }
    if (lowerValue === 'no' || lowerValue === 'false') {
      return { type: 'checkbox', checked: false };
    }

    return trimmed;
  }

  /**
   * Parse Markdown table format
   * | Header 1 | Header 2 |
   * |----------|----------|
   * | Data 1   | Data 2   |
   *
   * Supports checkbox cells: [x] for checked, [ ] for unchecked
   */
  private parseMarkdownTable(content: string): ParsedTableData {
    const lines = content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line);

    let title = 'Imported Data';
    const headers: string[] = [];
    const rows: TableCellValue[][] = [];
    let foundHeader = false;
    let foundSeparator = false;

    for (const line of lines) {
      // Extract title from # heading
      if (line.startsWith('#')) {
        title = line.replace(/^#+\s*/, '').trim();
        // Remove emoji if present at the start
        title = title.replace(/^[\u{1F300}-\u{1F9FF}]+\s*/u, '').trim();
        continue;
      }

      // Skip non-table lines
      if (!line.includes('|')) {
        continue;
      }

      // Parse table row
      const cells = line
        .split('|')
        .map((cell) => cell.trim())
        .filter((cell) => cell !== '');

      // Skip separator row (contains only dashes and colons)
      if (cells.every((cell) => /^[-:]+$/.test(cell))) {
        foundSeparator = true;
        continue;
      }

      if (!foundHeader) {
        headers.push(...cells);
        foundHeader = true;
      } else if (foundSeparator) {
        // Ensure row has same number of columns as headers
        while (cells.length < headers.length) {
          cells.push('');
        }
        // Parse each cell value (detect checkboxes)
        const parsedCells = cells.slice(0, headers.length).map((cell, index) => this.parseCellValue(cell, headers[index]));
        rows.push(parsedCells);
      }
    }

    if (headers.length === 0) {
      throw new BadRequestException('No table found in Markdown content');
    }

    return { title, headers, rows };
  }

  /**
   * Create template from checklist data
   */
  private async createTemplateFromChecklist(
    data: ParsedMarkdownData,
    options: {
      projectId?: string;
      folderId?: string;
      templateName?: string;
      templateTypeId?: string;
      createdBy: string;
      restoreDeleted?: boolean;
    },
  ): Promise<ImportResult> {
    // Get or create project (use system-templates if no projectId provided)
    let projectId = options.projectId;
    if (!projectId) {
      projectId = await this.getOrCreateSystemProject(options.createdBy);
    }

    // Get template type
    let templateTypeId = options.templateTypeId;
    if (!templateTypeId) {
      let defaultType = await this.prisma.templateType.findFirst({
        where: { name: 'checklist' },
      });
      if (!defaultType) {
        defaultType = await this.prisma.templateType.findFirst({
          where: { isActive: true },
        });
      }
      if (!defaultType) {
        throw new BadRequestException('No template type available. Please create one first.');
      }
      templateTypeId = defaultType.id;
    }

    const templateName = options.templateName || data.title || 'Imported Checklist';
    const folderId = options.folderId || null;

    // Check for existing template with same name in same project/folder (including deleted ones)
    const existing = await this.prisma.template.findFirst({
      where: {
        projectId,
        folderId,
        name: templateName,
        ['_bypassSoftDelete' as any]: true,
      } as any,
    });

    if (existing) {
      if (existing.deletedAt) {
        if (options.restoreDeleted) {
          // Soft delete existing checklist items for this template
          await this.prisma.checklistItem.deleteMany({
            where: { templateId: existing.id }
          });
          // Restore the template
          await this.prisma.template.update({
            where: { id: existing.id },
            data: {
              deletedAt: null,
              templateTypeId,
              createdBy: options.createdBy,
            },
          });
        } else {
          throw new DeletedResourceFoundException('Template', 'name', templateName);
        }
      } else {
        throw new ResourceAlreadyExistsException('Template', 'name', templateName);
      }
    }

    // Build components array
    const components: any[] = [];
    let componentPosition = 0;

    // Add main title header
    components.push({
      id: `component - ${uuidv4()} `,
      type: 'header',
      position: componentPosition++,
      config: {
        text: data.title,
        level: 1,
        style: {
          color: '#0f172a',
          align: 'left',
        },
      },
    });

    // Add each checklist section
    for (const section of data.checklistSections || []) {
      // Add section as checklist component
      components.push({
        id: `component - ${uuidv4()} `,
        type: 'checklist',
        position: componentPosition++,
        config: {
          title: section.title,
          items: section.items.map((item) => ({
            id: `item - ${uuidv4()} `,
            text: item.text,
            checked: item.checked,
          })),
          showProgress: true,
        },
      });
    }

    // Determine if this is a template or an instance
    // If projectId was explicitly provided, it's an instance (not a global template)
    const isTemplate = !options.projectId;

    // Create or update template
    const template = options.restoreDeleted && existing ? await this.prisma.template.update({
      where: { id: existing.id },
      data: {
        name: templateName,
        description: `Imported checklist on ${new Date().toLocaleDateString()}`,
        settings: {
          components,
        },
        columnConfig: [],
        folderId,
        isTemplate,
      }
    }) : await this.prisma.template.create({
      data: {
        projectId,
        folderId,
        templateTypeId,
        name: templateName,
        description: `Imported checklist on ${new Date().toLocaleDateString()}`,
        settings: {
          components,
        },
        columnConfig: [],
        createdBy: options.createdBy,
        isTemplate,
      },
    });

    // Calculate total items
    const totalItems = (data.checklistSections || []).reduce(
      (sum, section) => sum + section.items.length,
      0,
    );

    // Create checklist items in database for tracking
    let itemPosition = 0;
    for (const section of data.checklistSections || []) {
      for (const item of section.items) {
        await this.prisma.checklistItem.create({
          data: {
            templateId: template.id,
            position: itemPosition++,
            content: {
              section: section.title,
              text: item.text,
              checked: item.checked,
            },
            createdBy: options.createdBy,
          },
        });
      }
    }

    return {
      success: true,
      templateId: template.id,
      message: `Successfully imported checklist "${templateName}" with ${data.checklistSections?.length || 0} sections`,
      componentsCreated: components.length,
      itemsCreated: totalItems,
    };
  }

  /**
   * Create template from parsed table data
   */
  private async createTemplateFromTableData(
    data: ParsedTableData,
    options: {
      projectId?: string;
      folderId?: string;
      templateName?: string;
      templateTypeId?: string;
      createdBy: string;
      restoreDeleted?: boolean;
    },
    source: 'excel' | 'csv' | 'markdown',
  ): Promise<ImportResult> {
    // Get or create project (use system-templates if no projectId provided)
    let projectId = options.projectId;
    if (!projectId) {
      projectId = await this.getOrCreateSystemProject(options.createdBy);
    }

    // Get template type (use provided or find default)
    let templateTypeId = options.templateTypeId;
    if (!templateTypeId) {
      // Find or create a default template type for imports
      let defaultType = await this.prisma.templateType.findFirst({
        where: { name: 'imported' },
      });
      if (!defaultType) {
        defaultType = await this.prisma.templateType.findFirst({
          where: { isActive: true },
        });
      }
      if (!defaultType) {
        throw new BadRequestException('No template type available. Please create one first.');
      }
      templateTypeId = defaultType.id;
    }

    // Create table component
    const tableComponent = {
      id: `component - ${uuidv4()} `,
      type: 'table' as const,
      position: 1,
      config: {
        rows: data.rows.length,
        columns: data.headers.length,
        headers: data.headers,
        data: data.rows,
        style: {
          headerBgColor: '#f1f5f9',
          cellBgColor: '#ffffff',
          borderColor: '#e2e8f0',
          textAlign: 'left',
        },
      },
    };

    // Create header component for the title
    const headerComponent = {
      id: `component - ${uuidv4()} `,
      type: 'header' as const,
      position: 0,
      config: {
        text: data.title,
        level: 1,
        style: {
          color: '#0f172a',
          align: 'left',
        },
      },
    };

    // Create template
    const templateName = options.templateName || data.title || `Imported from ${source} `;
    const folderId = options.folderId || null;

    // Check for existing template with same name in same project/folder (including deleted ones)
    const existing = await this.prisma.template.findFirst({
      where: {
        projectId,
        folderId,
        name: templateName,
        ['_bypassSoftDelete' as any]: true,
      } as any,
    });

    if (existing) {
      if (existing.deletedAt) {
        if (options.restoreDeleted) {
          // Soft delete existing checklist items for this template
          await this.prisma.checklistItem.deleteMany({
            where: { templateId: existing.id }
          });
          // Restore the template
          await this.prisma.template.update({
            where: { id: existing.id },
            data: {
              deletedAt: null,
              templateTypeId,
              createdBy: options.createdBy,
            },
          });
        } else {
          throw new DeletedResourceFoundException('Template', 'name', templateName);
        }
      } else {
        throw new ResourceAlreadyExistsException('Template', 'name', templateName);
      }
    }

    // Determine if this is a template or an instance
    // If projectId was explicitly provided, it's an instance (not a global template)
    const isTemplate = !options.projectId;

    // Create or update template
    const template = options.restoreDeleted && existing ? await this.prisma.template.update({
      where: { id: existing.id },
      data: {
        name: templateName,
        description: `Imported from ${source} file on ${new Date().toLocaleDateString()}`,
        settings: {
          components: [headerComponent, tableComponent],
        },
        columnConfig: [],
        folderId,
        isTemplate,
      }
    }) : await this.prisma.template.create({
      data: {
        projectId,
        folderId,
        templateTypeId,
        name: templateName,
        description: `Imported from ${source} file on ${new Date().toLocaleDateString()}`,
        settings: {
          components: [headerComponent, tableComponent],
        },
        columnConfig: [],
        createdBy: options.createdBy,
        isTemplate,
      },
    });

    // Also create checklist items from table rows for tracking
    let itemsCreated = 0;
    for (let i = 0; i < data.rows.length; i++) {
      const row = data.rows[i];
      // Create a checklist item with all row data stored in content
      const content: Record<string, any> = {};
      data.headers.forEach((header, idx) => {
        const cellValue = row[idx];
        // Preserve checkbox objects or convert to string
        if (typeof cellValue === 'object' && cellValue?.type === 'checkbox') {
          content[header] = cellValue;
        } else {
          content[header] = cellValue || '';
        }
      });

      await this.prisma.checklistItem.create({
        data: {
          templateId: template.id,
          position: i,
          content: content,
          createdBy: options.createdBy,
        },
      });
      itemsCreated++;
    }

    return {
      success: true,
      templateId: template.id,
      message: `Successfully imported ${source} file as template "${templateName}"`,
      componentsCreated: 2,
      itemsCreated,
    };
  }

  /**
   * Convert Excel cell value to string
   */
  private cellToString(value: any): string {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'object') {
      // Handle rich text
      if (value.richText) {
        return value.richText.map((rt: any) => rt.text).join('');
      }
      // Handle formula result
      if (value.result !== undefined) {
        return String(value.result);
      }
      // Handle date
      if (value instanceof Date) {
        return value.toLocaleDateString();
      }
      return JSON.stringify(value);
    }
    return String(value);
  }

  /**
   * Preview imported data without creating template
   */
  async previewImport(
    file: Express.Multer.File | null,
    markdownContent: string | null,
  ): Promise<ParsedTableData | ParsedMarkdownData> {
    if (file) {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(Buffer.from(file.buffer) as any);
      const worksheet = workbook.worksheets[0];
      if (!worksheet) {
        throw new BadRequestException('Excel file has no worksheets');
      }
      return this.parseExcelWorksheet(worksheet);
    }

    if (markdownContent) {
      return this.parseMarkdownContent(markdownContent);
    }

    throw new BadRequestException('No file or markdown content provided');
  }
}
